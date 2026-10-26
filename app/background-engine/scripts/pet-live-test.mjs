import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {CdpSession} from './injector.mjs';
const [dataDir,output,mode='inspect']=process.argv.slice(2),delay=ms=>new Promise(r=>setTimeout(r,ms));
const saved=JSON.parse((await fs.readFile(path.join(dataDir,'background-state.json'),'utf8')).replace(/^\uFEFF/,''));
assert.ok(Number.isInteger(saved.port)&&saved.port>=1024&&saved.port<=65535);
const base=`http://127.0.0.1:${saved.port}`,browser=await (await fetch(base+'/json/version')).json();
assert.equal(new URL(browser.webSocketDebuggerUrl).pathname.split('/').pop(),saved.browserId,'Browser identity changed');
const targets=await (await fetch(base+'/json/list')).json();
let session;
for(const target of targets.filter(t=>t.type==='page'&&t.url.startsWith('app://'))){
 const candidate=await new CdpSession(target,saved.port).open();
 if(await candidate.evaluate(`Boolean(window.__mutsumiBackground && document.documentElement.dataset.dreamSkin==='active')`)){session=candidate;break;}
 candidate.close();
}
assert.ok(session,'No installed native Mutsumi renderer');
await fs.mkdir(output,{recursive:true});const report={ok:false,mode,at:new Date().toISOString(),checks:[]};
const inspect=()=>session.evaluate(`(()=>{const root=document.documentElement,scene=document.querySelector('#mutsumi-scene'),control=document.querySelector('#mutsumi-background-control');return {controlHidden:getComputedStyle(control).display==="none",shell:root.dataset.dreamShell,state:__mutsumiBackground.state(),fit:getComputedStyle(scene.querySelector('.mutsumi-art')).backgroundSize,veil:getComputedStyle(scene.querySelector('.mutsumi-veil')).backgroundColor,controlText:getComputedStyle(control).color,controlBackground:getComputedStyle(control.querySelector('section')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1,scene:scene.isConnected,viewport:{width:innerWidth,height:innerHeight}}})()`);
async function screenshot(name){const image=await session.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,name+'.png'),Buffer.from(image.data,'base64'));}
let previous;
try{
 previous=await inspect();report.initial=previous;assert.equal(previous.fit,'contain');assert.equal(previous.overflow,false);assert.equal(previous.controlHidden,true,"Native app buttons must not be covered");
 if(mode==='light'){assert.equal(previous.shell,'light');assert.match(previous.veil,/rgba\(255, 255, 255,/);assert.equal(previous.controlText,'rgb(36, 62, 50)');report.checks.push('Actual native light mode uses white veil and dark control text');}
 if(mode==='dark'){assert.equal(previous.shell,'dark');assert.match(previous.veil,/rgba\(12, 19, 23,/);report.checks.push('Actual native dark mode retains dark veil');}
 if(mode==='gallery'){
  for(let i=0;i<4;i++){await session.evaluate(`__mutsumiBackground.select(${i})`);await delay(250);assert.equal((await inspect()).state.image,i);await screenshot('gallery-'+i);}
  report.checks.push('Four real client backgrounds select correctly, contain the full image, and save the selection');
  await session.evaluate(`(()=>{const ranges=[...document.querySelectorAll('#mutsumi-background-control input[type=range]')];[1.1,.4,2].forEach((value,i)=>{ranges[i].value=value;ranges[i].dispatchEvent(new Event('input',{bubbles:true}));});})()`);
  const changed=await inspect();assert.equal(changed.state.brightness,1.1);assert.equal(changed.state.mask,.4);assert.equal(changed.state.blur,2);report.checks.push('Brightness, veil and blur controls update the installed client state');
 }
 if(mode==='rotation'){
  await session.evaluate(`(()=>{const c=document.querySelectorAll('#mutsumi-background-control input[type=checkbox]')[0];c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const initial=(await inspect()).state.image,deadline=Date.now()+65000;let changed=false;
  while(Date.now()<deadline){await delay(500);if((await inspect()).state.image!==initial){changed=true;break;}}
  assert.equal(changed,true,'Slideshow did not advance in its real one-minute interval');report.checks.push('Actual one-minute slideshow advances without user input');
 }
 await screenshot(mode);report.ok=true;
}catch(error){report.error=String(error.stack);try{await screenshot(mode+'-failure');}catch{}}
finally{
 if(previous&&['gallery','rotation'].includes(mode)){
  await session.evaluate(`(()=>{const prior=${JSON.stringify(previous.state)};__mutsumiBackground.select(prior.image);const ranges=[...document.querySelectorAll('#mutsumi-background-control input[type=range]')];[prior.brightness,prior.mask,prior.blur].forEach((value,i)=>{ranges[i].value=value;ranges[i].dispatchEvent(new Event('input',{bubbles:true}));});const c=document.querySelectorAll('#mutsumi-background-control input[type=checkbox]')[0];c.checked=prior.rotation;c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 }
 report.final=await inspect();await fs.writeFile(path.join(output,mode+'.json'),JSON.stringify(report,null,2));session.close();
}
console.log(JSON.stringify({ok:report.ok,mode,checks:report.checks,error:report.error}));if(!report.ok)process.exitCode=1;
