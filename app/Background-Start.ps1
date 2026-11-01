param([Parameter(Mandatory=$true)][string]$InstallRoot)
$ErrorActionPreference='Stop'
$stateFile=Join-Path $InstallRoot 'data\background-state.json'
$state=$null
if(Test-Path -LiteralPath $stateFile){$state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json;if($state.enabled -ne $true){return}}
$owns=$false;$mutex=[Threading.Mutex]::new($true,'Local\MutsumiBackgroundStart',[ref]$owns)
if(!$owns){$mutex.Dispose();return}
try{
 . (Join-Path $InstallRoot 'Runtime-Paths.ps1');$node=Get-MutsumiNode $InstallRoot
 . (Join-Path $InstallRoot 'background-engine\scripts\common-windows.ps1')
 $codex=Get-DreamSkinCodexInstall
 $existing=@(Get-DreamSkinCodexProcesses -Codex $codex).Count -gt 0
 $port=9335
 if($existing){
  $ports=@(9335..9345);if($state -and $state.port -in $ports){$ports=@($state.port)+@($ports | Where-Object {$_ -ne $state.port})}
  $verified=$false;foreach($candidate in $ports){if(Get-DreamSkinVerifiedCdpIdentity -Port $candidate -Codex $codex){$port=$candidate;$verified=$true;break}}
  if(!$verified){
   @{ok=$false;status='pending-restart';reason='Close the client safely, then open ChatGPT (Work Pet).';at=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-connection.json') -Encoding UTF8
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
 $evidence=Join-Path $InstallRoot 'data\evidence';New-Item -ItemType Directory -Path $evidence -Force | Out-Null
 $result=& (Join-Path $InstallRoot 'Background-Probe.ps1') -InstallRoot $InstallRoot -Evidence $evidence -NodePath $node -Port $port -AttachExisting:$existing
 $report=$result | ConvertFrom-Json
 @{ok=$report.ok;status=if($report.ok){'connected'}else{'failed'};at=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-connection.json') -Encoding UTF8
}catch{@{ok=$false;at=(Get-Date).ToString('o');error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-start-error.json') -Encoding UTF8}
finally{$mutex.ReleaseMutex();$mutex.Dispose()}
