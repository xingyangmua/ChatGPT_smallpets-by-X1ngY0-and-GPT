const path=require('node:path');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {execFile}=require('node:child_process');
const {createCustomizationStore}=require('./customization-store.cjs');
function createCustomizationController({BrowserWindow,dialog,nativeImage,ipcMain,dataDir,root,origin,getWidgetWindow,onChanged=()=>{},fixture=false,backgroundApply=null,backgroundPeek=null,getWidgetEnabled=()=>true,onWidgetEnabled=()=>{}}){
 const store=createCustomizationStore(dataDir,{decode:bytes=>nativeImage.createFromBuffer(bytes)}),install=path.resolve(root,'..');let panel=null,panelKind='client',pending=false,clientControls=null;
 const disconnectedMessage='背景设置已保存，等待客户端连接后自动应用；当前窗口未开放背景连接，请安全退出客户端（含托盘）后从 ChatGPT (Work Pet) 打开。';
 const run=(exe,args,options={})=>new Promise((resolve,reject)=>execFile(exe,args,{windowsHide:true,timeout:45000,maxBuffer:4*1024*1024,...options},(error,stdout)=>error?reject(Error('客户端背景暂未连接，已保留原背景')):resolve(stdout)));
 async function peek(){if(fixture&&!backgroundPeek)return {image:0,imageId:'preset-3575',brightness:.9,mask:.34,blur:0,rotation:false,enabled:true};if(backgroundPeek)return backgroundPeek();const text=await run(process.execPath,[path.join(install,'background-engine/scripts/pet-client-api.mjs'),dataDir,'read'],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});return JSON.parse(text);}
 async function applyBackground(){if(backgroundApply)return backgroundApply();if(fixture)return;await run(process.execPath,[path.join(install,'background-engine/scripts/pet-client-api.mjs'),dataDir,'wait'],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});}
 async function restoreClient(previous){if(!previous||fixture)return;await run(process.execPath,[path.join(install,'background-engine/scripts/pet-client-api.mjs'),dataDir,'restore',JSON.stringify(previous)],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});}
 function state(){const value=store.publicState();value.client.controls=clientControls;value.client.connected=clientControls!==null;value.companion={enabled:getWidgetEnabled()};return value;}
 function notify(selectSlot){const value=state(),widget=getWidgetWindow();if(widget&&!widget.isDestroyed())widget.webContents.send('mutsumi-customization',{...value,selectSlot});if(panel&&!panel.isDestroyed())panel.webContents.send('mutsumi-customizer-state',value);onChanged(value);return value;}
 async function reload(){const value=notify();try{await applyBackground();return {ok:true,state:value};}catch{return {ok:false,state:value,error:'挂件图片已更新，客户端背景暂未连接'};}}
 async function change(command,selectedFile){
  if(!command||typeof command!=='object')throw Error('图片操作无效');
  const action=command.action,kind=command.kind,slot=command.slot;
  if(action==='state'){if(panelKind==='client')try{clientControls=await peek();}catch{clientControls=null;}return {ok:true,state:state(),...(!clientControls&&panelKind==='client'?{message:'客户端背景未连接；可以先保存图片，连接后自动应用。'}:{})};}
  if(action==='companion'){if(typeof command.enabled!=='boolean'||pending)throw Error('挂件开关暂不可用');await onWidgetEnabled(command.enabled);return {ok:true,state:notify()};}
  if(!['client','widget','bubble'].includes(kind)&&action!=='opacity')throw Error('图片操作无效');
  if(kind==='widget'&&action!=='reset-all'&&(!Number.isInteger(slot)||slot<0||slot>3))throw Error('请选择一个有效表情');
  if(pending)throw Error('上一个图片操作正在处理，请稍等');pending=true;
  try{
   if(action==='visual'&&kind==='client'){
    const input=command.value,keys=Object.keys(input||{});if(!keys.length||keys.some(k=>!['brightness','mask','blur','rotation','enabled'].includes(k)))throw Error('背景设置无效');
    for(const k of keys){if(['rotation','enabled'].includes(k)){if(typeof input[k]!=='boolean')throw Error('背景设置无效');}else{const [min,max]=k==='brightness'?[.4,1.4]:k==='mask'?[0,.85]:[0,15];if(!Number.isFinite(input[k])||input[k]<min||input[k]>max)throw Error('背景设置超出范围');}}
    const previous=await peek();await restoreClient({...previous,...input});clientControls=fixture?{...previous,...input}:await peek();return {ok:true,state:state()};
   }
   let source=selectedFile;
   if(action==='choose'&&!source){
    const result=await dialog.showOpenDialog(panel||getWidgetWindow(),{title:kind==='client'?'选择客户端背景':kind==='bubble'?'选择气泡底图':'选择挂件表情',properties:['openFile'],filters:[{name:'图片',extensions:['png','jpg','jpeg','webp']}]});
    if(result.canceled||!result.filePaths[0])return {ok:true,cancelled:true,state:state()};source=result.filePaths[0];
   }
   const previous=store.read(),next=structuredClone(previous);let clientBefore=null;
   if(kind==='client')try{clientBefore=await peek();clientControls=clientBefore;}catch{clientControls=null;}
   if(action==='choose'){
    const image=await store.importFile(source,kind);
    if(kind==='client'){next.client.images=next.client.images.filter(a=>a.id!==image.id);next.client.images.push(image);if(next.client.images.length>12)next.client.images.shift();next.client.selectedId=image.id;}
    else if(kind==='widget')next.widget.slots[slot]=image;else next.widget.bubble=image;
   }else if(action==='select'&&kind==='client'){
    if(![...store.presets,...next.client.images].some(a=>a.id===command.id))throw Error('所选图片已不可用');next.client.selectedId=command.id;
   }else if(action==='reset'){
    if(kind==='client')next.client.selectedId='preset-3575';else if(kind==='widget')next.widget.slots[slot]=null;else next.widget.bubble=null;
   }else if(action==='reset-all'&&kind==='widget'){next.widget.slots=[null,null,null,null];next.widget.bubble=null;next.widget.opacity=.25;}
   else if(action==='opacity'){if(!Number.isFinite(command.value)||command.value<0||command.value>.65)throw Error('可见程度超出范围');next.widget.opacity=command.value;}
   else throw Error('图片操作无效');
   if(kind==='client'){next.client.selectionRevision=randomUUID();next.client.resetVisuals=action==='reset';}
   store.write(next);
   if(kind==='client'&&!clientBefore)return {ok:true,pending:true,message:disconnectedMessage,state:notify()};
   try{if(kind==='client'){await applyBackground();clientControls=await peek();}}
   catch(error){store.write(previous);try{await applyBackground();await restoreClient(clientBefore);}catch{}throw error;}
   return {ok:true,state:notify(kind==='widget'&&Number.isInteger(slot)?slot:undefined)};
  }finally{pending=false;}
 }
 function open(kind){
  if(!['client','widget'].includes(kind))return false;
  if(panel&&!panel.isDestroyed()){if(panelKind===kind){panel.show();panel.focus();return true;}panel.close();}
  panelKind=kind;
  const area=require('electron').screen.getPrimaryDisplay().workArea;
  panel=new BrowserWindow({width:500,height:kind==='client'?760:800,minWidth:440,minHeight:500,x:Math.round(area.x+(area.width-500)/2),y:Math.max(area.y+20,Math.round(area.y+(area.height-(kind==='client'?760:800))/2)),show:false,autoHideMenuBar:true,title:kind==='client'?'① 自定义客户端背景':'② 自定义挂件背景',backgroundColor:'#f6f9f2',webPreferences:{preload:path.join(__dirname,'customization-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const current=panel;current.setMenu(null);const showPanel=()=>{if(!current.isDestroyed()&&!current.isVisible()){current.show();current.focus();}};current.once('ready-to-show',showPanel);current.webContents.once('did-finish-load',showPanel);current.on('closed',()=>{if(panel===current)panel=null;const widget=getWidgetWindow();if(widget&&!widget.isDestroyed())widget.webContents.invalidate();});
  current.webContents.setWindowOpenHandler(()=>({action:'deny'}));current.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/pet-customize.html'))event.preventDefault();});
  current.loadURL(origin+'/pet-customize.html?kind='+kind);return true;
 }
 ipcMain.handle('mutsumi-customizer',async(event,command)=>{
  if(!panel||panel.isDestroyed()||event.sender!==panel.webContents||event.senderFrame?.parent)return {ok:false,error:'这个设置窗口已失效'};
  if(!['state','companion'].includes(command?.action)&&((panelKind==='client')!==(command?.kind==='client'))&&command?.action!=='opacity')return {ok:false,error:'图片操作无效'};
  try{return await change(command);}catch(error){return {ok:false,error:/[\u4e00-\u9fff]/.test(error.message)?error.message:'图片操作未完成，原图已保留'};}
 });
 async function capture(){if(!panel||panel.isDestroyed())return null;const file=path.join(dataDir,'evidence','live-customizer.png');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,(await panel.webContents.capturePage()).toPNG());const view=await panel.webContents.executeJavaScript(`({title:document.title,status:document.querySelector('#status').textContent,controlsHidden:document.querySelector('#client-controls').hidden,brightness:document.querySelector('#client-brightness').value,mask:document.querySelector('#client-mask').value,blur:document.querySelector('#client-blur').value})`);return {file,view};}
 return {open,state,change,reload,capture,store,notify,dismiss(){if(panel&&!panel.isDestroyed())panel.close();return true;},get panel(){return panel;},close(){if(panel&&!panel.isDestroyed())panel.destroy();panel=null;ipcMain.removeHandler('mutsumi-customizer');}};
}
module.exports={createCustomizationController};
