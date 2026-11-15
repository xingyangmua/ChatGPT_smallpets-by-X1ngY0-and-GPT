param([string]$InstallRoot=$PSScriptRoot,[switch]$AttachOnly)
$ErrorActionPreference='Stop'
$config=& (Join-Path $InstallRoot 'Repair-Client.ps1') -InstallRoot $InstallRoot
$processes=@(Get-CimInstance Win32_Process -Filter ('Name='''+[IO.Path]::GetFileName($config.clientExe)+'''') -ErrorAction SilentlyContinue | Where-Object {$_.ExecutablePath -ieq $config.clientExe})
$ids=@($processes | ForEach-Object {$_.ProcessId})
$main=$processes | Where-Object {$_.ParentProcessId -notin $ids} | Select-Object -First 1
if(!$main){return}
try{& (Join-Path $InstallRoot 'Start-Animation.ps1') -InstallRoot $InstallRoot -ObserveProcessId $main.ProcessId | Out-Null}
catch{
 # Animation settings/media are optional. They must not block background recovery.
 try{@{ok=$false;reason='Startup animation request failed; background recovery continues';error=$_.Exception.Message;at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\startup-animation-error.json') -Encoding UTF8}catch{}
}
& (Join-Path $InstallRoot 'Background-Start.ps1') -InstallRoot $InstallRoot -AttachOnly | Out-Null
