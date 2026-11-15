import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../../Official-Startup.ps1',import.meta.url));
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
const packageName='OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0';
const family='OpenAI.Codex_2p2nqsd0c76g0';
const hash='A'.repeat(64);
const settings=()=>({enabled:true,consentVersion:1,packageFamilyName:family,packageFullName:packageName,lifecycleAcknowledged:true,noOtherDebuggerConfirmed:true,callbackSha256:hash,allowPackageUpdates:false});
function run(t,body,configuration=settings()) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-official-monitor-'));
 t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});});
 const data=path.join(root,'data/official-startup');fs.mkdirSync(data,{recursive:true});
 fs.mkdirSync(path.join(root,'official-startup'));
 fs.writeFileSync(path.join(root,'official-startup/Lease.ps1'),'# never executed');
 fs.writeFileSync(path.join(root,'official-startup/StartupBridge.exe'),'fixture');
 if(configuration!==null)fs.writeFileSync(path.join(data,'settings.json'),typeof configuration==='string'?configuration:JSON.stringify(configuration));
 const script=path.join(root,'check.ps1');
 fs.writeFileSync(script,'\uFEFF$ErrorActionPreference="Stop"\n$root='+quote(root)+'\n. '+quote(source)+'\n'+`
 # Get-FileHash is an exported function; load Utility before installing mocks,
 # so a later ConvertFrom-Json autoload cannot replace the mocked function.
 Import-Module Microsoft.PowerShell.Utility -ErrorAction Stop
 $global:starts=@();$global:packageReads=0;$global:hashReads=0;$global:disposes=0
 $global:registered=${quote(packageName)};$global:family=${quote(family)};$global:digest=${quote(hash)}
 function Get-AppxPackage {param($Name) $global:packageReads++;[pscustomobject]@{PackageFamilyName=$global:family;PackageFullName=$global:registered}}
 function Get-FileHash {param($LiteralPath,$Algorithm) $global:hashReads++;[pscustomobject]@{Hash=$global:digest}}
 function Start-Process {param($FilePath,$ArgumentList,$WindowStyle,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
  $global:starts+=@([pscustomobject]@{file=$FilePath;args=$ArgumentList;style=$WindowStyle})
  $child=[pscustomobject]@{Id=8123;HasExited=$false;StartTime=[datetime]'2026-01-01T00:00:00Z'}
  $child|Add-Member ScriptMethod Dispose {$global:disposes++}
  $child|Add-Member ScriptMethod WaitForExit {param($Milliseconds) $this.HasExited=$true;return $true}
  $child|Add-Member ScriptMethod Kill {throw 'Controller must never kill a process'}
  return $child
 }
 function Stop-Process {throw 'Controller must never stop a process'}
 $monitor=New-MutsumiOfficialStartup $root
 $now=[datetime]'2026-11-15T00:00:00Z'
 `+body);
 const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const result=spawnSync(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',script],{
  windowsHide:true,encoding:'utf8',timeout:20000,
  env:{...process.env,PSModulePath:path.join(path.dirname(powershell),'Modules')}
 });
 const stateFile=path.join(data,'controller-state.json');
 const state=fs.existsSync(stateFile)?fs.readFileSync(stateFile,'utf8'):'';
 assert.equal(result.status,0,[result.stderr,result.stdout,state].filter(Boolean).join('\n'));
 return root;
}

test('missing, damaged and incomplete consent cannot start or discover a package',windows,t=>{
 const inputs=[null,'{broken',{}, {...settings(),lifecycleAcknowledged:false}, {...settings(),noOtherDebuggerConfirmed:false}, {...settings(),enabled:'true'}, {...settings(),consentVersion:'1'}, {...settings(),allowPackageUpdates:'true'}, [settings()], {...settings(),callbackSha256:[hash]}];
 for(const input of inputs)run(t,`Invoke-MutsumiOfficialStartup $monitor $now
 if($global:starts.Count -ne 0 -or $global:packageReads -ne 0){throw 'Invalid consent performed startup work'}`,input);
});

