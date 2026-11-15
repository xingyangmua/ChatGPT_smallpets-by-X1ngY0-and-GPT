# Optional package-scoped startup integration. Disabled until explicitly enabled.
function New-MutsumiOfficialStartup([string]$InstallRoot) {
 return @{root=[IO.Path]::GetFullPath($InstallRoot);child=$null;nextCheck=[DateTime]::MinValue;nextAttempt=[DateTime]::MinValue;settingsKey=''}
}
function Read-MutsumiStartupLeaseState($Monitor) {
 try{return Get-Content -LiteralPath (Join-Path $Monitor.root 'data\official-startup\lease-state.json') -Raw -Encoding UTF8 | ConvertFrom-Json}catch{return $null}
}
function Test-MutsumiStartupLeaseIdentity($State,[int]$BrokerId,[string]$StartedAt,[string]$LeaseId='') {
 return $State -is [pscustomobject] -and $State.brokerPid -is [int] -and $State.brokerPid -eq $BrokerId -and
  $State.brokerStartedAt -is [string] -and $State.brokerStartedAt -ceq $StartedAt -and
  $State.leaseId -is [string] -and $State.leaseId -cmatch '^[a-f0-9]{32}$' -and
  (!$LeaseId -or $State.leaseId -ceq $LeaseId) -and
  $State.stopEvent -is [string] -and $State.stopEvent -ceq ('Local\WorkPetOfficialStartupStop-'+$State.leaseId)
}
function Test-MutsumiStartupReleaseReceipt($State) {
 return $State.status -ceq 'released' -and $State.enabled -is [bool] -and !$State.enabled -and $State.rollback -ceq 'DisableDebugging-succeeded'
}
function Write-MutsumiStartupCloseState($Monitor,$State) {
 $file=Join-Path $Monitor.root 'data\official-startup\close-state.json'
 $temporary=$file+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
 try{
  [IO.File]::WriteAllText($temporary,($State|ConvertTo-Json),[Text.UTF8Encoding]::new($true))
  if(Test-Path -LiteralPath $file){[IO.File]::Replace($temporary,$file,[NullString]::Value)}else{[IO.File]::Move($temporary,$file)}
 }finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -ErrorAction SilentlyContinue}}
}
function Confirm-MutsumiPreviousStartupClose($Monitor) {
 $file=Join-Path $Monitor.root 'data\official-startup\close-state.json'
 if(!(Test-Path -LiteralPath $file)){return}
 $text=Get-Content -LiteralPath $file -Raw -Encoding UTF8
 if(!$text.TrimStart().StartsWith('{')){throw 'The previous startup close record is invalid; review it before enabling another lease'}
 $close=$text|ConvertFrom-Json
 if($close -isnot [pscustomobject] -or $close.schemaVersion -isnot [int] -or $close.schemaVersion -ne 1 -or
    $close.brokerPid -isnot [int] -or $close.brokerPid -le 0 -or $close.brokerStartedAt -isnot [string] -or
    $close.brokerStartedAt -notmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$' -or
    $close.status -cnotin @('released','release-unconfirmed','release-failed') -or
    ($close.status -ceq 'released' -and !$close.leaseId) -or
    ($close.leaseId -and ($close.leaseId -isnot [string] -or $close.leaseId -cnotmatch '^[a-f0-9]{32}$' -or $close.stopEvent -cne ('Local\WorkPetOfficialStartupStop-'+$close.leaseId)))){
  throw 'The previous startup close record is invalid; review it before enabling another lease'
 }
 if($close.status -ceq 'released'){return}
 $state=Read-MutsumiStartupLeaseState $Monitor
 if((Test-MutsumiStartupLeaseIdentity $state $close.brokerPid $close.brokerStartedAt $close.leaseId) -and (Test-MutsumiStartupReleaseReceipt $state)){
  $close.status='released';$close.reason='matching-release-receipt-observed';$close.leaseId=$state.leaseId;$close.stopEvent=$state.stopEvent
  Write-MutsumiStartupCloseState $Monitor $close
  return
 }
 throw 'The previous owned startup lease has no confirmed release; review its close record before enabling another lease'
}
function Stop-MutsumiOwnedStartupLease($Monitor,[string]$LeaseId='') {
 if(!$Monitor.child){return}
 $signal=$null
 try{
  $state=Read-MutsumiStartupLeaseState $Monitor
  if(!(Test-MutsumiStartupLeaseIdentity $state $Monitor.child.Id $Monitor.child.StartTime.ToUniversalTime().ToString('o') $LeaseId)){return}
  $signal=[Threading.EventWaitHandle]::OpenExisting($state.stopEvent)
  [void]$signal.Set()
 }catch{}finally{if($signal){$signal.Dispose()}}
}
function Invoke-MutsumiOfficialStartup($Monitor,[DateTime]$Now=[DateTime]::UtcNow) {
 if($Now -lt $Monitor.nextCheck){return}
 $Monitor.nextCheck=$Now.AddSeconds(1)
 $settings=$null
 try{
  $text=Get-Content -LiteralPath (Join-Path $Monitor.root 'data\official-startup\settings.json') -Raw -Encoding UTF8
  # ConvertFrom-Json in Windows PowerShell unwraps a one-element JSON array.
  if($text.TrimStart().StartsWith('{')){$settings=$text | ConvertFrom-Json}
 }catch{}
 # Confirmation fields are a typed record, not PowerShell truthy values. A
 # malformed/partially edited file must never acquire a system startup lease.
 $enabled=$settings -is [pscustomobject] -and
  $settings.enabled -is [bool] -and $settings.enabled -and
  $settings.consentVersion -is [int] -and $settings.consentVersion -eq 1 -and
  $settings.packageFamilyName -is [string] -and $settings.packageFamilyName -ceq 'OpenAI.Codex_2p2nqsd0c76g0' -and
  $settings.packageFullName -is [string] -and $settings.packageFullName -cmatch '^OpenAI\.Codex_[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+_x64__2p2nqsd0c76g0$' -and
  $settings.lifecycleAcknowledged -is [bool] -and $settings.lifecycleAcknowledged -and
  $settings.noOtherDebuggerConfirmed -is [bool] -and $settings.noOtherDebuggerConfirmed -and
  ($null -eq $settings.allowPackageUpdates -or $settings.allowPackageUpdates -is [bool]) -and
  $settings.callbackSha256 -is [string] -and $settings.callbackSha256 -match '^[A-Fa-f0-9]{64}$'
 $key=if($enabled){@($settings.callbackSha256,$settings.packageFullName,$settings.allowPackageUpdates) -join '|'}else{''}
 if($Monitor.child){
  if(!$Monitor.child.HasExited){
   if(!$enabled -or $Monitor.settingsKey -cne $key){Stop-MutsumiOwnedStartupLease $Monitor}
   return
  }
  try{$Monitor.child.Dispose()}catch{};$Monitor.child=$null
 }
 if(!$enabled){$Monitor.settingsKey='';return}
 if($Monitor.settingsKey -cne $key){$Monitor.nextAttempt=[DateTime]::MinValue;$Monitor.settingsKey=$key}
 if($Now -lt $Monitor.nextAttempt){return}
 $Monitor.nextAttempt=$Now.AddSeconds(30)
 try{
  Confirm-MutsumiPreviousStartupClose $Monitor
  $previous=$null
  try{$previous=Get-Content -LiteralPath (Join-Path $Monitor.root 'data\official-startup\lease-state.json') -Raw -Encoding UTF8 | ConvertFrom-Json}catch{}
  # A failed rollback is not permission to acquire another lease. Preserve
  # this stop across supervisor restarts until the prior owned lease is reviewed.
  if($previous.status -ceq 'release-failed' -and
     $previous.packageFullName -cmatch '^OpenAI\.Codex_[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+_x64__2p2nqsd0c76g0$' -and
     $previous.leaseId -match '^[a-f0-9]{32}$' -and
     $previous.stopEvent -ceq ('Local\WorkPetOfficialStartupStop-'+$previous.leaseId)){
   throw 'The previous owned startup lease failed to release; review its rollback before enabling another lease'
  }
  $packages=@(Get-AppxPackage -Name OpenAI.Codex)
  if($packages.Count -ne 1 -or $packages[0].PackageFamilyName -cne $settings.packageFamilyName){throw 'Supported official package is not uniquely registered'}
  $package=$packages[0]
  if($settings.allowPackageUpdates -ne $true -and [string]$package.PackageFullName -cne $settings.packageFullName){throw 'Package version changed; startup integration requires renewed approval'}
  $script=Join-Path $Monitor.root 'official-startup\Lease.ps1'
  $callback=Join-Path $Monitor.root 'official-startup\StartupBridge.exe'
  if(!(Test-Path -LiteralPath $script) -or !(Test-Path -LiteralPath $callback)){throw 'Reviewed startup integration files are missing'}
  if((Get-FileHash -LiteralPath $callback -Algorithm SHA256).Hash -ine $settings.callbackSha256){throw 'Startup callback changed; it must be reviewed before enabling again'}
  $ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $started=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().ToString('o')
  $arguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "'+$script+'" -InstallRoot "'+$Monitor.root+'" -CallbackPath "'+$callback+'" -ExpectedCallbackSha256 '+$settings.callbackSha256+' -Enable -Persistent -OwnerProcessId '+$PID+' -OwnerStartedAt "'+$started+'" -ConfirmedPackageFullName "'+$package.PackageFullName+'" -AcknowledgeLifecycleChanges -ConfirmNoOtherDebugger'
  $Monitor.child=Start-Process -FilePath $ps -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Monitor.root 'data\official-startup\broker.log') -RedirectStandardError (Join-Path $Monitor.root 'data\official-startup\broker-error.log')
 }catch{
  try{@{status='not-started';reason=$_.Exception.Message;at=$Now.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Monitor.root 'data\official-startup\controller-state.json') -Encoding UTF8}catch{}
 }
}
function Close-MutsumiOfficialStartup($Monitor,[ValidateRange(100,5000)][int]$WaitMilliseconds=5000) {
 if($Monitor.child){
  $child=$Monitor.child
  $close=@{schemaVersion=1;status='release-unconfirmed';brokerPid=$child.Id;brokerStartedAt=$child.StartTime.ToUniversalTime().ToString('o');leaseId='';stopEvent='';reason='waiting-for-owned-release';brokerExitConfirmed=$false;at=[DateTime]::UtcNow.ToString('o')}
  try{
   $state=Read-MutsumiStartupLeaseState $Monitor
   if(Test-MutsumiStartupLeaseIdentity $state $close.brokerPid $close.brokerStartedAt){$close.leaseId=$state.leaseId;$close.stopEvent=$state.stopEvent}
   # Persist before waiting: a later supervisor must not replace an unconfirmed
   # lease merely because this broker vanished with the launcher's process job.
   Write-MutsumiStartupCloseState $Monitor $close
   $watch=[Diagnostics.Stopwatch]::StartNew()
   do{
    Stop-MutsumiOwnedStartupLease $Monitor $close.leaseId
    $state=Read-MutsumiStartupLeaseState $Monitor
    if(Test-MutsumiStartupLeaseIdentity $state $close.brokerPid $close.brokerStartedAt $close.leaseId){
     $close.leaseId=$state.leaseId;$close.stopEvent=$state.stopEvent
     if(Test-MutsumiStartupReleaseReceipt $state){$close.status='released';$close.reason='matching-release-receipt-observed'}
     if($state.status -ceq 'release-failed' -and $close.status -cne 'released'){$close.status='release-failed';$close.reason='broker-reported-release-failed'}
    }
    if($child.HasExited){$close.brokerExitConfirmed=$true;if($close.status -ceq 'release-unconfirmed'){$close.reason='broker-exited-without-release-receipt'};break}
    $remaining=$WaitMilliseconds-[int]$watch.ElapsedMilliseconds
    if($remaining -le 0){if($close.status -ceq 'release-unconfirmed'){$close.reason='owned-broker-release-timeout'}elseif($close.status -ceq 'released'){$close.reason='release-confirmed-broker-exit-timeout'};break}
    [void]$child.WaitForExit([Math]::Min(100,$remaining))
   }while($true)
  }catch{if($close.status -cne 'released'){$close.status='release-unconfirmed'};$close.reason='close-check-failed';$close.errorType=$_.Exception.GetType().Name}
  finally{
   $close.at=[DateTime]::UtcNow.ToString('o')
   try{Write-MutsumiStartupCloseState $Monitor $close}catch{}
   # The receipt confirms Disable; waiting for exit also lets finally release
   # the mutex before the launcher closes its job. Crashes still rely on OS cleanup.
   try{$child.Dispose()}catch{};$Monitor.child=$null
  }
 }
}
