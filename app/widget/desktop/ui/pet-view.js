(() => {
  'use strict';
  const avatars = [3576,3576,3576,3576];
  let appearance=window.whaleDesktop?.customization||null;
  let gallery=appearance?.widget?.slots||avatars.map(n=>({url:'/assets/IMG'+n+'.png',name:'睦'}));
  let index = 0, clicks = 0, pendingEgg='';
  const easter=MutsumiEaster.create(localStorage),lowView=MutsumiLowView.create(localStorage);
  try { const n=Number(localStorage.getItem('dshw-mutsumi-index'));if(Number.isInteger(n)&&n>=0&&n<4)index=n; } catch {}
  const source=()=>gallery[index]?.url||'/assets/IMG'+avatars[index]+'.png';
  function role() {
    const img=document.querySelector('.dshwv-img');if(!img)return;
    img.src=source();img.alt=gallery[index]?.name||'睦';
    localStorage.setItem('dshw-role','default');
    window.WhaleRendering?.hitCache.prepare(img.src);
    window.WhaleRendering?.presentFor(260);
  }
  window.MutsumiRole={source,next(){clicks++;pendingEgg=easter.click();index=(index+1)%4;localStorage.setItem('dshw-mutsumi-index',String(index));role();
    const values=Object.fromEntries(Object.keys(localStorage).filter(k=>/^dshw[-v]/.test(k)).map(k=>[k,localStorage.getItem(k)]));window.whaleDesktop?.save(values);
  },get index(){return index;},get clicks(){return clicks;},takeEgg(){const value=pendingEgg;pendingEgg='';return value;},get counter(){return easter.state();}};
  function customize(value){
    if(!value?.widget?.slots||value.widget.slots.length!==4)return;
    appearance=value;document.documentElement.dataset.mutsumiDisabled=String(value.companion?.enabled===false);const enabledBox=document.querySelector('[data-companion-enabled]');if(enabledBox)enabledBox.checked=value.companion?.enabled!==false;if(value.companion?.enabled===false){hideQuota();popup?.remove();popup=null;}gallery=value.widget.slots.map((slot,i)=>/^\/(?:assets\/IMG3576\.png|mutsumi-custom\/[a-f0-9]{64}\.png)$/.test(slot.url)?slot:{url:'/assets/IMG'+avatars[i]+'.png',name:'睦'});
    if(Number.isInteger(value.selectSlot)&&value.selectSlot>=0&&value.selectSlot<4){index=value.selectSlot;localStorage.setItem('dshw-mutsumi-index',String(index));window.whaleDesktop?.save(Object.fromEntries(Object.keys(localStorage).filter(k=>/^dshw[-v]/.test(k)).map(k=>[k,localStorage.getItem(k)])));}
    for(const slot of gallery){const image=new Image();image.src=slot.url;image.decode().then(()=>window.WhaleRendering?.hitCache.prepare(slot.url)).catch(()=>{});}role();
    if(card){const bubble=value.widget.bubble?.url;card.style.setProperty('--mutsumi-bubble-image',/^\/mutsumi-custom\/[a-f0-9]{64}\.png$/.test(bubble||'')?'url('+JSON.stringify(bubble)+')':'none');card.style.setProperty('--mutsumi-bubble-opacity',String(value.widget.opacity??.25));}
    if(value.companion?.enabled!==false)window.dispatchEvent(new Event('whale-layout-restored'));
  }
  const num = n => typeof n==='number' && Number.isFinite(n);
  let data={status:'unavailable',windows:[],resetCount:null,at:null}, card, bubbleKind='quota', eggText='', quotaOpen=false, hideTimer=null, popup, noticeKey='', lastScope='', seenValues=new Map();
  function hideQuota(){quotaOpen=false;clearTimeout(hideTimer);if(card)card.hidden=true;window.WhaleRendering?.presentFor(180);}
  function dismissLater(){clearTimeout(hideTimer);hideTimer=setTimeout(hideQuota,5000);}
  function showQuota(){const egg=MutsumiRole.takeEgg();bubbleKind=egg?'egg':'quota';eggText=egg;quotaOpen=true;render();dismissLater();}
  const date = t => num(t)?new Date(t*1000).toLocaleString('zh-CN',{hour12:false}):'暂不可用';
  const pct = n => num(n)?(Math.round(n*10)/10).toFixed(n%1?1:0)+'%':'暂不可用';
  function remaining(t) {if(!num(t))return '暂不可用';let n=Math.max(0,Math.ceil(t-Date.now()/1000));return Math.floor(n/86400)+'天 '+String(Math.floor(n/3600)%24).padStart(2,'0')+':'+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
  function el(tag,txt,parent,cls) {const e=document.createElement(tag);if(txt)e.textContent=txt;if(cls)e.className=cls;parent?.append(e);return e;}
  function current() {return data.status==='fresh' && num(data.at) && Date.now()-data.at<=300000 && data.at<=Date.now()+5000;}
  function render() {
    if(!card)return;
    card.hidden=!quotaOpen;if(!quotaOpen)return;
    const live=current();card.replaceChildren();card.dataset.kind=bubbleKind;
    if(bubbleKind==='egg'){el('div',eggText,card,'mutsumi-easter');position();return;}
    for(const minutes of [300,10080]) {
      const w=data.windows?.find(x=>x.minutes===minutes)||{label:minutes===300?'五小时':'每周'};
      const valid=live && w.status==='fresh' && w.resetsAt*1000>Date.now();
      const line=el('div','',card,'mutsumi-line');el('span',w.label,line);const amount=el('b',valid?pct(w.remaining):'暂不可用',line);
      if(valid && w.remaining<10)amount.className='mutsumi-low';
      const old=seenValues.get(minutes);
      if(valid && old!==undefined && old!==w.remaining)amount.animate([{opacity:.3,transform:'translateY(-5px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'cubic-bezier(.34,1.56,.64,1)'});
      if(valid)seenValues.set(minutes,w.remaining);
    }
    const resets=el('div','',card,'mutsumi-line');el('span','剩余重置',resets);el('b',live&&Number.isSafeInteger(data.resetCount)?data.resetCount+' 次':'暂不可用',resets);
    position();
  }
  function position(){
    const img=document.querySelector('.dshwv-img');if(!img||!card)return;
    const b=img.getBoundingClientRect(),h=card.offsetHeight,w=card.offsetWidth;
    const left=Math.max(8,Math.min(innerWidth-w-8,b.right-w));
    let top=b.top-h-8;
    if(top<8){const side=b.left>w+12?b.left-w-8:Math.min(innerWidth-w-8,b.right+8);card.style.left=Math.max(8,side)+'px';top=Math.max(8,Math.min(innerHeight-h-8,b.top));}
    else card.style.left=left+'px';
    card.style.top=top+'px';
    if(popup){const pH=popup.offsetHeight,pW=popup.offsetWidth,anchor=quotaOpen?card.getBoundingClientRect():b;let pL=Math.max(8,Math.min(innerWidth-pW-8,b.right-pW)),pT=anchor.top-pH-8;
      if(pT<8){const below=Math.max(anchor.bottom,b.bottom)+8;if(below+pH<=innerHeight-8)pT=below;else if(anchor.right+8+pW<=innerWidth-8){pL=anchor.right+8;pT=anchor.top;}else if(anchor.left-8-pW>=8){pL=anchor.left-8-pW;pT=anchor.top;}else pT=Math.max(8,innerHeight-pH-8);}
      popup.style.left=pL+'px';popup.style.top=Math.max(8,Math.min(innerHeight-pH-8,pT))+'px';}
  }
  function notice(){
    const windows=lowView.visible(data),key=JSON.stringify(windows);
    if(!windows.length){popup?.remove();popup=null;noticeKey='';return;}
    if(popup&&key===noticeKey)return;
    popup?.remove();noticeKey=key;popup=el('aside','',document.body,'whale-account-card mutsumi-notice');
    const close=el('button','×',popup);close.setAttribute('aria-label','关闭本周期低额度提醒');close.onclick=()=>{lowView.dismiss(data,windows);popup.remove();popup=null;noticeKey='';window.whaleDesktop?.save(Object.fromEntries(Object.keys(localStorage).filter(k=>/^dshw[-v]/.test(k)).map(k=>[k,localStorage.getItem(k)])));};
    el('strong','老大 你的额度不够啦',popup);
    for(const w of windows)el('p',w.label+'剩余 '+pct(w.remaining)+' · 重置 '+date(w.resetsAt),popup);position();window.dispatchEvent(new Event('whale-shape-request'));
  }
  function accept(v){
    if(v.scope!==lastScope){seenValues.clear();popup?.remove();popup=null;lastScope=v.scope;}
    data=v;render();notice();
  }
  window.WhaleAccountView={mode:'subscription',toggleBubble(){showQuota();return true;},refresh:render,notice(){},close:hideQuota,setMode:()=>Promise.resolve(false)};
  function init(){
    for(const slot of gallery){const image=new Image();image.src=slot.url;image.decode().then(()=>window.WhaleRendering?.hitCache.prepare(image.src)).catch(()=>{});}
    role();const style=el('style','',document.head);style.textContent=`.dshwv-img{border-radius:0}.mutsumi-meter{isolation:isolate;overflow:hidden}.mutsumi-meter::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:var(--mutsumi-bubble-image,none);background-size:cover;background-position:center;opacity:var(--mutsumi-bubble-opacity,.25)}.whale-account-card{position:fixed;z-index:10001;box-sizing:border-box;pointer-events:auto;font:12px/1.45 'Microsoft YaHei',sans-serif;color:#23413e;background:rgba(249,253,247,.96);border:1px solid #b1c5ae;border-radius:14px;box-shadow:0 4px 15px #203e3725;padding:10px;width:236px;max-width:calc(100vw - 16px)}.mutsumi-line{gap:16px;padding:5px 0;font-size:14px}.mutsumi-easter{font-size:15px;line-height:1.6;padding:6px 2px;text-align:center;overflow-wrap:anywhere}.mutsumi-head,.mutsumi-line{display:flex;align-items:center;justify-content:space-between}.whale-account-card button{border:1px solid #bbcdb6;background:#fff;border-radius:7px;color:#344e3b;padding:2px 6px;cursor:pointer;font:inherit}.whale-account-card small{display:block;font-size:10px;color:#54705e}.mutsumi-window{padding-top:6px}.mutsumi-window progress{width:100%;height:5px;accent-color:#78a47a;display:block;margin:3px 0}.mutsumi-resets{margin:7px 0 3px;font-weight:600}.mutsumi-stamp{border-top:1px solid #d6e2cf;padding-top:4px}.mutsumi-low{color:#b74750}.mutsumi-notice{width:290px;border-color:#c07980;background:#fff7f7}.mutsumi-notice button{float:right}.mutsumi-notice p{font-size:11px;margin:5px 0}.mutsumi-control{font:12px/1.6 sans-serif;color:#23413e;padding:6px;border-bottom:1px solid #cad8c3}.mutsumi-control button{margin:4px;padding:4px;border-radius:7px;border:1px solid #9bb393;background:white;color:#23413e}`;
    // Match the installed DSH frontend's inherited font stack and its random
    // text module's 700 weight, instead of the quota card's Microsoft YaHei override.
    style.textContent+=`html[data-mutsumi-disabled=true] :is(.dshwv-root,.dshwv-position,.whale-account-card,.dshwv-menu){display:none!important}.mutsumi-easter{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:700;font-size:18px;line-height:1.35}.mutsumi-notice{max-height:calc(100vh - 16px);overflow:auto}`;
    card=el('section','',document.body,'whale-account-card mutsumi-meter');card.hidden=true;card.setAttribute('aria-label','订阅额度或彩蛋');card.addEventListener('click',hideQuota);card.addEventListener('mouseenter',()=>clearTimeout(hideTimer));card.addEventListener('mouseleave',dismissLater);render();
    if(appearance)customize(appearance);window.whaleDesktop?.onCustomization(customize);
    document.documentElement.dataset.accountMode='subscription';
    document.querySelectorAll('[data-account-api]').forEach(e=>e.hidden=true);
    const roleRow=document.querySelector('.dshwv-rolebtn')?.closest('.dshwv-menu-row');if(roleRow)roleRow.textContent='角色：默认单张图片，可自定义四个槽位';
    const menu=document.querySelector('.dshwv-menu');if(menu){
      const box=el('div','',null,'mutsumi-control');menu.prepend(box);el('strong','Codex Work Pet · 订阅挂件',box);const enableRow=el('label','',box),enableBox=el('input','',enableRow);enableBox.type='checkbox';enableBox.checked=appearance?.companion?.enabled!==false;enableBox.dataset.companionEnabled='';enableRow.append(' 启用额度挂件');enableBox.onchange=()=>window.whaleDesktop?.command(enableBox.checked?'mutsumi-widget-on':'mutsumi-widget-off');
      for(const [text,command] of [['① 自定义客户端背景…','mutsumi-client-background'],['② 自定义挂件背景…','mutsumi-widget-background']]){const button=el('button',text,box);button.dataset.customize=command;button.style.display='block';button.style.width='calc(100% - 8px)';button.onclick=()=>{if(menu.classList.contains('dshwv-menu-open'))document.querySelector('.dshwv-menu-btn')?.click();window.whaleDesktop?.keyboardFocus(false);window.dispatchEvent(new Event('whale-shape-request'));window.whaleDesktop?.command(command);};}
      const row=el('label','',box),check=el('input','',row);check.type='checkbox';check.checked=true;row.append(' 低于 10% 时提醒');
      check.onchange=async()=>{try{await fetch('/api/mutsumi-settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alerts:check.checked})});}catch{check.checked=!check.checked;}};
      window.whaleDesktop?.onQuota(v=>{check.checked=v.alertsEnabled!==false;});
      el('small','单击换图；每 2–5 次有效点击随机彩蛋；拖动不计数',box);
      const status=el('small','',box);const refresh=el('button','刷新额度',box);refresh.onclick=()=>fetch('/api/mutsumi-refresh',{method:'POST'}).then(r=>r.json()).then(accept).catch(()=>{});const updateStatus=()=>{status.textContent=(current()?'官方额度快照':'数据已过期 / 暂不可用')+' · 最近更新 '+(num(data.at)?new Date(data.at).toLocaleString('zh-CN',{hour12:false}):'尚无');};setInterval(updateStatus,1000);updateStatus();
    }
    window.whaleDesktop?.onQuota(accept);
    fetch('/api/mutsumi-quota').then(r=>r.json()).then(accept).catch(()=>render());
    setInterval(()=>{render();notice();},1000);setInterval(position,60);
    window.addEventListener('resize',position);
  }
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else init();
})();
