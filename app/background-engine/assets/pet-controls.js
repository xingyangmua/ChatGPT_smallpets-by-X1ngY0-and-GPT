(function(images,custom){
 'use strict';custom=custom||{};
 window.__mutsumiBackground?.cleanup();
 if(!document.querySelector('main') || document.documentElement.dataset.dreamSkin!=='active')return;
 const key='mutsumi-background-v1',names=custom.names||['蓝天草地'],ids=custom.ids||[3575].map(n=>'preset-'+n);
 const defaults={image:0,brightness:.9,mask:.34,blur:0,rotation:false,enabled:true};let state={...defaults};
 try{Object.assign(state,JSON.parse(localStorage.getItem(key)||'{}'));}catch{}
 if(state.native===true){state.enabled=true;state.rotation=false;}state.native=false;state.image=Number.isInteger(state.image)&&state.image>=0&&state.image<images.length?state.image:0;
 for(const [k,min,max] of [['brightness',.4,1.4],['mask',0,.85],['blur',0,15]])state[k]=Number.isFinite(state[k])?Math.max(min,Math.min(max,state[k])):defaults[k];
 if(typeof state.imageId==='string'&&ids.includes(state.imageId))state.image=ids.indexOf(state.imageId);
 if(custom.selectionRevision&&custom.selectionRevision!==state.selectionRevision){if(custom.resetVisuals)state={...defaults};const chosen=ids.indexOf(custom.selectedId);state.image=chosen>=0?chosen:0;state.rotation=false;state.selectionRevision=custom.selectionRevision;}
 let timer,observer,disposed=false;
 const root=document.documentElement,scene=document.createElement('div');scene.id='mutsumi-scene';scene.setAttribute('aria-hidden','true');
 scene.innerHTML='<div class="mutsumi-floor"></div><div class="mutsumi-art"></div><div class="mutsumi-veil"></div>';
 const style=document.createElement('style');style.id='mutsumi-background-style';style.textContent=`
 html[data-mutsumi-background=true] body{isolation:isolate;background:transparent!important}
 #mutsumi-scene{position:fixed;inset:0;pointer-events:none;z-index:-1;background:#17231f}
 #mutsumi-scene>div{position:absolute;inset:0;background-position:50% 42%;background-repeat:no-repeat;pointer-events:none}
 #mutsumi-scene .mutsumi-floor{background-size:cover;filter:blur(22px) brightness(var(--mutsumi-brightness));transform:scale(1.06)}
 #mutsumi-scene .mutsumi-art{background-size:contain;filter:blur(var(--mutsumi-blur)) brightness(var(--mutsumi-brightness))}
 #mutsumi-scene .mutsumi-veil{background:rgba(12,19,23,var(--mutsumi-mask))}
 html[data-mutsumi-background=true]{--dream-skin-art:none!important}
 html[data-mutsumi-background=true] main[data-ds-part=main]{background:transparent!important}
 html[data-mutsumi-background=true] aside[data-ds-part=sidebar]{background:rgba(17,25,29,.7)!important}
 html[data-mutsumi-background=true] [data-ds-part=composer]{background:rgba(22,29,33,.92)!important}
 html[data-mutsumi-background=true] pre,html[data-mutsumi-background=true] [role=menu],html[data-mutsumi-background=true] [role=dialog]{background:rgba(20,27,32,.97)!important}
 #mutsumi-background-control{position:fixed;right:15px;top:48px;z-index:2147483000;font:13px/1.5 'Microsoft YaHei',sans-serif;color:#edf7ef;pointer-events:auto}
 #mutsumi-background-control button,#mutsumi-background-control select{font:inherit;color:inherit;background:#253b33;border:1px solid #869d87;border-radius:8px;padding:4px 9px;cursor:pointer}
 #mutsumi-background-control section{margin-top:6px;width:255px;padding:14px;background:#1b2928f7;border:1px solid #91a38a;border-radius:12px;box-shadow:0 8px 30px #0006}
 html[data-dream-shell=light] #mutsumi-scene{background:#edf3e7}
 html[data-dream-shell=light] #mutsumi-scene .mutsumi-veil{background:rgba(255,255,255,calc(.24 + var(--mutsumi-mask)*.72))}
 html[data-mutsumi-background=true][data-dream-shell=light] aside[data-ds-part=sidebar]{background:rgba(249,252,246,.72)!important}
 html[data-mutsumi-background=true][data-dream-shell=light] [data-ds-part=composer]{background:rgba(252,254,249,.94)!important}
 html[data-mutsumi-background=true][data-dream-shell=light] pre,html[data-mutsumi-background=true][data-dream-shell=light] [role=menu],html[data-mutsumi-background=true][data-dream-shell=light] [role=dialog]{background:rgba(250,253,248,.97)!important}
 html[data-dream-shell=light] #mutsumi-background-control{color:#243e32}
 html[data-dream-shell=light] #mutsumi-background-control button,html[data-dream-shell=light] #mutsumi-background-control select{color:#243e32;background:#f3f8ee;border-color:#7e9779}
 html[data-dream-shell=light] #mutsumi-background-control section{background:#f9fcf5f7;border-color:#839d7c;box-shadow:0 8px 24px #30452f26}
 #mutsumi-background-control label{display:block;margin:8px 0}#mutsumi-background-control input[type=range]{width:100%;accent-color:#b8d3a3}#mutsumi-background-control [hidden]{display:none!important}
 `;
 // All user controls are available through entry 1 in the companion menu.
 // Keep this internal adapter hidden so no overlay covers native app buttons.
 const box=document.createElement('div');box.id='mutsumi-background-control';box.hidden=true;box.setAttribute('aria-hidden','true');
 const toggle=document.createElement('button');toggle.textContent='睦背景';toggle.setAttribute('aria-expanded','false');box.append(toggle);
 const panel=document.createElement('section');panel.hidden=true;panel.setAttribute('aria-label','睦背景设置');box.append(panel);
 toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};
 const label=(text,input)=>{const l=document.createElement('label');l.append(text,input);panel.append(l);};
 const select=document.createElement('select');for(let i=0;i<images.length;i++){const o=document.createElement('option');o.value=String(i);o.textContent=names[i];select.append(o);}select.value=String(state.image);select.onchange=()=>{state.image=Number(select.value);save();};label('图片 ',select);
 for(const [k,title,min,max,step] of [['brightness','背景亮度',.4,1.4,.01],['mask','遮罩透明度',0,.85,.01],['blur','背景模糊',0,15,.5]]){const slider=document.createElement('input');slider.type='range';slider.min=min;slider.max=max;slider.step=step;slider.value=String(state[k]);slider.setAttribute('aria-label',title);const value=document.createElement('span');value.textContent=String(state[k]);slider.oninput=()=>{state[k]=Number(slider.value);value.textContent=slider.value;save();};label(title+' ',value);panel.append(slider);}
 for(const [k,title] of [['rotation','每分钟轮播'],['enabled','启用图片背景']]){const check=document.createElement('input');check.type='checkbox';check.checked=state[k]===true;check.onchange=()=>{state[k]=check.checked;save();};label(title+' ',check);}
 const restore=document.createElement('button');restore.textContent='恢复默认';restore.onclick=()=>{state={...defaults};save();window.__mutsumiBackground.cleanup();location.reload();};panel.append(restore);
 function paint(){if(disposed)return;root.dataset.mutsumiBackground=String(state.enabled);scene.hidden=!state.enabled;scene.style.setProperty('--mutsumi-brightness',String(state.brightness));scene.style.setProperty('--mutsumi-mask',String(state.mask));scene.style.setProperty('--mutsumi-blur',state.blur+'px');for(const div of scene.querySelectorAll('.mutsumi-floor,.mutsumi-art'))div.style.backgroundImage='url('+JSON.stringify(images[state.image])+')';select.value=String(state.image);}
 function save(){state.imageId=ids[state.image];try{localStorage.setItem(key,JSON.stringify(state));}catch{}paint();}
 function cleanup(){disposed=true;clearInterval(timer);observer?.disconnect();scene.remove();box.remove();style.remove();delete root.dataset.mutsumiBackground;}
 style.textContent+='#mutsumi-background-control[hidden]{display:none!important}';document.head.append(style);document.body.append(scene,box);save();
 timer=setInterval(()=>{if(state.rotation&&state.enabled){state.image=(state.image+1)%images.length;save();}},60000);
 observer=new MutationObserver(()=>{if(root.dataset.dreamSkin!=='active')cleanup();});observer.observe(root,{attributes:true,attributeFilter:['data-dream-skin']});
 window.__mutsumiBackground={cleanup,state:()=>({...state,imageId:ids[state.image]}),apply:value=>{for(const k of ['brightness','mask','blur']){const bounds=k==='brightness'?[.4,1.4]:k==='mask'?[0,.85]:[0,15];if(Number.isFinite(value?.[k]))state[k]=Math.max(bounds[0],Math.min(bounds[1],value[k]));}for(const k of ['rotation','enabled'])if(typeof value?.[k]==='boolean')state[k]=value[k];if(ids.includes(value?.imageId))state.image=ids.indexOf(value.imageId);else if(Number.isInteger(value?.image)&&value.image>=0&&value.image<images.length)state.image=value.image;save();return {...state};},select:n=>{if(Number.isInteger(n)&&n>=0&&n<images.length){state.image=n;save();}}};
})
