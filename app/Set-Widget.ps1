param([ValidateSet('On','Off')][string]$State='On',[string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop';$data=Join-Path $InstallRoot 'data';$enabled=$State -eq 'On'
if(Test-Path -LiteralPath (Join-Path $data 'runtime.json')){
 . (Join-Path $InstallRoot 'Runtime-Paths.ps1');$node=Get-MutsumiNode $InstallRoot
 $action=if($enabled){'widget-on'}else{'widget-off'}
 Invoke-MutsumiNode -NodePath $node -Arguments @((Join-Path $InstallRoot 'widget\scripts\pet-customization.mjs'),$data,$action)
 if($LASTEXITCODE -ne 0){throw 'The running companion did not confirm the switch'}
}else{
 New-Item -ItemType Directory -Path $data -Force | Out-Null
 $file=Join-Path $data 'companion-settings.json';if(Test-Path -LiteralPath $file){$b=Join-Path $data 'customization-backups';New-Item -ItemType Directory -Path $b -Force | Out-Null;Copy-Item -LiteralPath $file -Destination (Join-Path $b ('companion-'+(Get-Date -Format 'yyyyMMddHHmmssfff')+'.json'))}
 @{version=1;widgetEnabled=$enabled} | ConvertTo-Json | Set-Content -LiteralPath ($file+'.tmp') -Encoding UTF8;Move-Item -LiteralPath ($file+'.tmp') -Destination $file -Force
 @{ok=$true;widgetEnabled=$enabled;appliesAtNextStart=$true} | ConvertTo-Json
}
