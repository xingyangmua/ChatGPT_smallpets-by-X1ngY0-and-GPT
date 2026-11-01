import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../../',import.meta.url));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function run(t,body,setup=()=>{}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-background-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'data'));setup(root);
 const file=path.join(root,'check.ps1');fs.writeFileSync(file,'\uFEFF$ErrorActionPreference="Stop"\n$root='+quote(root)+'\n'+body);
 const r=spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',file],{windowsHide:true,encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr||r.stdout);return root;
}
test('background restore completes with a recycled PID and never stops that process',{skip:process.platform!=='win32'},t=>{
 const root=run(t,`
 function Get-Process {param($Id,$ErrorAction) $p=[pscustomobject]@{StartTime=[datetime]'2030-01-01Z'};$p | Add-Member ScriptMethod Dispose {};return $p}
 function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) [pscustomobject]@{CommandLine='unrelated service'}}
 function Stop-Process {throw 'An unrelated process must never be stopped'}
 & (Join-Path $root 'Restore-Background.ps1') -InstallRoot $root
 $s=Get-Content (Join-Path $root 'data/background-state.json') -Raw | ConvertFrom-Json
 if($s.enabled -ne $false){throw 'Restore failed to disable the stale background'}
 `,root=>{
 for(const name of ['Restore-Background.ps1','Background-Process.ps1'])fs.copyFileSync(path.join(source,name),path.join(root,name));
 fs.writeFileSync(path.join(root,'Runtime-Paths.ps1'),"function Get-MutsumiNode {param($r) 'unused'}\nfunction Invoke-MutsumiNode {param($NodePath,$Arguments) $global:LASTEXITCODE=0}");
 fs.writeFileSync(path.join(root,'data/background-state.json'),JSON.stringify({enabled:true,pid:123,startedAt:'2020-01-01Z',injector:path.join(root,'background-engine/scripts/injector.mjs').replaceAll('/','\\'),port:9335,browserId:'fixture'}));
 });assert.ok(fs.existsSync(path.join(root,'data/background-paused.json')));
});
test('ordinary search activation is reported pending without launching or killing the current client',{skip:process.platform!=='win32'},t=>{
 const root=run(t,`& (Join-Path $root 'Background-Start.ps1') -InstallRoot $root`,root=>{
 fs.copyFileSync(path.join(source,'Background-Start.ps1'),path.join(root,'Background-Start.ps1'));
 fs.writeFileSync(path.join(root,'Runtime-Paths.ps1'),"function Get-MutsumiNode {param($r) 'unused'}");
 fs.mkdirSync(path.join(root,'background-engine/scripts'),{recursive:true});
 fs.writeFileSync(path.join(root,'background-engine/scripts/common-windows.ps1'),"function Get-DreamSkinCodexInstall { @{Version='test'} }\nfunction Get-DreamSkinCodexProcesses {param($Codex) @{ProcessId=123}}\nfunction Get-DreamSkinVerifiedCdpIdentity {param($Port,$Codex) $null}\nfunction Stop-DreamSkinCodex {throw 'must not stop'}");
 });assert.equal(JSON.parse(fs.readFileSync(path.join(root,'data/background-connection.json'),'utf8').replace(/^\uFEFF/,'' )).status,'pending-restart');
});
