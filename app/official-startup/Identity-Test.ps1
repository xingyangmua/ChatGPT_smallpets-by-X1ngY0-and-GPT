param([Parameter(Mandatory=$true)][string]$TestExecutable,[Parameter(Mandatory=$true)][string]$WorkDirectory)
$ErrorActionPreference='Stop'
$exe=[IO.Path]::GetFullPath($TestExecutable);$work=[IO.Path]::GetFullPath($WorkDirectory)
New-Item -ItemType Directory -Path $work -Force | Out-Null
[void][Reflection.Assembly]::LoadFile($exe)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class IdentityTestCleanup {
 [DllImport("kernel32.dll")] public static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern IntPtr CreateRemoteThread(IntPtr process,IntPtr attributes,UIntPtr stack,IntPtr start,IntPtr parameter,uint flags,out uint threadId);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr GetModuleHandle(string name);
 [DllImport("kernel32.dll",CharSet=CharSet.Ansi)] public static extern IntPtr GetProcAddress(IntPtr module,string name);
}
'@
$targets=@();$results=@()
try {
 for($index=0;$index -lt 2;$index++){
  $output=Join-Path $work ('target-'+$index+'.json');Remove-Item -LiteralPath $output -ErrorAction SilentlyContinue
  $startup=New-Object WorkPet.OfficialStartup.StartupBridge+StartupInfo;$startup.cb=[Runtime.InteropServices.Marshal]::SizeOf($startup)
  $native=New-Object WorkPet.OfficialStartup.StartupBridge+ProcessInfo
  $command=[Text.StringBuilder]::new(('"'+$exe+'" --probe "'+$output+'"'))
  if(![WorkPet.OfficialStartup.StartupBridge]::CreateProcess($exe,$command,[IntPtr]::Zero,[IntPtr]::Zero,$false,0x08000004,[IntPtr]::Zero,$work,[ref]$startup,[ref]$native)){throw 'Test child creation failed'}
  $targets+=@{native=$native;output=$output;process=[Diagnostics.Process]::GetProcessById($native.processId)}
 }
 $args='--callback --test -p '+$targets[0].native.processId+' -tid '+$targets[1].native.threadId+' --config "'+(Join-Path $work 'absent-policy.json')+'"'
 $callback=Start-Process -FilePath $exe -ArgumentList $args -WindowStyle Hidden -PassThru
 try{if(!$callback.WaitForExit(2000)){throw 'Identity rejection timed out'}}finally{$callback.Dispose()}
 foreach($target in $targets){if(Test-Path -LiteralPath $target.output){throw 'Wrong PID/TID was unexpectedly resumed'}}
 $results+=[pscustomobject]@{name='wrong-process-thread-pair';passed=$true;resumed=$false}
 $name='Local\WorkPetIdentity-'+[Guid]::NewGuid().ToString('N')
 $args='--watchdog --test -p '+$targets[0].native.processId+' -tid '+$targets[0].native.threadId+' --created 0 --thread-created 0 --event "'+$name+'" --ready "'+$name+'-ready" --callback-pid 0 --callback-created 0'
 $guard=Start-Process -FilePath $exe -ArgumentList $args -WindowStyle Hidden -PassThru
 try{if(!$guard.WaitForExit(2000)){throw 'Reused identity rejection timed out'}}finally{$guard.Dispose()}
 foreach($target in $targets){if(Test-Path -LiteralPath $target.output){throw 'Stale creation time unexpectedly resumed target'}}
 $results+=[pscustomobject]@{name='stale-process-and-thread-creation';passed=$true;resumed=$false}
 [uint32]$extraId=0
 $exitThread=[IdentityTestCleanup]::GetProcAddress([IdentityTestCleanup]::GetModuleHandle('kernel32.dll'),'ExitThread')
 $extra=[IdentityTestCleanup]::CreateRemoteThread($targets[0].native.process,[IntPtr]::Zero,[UIntPtr]::Zero,$exitThread,[IntPtr]::Zero,4,[ref]$extraId)
 if($extra -eq [IntPtr]::Zero){throw 'Test-owned secondary suspended thread creation failed'}
 try{
  $args='--callback --test -p '+$targets[0].native.processId+' -tid '+$extraId+' --config "'+(Join-Path $work 'absent-policy.json')+'"'
  $callback=Start-Process -FilePath $exe -ArgumentList $args -WindowStyle Hidden -PassThru
  try{if(!$callback.WaitForExit(2000)){throw 'Secondary thread rejection timed out'}}finally{$callback.Dispose()}
  foreach($target in $targets){if(Test-Path -LiteralPath $target.output){throw 'Secondary thread callback unexpectedly resumed target'}}
  $results+=[pscustomobject]@{name='secondary-thread-rejected';passed=$true;resumed=$false}
  $policy=Join-Path $work 'pass-through-policy.json';[IO.File]::WriteAllText($policy,(@{executablePath=$exe;profilePath=$work;port=9335;evidenceDirectory=$work;packageFullName='test'}|ConvertTo-Json))
  $args='--callback --test -p '+$targets[0].native.processId+' -tid '+$targets[0].native.threadId+' --config "'+$policy+'"'
  $callback=Start-Process -FilePath $exe -ArgumentList $args -WindowStyle Hidden -PassThru
  try{if(!$callback.WaitForExit(2000)){throw 'Initial thread with worker pass-through timed out'}}finally{$callback.Dispose()}
  if(!$targets[0].process.WaitForExit(3000) -or !(Test-Path -LiteralPath $targets[0].output)){throw 'Initial thread with worker was not released'}
  $record=Get-Content -LiteralPath $targets[0].output -Raw -Encoding UTF8|ConvertFrom-Json
  if(@($record.args|Where-Object {$_ -like '--remote-debugging*'}).Count){throw 'Target with loader worker was unexpectedly patched'}
  $results+=[pscustomobject]@{name='initial-with-secondary-thread-pass-through';passed=$true;resumed=$true}
 }finally{[void][IdentityTestCleanup]::CloseHandle($extra)}
}finally{
 foreach($target in $targets){[void][IdentityTestCleanup]::ResumeThread($target.native.thread);[void]$target.process.WaitForExit(5000);$target.process.Dispose();[void][IdentityTestCleanup]::CloseHandle($target.native.thread);[void][IdentityTestCleanup]::CloseHandle($target.native.process)}
}
foreach($target in $targets){if(!(Test-Path -LiteralPath $target.output)){throw 'Test-owned target failed after explicit cleanup resume'}}
$results|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $work 'identity-results.json') -Encoding UTF8
$results|Format-Table