test('confirmed controller starts one hidden lease and passes exact package and owner identity',windows,t=>{
 run(t,`Invoke-MutsumiOfficialStartup $monitor $now
 Invoke-MutsumiOfficialStartup $monitor ($now.AddSeconds(2))
 if($global:starts.Count -ne 1){throw 'Duplicate broker'}
 $args=$global:starts[0].args
 if($global:starts[0].style -ne 'Hidden' -or $args -notmatch ' -Persistent ' -or $args -notmatch (' -OwnerProcessId '+$PID+' ') -or $args -notmatch ' -OwnerStartedAt "[^"]+"' -or $args -notmatch [regex]::Escape(${quote(packageName)})){throw 'Owner/package binding missing'}
 if($args -notmatch ' -AcknowledgeLifecycleChanges -ConfirmNoOtherDebugger'){throw 'Consent was not forwarded'}
 Close-MutsumiOfficialStartup $monitor
 if($monitor.child -or $global:disposes -ne 1){throw 'Handle not released'}
 $closed=Get-Content (Join-Path $root 'data/official-startup/close-state.json') -Raw|ConvertFrom-Json
 if($closed.status -ne 'release-unconfirmed' -or $closed.reason -ne 'broker-exited-without-release-receipt'){throw 'Exit was mistaken for verified release'}`);
});

test('changed hash, unrelated package and unapproved version never start a broker',windows,t=>{
 for(const override of ["$global:digest='B'*64", "$global:family='Unrelated.Package'", "$global:registered='OpenAI.Codex_26.1115.1000.0_x64__2p2nqsd0c76g0'"]){
  run(t,override+`\nInvoke-MutsumiOfficialStartup $monitor $now
   if($global:starts.Count -ne 0){throw 'Unreviewed target was launched'}
   $state=Get-Content (Join-Path $root 'data/official-startup/controller-state.json') -Raw|ConvertFrom-Json
   if($state.status -ne 'not-started'){throw 'Failure was not recorded'}`);
 }
});

test('approved same-family updates use the new exact package name',windows,t=>{
 run(t,`$global:registered='OpenAI.Codex_26.1115.1000.0_x64__2p2nqsd0c76g0'
 Invoke-MutsumiOfficialStartup $monitor $now
 if($global:starts.Count -ne 1 -or $global:starts[0].args -notmatch [regex]::Escape($global:registered)){throw 'Approved update was not bound exactly'}`,{...settings(),allowPackageUpdates:true});
});

test('exited lease is disposed and retried after the bounded backoff',windows,t=>{
 run(t,`Invoke-MutsumiOfficialStartup $monitor $now
 $monitor.child.HasExited=$true
 Invoke-MutsumiOfficialStartup $monitor ($now.AddSeconds(2))
 if($monitor.child -or $global:starts.Count -ne 1 -or $global:disposes -ne 1){throw 'Early retry or leaked child'}
 Invoke-MutsumiOfficialStartup $monitor ($now.AddSeconds(31))
 if($global:starts.Count -ne 2){throw 'Exited broker never retried'}`);
});

test('disable signals only an exact owned lease and never kills a process',windows,t=>{
 run(t,`Invoke-MutsumiOfficialStartup $monitor $now
 $leaseId=[guid]::NewGuid().ToString('N');$eventName='Local\\WorkPetOfficialStartupStop-'+$leaseId
 $signal=[Threading.EventWaitHandle]::new($false,[Threading.EventResetMode]::ManualReset,$eventName)
 try{
  $state=@{brokerPid=$monitor.child.Id;brokerStartedAt=$monitor.child.StartTime.ToUniversalTime().ToString('o');leaseId=$leaseId;stopEvent=$eventName}
  $state.brokerPid=99999
  $file=Join-Path $root 'data/official-startup/lease-state.json'
  $state|ConvertTo-Json|Set-Content -LiteralPath $file -Encoding UTF8
  Stop-MutsumiOwnedStartupLease $monitor
  if($signal.WaitOne(0)){throw 'Foreign lease was signaled'}
  $state.brokerPid=$monitor.child.Id;$state.brokerStartedAt='2020-01-01T00:00:00Z'
  $state|ConvertTo-Json|Set-Content -LiteralPath $file -Encoding UTF8
  Stop-MutsumiOwnedStartupLease $monitor
  if($signal.WaitOne(0)){throw 'Recycled PID lease was signaled'}
  $state.brokerStartedAt=$monitor.child.StartTime.ToUniversalTime().ToString('o')
  $state|ConvertTo-Json|Set-Content -LiteralPath $file -Encoding UTF8
  @{enabled=$false}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'data/official-startup/settings.json') -Encoding UTF8
  Invoke-MutsumiOfficialStartup $monitor ($now.AddSeconds(2))
  if(!$signal.WaitOne(0)){throw 'Owned lease did not receive stop'}
  if($global:starts.Count -ne 1){throw 'Disable started a new broker'}
  Close-MutsumiOfficialStartup $monitor
 }finally{$signal.Dispose()}`);
});

