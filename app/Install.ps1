[CmdletBinding()]
param([string]$InstallRoot=(Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\codex_work_pet'),[switch]$PreflightOnly,[switch]$PrepareOnly,[switch]$Launch)
$ErrorActionPreference='Stop'
if($env:OS -ne 'Windows_NT' -or ![Environment]::Is64BitOperatingSystem){throw 'This release supports Windows x64 only'}
if($PSVersionTable.PSEdition -ne 'Desktop'){throw 'Run this installer with powershell.exe (Windows PowerShell 5.1), as shown in README.'}
$pkg=Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
if(!$pkg){throw 'Supported OpenAI.Codex desktop package is missing. Classic ChatGPT, DSH and browser pages are not substitute targets.'}
$client=Join-Path $pkg.InstallLocation 'app\ChatGPT.exe';if(!(Test-Path -LiteralPath $client)){$client=Join-Path $pkg.InstallLocation 'app\Codex.exe'}
$cli=Join-Path $pkg.InstallLocation 'app\resources\codex.exe'
if(!(Test-Path -LiteralPath $client) -or !(Test-Path -LiteralPath $cli)){throw 'This desktop build is unsupported: required GUI or official App Server executable missing'}
$target=[IO.Path]::GetFullPath($InstallRoot);if($target -eq [IO.Path]::GetPathRoot($target) -or $target -ieq $env:USERPROFILE){throw 'Unsafe installation root'}
$clientRunning=[bool](Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($client)) -ErrorAction SilentlyContinue | Where-Object {$_.Path -ieq $client -and $_.MainWindowHandle -ne 0})
$preflight=@{ok=$true;platform='windows-x64';packageName=$pkg.Name;packageVersion=[string]$pkg.Version;clientRunning=$clientRunning;installRoot=$target;existingInstall=Test-Path -LiteralPath (Join-Path $target 'data\mutsumi-install.json')}
if($PreflightOnly){$preflight | ConvertTo-Json;return}
if($PrepareOnly -and $preflight.existingInstall){throw 'PrepareOnly requires a new empty target; existing installation preserved'}
if((Test-Path -LiteralPath $target) -and (Get-ChildItem -LiteralPath $target -Force | Select-Object -First 1) -and !$preflight.existingInstall){throw 'Existing nonempty target directory is not this project; preserved'}
$task=Get-ScheduledTask -TaskName 'Mutsumi Codex Companion' -ErrorAction SilentlyContinue
if($task -and !$PrepareOnly){foreach($a in $task.Actions){if(!$a.Arguments.Contains((Join-Path $target 'widget\desktop\supervisor.ps1'))){throw 'A companion task belongs to another installation; preserved'}}}
if(!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'electron-runtime.zip'))){throw 'Complete Release ZIP required. GitHub source ZIP does not include runtime binaries.'}
New-Item -ItemType Directory -Path $target,(Join-Path $target 'data'),(Join-Path $target 'backups') -Force | Out-Null
if($preflight.existingInstall){
 $backup=Join-Path $target ('backups\release-'+(Get-Date -Format 'yyyyMMdd-HHmmss'));New-Item -ItemType Directory -Path $backup -Force | Out-Null
 foreach($name in 'widget','background-engine','backgrounds','background-themes','docs','receipt.json','codex_work_pet.exe','codex_work_pet_settings.exe'){if(Test-Path -LiteralPath (Join-Path $target $name)){Copy-Item -LiteralPath (Join-Path $target $name) -Destination $backup -Recurse}}
 Get-ChildItem -LiteralPath $target -File | Where-Object {$_.Extension -in @('.ps1','.cmd','.cs','.md') -or $_.Name -eq 'LICENSE'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $backup -Force}
 $backupData=Join-Path $backup 'data';New-Item -ItemType Directory -Path $backupData -Force | Out-Null
 foreach($name in 'mutsumi-install.json','display-mode.json','follow-config.json','follow-install.json','mutsumi-entrypoints.json'){if(Test-Path -LiteralPath (Join-Path $target ('data\'+$name))){Copy-Item -LiteralPath (Join-Path $target ('data\'+$name)) -Destination $backupData}}
 @{project='codex_work_pet';installRoot=$target;createdAt=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'rollback.json') -Encoding UTF8
 & (Join-Path $target 'widget\desktop\supervisor.ps1') -DataDir (Join-Path $target 'data') -Stop
 Start-Sleep -Seconds 3
}
foreach($name in 'widget','background-engine','backgrounds','background-themes','docs'){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name)){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $target -Recurse -Force}}
Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object {$_.Extension -in @('.ps1','.cmd','.cs','.md') -or $_.Name -in @('LICENSE','THIRD_PARTY_NOTICES')} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $target -Force}
$data=Join-Path $target 'data';$runtime=Join-Path $data 'desktop-runtime\node_modules\electron\dist'
if(!(Test-Path -LiteralPath (Join-Path $runtime 'electron.exe'))){New-Item -ItemType Directory -Path $runtime -Force | Out-Null;Expand-Archive -LiteralPath (Join-Path $PSScriptRoot 'electron-runtime.zip') -DestinationPath $runtime -Force}
$configFile=Join-Path $data 'mutsumi-install.json';$codexProfileHome=Join-Path $env:USERPROFILE '.codex';if(Test-Path -LiteralPath $configFile){$old=Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json;if($old.codexHome){$codexProfileHome=$old.codexHome}}
@{cli=$cli;clientExe=$client;codexHome=$codexProfileHome;appId=$pkg.PackageFamilyName+'!App';packageVersion=[string]$pkg.Version} | ConvertTo-Json | Set-Content -LiteralPath $configFile -Encoding UTF8
@{mode='subscription';version=1} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $data 'display-mode.json') -Encoding UTF8
& (Join-Path $target 'Build-Entries.ps1') -InstallRoot $target
if($PrepareOnly){@{ok=$true;stage='prepared-only';running=$false;autostartInstalled=$false} | ConvertTo-Json;return}
& (Join-Path $target 'widget\scripts\install-follow.ps1') -DataDir $data -NoStart | Out-Null
& (Join-Path $target 'Resume-Widget.ps1') -InstallRoot $target | Out-Null
& (Join-Path $target 'Install-SettingsEntry.ps1') -InstallRoot $target | Out-Null
$background=$false
if(Test-Path -LiteralPath (Join-Path $data 'background-state.json')){try{& (Join-Path $target 'Update-Background.ps1') -InstallRoot $target | Out-Null;$background=$true}catch{}}
if($Launch -and !$preflight.clientRunning){Start-Process -FilePath (Join-Path $target 'codex_work_pet.exe') -WindowStyle Hidden}
$receipt=@{project='codex_work_pet';version='1.1.0-beta.2';installedAt=(Get-Date).ToString('o');root=$target;packageName=$pkg.Name;packageVersion=[string]$pkg.Version;backgroundConnected=$background;clientRestarted=$false;originalClientEntrypointsPreserved=$true}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'receipt.json') -Encoding UTF8
@{ok=$true;stage='installed';installRoot=$target;backgroundConnected=$background;verificationRequired=$true;nextStep=if($background){'Run Status.ps1 and confirm companion health'}else{'Use managed Mutsumi Codex entry after a safe client exit; do not claim background complete until Status.ps1 confirms it'}} | ConvertTo-Json
