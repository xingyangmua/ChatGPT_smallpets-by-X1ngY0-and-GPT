import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT} from '../runtime/paths.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function verifyDesktop({app,window,screen,setHost,setTestCursor,errors}){
 const {BrowserWindow}=await import('electron');const out=process.env.WHALE_DESKTOP_VERIFY_DIR,report={ok:false,bursts:[],errors};let host;
 const ev=s=>window.webContents.executeJavaScript(s),python=process.env.WHALE_TEST_PYTHON;
 try{
  const b={x:30,y:30,width:1100,height:820};host=new BrowserWindow({...b,frame:false,show:false,title:'Mutsumi isolated native acceptance',backgroundColor:'#dfe9e1',webPreferences:{sandbox:true}});
  await host.loadURL('data:text/html,<meta charset="utf-8"><p>Isolated native input acceptance. No user application receives test clicks.</p>');host.show();host.setAlwaysOnTop(true);host.moveTop();
  const wh=window.getNativeWindowHandle().readBigUInt64LE().toString(),hh=host.getNativeWindowHandle().readBigUInt64LE().toString();
  await setHost({hostAlive:true,hostPid:process.pid,window:hh,visible:true,attached:true,bounds:screen.dipToScreenRect(null,b)});
  await promisify(execFile)(python,[path.join(ROOT,'tests/fixture-owner.py'),wh,String(process.pid),hh,String(process.pid)],{windowsHide:true,timeout:10000});
  window.showInactive();window.setAlwaysOnTop(true);window.moveTop();setTestCursor(null);await delay(1000);fs.writeFileSync(path.join(out,'native-ready.json'),JSON.stringify({host:hh,widget:wh,pid:process.pid}));if(process.env.MUTSUMI_NATIVE_WAIT==='1'){for(let i=0;i<300&&!fs.existsSync(path.join(out,'native-proceed.flag'));i++)await delay(100);}
  await ev(`window.__nativeTrace=[];for(const type of ['pointerdown','pointerup'])window.addEventListener(type,e=>__nativeTrace.push({type,trusted:e.isTrusted,index:MutsumiRole.index}),true);`);
  for(const count of [4,20]){
   const p=await ev(`(()=>{const r=document.querySelector('.dshwv-img').getBoundingClientRect();return{x:Math.round(r.left+r.width*.5),y:Math.round(r.top+r.height*.6)}})()`),wb=window.getContentBounds(),physical=screen.dipToScreenPoint({x:wb.x+p.x,y:wb.y+p.y});
   const before=await ev('MutsumiRole.index');await ev('__nativeTrace=[]');
   const response=await promisify(execFile)(python,[path.join(ROOT,'tests/rapid-click-native.py'),wh,String(process.pid),hh,String(process.pid),String(Math.round(physical.x)),String(Math.round(physical.y)),String(count),count===4?'250':'40','100'],{windowsHide:true,timeout:15000});
   await delay(400);const trace=await ev('__nativeTrace'),after=await ev('MutsumiRole.index');
   report.bursts.push({count,before,after,trace,native:JSON.parse(response.stdout)});
   assert.equal(after,(before+count)%4);assert.equal(trace.filter(t=>t.type==='pointerdown').length,count);assert.equal(trace.filter(t=>t.type==='pointerup').length,count);assert.ok(trace.every(t=>t.trusted));
  }
  report.ok=true;
 }catch(e){report.error=e.stack;report.nativeError=e.stdout;report.stderr=e.stderr;}
 finally{fs.writeFileSync(path.join(out,'pet-native.json'),JSON.stringify(report,null,2));try{await setHost({hostAlive:false});}catch{}host?.destroy();app.exit(report.ok?0:1);}
}
