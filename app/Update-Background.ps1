param([string]$InstallRoot=(Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\codex_work_pet'),[string]$NodePath,[string]$Evidence)
$ErrorActionPreference='Stop'
. (Join-Path $InstallRoot 'Runtime-Paths.ps1')
if(!$NodePath){$NodePath=Get-MutsumiNode $InstallRoot}
$stateFile=Join-Path $InstallRoot 'data\background-state.json'
$state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$injector=Join-Path $InstallRoot 'background-engine\scripts\injector.mjs'
if($state.injector -ine $injector){throw 'Background belongs to another installation'}
. (Join-Path $InstallRoot 'background-engine\scripts\common-windows.ps1')
$codex=Get-DreamSkinCodexInstall
$identity=Get-DreamSkinVerifiedCdpIdentity -Port $state.port -Codex $codex
if(!$identity -or $identity.BrowserId -cne $state.browserId){throw 'No current verified desktop background session; client was not restarted'}
$old=Get-Process -Id $state.pid -ErrorAction SilentlyContinue
if($old){$meta=Get-CimInstance Win32_Process -Filter ('ProcessId='+$state.pid);if($old.StartTime.ToUniversalTime().Ticks -ne ([DateTimeOffset]$state.startedAt).UtcDateTime.Ticks -or $meta.CommandLine -notlike ('*'+$injector+'*')){throw 'Watcher identity changed; preserved'};Stop-Process -Id $state.pid}
$apply=@($injector,'--once','--port',[string]$state.port,'--browser-id',$state.browserId,'--theme-dir',$state.theme)
if($Evidence){New-Item -ItemType Directory -Path $Evidence -Force | Out-Null;$apply+=@('--screenshot',(Join-Path $Evidence 'background-updated.png'))}
$result=Invoke-MutsumiNode -NodePath $NodePath -Arguments $apply
if($LASTEXITCODE -ne 0){throw 'Live background update failed'}
if($Evidence){$result | Set-Content -LiteralPath (Join-Path $Evidence 'background-update.json') -Encoding UTF8}
$pause=Join-Path $InstallRoot 'data\background-paused.json'
Remove-Item -LiteralPath $pause -ErrorAction SilentlyContinue
$line='"'+$injector+'" --watch --port '+$state.port+' --browser-id '+$state.browserId+' --theme-dir "'+$state.theme+'" --pause-file "'+$pause+'"'
$daemon=Start-MutsumiNode -NodePath $NodePath -ArgumentLine $line -Stdout (Join-Path $InstallRoot 'data\background-watch.log') -Stderr (Join-Path $InstallRoot 'data\background-watch-error.log')
$state.pid=$daemon.Id;$state.startedAt=$daemon.StartTime.ToUniversalTime().ToString('o');$state.enabled=$true
$state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $stateFile -Encoding UTF8
'Background updated in the running official desktop client.'
