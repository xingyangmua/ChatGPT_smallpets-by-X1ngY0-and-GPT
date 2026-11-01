(function(root){
 'use strict';
 const phrases=Object.freeze(['好模型…','用不起别用','Tibo…','你不会把ds接进来的对吧…','kskbl','zdjd']);
 root.MutsumiEaster=Object.freeze({phrases,create(store,random=Math.random){
  const pick=n=>Math.min(n-1,Math.max(0,Math.floor(random()*n)));
  let count=Number(store.getItem('dshw-easter-count')),goal=Number(store.getItem('dshw-easter-goal'));
  if(!Number.isInteger(goal)||goal<2||goal>5)goal=2+pick(4);
  if(!Number.isInteger(count)||count<0||count>=goal)count=0;
  function save(){store.setItem('dshw-easter-count',String(count));store.setItem('dshw-easter-goal',String(goal));}
  save();
  return Object.freeze({click(){count++;let phrase='';if(count>=goal){phrase=phrases[pick(phrases.length)];count=0;goal=2+pick(4);}save();return phrase;},state(){return {count,goal};}});
 }});
})(globalThis);
