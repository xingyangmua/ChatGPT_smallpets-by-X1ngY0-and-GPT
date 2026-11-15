[CmdletBinding()]
param(
 [string]$InstallRoot,
 [string]$CallbackPath,
 [string]$ExpectedCallbackSha256,
 [ValidateRange(10,900)][int]$DurationSeconds=300,
 [switch]$Persistent,
 [int]$OwnerProcessId=0,
 [string]$OwnerStartedAt,
 [int]$Port=0,
 [switch]$Enable,
 [string]$ConfirmedPackageFullName,
 [switch]$AcknowledgeLifecycleChanges,
 [switch]$ConfirmNoOtherDebugger
)
$ErrorActionPreference='Stop'

function Get-WorkPetStartupPackage {
 $packages=@(Get-AppxPackage -Name OpenAI.Codex)
 if($packages.Count -ne 1 -or $packages[0].PackageFamilyName -ne 'OpenAI.Codex_2p2nqsd0c76g0'){throw 'The exact supported package is not uniquely registered'}
 return $packages[0]
}
function Get-WorkPetStartupProfile($Package) {
 $virtual=Join-Path $env:LOCALAPPDATA ('Packages\'+$Package.PackageFamilyName+'\LocalCache\Roaming\Codex\web\Codex')
 if(Test-Path -LiteralPath (Join-Path $virtual 'Local State') -PathType Leaf){return @{path=$virtual;source='existing-msix-roaming'}}
 $logical=Join-Path $env:APPDATA 'Codex\web\Codex'
 if(Test-Path -LiteralPath (Join-Path $logical 'Local State') -PathType Leaf){return @{path=$logical;source='existing-logical-roaming'}}
 throw 'An existing browser profile was not found; a new login profile will not be created'
}
function Test-WorkPetStartupPort([int]$Number) {
 $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Number)
 try{$listener.ExclusiveAddressUse=$true;$listener.Start();return $true}catch [Net.Sockets.SocketException]{return $false}finally{$listener.Stop()}
}
function Get-WorkPetStartupPort([int]$Requested=0) {
 if($Requested -ne 0 -and ($Requested -lt 9335 -or $Requested -gt 9345)){throw 'Only loopback ports 9335 through 9345 are allowed'}
 $ports=if($Requested){@($Requested)}else{@(9335..9345)}
 foreach($number in $ports){if(Test-WorkPetStartupPort $number){return $number}}
 throw 'No requested managed loopback port is available'
}
function Get-WorkPetStartupHash([string]$File) {
 return (Get-FileHash -LiteralPath $File -Algorithm SHA256 -ErrorAction Stop).Hash.ToUpperInvariant()
}
function New-WorkPetStartupPlan([string]$Root,[string]$Callback,[string]$Hash,[int]$RequestedPort=0) {
 if($env:OS -ne 'Windows_NT' -or ![Environment]::Is64BitProcess -or $PSVersionTable.PSEdition -ne 'Desktop'){throw 'Use Windows PowerShell 5.1 x64'}
 $rootPath=[IO.Path]::GetFullPath($Root)
 if(!(Test-Path -LiteralPath (Join-Path $rootPath 'data') -PathType Container)){throw 'An existing companion installation is required'}
 $callbackFile=[IO.Path]::GetFullPath($Callback)
 if(!(Test-Path -LiteralPath $callbackFile -PathType Leaf) -or [IO.Path]::GetExtension($callbackFile) -ine '.exe'){throw 'The reviewed callback executable is missing'}
 if($Hash -notmatch '^[a-fA-F0-9]{64}$'){throw 'Supply the independently reviewed callback SHA256'}
 $actual=Get-WorkPetStartupHash $callbackFile
 if($actual -cne $Hash.ToUpperInvariant()){throw 'Callback SHA256 differs from the reviewed binary'}
 $package=Get-WorkPetStartupPackage
 $gui=Join-Path $package.InstallLocation 'app\ChatGPT.exe'
 if(!(Test-Path -LiteralPath $gui -PathType Leaf)){$gui=Join-Path $package.InstallLocation 'app\Codex.exe'}
 if(!(Test-Path -LiteralPath $gui -PathType Leaf)){throw 'The registered GUI executable is missing'}
 $profile=Get-WorkPetStartupProfile $package
 return @{root=$rootPath;callback=$callbackFile;hash=$actual;packageFullName=[string]$package.PackageFullName;packageVersion=[string]$package.Version;gui=$gui;profile=$profile.path;profileSource=$profile.source;port=(Get-WorkPetStartupPort $RequestedPort)}
}
function New-WorkPetPackageDebugApi {
 if(!('WorkPet.StartupLease.PackageApi' -as [type])){
  # Method order and GUIDs match Microsoft's ShObjIdl_core.h, not its
  # alphabetically sorted documentation method table.
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace WorkPet.StartupLease {
 [ComImport,Guid("F27C3930-8029-4AD1-94E3-3DBA417810C1"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IPackageDebugSettings {
  [PreserveSig]int EnableDebugging([MarshalAs(UnmanagedType.LPWStr)]string package,[MarshalAs(UnmanagedType.LPWStr)]string debugger,IntPtr environment);
  [PreserveSig]int DisableDebugging([MarshalAs(UnmanagedType.LPWStr)]string package);
  [PreserveSig]int Suspend([MarshalAs(UnmanagedType.LPWStr)]string package);
  [PreserveSig]int Resume([MarshalAs(UnmanagedType.LPWStr)]string package);
  [PreserveSig]int TerminateAllProcesses([MarshalAs(UnmanagedType.LPWStr)]string package);
  [PreserveSig]int SetTargetSessionId(uint session);
  [PreserveSig]int EnumerateBackgroundTasks([MarshalAs(UnmanagedType.LPWStr)]string package,out uint count,out IntPtr ids,out IntPtr names);
  [PreserveSig]int ActivateBackgroundTask(IntPtr taskId);
  [PreserveSig]int StartServicing([MarshalAs(UnmanagedType.LPWStr)]string package);
  [PreserveSig]int StopServicing([MarshalAs(UnmanagedType.LPWStr)]string package);
  [PreserveSig]int StartSessionRedirection([MarshalAs(UnmanagedType.LPWStr)]string package,uint session);
  [PreserveSig]int StopSessionRedirection([MarshalAs(UnmanagedType.LPWStr)]string package);
  [PreserveSig]int GetPackageExecutionState([MarshalAs(UnmanagedType.LPWStr)]string package,out int state);
  [PreserveSig]int RegisterForPackageStateChanges([MarshalAs(UnmanagedType.LPWStr)]string package,IntPtr notification,out uint cookie);
  [PreserveSig]int UnregisterForPackageStateChanges(uint cookie);
 }
 public sealed class PackageApi : IDisposable {
  IPackageDebugSettings api;
  public PackageApi(){api=(IPackageDebugSettings)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("B1AEC16F-2383-4852-B0E9-8F0B1DC66B4D")));}
  public int State(string package){int state;Marshal.ThrowExceptionForHR(api.GetPackageExecutionState(package,out state));return state;}
  public void TargetSession(uint session){Marshal.ThrowExceptionForHR(api.SetTargetSessionId(session));}
  public void Enable(string package,string command){Marshal.ThrowExceptionForHR(api.EnableDebugging(package,command,IntPtr.Zero));}
  public void Disable(string package){Marshal.ThrowExceptionForHR(api.DisableDebugging(package));}
  public void Dispose(){if(api!=null){Marshal.FinalReleaseComObject(api);api=null;}}
 }
}
'@
 }
 return [WorkPet.StartupLease.PackageApi]::new()
}
function Write-WorkPetStartupState([string]$File,$Value) {
 $temporary=$File+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
 try{
  [IO.File]::WriteAllText($temporary,($Value | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($true))
  if(Test-Path -LiteralPath $File){[IO.File]::Replace($temporary,$File,[NullString]::Value)}else{[IO.File]::Move($temporary,$File)}
 }finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -ErrorAction SilentlyContinue}}
}
function Get-WorkPetStartupReview($Plan,[int]$Seconds,$ExecutionState) {
 $eligible=Test-WorkPetStartupReleaseEligible $Plan
 return [ordered]@{status='review-only';enabled=$false;enableEligible=$eligible;explicitUserConfirmationRequired=$true;validation=if($eligible){'isolated-passed; real-package startup not yet established'}else{'no-matching-reviewed-candidate'};packageFullName=$Plan.packageFullName;packageVersion=$Plan.packageVersion;executablePath=$Plan.gui;callbackSha256=$Plan.hash;profilePreserved=$true;profileResolution=$Plan.profileSource;loopbackAddress='127.0.0.1';port=$Plan.port;durationSeconds=$Seconds;packageExecutionState=$ExecutionState;systemRegistrationModified=$false;otherDebuggerState='not-queryable-by-this-interface';suspendedThreadRecovery='callback-watchdog-required; COM release alone is not a resume guarantee'}
}
function Get-WorkPetStartupWindowsBuild {return [Environment]::OSVersion.Version.Build}
function Get-WorkPetStartupSession {
 $process=[Diagnostics.Process]::GetCurrentProcess()
 try{return $process.SessionId}finally{$process.Dispose()}
}
function Test-WorkPetStartupReleaseEligible($Plan) {
 # This receipt records reviewed isolated evidence, not user authorization.
 # No command-line switch can manufacture or bypass a matching receipt.
 try{
  $receiptFile=Join-Path $PSScriptRoot 'reviewed-candidate.json'
  $sourceFile=Join-Path $PSScriptRoot 'StartupBridge.cs'
  if(!(Test-Path -LiteralPath $receiptFile -PathType Leaf) -or !(Test-Path -LiteralPath $sourceFile -PathType Leaf)){return $false}
  $text=Get-Content -LiteralPath $receiptFile -Raw -Encoding UTF8
  if(!$text.TrimStart().StartsWith('{')){return $false}
  $receipt=$text | ConvertFrom-Json
  if($receipt -isnot [pscustomobject] -or $receipt.schemaVersion -isnot [int] -or $receipt.schemaVersion -ne 1 -or $receipt.status -cne 'isolated-passed' -or $receipt.architecture -cne 'x64' -or ![Environment]::Is64BitProcess -or $receipt.testCount -isnot [int] -or $receipt.testCount -lt 16 -or $receipt.windowsBuild -isnot [int]){return $false}
  if($receipt.windowsBuild -ne (Get-WorkPetStartupWindowsBuild)){return $false}
  if($receipt.callbackSha256 -notmatch '^[a-fA-F0-9]{64}$' -or $receipt.sourceSha256 -notmatch '^[a-fA-F0-9]{64}$'){return $false}
  if($receipt.callbackSha256 -ine $Plan.hash -or (Get-WorkPetStartupHash $Plan.callback) -ine $receipt.callbackSha256){return $false}
  return (Get-WorkPetStartupHash $sourceFile) -ieq $receipt.sourceSha256
 }catch{return $false}
}
function Test-WorkPetStartupOwner([int]$ProcessId,[string]$StartedAt) {
 if($ProcessId -le 0 -or $ProcessId -eq $PID -or [string]::IsNullOrWhiteSpace($StartedAt)){return $false}
 $owner=$null
 try{
  $expected=[DateTimeOffset]::Parse($StartedAt,[Globalization.CultureInfo]::InvariantCulture)
  $owner=Get-Process -Id $ProcessId -ErrorAction Stop
  return $owner.StartTime.ToUniversalTime().Ticks -eq $expected.UtcDateTime.Ticks -and $owner.SessionId -eq (Get-WorkPetStartupSession)
 }catch{return $false}finally{if($owner){$owner.Dispose()}}
}
function Invoke-WorkPetStartupLease($Plan,[int]$Seconds,[bool]$Enabled,[string]$ConfirmedPackage,[bool]$LifecycleAcknowledged,[bool]$OtherDebuggerAbsent,[bool]$Continuous=$false,[int]$OwnerId=0,[string]$OwnerCreated='') {
 if($Seconds -lt 10 -or $Seconds -gt 900){throw 'A lease must last between 10 and 900 seconds'}
 if($Continuous -and !(Test-WorkPetStartupOwner $OwnerId $OwnerCreated)){throw 'A persistent lease requires a live owning supervisor with a matching process start time'}
 if($Enabled -and ($ConfirmedPackage -cne $Plan.packageFullName -or !$LifecycleAcknowledged -or !$OtherDebuggerAbsent)){throw 'Enable requires confirmation of the exact package, lifecycle changes and absence of another debugger'}
 if($Enabled -and !(Test-WorkPetStartupReleaseEligible $Plan)){throw 'Enable is disabled: no matching isolated-validation receipt for this callback, source and Windows build; confirmation cannot bypass this release gate'}
 $api=$null;$mutex=$null;$owns=$false;$stop=$null;$callbackLock=$null;$policyLock=$null;$attempted=$false;$state=$null;$statusFile=$null;$leaseStatusFile=$null
 try{
  $session=Get-WorkPetStartupSession
  if($session -le 0){throw 'An interactive user session is required; session zero is not supported'}
  $api=New-WorkPetPackageDebugApi
  $api.TargetSession([uint32]$session)
  $execution=$api.State($Plan.packageFullName)
  if(!$Enabled){$review=Get-WorkPetStartupReview $Plan $Seconds $execution;$review.requestedSessionId=$session;$review.sessionScope='current-interactive-session; FullTrust cross-session behavior not yet validated';$review.persistent=$Continuous;$review.ownerBound=$Continuous;if($Continuous){$review.durationSeconds=$null};return $review}
  $mutex=[Threading.Mutex]::new($false,'Local\WorkPetOfficialStartupLease-OpenAI.Codex')
  try{$owns=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$owns=$true}
  if(!$owns){throw 'Another official-startup lease is already active'}
  # Hold read-only handles to deny replacement/deletion during the lease.
  $callbackLock=[IO.File]::Open($Plan.callback,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  if((Get-WorkPetStartupHash $Plan.callback) -cne $Plan.hash){throw 'Callback changed before lease activation'}
  if(!(Test-WorkPetStartupReleaseEligible $Plan)){throw 'Reviewed candidate changed before lease activation'}
  $current=Get-WorkPetStartupPackage
  if([string]$current.PackageFullName -cne $Plan.packageFullName){throw 'Registered package changed before activation'}
  if(!(Test-WorkPetStartupPort $Plan.port)){throw 'Managed loopback port became occupied before activation'}
  if(!(Test-Path -LiteralPath (Join-Path $Plan.profile 'Local State') -PathType Leaf)){throw 'Existing browser profile is no longer available'}
  $leaseId=[Guid]::NewGuid().ToString('N')
  $folder=Join-Path $Plan.root 'data\official-startup'
  $run=Join-Path $folder ('lease-'+$leaseId)
  $evidence=Join-Path $run 'evidence'
  New-Item -ItemType Directory -Path $evidence -Force | Out-Null
  $policyFile=Join-Path $run 'policy.json'
  $policy=[ordered]@{packageFullName=$Plan.packageFullName;executablePath=$Plan.gui;profilePath=$Plan.profile;evidenceDirectory=$evidence;port=$Plan.port}
  [IO.File]::WriteAllText($policyFile,($policy | ConvertTo-Json),[Text.UTF8Encoding]::new($true))
  $policyLock=[IO.File]::Open($policyFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  $policyHash=Get-WorkPetStartupHash $policyFile
  $stopName='Local\WorkPetOfficialStartupStop-'+$leaseId
  $stop=[Threading.EventWaitHandle]::new($false,[Threading.EventResetMode]::ManualReset,$stopName)
  $created=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().ToString('o')
  $state=[ordered]@{status='activating';enabled=$false;leaseId=$leaseId;brokerPid=$PID;brokerStartedAt=$created;stopEvent=$stopName;packageFullName=$Plan.packageFullName;packageVersion=$Plan.packageVersion;callbackSha256=$Plan.hash;profilePreserved=$true;profileResolution=$Plan.profileSource;port=$Plan.port;requestedSessionId=$session;sessionScope='current-interactive-session; FullTrust cross-session behavior not yet validated';startedAt=[DateTime]::UtcNow.ToString('o');expiresAt=if($Continuous){$null}else{[DateTime]::UtcNow.AddSeconds($Seconds).ToString('o')};persistent=$Continuous;ownerPid=if($Continuous){$OwnerId}else{$null};ownerStartedAt=if($Continuous){$OwnerCreated}else{$null};packageExecutionState=$execution;reason='';rollback='not-yet-needed'}
  $statusFile=Join-Path $folder 'lease-state.json';$leaseStatusFile=Join-Path $run 'status.json'
  Write-WorkPetStartupState $statusFile $state;Write-WorkPetStartupState $leaseStatusFile $state
  if($Plan.callback.Contains('"') -or $policyFile.Contains('"')){throw 'Invalid callback path'}
  $command='"'+$Plan.callback+'" --callback --config "'+$policyFile+'"'
  $attempted=$true
  $api.Enable($Plan.packageFullName,$command)
  $state.status='active';$state.enabled=$true;$state.rollback='owning-broker-will-disable'
  Write-WorkPetStartupState $statusFile $state;Write-WorkPetStartupState $leaseStatusFile $state
  $watch=[Diagnostics.Stopwatch]::StartNew();$state.reason='lease-expired';$nextPackageCheck=0
  while($Continuous -or $watch.Elapsed.TotalSeconds -lt $Seconds){
   if($stop.WaitOne(1000)){$state.reason='stop-requested';break}
   if($Continuous -and !(Test-WorkPetStartupOwner $OwnerId $OwnerCreated)){$state.reason='owner-exited-or-changed';break}
   if(!(Test-Path -LiteralPath $Plan.callback -PathType Leaf) -or (Get-WorkPetStartupHash $Plan.callback) -cne $Plan.hash){$state.reason='callback-changed';break}
   if(!(Test-Path -LiteralPath $policyFile -PathType Leaf) -or (Get-WorkPetStartupHash $policyFile) -cne $policyHash){$state.reason='policy-changed';break}
   if($watch.Elapsed.TotalSeconds -ge $nextPackageCheck){
    if(!(Test-WorkPetStartupReleaseEligible $Plan)){$state.reason='reviewed-candidate-changed';break}
    $current=Get-WorkPetStartupPackage
    if([string]$current.PackageFullName -cne $Plan.packageFullName){$state.reason='registered-package-changed';break}
    $nextPackageCheck=$watch.Elapsed.TotalSeconds+5
   }
   if(!(Test-Path -LiteralPath (Join-Path $Plan.profile 'Local State') -PathType Leaf)){$state.reason='profile-missing';break}
  }
 }catch{
  if($state){$state.reason='broker-error';$state.errorType=$_.Exception.GetType().Name;$state.errorHResult=$_.Exception.HResult}
  else{throw}
 }finally{
  if($attempted -and $api){
   try{$api.Disable($Plan.packageFullName);$state.status='released';$state.enabled=$false;$state.rollback='DisableDebugging-succeeded'}
   catch{$state.status='release-failed';$state.rollback='DisableDebugging-failed';$state.releaseHResult=$_.Exception.HResult}
  }
  elseif($state){$state.status='not-enabled';$state.enabled=$false;$state.rollback='not-needed'}
  try{if($api){$api.Dispose()}}catch{if($state){$state.comReleaseHResult=$_.Exception.HResult}}
  finally{
   if($policyLock){$policyLock.Dispose()};if($callbackLock){$callbackLock.Dispose()}
   if($stop){$stop.Dispose()}
   try{if($state){$state.finishedAt=[DateTime]::UtcNow.ToString('o');$state.suspendedThreadRecovery='not-inferred-from-debug-settings-release';Write-WorkPetStartupState $statusFile $state;Write-WorkPetStartupState $leaseStatusFile $state}}
   finally{if($owns){$mutex.ReleaseMutex()};if($mutex){$mutex.Dispose()}}
  }
 }
 if($state){return $state}
}

# Dot sourcing exposes helpers for isolated tests; it never acquires a lease.
if($MyInvocation.InvocationName -ne '.'){
 if(!$InstallRoot){$InstallRoot=Split-Path -Parent $PSScriptRoot}
 if(!$CallbackPath){$CallbackPath=Join-Path $PSScriptRoot 'StartupBridge.exe'}
 $plan=New-WorkPetStartupPlan $InstallRoot $CallbackPath $ExpectedCallbackSha256 $Port
 Invoke-WorkPetStartupLease $plan $DurationSeconds ([bool]$Enable) $ConfirmedPackageFullName ([bool]$AcknowledgeLifecycleChanges) ([bool]$ConfirmNoOtherDebugger) ([bool]$Persistent) $OwnerProcessId $OwnerStartedAt | ConvertTo-Json -Depth 6
}
