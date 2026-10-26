param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll ('/out:'+(Join-Path $InstallRoot 'codex_work_pet_settings.exe')) (Join-Path $InstallRoot 'SettingsLauncher.cs')
if($LASTEXITCODE -ne 0){throw 'Settings entry compilation failed'}
$file=Join-Path $InstallRoot 'data\mutsumi-entrypoints.json';$records=@();if(Test-Path -LiteralPath $file){$records=@(Get-Content -LiteralPath $file -Raw | ConvertFrom-Json)}
$shell=New-Object -ComObject WScript.Shell
foreach($folder in @([Environment]::GetFolderPath('Desktop'),(Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))){
 foreach($entry in @(@{name='Codex Work Pet Settings.lnk';exe='codex_work_pet_settings.exe'},@{name='Codex Work Pet.lnk';exe='codex_work_pet.exe'})){
  $target=Join-Path $InstallRoot $entry.exe;if(!(Test-Path -LiteralPath $target)){continue};$link=Join-Path $folder $entry.name;$old=@($records | Where-Object {$_.path -ieq $link}) | Select-Object -First 1
  if((Test-Path -LiteralPath $link) -and $shell.CreateShortcut($link).TargetPath -ine $target){Write-Warning ('Preserved existing unowned shortcut: '+$entry.name);continue}
  $backup=$null;if(!$old -and (Test-Path -LiteralPath $link)){$dir=Join-Path $InstallRoot 'data\shortcut-backups';New-Item -ItemType Directory -Path $dir -Force | Out-Null;$backup=Join-Path $dir ([guid]::NewGuid().ToString()+'.lnk');Copy-Item -LiteralPath $link -Destination $backup}
  $s=$shell.CreateShortcut($link);$s.TargetPath=$target;$s.WorkingDirectory=$InstallRoot;$s.IconLocation=$target+',0';$s.Save()
  $records=@($records | Where-Object {$_.path -ine $link})+@(@{path=$link;target=$target;backup=if($old){$old.backup}else{$backup};hash=(Get-FileHash -LiteralPath $link -Algorithm SHA256).Hash})
 }
}
ConvertTo-Json -InputObject @($records) -Depth 5 | Set-Content -LiteralPath $file -Encoding UTF8
'Settings entries installed. The companion can be re-enabled even while its avatar is hidden.'
