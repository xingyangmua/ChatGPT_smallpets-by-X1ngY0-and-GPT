[CmdletBinding()]
param([string]$InstallRoot,[ValidateRange(1,30)][int]$WaitSeconds=10)
$ErrorActionPreference='Stop'
if(!$InstallRoot){$InstallRoot=Split-Path -Parent $PSScriptRoot}
$file=Join-Path ([IO.Path]::GetFullPath($InstallRoot)) 'data\official-startup\lease-state.json'
if(!(Test-Path -LiteralPath $file -PathType Leaf)){@{status='no-recorded-lease';modified=$false} | ConvertTo-Json;return}
$state=Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
if($state.packageFullName -notmatch '^OpenAI\.Codex_[^\\/]+_x64__2p2nqsd0c76g0$' -or $state.leaseId -notmatch '^[a-f0-9]{32}$' -or $state.stopEvent -cne ('Local\WorkPetOfficialStartupStop-'+$state.leaseId)){throw 'Lease identity is invalid; no unrelated state was modified'}
if($state.status -eq 'released'){@{status='already-released';modified=$false;rollback=$state.rollback} | ConvertTo-Json;return}
$broker=Get-Process -Id $state.brokerPid -ErrorAction SilentlyContinue
if(!$broker -or $broker.StartTime.ToUniversalTime().ToString('o') -cne $state.brokerStartedAt){@{status='broker-not-running';modified=$false;leaseRelease='not-verified';suspendedThreadRecovery='not-guaranteed'} | ConvertTo-Json;return}
$signal=$null
try{$signal=[Threading.EventWaitHandle]::OpenExisting($state.stopEvent);[void]$signal.Set()}
catch{@{status='stop-event-unavailable';modified=$false;leaseRelease='not-verified'} | ConvertTo-Json;return}
finally{if($signal){$signal.Dispose()};$broker.Dispose()}
$deadline=[Diagnostics.Stopwatch]::StartNew()
do{
 Start-Sleep -Milliseconds 200
 $latest=Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
 if($latest.leaseId -cne $state.leaseId){throw 'Lease identity changed while waiting; no new lease was stopped'}
 if($latest.status -in @('released','release-failed')){@{status=$latest.status;stopRequested=$true;rollback=$latest.rollback;suspendedThreadRecovery='not-inferred-from-debug-settings-release'} | ConvertTo-Json;return}
}while($deadline.Elapsed.TotalSeconds -lt $WaitSeconds)
@{status='stop-requested-awaiting-release';stopRequested=$true;leaseRelease='not-yet-verified'} | ConvertTo-Json
