param([Parameter(Mandatory=$true)][string]$InstallRoot,[switch]$AttachOnly)
$ErrorActionPreference='Stop'
$stateFile=Join-Path $InstallRoot 'data\background-state.json'
$state=$null
function Get-MutsumiClientSession($Processes){
 $ids=@($Processes | ForEach-Object {$_.ProcessId})
 $main=@($Processes | Where-Object {$_.ParentProcessId -notin $ids}) | Select-Object -First 1
 if($main){return ([string]$main.ProcessId)+'|'+([string]$main.CreationDate)}
 return ''
}
if(Test-Path -LiteralPath $stateFile){$state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json;if($state.enabled -ne $true){return}}
$owns=$false;$mutex=[Threading.Mutex]::new($true,'Local\MutsumiBackgroundStart',[ref]$owns)
if(!$owns){$mutex.Dispose();return}
try{
 . (Join-Path $InstallRoot 'Runtime-Paths.ps1');$node=Get-MutsumiNode $InstallRoot
 . (Join-Path $InstallRoot 'background-engine\scripts\common-windows.ps1')
 $codex=Get-DreamSkinCodexInstall
 $processes=@(Get-DreamSkinCodexProcesses -Codex $codex)
 $clientSession=Get-MutsumiClientSession $processes
 $existing=$processes.Count -gt 0
 if(!$existing -and $AttachOnly){return}
 $port=9335
 if($existing){
  $ports=@(9335..9345);if($state -and $state.port -in $ports){$ports=@($state.port)+@($ports | Where-Object {$_ -ne $state.port})}
  # One OS listener snapshot avoids eleven slow CDP probes on an ordinary
  # unthemed launch. The endpoint owner is still validated before attachment.
  $listening=@(Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort -Unique)
  $ports=@($ports | Where-Object {$_ -in $listening})
  $verified=$false;foreach($candidate in $ports){if(Get-DreamSkinVerifiedCdpIdentity -Port $candidate -Codex $codex){$port=$candidate;$verified=$true;break}}
  if(!$verified){
   if($AttachOnly){
    try{$last=Get-Content -LiteralPath (Join-Path $InstallRoot 'data\background-connection.json') -Raw | ConvertFrom-Json;if($last.status -eq 'failed' -and $clientSession -and $last.clientSession -eq $clientSession){return}}catch{}
   }
   @{ok=$false;status='pending-restart';clientSession=$clientSession;reason='Exit the client safely, including its tray process, then open ChatGPT (Work Pet).';at=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-connection.json') -Encoding UTF8
   return
  }
  try{
   . (Join-Path $InstallRoot 'Background-Process.ps1')
   $watcher=Get-Process -Id $state.pid -ErrorAction SilentlyContinue
   $meta=Get-CimInstance Win32_Process -Filter ('ProcessId='+$state.pid) -ErrorAction SilentlyContinue
   if($watcher -and (Test-MutsumiWatcherIdentity $state $meta $watcher.StartTime (Join-Path $InstallRoot 'background-engine\scripts\injector.mjs'))){
    Invoke-MutsumiNode -NodePath $node -Arguments @((Join-Path $InstallRoot 'background-engine\scripts\pet-client-api.mjs'),(Join-Path $InstallRoot 'data'),'read') | Out-Null
    if($LASTEXITCODE -eq 0){return}
   }
  }catch{}finally{if($watcher){$watcher.Dispose()}}
 }else{while($port -le 9345 -and !(Test-DreamSkinPortAvailable -Port $port)){$port++};if($port -gt 9345){throw 'No free managed loopback port'}}
 if($state){. (Join-Path $InstallRoot 'Background-Process.ps1');[void](Stop-MutsumiBackgroundWatcher $state (Join-Path $InstallRoot 'background-engine\scripts\injector.mjs'))}
 $evidence=Join-Path $InstallRoot 'data\evidence';New-Item -ItemType Directory -Path $evidence -Force | Out-Null
 $result=& (Join-Path $InstallRoot 'Background-Probe.ps1') -InstallRoot $InstallRoot -Evidence $evidence -NodePath $node -Port $port -AttachExisting:$existing
 $report=$result | ConvertFrom-Json
 $clientSession=Get-MutsumiClientSession @(Get-DreamSkinCodexProcesses -Codex $codex)
 $connection=@{ok=$report.ok;status=if($report.ok){'connected'}else{'failed'};stage=$report.stage;clientSession=$clientSession;at=(Get-Date).ToString('o')}
 if(!$report.ok){$connection.reason=$report.error}
 $connection | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-connection.json') -Encoding UTF8
}catch{
 $failure=@{ok=$false;status='failed';at=(Get-Date).ToString('o');reason=$_.Exception.Message}
 $failure | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-connection.json') -Encoding UTF8
 $failure | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-start-error.json') -Encoding UTF8
}
finally{$mutex.ReleaseMutex();$mutex.Dispose()}
