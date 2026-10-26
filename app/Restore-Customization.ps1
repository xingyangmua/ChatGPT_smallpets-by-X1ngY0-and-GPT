param([string]$InstallRoot=(Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\codex_work_pet'))
$ErrorActionPreference='Stop'
$data=Join-Path $InstallRoot 'data';$file=Join-Path $data 'mutsumi-customization.json'
$backup=Join-Path $data 'customization-backups';New-Item -ItemType Directory -Path $backup -Force | Out-Null
if(Test-Path -LiteralPath $file){Copy-Item -LiteralPath $file -Destination (Join-Path $backup ('restore-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json'))}
$state=@{version=1;client=@{images=@();selectedId='preset-3575';selectionRevision=([guid]::NewGuid().ToString());resetVisuals=$true};widget=@{slots=@($null,$null,$null,$null);bubble=$null;opacity=.25}}
$temp=$file+'.restore.tmp';$state | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $temp -Encoding UTF8;Move-Item -LiteralPath $temp -Destination $file -Force
$runtime=Join-Path $data 'desktop-runtime\node_modules\electron\dist\electron.exe'
$previousNodeMode=$env:ELECTRON_RUN_AS_NODE
$live=$false
try {
 $env:ELECTRON_RUN_AS_NODE='1'
 $response=& $runtime (Join-Path $InstallRoot 'widget\scripts\pet-customization.mjs') $data reload 2>$null
 if($LASTEXITCODE -eq 0){$live=($response | ConvertFrom-Json).ok -eq $true}
} catch {} finally { $env:ELECTRON_RUN_AS_NODE=$previousNodeMode }
if($live){'Default background, four original portraits and plain bubble restored in the running client.'}
else {'Defaults saved. The current background connection was unavailable; changes will apply when the companion and managed background session are running.'}
'Imported files and backups retained.'
