(function(root){
 'use strict';
 // Only an explicit plan from the official account snapshot changes the view.
 // Missing quota windows alone cannot identify the subscription tier.
 root.MutsumiQuotaView={minutes(snapshot){return ['pro','prolite'].includes(snapshot?.plan)?[10080]:[300,10080];}};
 root.MutsumiLowView={create(storage,now=Date.now){
  let dismissed=[];try{const value=JSON.parse(storage.getItem('dshw-low-dismissed')||'[]');if(Array.isArray(value))dismissed=value.filter(x=>typeof x==='string').slice(-120);}catch{}
  const key=(snapshot,w)=>[snapshot.scope,snapshot.limitId,w.minutes,w.resetsAt].join('|');
  return {visible(snapshot){const time=now();if(snapshot?.alertsEnabled===false||snapshot?.status!=='fresh'||!snapshot.scope||!Number.isFinite(snapshot.at)||time-snapshot.at>300000||snapshot.at>time+5000)return [];
   const low=(snapshot.windows||[]).filter(w=>root.MutsumiQuotaView.minutes(snapshot).includes(w.minutes)&&w.status==='fresh'&&Number.isFinite(w.remaining)&&w.remaining>=0&&w.remaining<10&&Number.isFinite(w.resetsAt)&&w.resetsAt*1000>time);
   return low.some(w=>!dismissed.includes(key(snapshot,w)))?low:[];
  },dismiss(snapshot,windows){dismissed=[...new Set([...dismissed,...windows.map(w=>key(snapshot,w))])].slice(-120);storage.setItem('dshw-low-dismissed',JSON.stringify(dismissed));}};
 }};
})(globalThis);
