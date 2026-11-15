import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const app=fileURLToPath(new URL('../../',import.meta.url));
const repo=path.dirname(app.replace(/[\\/]$/,''));
const windows={skip:process.platform!=='win32'};
const ps=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
function fixture(t,{existing=false,settings,lease}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-startup-package-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,'source'),target=path.join(root,'target'),pkg=path.join(root,'package');
 fs.mkdirSync(source);fs.mkdirSync(target);
 // A private kernel-object namespace prevents isolated packaging tests from
 // interacting with a real, separately authorized startup lease.
 const mutex='Local\\WorkPetPackageFixture-'+crypto.randomUUID();
 write(path.join(source,'Install.ps1'),fs.readFileSync(path.join(app,'Install.ps1'),'utf8').replaceAll('Local\\WorkPetOfficialStartupLease-OpenAI.Codex',mutex));
 write(path.join(source,'Repair-Client.ps1'),fs.readFileSync(path.join(app,'Repair-Client.ps1')));
 write(path.join(source,'Build-Entries.ps1'),"param($InstallRoot) [IO.File]::WriteAllText((Join-Path $InstallRoot 'entries-built.txt'),'ordinary entries only')");
 write(path.join(source,'official-startup/Lease.ps1'),'# source candidate');
 write(path.join(source,'official-startup/Stop.ps1'),'# candidate stop tool');
 write(path.join(source,'official-startup/StartupBridge.cs'),'// candidate source');
 write(path.join(source,'official-startup/StartupBridge.exe'),'private reviewed binary; must not copy');
 write(path.join(source,'official-startup/reviewed-candidate.json'),'{"authorizationGranted":false}');
 write(path.join(source,'Official-Startup.ps1'),'# default disabled controller');
 write(path.join(pkg,'app/ChatGPT.exe'),'inert fixture');write(path.join(pkg,'app/resources/codex.exe'),'inert fixture');
 if(existing)write(path.join(target,'data/mutsumi-install.json'),JSON.stringify({codexHome:path.join(root,'profile')}));
 if(settings!==undefined)write(path.join(target,'data/official-startup/settings.json'),typeof settings==='string'?settings:JSON.stringify(settings));
 if(lease!==undefined)write(path.join(target,'data/official-startup/lease-state.json'),typeof lease==='string'?lease:JSON.stringify(lease));
 const wrapper=path.join(root,'run.ps1');
 write(wrapper,'\uFEFFparam([string]$Mode)\n$ErrorActionPreference="Stop"\n'+
  'function Get-AppxPackage {param($Name) [pscustomobject]@{Name="OpenAI.Codex";InstallLocation='+quote(pkg)+';Version="26.1.1.0";PackageFamilyName="OpenAI.Codex_2p2nqsd0c76g0"}}\n'+
  'function Get-Process {param($Name,$ErrorAction) @()}\n'+
  'function Get-ScheduledTask {param($TaskName,$ErrorAction) $null}\n'+
  '$script='+quote(path.join(source,'Install.ps1'))+'\n$target='+quote(target)+'\n'+
  "if($Mode -eq 'Prepare'){& $script -InstallRoot $target -PrepareOnly}else{& $script -InstallRoot $target -PreflightOnly}\n");
 return {root,source,target,wrapper,mutex};
}
function invoke(f,mode='Preflight'){
 return spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',f.wrapper,'-Mode',mode],{encoding:'utf8',windowsHide:true,timeout:25000});
}
function snapshot(root){
 return fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(item=>item.isFile()).map(item=>{
  const file=path.join(item.parentPath,item.name);return [path.relative(root,file),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')];
 }).sort((a,b)=>a[0].localeCompare(b[0]));
}

test('first isolated preparation includes startup sources but no local binary, review receipt or enabled settings',windows,t=>{
 const f=fixture(t),runtime=path.join(f.root,'runtime');
 write(path.join(runtime,'electron.exe'),'inert fixture');write(path.join(runtime,'LICENSE'),'fixture');write(path.join(runtime,'LICENSES.chromium.html'),'fixture');
 const archive=spawnSync(ps,['-NoProfile','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('+quote(runtime)+','+quote(path.join(f.source,'electron-runtime.zip'))+')'],{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(archive.status,0,archive.stderr);
 const result=invoke(f,'Prepare');assert.equal(result.status,0,result.stderr||result.stdout);
 assert.match(result.stdout,/prepared-only/);
 for(const name of ['Lease.ps1','Stop.ps1','StartupBridge.cs'])assert.ok(fs.existsSync(path.join(f.target,'official-startup',name)),name);
 for(const name of ['StartupBridge.exe','reviewed-candidate.json'])assert.equal(fs.existsSync(path.join(f.target,'official-startup',name)),false,name);
 assert.equal(fs.existsSync(path.join(f.target,'data/official-startup/settings.json')),false);
 assert.equal(fs.existsSync(path.join(f.target,'data/official-startup/lease-state.json')),false);
 assert.ok(fs.existsSync(path.join(f.target,'Repair-Client.ps1')));
 assert.ok(fs.existsSync(path.join(f.target,'entries-built.txt')));
});

for(const [label,settings,lease] of [
 ['enabled startup',{enabled:true},undefined],
 ['malformed settings','{"enabled":',undefined],
 ['ambiguous settings',{enabled:'false'},undefined],
 ['active lease',{enabled:false},{status:'active',enabled:true}],
 ['failed release',{enabled:false},{status:'release-failed',enabled:false,rollback:'DisableDebugging-failed'}],
 ['unverified release',{enabled:false},{status:'released',enabled:false}],
 ['damaged lease',{enabled:false},'\0\0'],
])test(`installer rejects ${label} before changing any target files`,windows,t=>{
 const f=fixture(t,{existing:true,settings,lease}),before=snapshot(f.target);
 const result=invoke(f);assert.notEqual(result.status,0);
 assert.match(result.stderr,/installed Disable-OfficialStartup|installed.*Off/);
 assert.deepEqual(snapshot(f.target),before);
});

test('absent or explicitly released startup state permits read-only installation preflight',windows,t=>{
 for(const options of [{existing:true},{existing:true,settings:{enabled:false},lease:{status:'released',enabled:false,rollback:'DisableDebugging-succeeded'}}]){
  const f=fixture(t,options),before=snapshot(f.target),result=invoke(f);
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.deepEqual(snapshot(f.target),before);
 }
});

test('a live lease blocks installation even before any lease-state file exists',windows,async t=>{
 const f=fixture(t,{existing:true}),before=snapshot(f.target),ready=path.join(f.root,'ready'),stop=path.join(f.root,'stop');
 const holder=path.join(f.root,'hold.ps1');
 write(holder,'$ErrorActionPreference="Stop"\n$m=[Threading.Mutex]::new($false,'+quote(f.mutex)+')\n'+
  'if(!$m.WaitOne(0)){throw "Fixture mutex already owned"}\ntry{[IO.File]::WriteAllText('+quote(ready)+',"ready");'+
  'for($n=0;$n -lt 100 -and !(Test-Path -LiteralPath '+quote(stop)+');$n++){Start-Sleep -Milliseconds 100}}finally{$m.ReleaseMutex();$m.Dispose()}');
 const child=spawn(ps,['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',holder],{windowsHide:true});
 let errors='';child.stderr.on('data',value=>errors+=value);
 const closed=new Promise(resolve=>child.on('close',resolve));
 try{
  const deadline=Date.now()+5000;
  while(!fs.existsSync(ready)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(fs.existsSync(ready),errors||'Fixture lease did not become ready');
  const result=invoke(f);assert.notEqual(result.status,0);
  assert.match(result.stderr,/official-startup lease is active/);
  assert.deepEqual(snapshot(f.target),before);
 }finally{write(stop,'stop');await closed;}
});

const pythonCandidates=[process.env.MUTSUMI_TEST_PYTHON,'python3','python'].filter(Boolean);
const python=pythonCandidates.find(command=>spawnSync(command,['--version'],{encoding:'utf8',windowsHide:true,timeout:5000}).status===0);
test('release archive retains repair and candidate sources while excluding local approval evidence and executables',{skip:!python},t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-package-archive-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 write(path.join(root,'tools/build_release.py'),fs.readFileSync(path.join(repo,'tools/build_release.py')));
 write(path.join(root,'app/Repair-Client.ps1'),'# repair');
 write(path.join(root,'app/official-startup/Lease.ps1'),'# lease');
 write(path.join(root,'app/official-startup/StartupBridge.cs'),'// source\r\n');
 write(path.join(root,'app/official-startup/StartupBridge.exe'),'private local binary');
 write(path.join(root,'app/official-startup/reviewed-candidate.json'),'{"status":"isolated-passed"}');
 write(path.join(root,'app/data/official-startup/settings.json'),'{"enabled":true}');
 const runtime=path.join(root,'runtime.zip');
 let result=spawnSync(python,['-c','import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],"w") as z:\n for n in ["electron.exe","LICENSE","LICENSES.chromium.html"]: z.writestr(n,"inert fixture")',runtime],{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(result.status,0,result.stderr);
 result=spawnSync(python,[path.join(root,'tools/build_release.py'),'--electron-archive',runtime,'--output',path.join(root,'dist'),'--version','1.1.0-isolated-test'],{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);
 result=spawnSync(python,['-c','import sys,zipfile,json\nwith zipfile.ZipFile(sys.argv[1]) as z: print(json.dumps(z.namelist()))',report.file],{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(result.status,0,result.stderr);
 const names=JSON.parse(result.stdout);
 for(const name of ['Repair-Client.ps1','official-startup/Lease.ps1','official-startup/StartupBridge.cs','electron-runtime.zip'])assert.ok(names.includes(name),name);
 for(const name of ['official-startup/StartupBridge.exe','official-startup/reviewed-candidate.json','data/official-startup/settings.json'])assert.equal(names.includes(name),false,name);
});
