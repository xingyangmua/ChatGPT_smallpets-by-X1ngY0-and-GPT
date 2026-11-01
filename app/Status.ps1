param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop';$data=Join-Path $InstallRoot 'data';$r=[ordered]@{project='codex_work_pet';installed=(Test-Path -LiteralPath (Join-Path $data 'mutsumi-install.json'));companionRunning=$false;backgroundConnected=$false}
try{. (Join-Path $InstallRoot 'Runtime-Paths.ps1');$node=Get-MutsumiNode $InstallRoot;$raw=Invoke-MutsumiNode -NodePath $node -Arguments @((Join-Path $InstallRoot 'widget\scripts\pet-customization.mjs'),$data,'health') 2>$null;if($LASTEXITCODE -eq 0){$h=$raw | ConvertFrom-Json;$r.companionRunning=$h.ok;$r.widgetEnabled=$h.widgetEnabled;$r.widgetVisible=$h.visible;$r.widgetSurfaceReady=$h.widgetSurfaceReady;$r.quotaStatus=$h.quotaStatus;$r.quotaProcessRunning=$h.quotaProcessRunning}}catch{}
try{$raw=Invoke-MutsumiNode -NodePath $node -Arguments @((Join-Path $InstallRoot 'background-engine\scripts\pet-client-api.mjs'),$data,'read') 2>$null;if($LASTEXITCODE -eq 0){$b=$raw | ConvertFrom-Json;$r.backgroundConnected=$true;$r.backgroundSelection=$b.imageId;$r.nativeBackground=$b.native -eq $true}}catch{}
$r.backgroundStatus=if($r.backgroundConnected){'connected'}else{'unavailable'}
try{
 $state=Get-Content -LiteralPath (Join-Path $data 'background-state.json') -Raw | ConvertFrom-Json
 if($state.enabled -eq $false){$r.backgroundStatus='disabled'}
 elseif(!$r.backgroundConnected){$connection=Get-Content -LiteralPath (Join-Path $data 'background-connection.json') -Raw | ConvertFrom-Json;$r.backgroundStatus=$connection.status;if($connection.status -eq 'pending-restart'){$r.backgroundNextStep='Close the client safely, then open ChatGPT (Work Pet).'}}
}catch{}
try{$install=Get-Content -LiteralPath (Join-Path $data 'mutsumi-install.json') -Raw | ConvertFrom-Json;$r.recordedClientVersion=$install.packageVersion;$r.recordedCliExists=Test-Path -LiteralPath $install.cli}catch{}
$r | ConvertTo-Json -Depth 5
