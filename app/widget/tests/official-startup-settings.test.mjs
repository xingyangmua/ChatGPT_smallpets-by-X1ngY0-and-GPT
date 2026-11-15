import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../../',import.meta.url));
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
function run(t,body) {
 // Match Windows PowerShell's long-path form before asserting caller identity.
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'pet-startup-settings-')));
 t.after(()=>{assert.ok(path.resolve(root).startsWith(fs.realpathSync.native(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});});
 const module=path.join(root,'official-startup');fs.mkdirSync(module);
 fs.mkdirSync(path.join(root,'data/official-startup'),{recursive:true});
 for(const file of ['Set-OfficialStartup.ps1','Official-Startup.ps1'])fs.copyFileSync(path.join(source,file),path.join(root,file));
 fs.copyFileSync(path.join(source,'official-startup/Stop.ps1'),path.join(module,'Stop.ps1'));
 fs.writeFileSync(path.join(module,'StartupBridge.exe'),'isolated callback fixture');
 fs.writeFileSync(path.join(module,'StartupBridge.cs'),'isolated reviewed source fixture');
 const callbackHash=crypto.createHash('sha256').update('isolated callback fixture').digest('hex').toUpperCase();
 const sourceHash=crypto.createHash('sha256').update('isolated reviewed source fixture').digest('hex').toUpperCase();
 // Keep the real import parameters and release-receipt gate. Replace only the
 // system-discovery boundary; no COM or actual package action may occur here.
 const lease=fs.readFileSync(path.join(source,'official-startup/Lease.ps1'),'utf8');
 fs.writeFileSync(path.join(module,'Lease.ps1'),lease+`\n
 function New-WorkPetStartupPlan([string]$Root,[string]$Callback,[string]$Hash,[int]$RequestedPort=0) {
  $global:planCalls++
  if($Root -cne $global:fixtureRoot -or $Hash -cne ${quote(callbackHash)} -or $Callback -cne (Join-Path $Root 'official-startup/StartupBridge.exe')){throw 'Caller parameters changed while importing Lease.ps1'}
  return @{root=$Root;callback=$Callback;hash=$Hash;packageFullName='OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0';packageVersion='26.1111.2228.0'}
 }
 function New-WorkPetPackageDebugApi {throw 'No real system lease may be acquired by settings'}
 function Invoke-WorkPetStartupLease {throw 'Settings must only save future consent'}
 `);
 const script=path.join(root,'check.ps1');
 fs.writeFileSync(script,'\uFEFF$ErrorActionPreference="Stop"\n$root='+quote(root)+'\n'+`
 $global:fixtureRoot=$root;$global:planCalls=0
 $command=Join-Path $root 'Set-OfficialStartup.ps1'
 $settingsFile=Join-Path $root 'data/official-startup/settings.json'
 $reviewFile=Join-Path $root 'official-startup/reviewed-candidate.json'
 $hash=${quote(callbackHash)}
 function Write-FixtureReview {
  @{schemaVersion=1;status='isolated-passed';architecture='x64';testCount=16;windowsBuild=[Environment]::OSVersion.Version.Build;callbackSha256=$hash;sourceSha256=${quote(sourceHash)}}|ConvertTo-Json|Set-Content -LiteralPath $reviewFile -Encoding UTF8
 }
 function Start-Process {throw 'Settings must not launch any process'}
 function Stop-Process {throw 'Settings must not terminate any process'}
 `+body);
 const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const result=spawnSync(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',script],{windowsHide:true,encoding:'utf8',timeout:20000,env:{...process.env,PSModulePath:path.join(path.dirname(powershell),'Modules')}});
 assert.equal(result.status,0,result.stderr+result.stdout);
}

test('On refuses missing confirmations or an absent/mismatched receipt without changing saved consent',windows,t=>{
 run(t,`[IO.File]::WriteAllText($settingsFile,'{"enabled":false,"keep":"existing"}')
 $before=[IO.File]::ReadAllText($settingsFile)
 $failed=$false;try{& $command -InstallRoot $root -State On -ReviewedCallbackSha256 $hash|Out-Null}catch{$failed=$true}
 if(!$failed -or $global:planCalls -ne 0){throw 'Missing confirmations were accepted'}
 $failed=$false;try{& $command -InstallRoot $root -State On -ReviewedCallbackSha256 $hash -AcknowledgeLifecycleChanges -ConfirmNoOtherDebugger|Out-Null}catch{$failed=$true}
 if(!$failed){throw 'Missing receipt was accepted'}
 Write-FixtureReview
 [IO.File]::WriteAllText((Join-Path $root 'official-startup/StartupBridge.cs'),'changed source')
 $failed=$false;try{& $command -InstallRoot $root -State On -ReviewedCallbackSha256 $hash -AcknowledgeLifecycleChanges -ConfirmNoOtherDebugger|Out-Null}catch{$failed=$true}
 if(!$failed){throw 'Changed reviewed source was accepted'}
 if([IO.File]::ReadAllText($settingsFile) -cne $before){throw 'A rejected On changed saved settings'}`);
});

test('On preserves explicit options through dot-sourcing and only saves consent for the future broker',windows,t=>{
 run(t,`Write-FixtureReview
 $response=& $command -InstallRoot $root -State On -ReviewedCallbackSha256 $hash -AcknowledgeLifecycleChanges -ConfirmNoOtherDebugger -AllowPackageUpdates|ConvertFrom-Json
 $saved=Get-Content -LiteralPath $settingsFile -Raw -Encoding UTF8|ConvertFrom-Json
 if($saved.enabled -ne $true -or $saved.allowPackageUpdates -ne $true -or $saved.callbackSha256 -cne $hash -or $saved.consentVersion -ne 1){throw 'Explicit settings were lost during import'}
 if($saved.lifecycleAcknowledged -ne $true -or $saved.noOtherDebuggerConfirmed -ne $true){throw 'Consent flags were lost'}
 if($response.status -ne 'awaiting-companion-lease' -or $response.realOfficialColdStartVerified -ne $false){throw 'Saving was misreported as real activation'}
 if(Test-Path -LiteralPath (Join-Path $root 'data/official-startup/lease-state.json')){throw 'On acquired a system lease'}`);
});

test('Off ignores obsolete review data, revokes consent and signals only the recorded live broker',windows,t=>{
 run(t,`[IO.File]::WriteAllText($settingsFile,'{"enabled":true,"consentVersion":"invalid"}')
 [IO.File]::WriteAllText($reviewFile,'broken obsolete receipt')
 $eventId=[guid]::NewGuid().ToString('N');$eventName='Local\\WorkPetOfficialStartupStop-'+$eventId
 $event=[Threading.EventWaitHandle]::new($false,[Threading.EventResetMode]::ManualReset,$eventName)
 $global:broker=[pscustomobject]@{Id=8891;StartTime=[datetime]'2026-01-01T00:00:00Z'}
 $global:broker|Add-Member ScriptMethod Dispose {}
 $global:leaseFile=Join-Path $root 'data/official-startup/lease-state.json'
 $lease=@{status='active';packageFullName='OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0';leaseId=$eventId;stopEvent=$eventName;brokerPid=8891;brokerStartedAt='2020-01-01T00:00:00Z'}
 function Get-Process {param($Id,$ErrorAction) if($Id -eq 8891){$global:broker}}
 function Start-Sleep {param($Milliseconds) $latest=Get-Content $global:leaseFile -Raw|ConvertFrom-Json;$latest.status='released';$latest|Add-Member NoteProperty rollback 'synthetic-owned-release' -Force;$latest|ConvertTo-Json|Set-Content $global:leaseFile -Encoding UTF8}
 try{
  $lease|ConvertTo-Json|Set-Content $global:leaseFile -Encoding UTF8
  $first=& $command -InstallRoot $root -State Off|ConvertFrom-Json
  if($event.WaitOne(0) -or $first.status -ne 'broker-not-running'){throw 'Off signaled a recycled broker PID'}
  $lease.brokerStartedAt=$global:broker.StartTime.ToUniversalTime().ToString('o');$lease|ConvertTo-Json|Set-Content $global:leaseFile -Encoding UTF8
  $second=& $command -InstallRoot $root -State Off|ConvertFrom-Json
  if(!$event.WaitOne(0) -or $second.status -ne 'released'){throw 'Off failed to signal its recorded live broker'}
  $saved=Get-Content $settingsFile -Raw|ConvertFrom-Json
  if($saved.enabled -ne $false -or $saved.PSObject.Properties['consentVersion']){throw 'Off retained enabling consent'}
  . (Join-Path $root 'Official-Startup.ps1')
  function Get-AppxPackage {throw 'Disabled consent must not discover or launch a broker'}
  Invoke-MutsumiOfficialStartup (New-MutsumiOfficialStartup $root)
  if($global:planCalls -ne 0){throw 'Off unexpectedly loaded the enabling path'}
 }finally{$event.Dispose()}`);
});
