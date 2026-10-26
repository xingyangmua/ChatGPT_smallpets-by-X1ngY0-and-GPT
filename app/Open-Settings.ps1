param([string]$InstallRoot=$PSScriptRoot,[ValidateSet('client','widget')][string]$Panel='client')
$ErrorActionPreference='Stop'
. (Join-Path $InstallRoot 'Runtime-Paths.ps1')
$node=Get-MutsumiNode $InstallRoot;$data=Join-Path $InstallRoot 'data'
& (Join-Path $InstallRoot 'Resume-Widget.ps1') -InstallRoot $InstallRoot | Out-Null
$runtime=Join-Path $data 'runtime.json'
if(!(Test-Path -LiteralPath $runtime)){
 $entry=Join-Path $InstallRoot 'codex_work_pet.exe'
 if(!(Test-Path -LiteralPath $entry)){$entry=Join-Path $InstallRoot 'boot\DragonCodexBoot.exe'}
 if(!(Test-Path -LiteralPath $entry)){throw 'The managed client entry is missing. Reinstall this package.'}
 Start-Process -FilePath $entry -WindowStyle Hidden
}
$deadline=(Get-Date).AddSeconds(90)
do{
 if(Test-Path -LiteralPath $runtime){try{$result=Invoke-MutsumiNode -NodePath $node -Arguments @((Join-Path $InstallRoot 'widget\scripts\pet-customization.mjs'),$data,$Panel) 2>$null;if($LASTEXITCODE -eq 0 -and ($result | ConvertFrom-Json).ok){'Codex Work Pet settings opened.';return}}catch{}}
 Start-Sleep -Milliseconds 500
}while((Get-Date) -lt $deadline)
throw 'The settings window could not connect to the companion. Check the installed status report.'
