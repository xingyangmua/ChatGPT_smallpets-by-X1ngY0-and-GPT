(function(custom,revision,version,themeId){
 'use strict';
 const route=new URLSearchParams(location.search).get('initialRoute')||'';
 if(location.protocol!=='app:'||route.startsWith('/avatar-overlay')||location.pathname.endsWith('/avatar-overlay-composition-surface.html'))return {installed:false};
 window.__mutsumiBackground?.cleanup();window.__CODEX_DREAM_SKIN_STATE__?.cleanup();
 let previous={};try{previous=JSON.parse(localStorage.getItem('mutsumi-background-v1')||'{}');}catch{}
 // Earlier native adapters wrote their disabled flag into the picture preset.
 // Migrate that adapter state, then keep the picture settings independent.
 if(previous.native===true){previous.enabled=true;previous.rotation=false;delete previous.native;}
 let state={brightness:.9,mask:.34,blur:0,...previous,image:-1,imageId:'native-default',enabled:false,rotation:false,native:true,selectionRevision:custom.selectionRevision};
 const save=()=>{for(const k of ['brightness','mask','blur'])previous[k]=state[k];try{localStorage.setItem('mutsumi-background-v1',JSON.stringify(previous));}catch{}};
 const api={revision,state:()=>({...state}),apply:value=>{for(const k of ['brightness','mask','blur']){const [min,max]=k==='brightness'?[.4,1.4]:k==='mask'?[0,.85]:[0,15];if(Number.isFinite(value?.[k]))state[k]=Math.max(min,Math.min(max,value[k]));}save();return {...state};},cleanup(){if(window.__mutsumiBackground===api)delete window.__mutsumiBackground;}};
 window.__mutsumiBackground=api;save();
 return {installed:true,nativeDefault:true,version,themeId,revision};
})
