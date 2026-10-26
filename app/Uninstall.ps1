param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop'
& (Join-Path $InstallRoot 'Restore-Background.ps1') -InstallRoot $InstallRoot
& (Join-Path $InstallRoot 'Stop-Widget.ps1') -InstallRoot $InstallRoot
& (Join-Path $InstallRoot 'Restore-Entries.ps1') -InstallRoot $InstallRoot
$task=Get-ScheduledTask -TaskName 'Mutsumi Codex Companion' -ErrorAction SilentlyContinue
if($task){foreach($a in $task.Actions){if(!$a.Arguments.Contains((Join-Path $InstallRoot 'widget\desktop\supervisor.ps1'))){throw 'Task belongs to another installation; preserved'}};Unregister-ScheduledTask -TaskName $task.TaskName -Confirm:$false}
'Background, companion and managed project shortcuts disabled. User images and backups retained. Existing ChatGPT/animation shortcuts preserved.'
