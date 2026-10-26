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
 $port=9335;while($port -le 9345 -and !(Test-DreamSkinPortAvailable -Port $port)){$port++};if($port -gt 9345){throw 'No free managed loopback port'}
 $evidence=Join-Path $InstallRoot 'data\evidence';New-Item -ItemType Directory -Path $evidence -Force | Out-Null
 & (Join-Path $InstallRoot 'Background-Probe.ps1') -InstallRoot $InstallRoot -Evidence $evidence -NodePath $node -Port $port | Out-Null
}catch{@{ok=$false;at=(Get-Date).ToString('o');error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallRoot 'data\background-start-error.json') -Encoding UTF8}
finally{$mutex.ReleaseMutex();$mutex.Dispose()}
