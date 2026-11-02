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

test('cold theme launch never falls through to a second normal or animation launch',{skip:process.platform!=='win32'},t=>{
 const root=run(t,`
 $global:fixtureReads=0;$global:fixtureStarts=@()
 function Get-Process {param($Name,$ErrorAction) $global:fixtureReads++;if($global:fixtureReads -gt 1){[pscustomobject]@{Path=(Join-Path $root 'ChatGPT.exe')}}}
 function Start-Process {param($FilePath,$ArgumentList,$WindowStyle) $global:fixtureStarts+=@($FilePath)}
 & (Join-Path $root 'Launch-Client.ps1') -InstallRoot $root
 if($global:fixtureStarts.Count -ne 1 -or $global:fixtureStarts[0] -ne 'companion.exe'){throw ('Duplicate client activation: '+($global:fixtureStarts -join ','))}
 if(!(Test-Path (Join-Path $root 'data/start-called'))){throw 'Theme launch was skipped'}
 `,root=>{
 fs.copyFileSync(path.join(source,'Launch-Client.ps1'),path.join(root,'Launch-Client.ps1'));
 fs.writeFileSync(path.join(root,'Repair-Client.ps1'),"param($InstallRoot) @{clientExe=(Join-Path $InstallRoot 'ChatGPT.exe');appId='fixture!App'}");
 fs.writeFileSync(path.join(root,'Background-Start.ps1'),"param($InstallRoot) [IO.File]::WriteAllText((Join-Path $InstallRoot 'data/start-called'),'yes')");
 fs.writeFileSync(path.join(root,'data/follow-config.json'),JSON.stringify({launcherPath:'companion.exe'}));
 fs.mkdirSync(path.join(root,'boot'));fs.writeFileSync(path.join(root,'boot/DragonCodexBoot.exe'),'fixture');
 });assert.ok(fs.existsSync(path.join(root,'data/start-called')));
});

test('attach-only monitoring never launches a missing client',{skip:process.platform!=='win32'},t=>{
 const root=run(t,`& (Join-Path $root 'Background-Start.ps1') -InstallRoot $root -AttachOnly`,root=>{
 fs.copyFileSync(path.join(source,'Background-Start.ps1'),path.join(root,'Background-Start.ps1'));
 fs.writeFileSync(path.join(root,'Runtime-Paths.ps1'),"function Get-MutsumiNode {param($r) 'unused'}");
 fs.mkdirSync(path.join(root,'background-engine/scripts'),{recursive:true});
 fs.writeFileSync(path.join(root,'background-engine/scripts/common-windows.ps1'),"function Get-DreamSkinCodexInstall { @{Version='test'} }\nfunction Get-DreamSkinCodexProcesses {param($Codex) @()}\nfunction Start-DreamSkinCodex {throw 'must not launch'}");
 });assert.equal(fs.existsSync(path.join(root,'data/background-connection.json')),false);
});

test('background start failure replaces stale pending status with its actual reason',{skip:process.platform!=='win32'},t=>{
 const root=run(t,`& (Join-Path $root 'Background-Start.ps1') -InstallRoot $root`,root=>{
 fs.copyFileSync(path.join(source,'Background-Start.ps1'),path.join(root,'Background-Start.ps1'));
 fs.writeFileSync(path.join(root,'Runtime-Paths.ps1'),"function Get-MutsumiNode {param($r) throw 'runtime fixture failure'}");
 fs.writeFileSync(path.join(root,'data/background-connection.json'),JSON.stringify({status:'pending-restart'}));
 });const result=JSON.parse(fs.readFileSync(path.join(root,'data/background-connection.json'),'utf8').replace(/^\uFEFF/,''));assert.equal(result.status,'failed');assert.equal(result.reason,'runtime fixture failure');
});

test('ordinary reconnect does not erase a cold-start failure for the same client session',{skip:process.platform!=='win32'},t=>{
 const root=run(t,`& (Join-Path $root 'Background-Start.ps1') -InstallRoot $root -AttachOnly`,root=>{
 fs.copyFileSync(path.join(source,'Background-Start.ps1'),path.join(root,'Background-Start.ps1'));
 fs.writeFileSync(path.join(root,'Runtime-Paths.ps1'),"function Get-MutsumiNode {param($r) 'unused'}");
 fs.mkdirSync(path.join(root,'background-engine/scripts'),{recursive:true});
 fs.writeFileSync(path.join(root,'background-engine/scripts/common-windows.ps1'),"function Get-DreamSkinCodexInstall { @{Version='test'} }\nfunction Get-DreamSkinCodexProcesses {param($Codex) @{ProcessId=123;ParentProcessId=1;CreationDate='fixture-start'}}\nfunction Get-NetTCPConnection {param($State,$LocalPort,$ErrorAction) @()}\nfunction Get-DreamSkinVerifiedCdpIdentity {throw 'No listener must never be contacted'}");
 fs.writeFileSync(path.join(root,'data/background-connection.json'),JSON.stringify({status:'failed',reason:'no listener after cold start',clientSession:'123|fixture-start'}));
 });const result=JSON.parse(fs.readFileSync(path.join(root,'data/background-connection.json'),'utf8').replace(/^\uFEFF/,''));assert.equal(result.status,'failed');assert.equal(result.reason,'no listener after cold start');
});

