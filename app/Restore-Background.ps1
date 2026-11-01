param([string]$InstallRoot=(Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\codex_work_pet'))
$ErrorActionPreference='Stop'
$stateFile=Join-Path $InstallRoot 'data\background-state.json'
if(!(Test-Path -LiteralPath $stateFile)){'No background was injected; official appearance retained.';return}
$state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$injector=Join-Path $InstallRoot 'background-engine\scripts\injector.mjs'
if($state.injector -ine $injector){throw 'Background state belongs to another installation; preserved'}
. (Join-Path $InstallRoot 'Runtime-Paths.ps1');$node=Get-MutsumiNode $InstallRoot
New-Item -ItemType File -Path (Join-Path $InstallRoot 'data\background-paused.json') -Force | Out-Null
try {Invoke-MutsumiNode -NodePath $node -Arguments @($injector,'--remove','--port',[string]$state.port,'--browser-id',$state.browserId) | Out-Null}catch{}
. (Join-Path $InstallRoot 'Background-Process.ps1')
[void](Stop-MutsumiBackgroundWatcher $state $injector)
$state.enabled=$false;$state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $stateFile -Encoding UTF8
'Background injection removed and watcher disabled. Normal client exit closes the local debugging session. User data retained.'
