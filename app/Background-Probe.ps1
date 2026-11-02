param([Parameter(Mandatory=$true)][string]$InstallRoot,[Parameter(Mandatory=$true)][string]$Evidence,[Parameter(Mandatory=$true)][string]$NodePath,[int]$Port=9335,[switch]$AttachExisting)
$ErrorActionPreference='Stop'
. (Join-Path $InstallRoot 'Runtime-Paths.ps1')
$engine=Join-Path $InstallRoot 'background-engine'
. (Join-Path $engine 'scripts\common-windows.ps1')
$report=[ordered]@{ok=$false;project='Fei-Away/Codex-Dream-Skin';version='1.5.21';at=(Get-Date).ToString('o');port=$Port;profilePreserved=$true;configurationModified=$false;protectedPackageModified=$false;stage='preflight'}
$codex=$null;$baseline=@();$daemon=$null
try {
 $codex=Get-DreamSkinCodexInstall
 $report.clientVersion=[string]$codex.Version
 $baseline=@(Get-DreamSkinCodexProcesses -Codex $codex | ForEach-Object {[int]$_.ProcessId})
 if($AttachExisting){
  $identity=Get-DreamSkinVerifiedCdpIdentity -Port $Port -Codex $codex
  if(!$identity){throw 'The existing client has no verified background endpoint; it was preserved'}
  $report.strategy='attach-existing';$report.stage='listener'
 }else{
 if($baseline.Count){throw 'The verified client must be fully closed before this probe'}
 if(!(Test-DreamSkinPortAvailable -Port $Port)){throw 'Loopback port occupied; no client launched'}
 $profile=Join-Path $env:APPDATA 'Codex\web\Codex'
 $report.profileResolution='logical Roaming profile'
 if(!(Test-Path -LiteralPath (Join-Path $profile 'Local State'))){
  $virtualProfile=Join-Path $env:LOCALAPPDATA ('Packages\'+$codex.PackageFamilyName+'\LocalCache\Roaming\Codex\web\Codex')
  if(!(Test-Path -LiteralPath (Join-Path $virtualProfile 'Local State'))){throw 'Existing desktop profile not found; separate login profile will not be created'}
  $profile=$virtualProfile;$report.profileResolution='existing MSIX LocalCache Roaming profile'
 }
 $report.stage='launch'
 $null=Start-DreamSkinCodex -Codex $codex -Arguments @('--remote-debugging-address=127.0.0.1',"--remote-debugging-port=$Port","--user-data-dir=$profile")
 $report.strategy='package-activation'
 $report.argumentStatus=Wait-DreamSkinCodexDebugArgumentStatus -Codex $codex -Port $Port
 $report.packageArgumentStatus=$report.argumentStatus
 $report.stage='listener'
 $deadline=(Get-Date).AddSeconds(45);$identity=$null
 do {$identity=Get-DreamSkinVerifiedCdpIdentity -Port $Port -Codex $codex;if($identity){break};Start-Sleep -Milliseconds 500}while((Get-Date) -lt $deadline)
 if(!$identity){throw ('Actual '+$codex.Version+' did not expose an owned, verified loopback CDP endpoint within 45 seconds; arguments='+$launch.ArgumentStatus)}
 }
 $report.stage='renderer'
 $injector=Join-Path $engine 'scripts\injector.mjs';$theme=Join-Path $InstallRoot 'background-themes\3575'
 $render=Invoke-MutsumiNode -NodePath $NodePath -Arguments @($injector,'--once','--port',[string]$Port,'--browser-id',$identity.BrowserId,'--theme-dir',$theme,'--screenshot',(Join-Path $Evidence 'background-installed.png')) 2> (Join-Path $Evidence 'background-render-error.txt')
 $exit=$LASTEXITCODE
 $render | Set-Content -LiteralPath (Join-Path $Evidence 'background-render.json') -Encoding UTF8
 if($exit -ne 0){throw 'Verified CDP exists but upstream renderer injection/verification failed; see background-render-error.txt'}
 $verify=Invoke-MutsumiNode -NodePath $NodePath -Arguments @($injector,'--verify','--port',[string]$Port,'--browser-id',$identity.BrowserId,'--theme-dir',$theme)
 $verify | Set-Content -LiteralPath (Join-Path $Evidence 'background-verify.json') -Encoding UTF8
 if($LASTEXITCODE -ne 0){throw 'Upstream actual-render verification failed'}
 Remove-Item -LiteralPath (Join-Path $InstallRoot 'data\background-paused.json') -ErrorAction SilentlyContinue
 $args='"'+$injector+'" --watch --port '+$Port+' --browser-id '+$identity.BrowserId+' --theme-dir "'+$theme+'" --pause-file "'+(Join-Path $InstallRoot 'data\background-paused.json')+'"'
 $daemon=Start-MutsumiNode -NodePath $NodePath -ArgumentLine $args -Stdout (Join-Path $InstallRoot 'data\background-watch.log') -Stderr (Join-Path $InstallRoot 'data\background-watch-error.log')
 @{enabled=$true;port=$Port;browserId=$identity.BrowserId;pid=$daemon.Id;startedAt=$daemon.StartTime.ToUniversalTime().ToString('o');injector=$injector;theme=$theme} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-state.json') -Encoding UTF8
 $report.stage='injected';$report.ok=$true
}catch{
 $report.error=$_.Exception.Message
 # Keep the client alive: a user may already have started a task while the
 # bounded connection probe was running. A theme failure is never permission
 # to terminate that task.
 $report.clientPreserved=$true
}finally{
 $report.finishedAt=(Get-Date).ToString('o')
 $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Evidence 'background-probe.json') -Encoding UTF8
}
$report | ConvertTo-Json -Depth 6
