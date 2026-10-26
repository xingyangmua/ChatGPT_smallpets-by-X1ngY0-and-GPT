import fs from 'node:fs/promises';
import path from 'node:path';
import {CdpSession} from './injector.mjs';
const [dataDir,action,value]=process.argv.slice(2);
const state=JSON.parse((await fs.readFile(path.join(dataDir,'background-state.json'),'utf8')).replace(/^\uFEFF/,''));
if(!Number.isInteger(state.port)||state.port<1024||state.port>65535||!['read','restore','wait'].includes(action))throw Error('Invalid local background operation');
const base='http://127.0.0.1:'+state.port,version=await (await fetch(base+'/json/version')).json();
if(new URL(version.webSocketDebuggerUrl).pathname.split('/').pop()!==state.browserId)throw Error('Background session changed');
const targets=await (await fetch(base+'/json/list')).json();let found=false;
for(const target of targets.filter(t=>t.type==='page'&&t.url.startsWith('app://'))){
 const session=await new CdpSession(target,state.port).open();
 try{
  if(!await session.evaluate(`Boolean(window.__mutsumiBackground && (document.documentElement.dataset.dreamSkin==='active'||window.__mutsumiBackground.state().native===true))`))continue;
  let result;
  if(action==='wait'){
   const custom=JSON.parse((await fs.readFile(path.join(dataDir,'mutsumi-customization.json'),'utf8')).replace(/^\uFEFF/,''));
   if(typeof custom.client?.selectionRevision!=='string'||!custom.client.selectionRevision)throw Error('No managed image selection');
   const deadline=Date.now()+12000;let matched=false;
   while(Date.now()<deadline){result=await session.evaluate('__mutsumiBackground.state()');if(result.selectionRevision===custom.client.selectionRevision&&result.imageId===custom.client.selectedId){matched=true;break;}await new Promise(resolve=>setTimeout(resolve,200));}
   if(!matched)throw Error('Background watcher did not apply the selected image');
  }else result=action==='read'?await session.evaluate('__mutsumiBackground.state()'):await session.evaluate(`__mutsumiBackground.apply(${JSON.stringify(JSON.parse(value))})`);
  console.log(JSON.stringify(result));found=true;break;
 }finally{session.close();}
}
if(!found)throw Error('No live native background');
