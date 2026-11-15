param([Parameter(Mandatory=$true)][string]$WorkDirectory,[switch]$FaultsOnly)
$ErrorActionPreference='Stop'
$work=[IO.Path]::GetFullPath($WorkDirectory)
New-Item -ItemType Directory -Path $work -Force | Out-Null
$exe=Join-Path $work 'StartupBridge.Test.exe'
& (Join-Path $PSScriptRoot 'Build.ps1') -OutputPath $exe -SelfTest
[void][Reflection.Assembly]::LoadFile($exe)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class StartupTestCleanup {
 [DllImport("kernel32.dll")] public static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")] public static extern bool GetExitCodeProcess(IntPtr process,out uint code);
}
'@
$profile=Join-Path $work 'existing profile'
New-Item -ItemType Directory -Path $profile -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $profile 'Local State'),'{}')
$results=@()
function Test-Case([string]$Name,[string]$Fault='', [string]$Extra='', [switch]$OtherEntry,[switch]$MissingConfig,[switch]$TrailingSlash,[switch]$Activation,[switch]$InvalidPort) {
 $output=Join-Path $work ($Name+'.json');$policyFile=Join-Path $work ($Name+'-policy.json')
 Remove-Item -LiteralPath $output -ErrorAction SilentlyContinue
 $policy=@{packageFullName='test';executablePath=$exe;profilePath=$profile;port=9335;evidenceDirectory=$work}
 if($OtherEntry){$policy.executablePath=Join-Path $work 'DifferentEntry.exe'}
 if($TrailingSlash){$policy.profilePath+='\'}
 if($InvalidPort){$policy.port=9222}
 $activationArgument='codex://open?path='+((([char]0x6D4B).ToString()+[char]0x8BD5+'%20path/')*100)+'&value=original'
 if($Activation){$Extra='"'+$activationArgument+'"'}
 if(!$MissingConfig){[IO.File]::WriteAllText($policyFile,($policy|ConvertTo-Json))}else{Remove-Item -LiteralPath $policyFile -ErrorAction SilentlyContinue}
 $startup=New-Object WorkPet.OfficialStartup.StartupBridge+StartupInfo;$startup.cb=[Runtime.InteropServices.Marshal]::SizeOf($startup)
 $native=New-Object WorkPet.OfficialStartup.StartupBridge+ProcessInfo
 $command=[Text.StringBuilder]::new(('"'+$exe+'" --probe "'+$output+'" "original value" '+$Extra))
 $previousSentinel=$env:WORKPET_STARTUP_SENTINEL
 try{$env:WORKPET_STARTUP_SENTINEL='preserved-value-20261115';if(![WorkPet.OfficialStartup.StartupBridge]::CreateProcess($exe,$command,[IntPtr]::Zero,[IntPtr]::Zero,$false,0x08000004,[IntPtr]::Zero,$work,[ref]$startup,[ref]$native)){throw 'Test child creation failed'}}finally{$env:WORKPET_STARTUP_SENTINEL=$previousSentinel}
 $target=[Diagnostics.Process]::GetProcessById($native.processId)
 try {
  $args='--callback --test -p '+$native.processId+' -tid '+$native.threadId+' --config "'+$policyFile+'"'
  if($Fault){$args+=' --fault '+$Fault}
  $timer=[Diagnostics.Stopwatch]::StartNew()
  $callback=Start-Process -FilePath $exe -ArgumentList $args -WindowStyle Hidden -PassThru
  try {if(!$target.WaitForExit(8000)){throw ($Name+': target remained suspended')};[void]$callback.WaitForExit(3000)}finally{$callback.Dispose()}
  if(!(Test-Path -LiteralPath $output)){[uint32]$exitCode=0;[void][StartupTestCleanup]::GetExitCodeProcess($native.process,[ref]$exitCode);throw ($Name+': target did not record its arguments; exit='+('{0:X8}' -f $exitCode))}
  $actual=Get-Content -LiteralPath $output -Raw -Encoding UTF8|ConvertFrom-Json
  $shouldPatch=(!$Fault -and !$OtherEntry -and !$MissingConfig -and !$InvalidPort -and (!$Extra -or $Activation))
  $patched=@($actual.args|Where-Object {$_ -eq '--remote-debugging-port=9335'}).Count -eq 1
  if($patched -ne $shouldPatch){throw ($Name+': unexpected patch state '+$patched)}
  if($actual.pid -ne $native.processId){throw 'Target process identity changed'}
  if('original value' -notin $actual.args){throw 'Original argument changed'}
  if($actual.cwd -ne $work -or $actual.sentinel -ne 'preserved-value-20261115'){throw 'Working directory or environment changed'}
  if($Activation -and $activationArgument -notin $actual.args){throw 'Long Unicode activation argument changed'}
  if($shouldPatch -and ('--user-data-dir='+$policy.profilePath) -notin $actual.args){throw 'Profile argument did not round-trip'}
  [pscustomobject]@{name=$Name;passed=$true;patched=$patched;elapsedMs=$timer.ElapsedMilliseconds;sameProcess=$true}
 }finally{if(!$target.HasExited){[void][StartupTestCleanup]::ResumeThread($native.thread);[void]$target.WaitForExit(5000)};$target.Dispose();[void][StartupTestCleanup]::CloseHandle($native.thread);[void][StartupTestCleanup]::CloseHandle($native.process)}
}
$results+=Test-Case 'other-entry-control' -OtherEntry
if(!$FaultsOnly){$results+=Test-Case 'normal';$results+=Test-Case 'profile-trailing-slash' -TrailingSlash;$results+=Test-Case 'long-unicode-activation' -Activation}
$results+=Test-Case 'other-entry' -OtherEntry
$results+=Test-Case 'chromium-child' -Extra '--type=renderer'
$results+=Test-Case 'existing-debug-switch' -Extra '--remote-debugging-port=9444'
$results+=Test-Case 'missing-config' -MissingConfig
$results+=Test-Case 'invalid-port' -InvalidPort
$results+=Test-Case 'callback-exception' -Fault 'exception'
$results+=Test-Case 'failure-after-copy' -Fault 'after-copy'
$results+=Test-Case 'failure-after-commit' -Fault 'after-commit'
$results+=Test-Case 'callback-crash' -Fault 'crash'
$results+=Test-Case 'callback-timeout' -Fault 'timeout'
$results|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $work 'results.json') -Encoding UTF8
$results|Format-Table