test('changed consent requests owned release before a replacement broker can start',windows,t=>{
 run(t,`$global:stopRequests=0
 function Stop-MutsumiOwnedStartupLease($Monitor){$global:stopRequests++}
 Invoke-MutsumiOfficialStartup $monitor $now
 $settings=Get-Content (Join-Path $root 'data/official-startup/settings.json') -Raw|ConvertFrom-Json
 $settings.allowPackageUpdates=$true;$settings|ConvertTo-Json|Set-Content (Join-Path $root 'data/official-startup/settings.json') -Encoding UTF8
 Invoke-MutsumiOfficialStartup $monitor ($now.AddSeconds(2))
 if($global:stopRequests -ne 1 -or $global:starts.Count -ne 1){throw 'Replacement overlapped the owned lease'}
 $monitor.child.HasExited=$true
 Invoke-MutsumiOfficialStartup $monitor ($now.AddSeconds(3))
 if($global:starts.Count -ne 2){throw 'Changed consent did not restart after release'}`);
});

test('failed owned release blocks retries and survives a supervisor restart',windows,t=>{
 run(t,`Invoke-MutsumiOfficialStartup $monitor $now
 $leaseId=[guid]::NewGuid().ToString('N')
 @{status='release-failed';packageFullName=${quote(packageName)};leaseId=$leaseId;stopEvent=('Local\\WorkPetOfficialStartupStop-'+$leaseId)}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'data/official-startup/lease-state.json') -Encoding UTF8
 $monitor.child.HasExited=$true
 Invoke-MutsumiOfficialStartup $monitor ($now.AddSeconds(31))
 if($global:starts.Count -ne 1){throw 'Failed rollback caused an automatic re-enable'}
 $restarted=New-MutsumiOfficialStartup $root
 Invoke-MutsumiOfficialStartup $restarted ($now.AddSeconds(32))
 if($global:starts.Count -ne 1){throw 'Supervisor restart bypassed failed rollback'}
 $failure=Get-Content -LiteralPath (Join-Path $root 'data/official-startup/controller-state.json') -Raw|ConvertFrom-Json
 if($failure.reason -notmatch 'previous owned startup lease failed to release'){throw 'Rollback failure was not explained'}
 $saved=Get-Content -LiteralPath (Join-Path $root 'data/official-startup/settings.json') -Raw|ConvertFrom-Json
 if($saved.enabled -ne $true){throw 'Failure rewrote user consent'}`);
});

test('close waits for its real dummy broker to publish an owned release after delayed initialization',windows,t=>{
 run(t,`$dummyScript=Join-Path $root 'dummy-broker.ps1'
 @'
param([string]$Root)
$ErrorActionPreference='Stop'
$signal=$null
try{
 $leaseId=[guid]::NewGuid().ToString('N');$eventName='Local\\WorkPetOfficialStartupStop-'+$leaseId
 $signal=[Threading.EventWaitHandle]::new($false,[Threading.EventResetMode]::ManualReset,$eventName)
 $state=@{status='active';enabled=$true;brokerPid=$PID;brokerStartedAt=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().ToString('o');leaseId=$leaseId;stopEvent=$eventName;rollback='owning-broker-will-disable'}
 [IO.File]::WriteAllText((Join-Path $Root 'dummy-starting'),'ready')
 Start-Sleep -Milliseconds 400
 $file=Join-Path $Root 'data/official-startup/lease-state.json'
 $state|ConvertTo-Json|Set-Content -LiteralPath $file -Encoding UTF8
 if(!$signal.WaitOne(5000)){exit 21}
 Start-Sleep -Milliseconds 300
 $state.status='released';$state.enabled=$false;$state.rollback='DisableDebugging-succeeded'
 $state|ConvertTo-Json|Set-Content -LiteralPath $file -Encoding UTF8
 Start-Sleep -Milliseconds 400
 [IO.File]::WriteAllText((Join-Path $Root 'dummy-cleanup-complete'),'done')
}finally{if($signal){$signal.Dispose()}}
'@ | Set-Content -LiteralPath $dummyScript -Encoding UTF8
 $info=[Diagnostics.ProcessStartInfo]::new()
 $info.FileName=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
 $info.Arguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "'+$dummyScript+'" -Root "'+$root+'"'
 $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden'
 $dummy=[Diagnostics.Process]::new();$dummy.StartInfo=$info
 [void]$dummy.Start();$observer=[Diagnostics.Process]::GetProcessById($dummy.Id);[void]$observer.Handle
 try{
  $deadline=[DateTime]::UtcNow.AddSeconds(5)
  while(!(Test-Path -LiteralPath (Join-Path $root 'dummy-starting'))){if([DateTime]::UtcNow -ge $deadline){throw 'Dummy did not initialize'};Start-Sleep -Milliseconds 20}
  $monitor.child=$dummy
  $watch=[Diagnostics.Stopwatch]::StartNew()
  Close-MutsumiOfficialStartup $monitor
  if($watch.ElapsedMilliseconds -lt 850){throw 'Close returned before post-receipt cleanup'}
  if(!(Test-Path -LiteralPath (Join-Path $root 'dummy-cleanup-complete'))){throw 'Broker cleanup was cut short'}
  if(!$observer.WaitForExit(5000) -or $observer.ExitCode -ne 0){throw 'Dummy broker did not exit successfully'}
  $closed=Get-Content (Join-Path $root 'data/official-startup/close-state.json') -Raw|ConvertFrom-Json
  if($closed.status -ne 'released' -or $closed.brokerExitConfirmed -ne $true -or !$closed.leaseId -or $closed.brokerPid -ne $observer.Id){throw 'Release receipt identity or broker exit was not preserved'}
  Confirm-MutsumiPreviousStartupClose $monitor
  if($monitor.child -or $global:starts.Count -ne 0){throw 'Close launched a replacement broker'}
 }finally{[void]$observer.WaitForExit(6000);$observer.Dispose();$dummy.Dispose()}`,null);
});

