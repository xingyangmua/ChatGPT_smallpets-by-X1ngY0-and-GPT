param([string]$InstallRoot=(Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\codex_work_pet'))
$ErrorActionPreference='Stop'
$data=Join-Path $InstallRoot 'data'
$file=Join-Path $data 'follow-config.json'
$c=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
$c.enabled=$true
$c | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $file -Encoding UTF8
$pause=Join-Path $data 'pause-until-host-exit.json'
if(Test-Path -LiteralPath $pause){Remove-Item -LiteralPath $pause}
try {
 Enable-ScheduledTask -TaskName 'Mutsumi Codex Companion' | Out-Null
 Start-ScheduledTask -TaskName 'Mutsumi Codex Companion'
} catch { Write-Warning 'Task Scheduler could not activate this login session; using the installed GUI launcher.' }
# The launcher mutex makes this safe when the scheduled activation also works.
# A remote login can leave Task Scheduler without an interactive logon token.
$script=Join-Path $InstallRoot 'widget\desktop\supervisor.ps1'
Start-Process -FilePath $c.launcherPath -ArgumentList @('--script',('"'+$script+'"'),'--data',('"'+$data+'"')) -WindowStyle Hidden
$ready=$false;$deadline=(Get-Date).AddSeconds(20)
while((Get-Date) -lt $deadline){
 try{$r=Get-Content -LiteralPath (Join-Path $data 'supervisor-state.json') -Raw | ConvertFrom-Json;$p=Get-Process -Id $r.pid -ErrorAction Stop;if($p.ProcessName -eq 'powershell'){$ready=$true;break}}catch{}
 Start-Sleep -Milliseconds 300
}
if(!$ready){throw 'The companion monitor did not become ready. No successful resume was reported.'}
'Mutsumi widget following resumed with a verified monitor.'
