param([string]$InstallRoot=$PSScriptRoot,[Parameter(Mandatory=$true)][string]$BackupDirectory)
$ErrorActionPreference='Stop'
$target=[IO.Path]::GetFullPath($InstallRoot).TrimEnd('\');$backup=[IO.Path]::GetFullPath($BackupDirectory).TrimEnd('\');$allowed=(Join-Path $target 'backups')+'\'
if(!$backup.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Backup must be inside this installation backups directory'}
$receipt=Get-Content -LiteralPath (Join-Path $backup 'rollback.json') -Raw | ConvertFrom-Json
if($receipt.project -ne 'codex_work_pet' -or $receipt.installRoot.TrimEnd('\') -ine $target){throw 'Backup identity mismatch; nothing restored'}
& (Join-Path $target 'widget\desktop\supervisor.ps1') -DataDir (Join-Path $target 'data') -Stop
Start-Sleep -Seconds 3
foreach($name in 'widget','background-engine','backgrounds','background-themes','docs'){if(Test-Path -LiteralPath (Join-Path $backup $name)){Copy-Item -LiteralPath (Join-Path $backup $name) -Destination $target -Recurse -Force}}
Get-ChildItem -LiteralPath $backup -File | Where-Object {$_.Name -ne 'rollback.json'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $target -Force}
foreach($name in 'mutsumi-install.json','display-mode.json','follow-config.json','follow-install.json','mutsumi-entrypoints.json'){if(Test-Path -LiteralPath (Join-Path $backup ('data\'+$name))){Copy-Item -LiteralPath (Join-Path $backup ('data\'+$name)) -Destination (Join-Path $target 'data') -Force}}
& (Join-Path $target 'Resume-Widget.ps1') -InstallRoot $target
& (Join-Path $target 'Update-Background.ps1') -InstallRoot $target
'Previous component code restored. User images, login and chat profile retained.'
