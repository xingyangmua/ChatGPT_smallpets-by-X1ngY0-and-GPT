param([string]$InstallRoot=$PSScriptRoot,[Parameter(Mandatory=$true)][string]$BackupDirectory)
$ErrorActionPreference='Stop'
$target=[IO.Path]::GetFullPath($InstallRoot).TrimEnd('\');$backup=[IO.Path]::GetFullPath($BackupDirectory).TrimEnd('\');$allowed=(Join-Path $target 'backups')+'\'
if(!$backup.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Backup must be inside this installation backups directory'}
$receipt=Get-Content -LiteralPath (Join-Path $backup 'rollback.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($receipt.project -ne 'codex_work_pet' -or $receipt.installRoot.TrimEnd('\') -ine $target){throw 'Backup identity mismatch; nothing restored'}
$task=Get-ScheduledTask -TaskName 'Mutsumi Codex Companion' -ErrorAction SilentlyContinue
if($task){foreach($a in $task.Actions){if(!$a.Arguments -or !$a.Arguments.Contains((Join-Path $target 'widget\desktop\supervisor.ps1'))){throw 'Task belongs to another installation; nothing restored'}}}
. (Join-Path $target 'Official-Startup-Maintenance.ps1')
$maintenance=Enter-MutsumiStartupMaintenance $target
try{
& (Join-Path $target 'widget\desktop\supervisor.ps1') -DataDir (Join-Path $target 'data') -Stop
Start-Sleep -Seconds 3
foreach($name in 'widget','background-engine','backgrounds','background-themes','animation','official-startup','docs'){if(Test-Path -LiteralPath (Join-Path $backup $name)){Copy-Item -LiteralPath (Join-Path $backup $name) -Destination $target -Recurse -Force}}
if(Test-Path -LiteralPath (Join-Path $backup 'boot\WorkPetAnimation.exe') -PathType Leaf){New-Item -ItemType Directory -Path (Join-Path $target 'boot') -Force | Out-Null;Copy-Item -LiteralPath (Join-Path $backup 'boot\WorkPetAnimation.exe') -Destination (Join-Path $target 'boot\WorkPetAnimation.exe') -Force}
Get-ChildItem -LiteralPath $backup -File | Where-Object {$_.Name -ne 'rollback.json'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $target -Force}
# Never restore data/official-startup settings or lease state from a backup.
# The current Off record remains authoritative even when old code is restored.
foreach($name in 'mutsumi-install.json','display-mode.json','follow-config.json','follow-install.json','mutsumi-entrypoints.json'){if(Test-Path -LiteralPath (Join-Path $backup ('data\'+$name))){Copy-Item -LiteralPath (Join-Path $backup ('data\'+$name)) -Destination (Join-Path $target 'data') -Force}}
& (Join-Path $target 'Resume-Widget.ps1') -InstallRoot $target
& (Join-Path $target 'Update-Background.ps1') -InstallRoot $target
'Previous component code restored; official startup remains disabled and no startup lease was reacquired. User images, login, chat profile and private animation media retained.'
}finally{Exit-MutsumiStartupMaintenance $maintenance}
