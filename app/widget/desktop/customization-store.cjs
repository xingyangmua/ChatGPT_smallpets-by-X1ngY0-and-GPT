const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const MAX_BYTES=10*1024*1024;
const presets=[3575].map((n,i)=>({id:'preset-'+n,name:['蓝天草地'][i],url:'/mutsumi-background/'+n+'.jpg'}));
presets.unshift({id:'native-default',name:'ChatGPT 默认背景',url:null});
const empty=()=>({version:1,client:{images:[],selectedId:'preset-3575',selectionRevision:'',resetVisuals:false},widget:{slots:[null,null,null,null],bubble:null,opacity:.25}});
function assetValid(a){return !!a&&/^[a-f0-9]{64}$/.test(a.id)&&new RegExp('^'+a.id+'\\.(png|jpg|webp)$').test(a.file)&&typeof a.name==='string'&&a.name.length<=120&&Number.isInteger(a.width)&&Number.isInteger(a.height)&&a.width>0&&a.height>0&&a.width<=16384&&a.height<=16384&&a.width*a.height<=50000000;}
function safeDirectory(dir){if(fs.existsSync(dir)&&(!fs.lstatSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink()))throw Error('图片保存目录不可用，请恢复后重试');fs.mkdirSync(dir,{recursive:true});}
function createCustomizationStore(dataDir,{decode,metadata}={}){
 const file=path.join(dataDir,'mutsumi-customization.json'),assets=path.join(dataDir,'custom-images');
 function read(){
  if(!fs.existsSync(file))return empty();let state;try{state=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{throw Error('图片设置文件无法读取，已保留原文件');}
  if(state?.version!==1||!state.client||!state.widget||!Array.isArray(state.client.images)||!Array.isArray(state.widget.slots)||state.widget.slots.length!==4||state.client.images.length>12)throw Error('图片设置格式不正确，已保留原文件');
  for(const a of [...state.client.images,...state.widget.slots,state.widget.bubble].filter(Boolean))if(!assetValid(a))throw Error('图片设置中有无效项目，已保留原文件');
  if(/^preset-/.test(state.client.selectedId)&&state.client.selectedId!=='preset-3575')state.client.selectedId='preset-3575';
  return state;
 }
 function write(state){
  safeDirectory(dataDir);if(fs.existsSync(file)){const dir=path.join(dataDir,'customization-backups');safeDirectory(dir);fs.copyFileSync(file,path.join(dir,Date.now()+'-'+randomUUID()+'.json'));}
  const temp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(state,null,2));fs.renameSync(temp,file);
 }
 function url(a){return a?'/mutsumi-custom/'+a.file:null;}
 function publicState(){const state=read();return {client:{images:[...presets,...state.client.images.map(a=>({id:a.id,name:a.name,url:url(a)}))],selectedId:state.client.selectedId},widget:{slots:state.widget.slots.map((a,i)=>({name:a?.name||'原表情 '+(i+1),url:url(a)||'/assets/IMG3576.png',custom:!!a})),bubble:state.widget.bubble?{name:state.widget.bubble.name,url:url(state.widget.bubble)}:null,opacity:Number.isFinite(state.widget.opacity)?Math.max(0,Math.min(.65,state.widget.opacity)):.25}};}
 async function importFile(source,kind){
  const stat=fs.statSync(source);if(!stat.isFile()||stat.size<12||stat.size>MAX_BYTES)throw Error('请选择不超过 10 MB 的图片');
  let bytes=fs.readFileSync(source),ext='';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';
  else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';
  else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';
  else throw Error('只支持 PNG、JPG 或 WebP 图片');
  const parse=metadata||(await import(pathToFileURL(path.resolve(__dirname,'../../background-engine/scripts/image-metadata.mjs')).href)).readImageMetadata;
  let size;try{size=parse(bytes,'.'+ext);}catch{throw Error('图片无法读取，请换一张有效图片');}
  if(!size?.width||!size?.height||size.width>16384||size.height>16384||size.width*size.height>50000000)throw Error('图片尺寸过大，请选择较小图片');
  if(decode){const image=decode(bytes);if(image.isEmpty())throw Error('图片无法读取，请换一张有效图片');if(kind!=='client'){bytes=image.toPNG();ext='png';size=image.getSize();if(bytes.length>MAX_BYTES)throw Error('这张图片转换后过大，请选择较小图片');}}
  const id=createHash('sha256').update(bytes).digest('hex'),name=path.basename(source).replace(/[\u0000-\u001f]/g,'').slice(0,120)||'自定义图片';
  safeDirectory(assets);const target=path.join(assets,id+'.'+ext);
  if(fs.existsSync(target)){if(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())throw Error('图片保存位置不可用');if(createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==id)throw Error('已保存图片发生变化，原设置保留');}
  else{const temp=target+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,bytes,{flag:'wx'});fs.renameSync(temp,target);}
  return {id,file:id+'.'+ext,name,width:size.width,height:size.height};
 }
 return {read,write,publicState,importFile,file,assets,presets};
}
module.exports={createCustomizationStore,empty,assetValid};
