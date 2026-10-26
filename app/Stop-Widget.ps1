param([string]$InstallRoot=(Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\codex_work_pet'))
$ErrorActionPreference='Stop'
$data=Join-Path $InstallRoot 'data'
& (Join-Path $InstallRoot 'widget\desktop\supervisor.ps1') -DataDir $data -Stop
$task=Get-ScheduledTask -TaskName 'Mutsumi Codex Companion' -ErrorAction SilentlyContinue
if($task){Disable-ScheduledTask -TaskName $task.TaskName | Out-Null}
$file=Join-Path $data 'follow-config.json'
if(Test-Path -LiteralPath $file){$c=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json;$c.enabled=$false;$c | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $file -Encoding UTF8}
'Mutsumi widget stopped and automatic following disabled. Data retained.'
