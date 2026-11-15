// Self-contained for DSH's structured inline-script injection contract.
export function mountWorkPet(defaults,win) {
  const doc=win.document,key='work-pet:dsh:v1',apiKey='__DSH_WORK_PET__';
  if(win[apiKey])return win[apiKey];
  const cleanups=[];
  let stopped=false,ready=false,root,backdrop,pet,image,panel,notice,settingsButton;
  let state={petEnabled:defaults.petEnabled,backgroundEnabled:defaults.backgroundEnabled,opacity:defaults.opacity,x:24,y:null,petImage:'',backgroundImage:''};
  const validImage=value=>typeof value==='string'&&value.length<=2200000&&/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  try {
    const saved=JSON.parse(win.localStorage.getItem(key)||'null');
    if(saved&&typeof saved==='object'){
      for(const name of ['petEnabled','backgroundEnabled'])if(typeof saved[name]==='boolean')state[name]=saved[name];
      if(Number.isFinite(saved.opacity))state.opacity=Math.max(0,Math.min(.8,saved.opacity));
      for(const name of ['x','y'])if(Number.isFinite(saved[name]))state[name]=saved[name];
      for(const name of ['petImage','backgroundImage'])if(validImage(saved[name]))state[name]=saved[name];
    }
  }catch{}
  function listen(target,event,handler,options){target.addEventListener(event,handler,options);cleanups.push(()=>target.removeEventListener(event,handler,options));}
  function save(){try{win.localStorage.setItem(key,JSON.stringify(state));return true;}catch{notice.textContent='本地保存空间不足；本次设置仍可使用。';return false;}}
  function element(tag,properties={},parent=root){const node=doc.createElement(tag);Object.assign(node,properties);parent?.append(node);return node;}
  function competingBackground(){return !!doc.getElementById('dsvs-backdrop')||doc.documentElement.getAttribute('data-dsvs')==='on';}
  function position(){
    state.x=Math.max(0,Math.min(Math.max(0,win.innerWidth-100),state.x));
    state.y=Math.max(0,Math.min(Math.max(0,win.innerHeight-130),state.y===null?win.innerHeight-180:state.y));
    pet.style.left=state.x+'px';pet.style.top=state.y+'px';
  }
  function render(){
    if(!ready||stopped)return;
    const conflict=competingBackground(),active=state.backgroundEnabled&&!conflict;
    backdrop.hidden=!active;doc.documentElement.toggleAttribute('data-dsh-work-pet-background',active);
    backdrop.style.backgroundImage=`url("${state.backgroundImage||defaults.background}")`;
    backdrop.style.opacity=String(state.opacity);
    pet.hidden=!state.petEnabled;image.src=state.petImage||defaults.pet;position();
    notice.textContent=conflict?'已保留现有视频皮肤背景。此处背景会在它关闭后显示。':'拖动角色可调整位置；点击角色打开设置。';
    panel.querySelector('[data-setting="pet"]').checked=state.petEnabled;
    panel.querySelector('[data-setting="background"]').checked=state.backgroundEnabled;
    panel.querySelector('[data-setting="opacity"]').value=String(state.opacity);
  }
  function togglePanel(){panel.hidden=!panel.hidden;settingsButton.setAttribute('aria-expanded',String(!panel.hidden));}
  function checkbox(labelText,name,property){
    const row=element('label',{className:'dwp-row'},panel),input=element('input',{type:'checkbox'},row);
    input.dataset.setting=name;element('span',{textContent:labelText},row);
    listen(input,'change',()=>{state[property]=input.checked;render();save();});return input;
  }
  function picker(labelText,property){
    const row=element('label',{className:'dwp-row'},panel);element('span',{textContent:labelText},row);
    const input=element('input',{type:'file',accept:'image/png,image/jpeg,image/webp,image/gif'},row);
    listen(input,'change',()=>{
      const file=input.files?.[0];if(!file)return;
      if(!/^image\/(?:png|jpeg|gif|webp)$/.test(file.type)||file.size>1600000){notice.textContent='请选择不超过 1.6 MB 的 PNG、JPG、WebP 或 GIF 图片。';return;}
      const reader=new win.FileReader();reader.onload=()=>{if(stopped||!validImage(reader.result))return;state[property]=reader.result;render();save();};reader.readAsDataURL(file);
    });
  }
  function start(){
    if(stopped||ready||!doc.body)return;
    root=element('div',{id:'dsh-work-pet-root'},doc.body);
    backdrop=element('div',{id:'dsh-work-pet-background'},doc.body);backdrop.setAttribute('aria-hidden','true');
    settingsButton=element('button',{className:'dwp-settings-button',textContent:'Work Pet',type:'button'});
    settingsButton.setAttribute('aria-label','打开 Work Pet 设置');settingsButton.setAttribute('aria-expanded','false');
    pet=element('button',{className:'dwp-pet',type:'button'});pet.setAttribute('aria-label','Work Pet 角色：拖动移动，点击设置');
    image=element('img',{alt:'Work Pet 角色',draggable:false},pet);
    panel=element('section',{className:'dwp-panel',hidden:true});panel.setAttribute('aria-label','Work Pet 设置');
    const header=element('div',{className:'dwp-header'},panel);element('strong',{textContent:'Work Pet · DSH'},header);
    const close=element('button',{textContent:'关闭',type:'button'},header);listen(close,'click',togglePanel);
    notice=element('p',{className:'dwp-notice'},panel);
    checkbox('显示角色','pet','petEnabled');checkbox('显示背景','background','backgroundEnabled');
    const opacityRow=element('label',{className:'dwp-row'},panel);element('span',{textContent:'背景浓度'},opacityRow);
    const opacity=element('input',{type:'range',min:'0',max:'.8',step:'.02'},opacityRow);opacity.dataset.setting='opacity';
    listen(opacity,'input',()=>{state.opacity=Number(opacity.value);render();save();});
    picker('更换角色','petImage');picker('更换背景','backgroundImage');
    const reset=element('button',{textContent:'恢复内置图片与位置',type:'button'},panel);
    listen(reset,'click',()=>{state.petImage='';state.backgroundImage='';state.x=24;state.y=null;render();save();});
    element('p',{className:'dwp-note',textContent:'额度与余额请查看 DSH 原有提供方或鲸鱼插件。图片仅保存在本机此页面。'},panel);
    listen(settingsButton,'click',togglePanel);listen(panel,'keydown',event=>{if(event.key==='Escape'){panel.hidden=true;settingsButton.setAttribute('aria-expanded','false');}});
    let drag=null,suppressClick=false;
    listen(pet,'pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:state.x,y:state.y,moved:false};pet.setPointerCapture?.(event.pointerId);});
    listen(pet,'pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){state.x=drag.x+dx;state.y=drag.y+dy;position();}});
    const finishDrag=event=>{if(!drag||event.pointerId!==drag.id)return;suppressClick=drag.moved;drag=null;save();};
    listen(pet,'pointerup',finishDrag);listen(pet,'pointercancel',event=>{if(!drag||event.pointerId!==drag.id)return;drag=null;suppressClick=false;save();});
    listen(pet,'click',()=>{if(suppressClick){suppressClick=false;return;}togglePanel();});
    listen(win,'resize',position);
    // Inspect only this public decoration marker, never conversation content.
    const observer=new win.MutationObserver(()=>render());observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-dsvs']});
    const bodyObserver=new win.MutationObserver(records=>{if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.id==='dsvs-backdrop')))render();});bodyObserver.observe(doc.body,{childList:true});
    cleanups.push(()=>observer.disconnect(),()=>bodyObserver.disconnect());
    ready=true;render();
  }
  const api={version:'0.1.0',quotaAvailable:false,getState:()=>({ready,petEnabled:state.petEnabled,backgroundEnabled:state.backgroundEnabled,backgroundActive:ready&&!backdrop.hidden,existingBackgroundPreserved:competingBackground()}),dispose(){stopped=true;for(const cleanup of cleanups.splice(0))cleanup();root?.remove();backdrop?.remove();doc.documentElement.removeAttribute('data-dsh-work-pet-background');delete win[apiKey];}};
  win[apiKey]=api;
  if(doc.body)start();else listen(doc,'DOMContentLoaded',start,{once:true});
  return api;
}
