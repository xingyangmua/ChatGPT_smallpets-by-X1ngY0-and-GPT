import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveCodexCli} from '../runtime/codex-install.mjs';
import {QuotaMonitor} from '../runtime/pet-quota.mjs';

test('Store update replaces an existing or deleted install-time CLI path',async()=>{
 for(const oldExists of [true,false]){
  const current='D:\\WindowsApps\\OpenAI.Codex_2\\app\\resources\\codex.exe';
  const cli=await resolveCodexCli('C:\\old\\codex.exe',{platform:'win32',exists:p=>p===current||oldExists,run:async(exe,args,options)=>{
   assert.match(exe,/WindowsPowerShell/);assert.ok(args.includes('-NoProfile'));assert.equal(options.windowsHide,true);
   return {stdout:JSON.stringify({root:'D:\\WindowsApps\\OpenAI.Codex_2',name:'OpenAI.Codex'})};
  }});
  assert.equal(cli,current);
 }
});
test('missing or unrelated desktop package never falls back to a stale executable',async()=>{
 for(const info of [{root:'D:\\other',name:'Other'},{root:'relative',name:'OpenAI.Codex'},{root:'D:\\missing',name:'OpenAI.Codex'}])
  await assert.rejects(resolveCodexCli('C:\\old.exe',{platform:'win32',exists:()=>false,run:async()=>({stdout:JSON.stringify(info)})}));
});
test('closing while package discovery is pending cannot start a quota process',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-update-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let finish;const m=new QuotaMonitor({dataDir:dir,fixture:true,resolveCli:()=>new Promise(r=>finish=r)});
 const starting=m.start();m.close();finish('unused');await starting;assert.equal(m.child,null);
});
test('account restart invalidates an already resolved old quota request',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-update-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const m=new QuotaMonitor({dataDir:dir,fixture:true});t.after(()=>m.close());m.ready=true;
 let finish;const blocked=new Promise(r=>finish=r);let calls=0;
 m.identity=async()=>({scope:++calls===1?'old':'old',accountId:'old'});
 m.rpc=async()=>{await blocked;return {rateLimitsByLimitId:{codex:{limitId:'codex'}}};};
 const refresh=m.refresh();await new Promise(r=>setImmediate(r));m.start=()=>{};m.restart();m.invalidate('changed');finish();await refresh;
 assert.equal(m.snapshot().scope,null);assert.equal(m.snapshot().at,null);assert.equal(m.timer,undefined);
});
test('read-generated notifications do not form a request loop; external bursts coalesce',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-update-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const m=new QuotaMonitor({dataDir:dir,fixture:true});t.after(()=>m.close());m.ready=true;let calls=0;
 m.refresh=async()=>{m.busy=true;calls++;m.limitsUpdated();await new Promise(r=>setTimeout(r,5));m.busy=false;};
 for(let i=0;i<20;i++)m.limitsUpdated();await new Promise(r=>setTimeout(r,600));assert.equal(calls,1);
 m.limitsUpdated();await new Promise(r=>setTimeout(r,350));assert.equal(calls,2);
});
