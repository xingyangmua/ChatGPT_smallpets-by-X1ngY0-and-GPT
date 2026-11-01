param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop'
try {
 $config=& (Join-Path $InstallRoot 'Repair-Client.ps1') -InstallRoot $InstallRoot
 $follow=Get-Content -LiteralPath (Join-Path $InstallRoot 'data\follow-config.json') -Raw | ConvertFrom-Json
 $supervisor=Join-Path $InstallRoot 'widget\desktop\supervisor.ps1'
 Start-Process -FilePath $follow.launcherPath -ArgumentList ('--script "'+$supervisor+'" --data "'+(Join-Path $InstallRoot 'data')+'"') -WindowStyle Hidden
 $alive=@(Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($config.clientExe)) -ErrorAction SilentlyContinue | Where-Object {$_.Path -ieq $config.clientExe}).Count -gt 0
 & (Join-Path $InstallRoot 'Background-Start.ps1') -InstallRoot $InstallRoot
 # Preserve a separately installed animation integration and its media.
 $boot=Join-Path $InstallRoot 'boot\DragonCodexBoot.exe'
 if(!$alive -and (Test-Path -LiteralPath $boot)){Start-Process -FilePath $boot -WorkingDirectory (Split-Path $boot) -WindowStyle Hidden;return}
} catch {
 @{ok=$false;reason='Managed launch failed; run Status.ps1';at=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\client-launch-error.json') -Encoding UTF8
}
$appId=if($config){$config.appId}else{'OpenAI.Codex_2p2nqsd0c76g0!App'}
Start-Process -FilePath 'explorer.exe' -ArgumentList ('shell:AppsFolder\'+$appId)
