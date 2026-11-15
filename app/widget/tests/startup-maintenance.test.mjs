import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const app=fileURLToPath(new URL('../../',import.meta.url));
const windows={skip:process.platform!=='win32'};
const ps=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
const released={status:'released',enabled:false,rollback:'DisableDebugging-succeeded'};
function fixture(t,{settings,lease,off='release',task='own'}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-startup-maintenance-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const target=path.join(root,'target'),backup=path.join(target,'backups/previous'),trace=path.join(root,'trace.txt');
 fs.mkdirSync(target,{recursive:true});
 for(const file of ['Uninstall.ps1','Restore-PreviousVersion.ps1','Official-Startup-Maintenance.ps1']){
  // Never open the real installation's named mutex or execute its Off entry.
  write(path.join(target,file),fs.readFileSync(path.join(app,file),'utf8').replaceAll('Local\\WorkPetOfficialStartupLease-OpenAI.Codex','Local\\WorkPetMaintenanceFixture-'+crypto.randomUUID()));
 }
 const mark=label=>"[IO.File]::AppendAllText("+quote(trace)+","+quote(label+'\n')+")\n";
 for(const [file,label] of [['Restore-Background.ps1','background-off'],['Stop-Widget.ps1','widget-stop'],['Restore-Entries.ps1','entries-off'],['Resume-Widget.ps1','widget-resume'],['Update-Background.ps1','background-update']])write(path.join(target,file),'param($InstallRoot)\n'+mark(label));
 write(path.join(target,'widget/desktop/supervisor.ps1'),'param($DataDir,[switch]$Stop)\n'+mark('supervisor-stop'));
 const data=path.join(target,'data/official-startup');
 if(settings!==undefined)write(path.join(data,'settings.json'),JSON.stringify(settings));
 if(lease!==undefined)write(path.join(data,'lease-state.json'),typeof lease==='string'?lease:JSON.stringify(lease));
 let offBody=mark('off');
 if(off==='throw')offBody+="throw 'Fixture Off failed'\n";
 else{
  offBody+='New-Item -ItemType Directory -Path '+quote(data)+' -Force | Out-Null\n'+
   '[IO.File]::WriteAllText('+quote(path.join(data,'settings.json'))+',\'{"enabled":false}\')\n';
  if(off==='release')offBody+='[IO.File]::WriteAllText('+quote(path.join(data,'lease-state.json'))+','+quote(JSON.stringify(released))+')\n';
 }
 write(path.join(target,'Set-OfficialStartup.ps1'),'param($InstallRoot,$State)\nif($State -ne "Off"){throw "Fixture refuses enabling"}\n'+offBody);
 write(path.join(backup,'rollback.json'),JSON.stringify({project:'codex_work_pet',installRoot:target}));
 const taskBody=task==='none'?'$null':"[pscustomobject]@{TaskName='Mutsumi Codex Companion';Actions=@([pscustomobject]@{Arguments="+quote('-File "'+(task==='own'?path.join(target,'widget/desktop/supervisor.ps1'):path.join(root,'other/supervisor.ps1'))+'"')+'})}';
 const wrapper=path.join(root,'run.ps1');
 write(wrapper,'\uFEFFparam([string]$Mode)\n$ErrorActionPreference="Stop"\n'+
  'function Get-ScheduledTask {param($TaskName,$ErrorAction) '+taskBody+'}\n'+
  'function Unregister-ScheduledTask {param($TaskName,$Confirm) '+mark('task-remove')+'}\n'+
  'function Start-Sleep {param($Seconds)}\n'+
  "if($Mode -eq 'Restore'){& "+quote(path.join(target,'Restore-PreviousVersion.ps1'))+' -InstallRoot '+quote(target)+' -BackupDirectory '+quote(backup)+'}else{& '+quote(path.join(target,'Uninstall.ps1'))+' -InstallRoot '+quote(target)+'}\n');
 return {root,target,backup,trace,data,wrapper};
}
function invoke(f,mode='Uninstall'){
 return spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',f.wrapper,'-Mode',mode],{encoding:'utf8',windowsHide:true,timeout:25000});
}
const events=f=>fs.existsSync(f.trace)?fs.readFileSync(f.trace,'utf8').trim().split('\n'):[];
function snapshot(root){
 return fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(item=>item.isFile()).map(item=>{
  const file=path.join(item.parentPath,item.name);return [path.relative(root,file),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')];
 }).sort((a,b)=>a[0].localeCompare(b[0]));
}

for(const mode of ['Uninstall','Restore'])test(`${mode} rejects an unrelated companion task before Off or any file changes`,windows,t=>{
 const f=fixture(t,{task:'other',settings:{enabled:true},lease:{status:'active',enabled:true}}),before=snapshot(f.target);
 const result=invoke(f,mode);assert.notEqual(result.status,0);assert.match(result.stderr,/Task belongs to another installation/);
 assert.deepEqual(events(f),[]);assert.deepEqual(snapshot(f.target),before);
});

for(const [label,off,lease] of [
 ['Off throws','throw',{status:'active',enabled:true}],
 ['lease still active','leave',{status:'active',enabled:true}],
 ['release failed','leave',{status:'release-failed',enabled:false,rollback:'DisableDebugging-failed'}],
 ['release unverified','leave',{status:'released',enabled:false}],
 ['damaged lease','leave','\0\0'],
])test(`maintenance stops before component changes when ${label}`,windows,t=>{
 for(const mode of ['Uninstall','Restore']){
  const f=fixture(t,{settings:{enabled:true},lease,off});
  write(path.join(f.backup,'replace-me.txt'),'backup');write(path.join(f.target,'replace-me.txt'),'current');
  const result=invoke(f,mode);assert.notEqual(result.status,0);
  assert.deepEqual(events(f),['off']);assert.equal(fs.readFileSync(path.join(f.target,'replace-me.txt'),'utf8'),'current');
 }
});

test('uninstall disables and verifies its lease before stopping or removing the companion',windows,t=>{
 const f=fixture(t,{settings:{enabled:true},lease:{status:'active',enabled:true}}),result=invoke(f);
 assert.equal(result.status,0,result.stderr||result.stdout);
 assert.deepEqual(events(f),['off','background-off','widget-stop','entries-off','task-remove']);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.data,'settings.json'),'utf8')).enabled,false);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.data,'lease-state.json'),'utf8')),released);
});

