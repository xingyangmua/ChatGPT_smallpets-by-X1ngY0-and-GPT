param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop';. (Join-Path $InstallRoot 'Runtime-Paths.ps1');$node=Get-MutsumiNode $InstallRoot
$tests=@(Get-ChildItem -LiteralPath (Join-Path $InstallRoot 'widget\tests') -Filter 'pet-*.test.mjs' | Select-Object -ExpandProperty FullName)
Invoke-MutsumiNode -NodePath $node -Arguments (@('--test')+$tests)
if($LASTEXITCODE -ne 0){throw 'Isolated tests failed'}