test('close timeout persists across restart and only the same broker and lease can clear it',windows,t=>{
 run(t,`Invoke-MutsumiOfficialStartup $monitor $now
 $monitor.child|Add-Member ScriptMethod WaitForExit {param($Milliseconds) Start-Sleep -Milliseconds $Milliseconds;return $false} -Force
 $leaseId=[guid]::NewGuid().ToString('N')
 $state=@{status='active';enabled=$true;brokerPid=$monitor.child.Id;brokerStartedAt=$monitor.child.StartTime.ToUniversalTime().ToString('o');leaseId=$leaseId;stopEvent=('Local\\WorkPetOfficialStartupStop-'+$leaseId);rollback='owning-broker-will-disable'}
 $file=Join-Path $root 'data/official-startup/lease-state.json'
 $state|ConvertTo-Json|Set-Content -LiteralPath $file -Encoding UTF8
 $watch=[Diagnostics.Stopwatch]::StartNew()
 Close-MutsumiOfficialStartup $monitor -WaitMilliseconds 150
 if($watch.ElapsedMilliseconds -lt 100 -or $watch.ElapsedMilliseconds -gt 2000){throw 'Close wait was not bounded'}
 $closed=Get-Content (Join-Path $root 'data/official-startup/close-state.json') -Raw|ConvertFrom-Json
 if($closed.status -ne 'release-unconfirmed' -or $closed.reason -ne 'owned-broker-release-timeout' -or $closed.leaseId -cne $leaseId){throw 'Timeout lost the owned lease identity'}
 $reads=$global:packageReads
 $again=New-MutsumiOfficialStartup $root;Invoke-MutsumiOfficialStartup $again ($now.AddSeconds(31))
 if($global:starts.Count -ne 1 -or $global:packageReads -ne $reads){throw 'Restart bypassed unresolved close'}
 $state.status='released';$state.enabled=$false;$state.rollback='DisableDebugging-succeeded'
 foreach($difference in @('pid','creation','lease')){
  $foreign=$state.Clone()
  if($difference -eq 'pid'){$foreign.brokerPid++}
  if($difference -eq 'creation'){$foreign.brokerStartedAt='2020-01-01T00:00:00.0000000Z'}
  if($difference -eq 'lease'){$foreign.leaseId=[guid]::NewGuid().ToString('N');$foreign.stopEvent='Local\\WorkPetOfficialStartupStop-'+$foreign.leaseId}
  $foreign|ConvertTo-Json|Set-Content -LiteralPath $file -Encoding UTF8
  $again=New-MutsumiOfficialStartup $root;Invoke-MutsumiOfficialStartup $again ($now.AddSeconds(32))
  if($global:starts.Count -ne 1){throw 'Foreign receipt cleared the release barrier'}
 }
 $state|ConvertTo-Json|Set-Content -LiteralPath $file -Encoding UTF8
 $again=New-MutsumiOfficialStartup $root;Invoke-MutsumiOfficialStartup $again ($now.AddSeconds(33))
 if($global:starts.Count -ne 2){throw 'Matching late release could not resolve the barrier'}
 $closed=Get-Content (Join-Path $root 'data/official-startup/close-state.json') -Raw|ConvertFrom-Json
 if($closed.status -ne 'released'){throw 'Resolved release was not saved'}
 $saved=Get-Content (Join-Path $root 'data/official-startup/settings.json') -Raw|ConvertFrom-Json
 if($saved.enabled -ne $true){throw 'Close changed saved consent'}`);
});
