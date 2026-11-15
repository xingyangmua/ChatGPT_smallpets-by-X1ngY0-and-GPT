param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop'
$InstallRoot=[IO.Path]::GetFullPath($InstallRoot)
$task=Get-ScheduledTask -TaskName 'Mutsumi Codex Companion' -ErrorAction SilentlyContinue
if($task){foreach($a in $task.Actions){if(!$a.Arguments -or !$a.Arguments.Contains((Join-Path $InstallRoot 'widget\desktop\supervisor.ps1'))){throw 'Task belongs to another installation; nothing disabled'}}}
. (Join-Path $InstallRoot 'Official-Startup-Maintenance.ps1')
$maintenance=Enter-MutsumiStartupMaintenance $InstallRoot
try{
& (Join-Path $InstallRoot 'Restore-Background.ps1') -InstallRoot $InstallRoot
& (Join-Path $InstallRoot 'Stop-Widget.ps1') -InstallRoot $InstallRoot
& (Join-Path $InstallRoot 'Restore-Entries.ps1') -InstallRoot $InstallRoot
if($task){Unregister-ScheduledTask -TaskName $task.TaskName -Confirm:$false}
'Official startup remains disabled; its lease was released or never acquired. Background, companion and managed project shortcuts disabled. User images and backups retained. Existing ChatGPT/animation shortcuts preserved.'
}finally{Exit-MutsumiStartupMaintenance $maintenance}
