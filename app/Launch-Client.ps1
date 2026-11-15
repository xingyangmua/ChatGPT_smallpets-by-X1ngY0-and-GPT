param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop'
try {
 $config=& (Join-Path $InstallRoot 'Repair-Client.ps1') -InstallRoot $InstallRoot
 $follow=Get-Content -LiteralPath (Join-Path $InstallRoot 'data\follow-config.json') -Raw | ConvertFrom-Json
 $supervisor=Join-Path $InstallRoot 'widget\desktop\supervisor.ps1'
 Start-Process -FilePath $follow.launcherPath -ArgumentList ('--script "'+$supervisor+'" --data "'+(Join-Path $InstallRoot 'data')+'"') -WindowStyle Hidden
 $alive=@(Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($config.clientExe)) -ErrorAction SilentlyContinue | Where-Object {$_.Path -ieq $config.clientExe}).Count -gt 0
 if(!$alive -and (Test-Path -LiteralPath (Join-Path $InstallRoot 'Start-Animation.ps1'))){
  try{& (Join-Path $InstallRoot 'Start-Animation.ps1') -InstallRoot $InstallRoot -ColdLaunch | Out-Null}
  catch{@{ok=$false;reason='Startup animation request failed; theme launch continues';error=$_.Exception.Message;at=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\startup-animation-error.json') -Encoding UTF8}
 }
 & (Join-Path $InstallRoot 'Background-Start.ps1') -InstallRoot $InstallRoot | Out-Null
 # A successful cold theme launch already opened the official client.
 # A second ordinary activation can create an unthemed instance.
 if(!$alive){
  $started=@(Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($config.clientExe)) -ErrorAction SilentlyContinue | Where-Object {$_.Path -ieq $config.clientExe}).Count -gt 0
  if($started){return}
 }
 # Animation observes this launch; it must never initiate a second activation.
} catch {
 @{ok=$false;reason='Managed launch failed; run Status.ps1';error=$_.Exception.Message;at=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\client-launch-error.json') -Encoding UTF8
}
$appId=if($config){$config.appId}else{'OpenAI.Codex_2p2nqsd0c76g0!App'}
Start-Process -FilePath 'explorer.exe' -ArgumentList ('shell:AppsFolder\'+$appId)