test('maintenance accepts a never configured installation and queued On disabled before any lease was acquired',windows,t=>{
 for(const options of [{task:'none'},{settings:{enabled:true},off:'leave'}]){
  const f=fixture(t,options),result=invoke(f);assert.equal(result.status,0,result.stderr||result.stdout);
  assert.equal(fs.existsSync(path.join(f.data,'lease-state.json')),false);
  assert.deepEqual(events(f),options.settings?['off','background-off','widget-stop','entries-off','task-remove']:['background-off','widget-stop','entries-off']);
 }
});

test('rollback restores startup and animation components while preserving Off and private animation files',windows,t=>{
 const f=fixture(t,{settings:{enabled:true},lease:{status:'active',enabled:true}});
 const componentFiles=['official-startup/StartupBridge.cs','official-startup/StartupBridge.exe','official-startup/reviewed-candidate.json','official-startup/Lease.ps1','animation/player.cs','boot/WorkPetAnimation.exe'];
 for(const file of componentFiles){write(path.join(f.target,file),'current '+file);write(path.join(f.backup,file),'previous '+file);}
 for(const file of ['boot/private-video.mp4','boot/animation-config.json']){write(path.join(f.target,file),'private current');write(path.join(f.backup,file),'private old');}
 write(path.join(f.backup,'data/official-startup/settings.json'),'{"enabled":true}');
 write(path.join(f.backup,'data/official-startup/lease-state.json'),'{"status":"active","enabled":true}');
 const result=invoke(f,'Restore');assert.equal(result.status,0,result.stderr||result.stdout);
 assert.deepEqual(events(f),['off','supervisor-stop','widget-resume','background-update']);
 for(const file of componentFiles)assert.equal(fs.readFileSync(path.join(f.target,file),'utf8'),'previous '+file,file);
 for(const file of ['boot/private-video.mp4','boot/animation-config.json'])assert.equal(fs.readFileSync(path.join(f.target,file),'utf8'),'private current',file);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.data,'settings.json'),'utf8')).enabled,false);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.data,'lease-state.json'),'utf8')),released);
});
