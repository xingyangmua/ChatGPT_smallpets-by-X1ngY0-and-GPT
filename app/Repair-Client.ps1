param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop'
$package=Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
if(!$package){throw 'Supported OpenAI.Codex package is missing'}
$client=Join-Path $package.InstallLocation 'app\ChatGPT.exe'
if(!(Test-Path -LiteralPath $client)){$client=Join-Path $package.InstallLocation 'app\Codex.exe'}
$cli=Join-Path $package.InstallLocation 'app\resources\codex.exe'
if(!(Test-Path -LiteralPath $client) -or !(Test-Path -LiteralPath $cli)){throw 'Desktop package is incomplete'}
$file=Join-Path $InstallRoot 'data\mutsumi-install.json'
$config=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
$config.cli=$cli;$config.clientExe=$client;$config.packageVersion=[string]$package.Version
$config.appId=$package.PackageFamilyName+'!App'
$temp=$file+'.repair.tmp'
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temp -Encoding UTF8
Move-Item -LiteralPath $temp -Destination $file -Force
$config