test('failed theme probe preserves the client and records the failing stage',{skip:process.platform!=='win32'},t=>{
 const root=run(t,`
 $env:APPDATA=$root
 $output=& (Join-Path $root 'Background-Probe.ps1') -InstallRoot $root -Evidence (Join-Path $root 'evidence') -NodePath 'unused'
 $r=$output | ConvertFrom-Json
 if($r.ok -or !$r.clientPreserved -or $r.stage -ne 'launch' -or $r.error -ne 'launch fixture failure'){throw 'Failure was swallowed or client preservation missing'}
 `,root=>{
 fs.copyFileSync(path.join(source,'Background-Probe.ps1'),path.join(root,'Background-Probe.ps1'));
 fs.writeFileSync(path.join(root,'Runtime-Paths.ps1'),'');
 fs.mkdirSync(path.join(root,'background-engine/scripts'),{recursive:true});
 fs.writeFileSync(path.join(root,'background-engine/scripts/common-windows.ps1'),"function Get-DreamSkinCodexInstall { @{Version='test'} }\nfunction Get-DreamSkinCodexProcesses {param($Codex) @()}\nfunction Test-DreamSkinPortAvailable {param($Port) $true}\nfunction Start-DreamSkinCodex {param($Codex,$Arguments) throw 'launch fixture failure'}\nfunction Stop-DreamSkinCodex {throw 'must not stop the client'}");
 fs.mkdirSync(path.join(root,'Codex/web/Codex'),{recursive:true});fs.writeFileSync(path.join(root,'Codex/web/Codex/Local State'),'{}');fs.mkdirSync(path.join(root,'evidence'));
 });assert.ok(fs.existsSync(path.join(root,'evidence/background-probe.json')));
});

test('background reconnect follows every host lifecycle with one bounded helper',{skip:process.platform!=='win32'},t=>{
 run(t,`
 . (Join-Path $root 'Background-Reconnect.ps1')
 $script:starts=0;$script:kills=0;$script:args=''
 function Start-Process {param($FilePath,$ArgumentList,$WindowStyle,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
  $script:starts++;$script:args=$ArgumentList
  $p=[pscustomobject]@{HasExited=$false};$p | Add-Member ScriptMethod Dispose {};$p | Add-Member ScriptMethod Kill {$script:kills++};return $p
 }
 $m=New-MutsumiBackgroundReconnect $root;$now=[datetime]'2030-01-01Z'
 Invoke-MutsumiBackgroundReconnect $m $false 0 $now
 if($script:starts){throw 'Monitor opened a missing client'}
 Invoke-MutsumiBackgroundReconnect $m $true 10 $now
 Invoke-MutsumiBackgroundReconnect $m $true 10 $now.AddSeconds(60)
 if($script:starts -ne 1 -or $script:args -notmatch '-AttachOnly'){throw 'Concurrent helper or unrestricted launch'}
 $m.child.HasExited=$true
 Invoke-MutsumiBackgroundReconnect $m $true 10 $now.AddSeconds(2)
 if($script:starts -ne 1){throw 'Retry was not debounced'}
 Invoke-MutsumiBackgroundReconnect $m $true 11 $now.AddSeconds(3)
 if($script:starts -ne 2){throw 'New client was not noticed'}
 Close-MutsumiBackgroundReconnect $m
 if($script:kills -ne 1 -or $m.child){throw 'Owned pending helper was not closed'}
 @{enabled=$false}|ConvertTo-Json|Set-Content (Join-Path $root 'data/background-state.json')
 Invoke-MutsumiBackgroundReconnect $m $true 12 $now.AddSeconds(4)
 if($script:starts -ne 2){throw 'Disabled background was re-enabled'}
 @{enabled=$true}|ConvertTo-Json|Set-Content (Join-Path $root 'data/background-state.json')
 Invoke-MutsumiBackgroundReconnect $m $true 13 $now.AddSeconds(5)
 Invoke-MutsumiBackgroundReconnect $m $true 13 $now.AddSeconds(126)
 if($script:starts -ne 4 -or $script:kills -ne 2){throw 'Hung helper did not recover within its deadline'}
 Close-MutsumiBackgroundReconnect $m
 `,root=>{fs.copyFileSync(path.join(source,'Background-Reconnect.ps1'),path.join(root,'Background-Reconnect.ps1'));fs.writeFileSync(path.join(root,'Background-Start.ps1'),'fixture');});
});
