param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop';. (Join-Path $InstallRoot 'Runtime-Paths.ps1');$node=Get-MutsumiNode $InstallRoot
$testRoot=Join-Path $InstallRoot 'widget\tests'
$tests=@(foreach($pattern in @('pet-*.test.mjs','install-record-recovery.test.mjs','repair-client.test.mjs','startup-animation.test.mjs','official-startup-*.test.mjs','official-shortcut.test.mjs','startup-maintenance.test.mjs')){
 Get-ChildItem -LiteralPath $testRoot -Filter $pattern | Select-Object -ExpandProperty FullName
}) | Sort-Object -Unique
Invoke-MutsumiNode -NodePath $node -Arguments (@('--test')+$tests)
if($LASTEXITCODE -ne 0){throw 'Isolated tests failed'}
