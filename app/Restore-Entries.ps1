param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop';$state=Join-Path $InstallRoot 'data\mutsumi-entrypoints.json';if(!(Test-Path -LiteralPath $state)){return}
$records=@(Get-Content -LiteralPath $state -Raw | ConvertFrom-Json);$shell=New-Object -ComObject WScript.Shell
foreach($folder in @([Environment]::GetFolderPath('Desktop'),(Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))){foreach($name in 'Codex Work Pet Settings.lnk','Codex Work Pet.lnk'){
 $file=Join-Path $folder $name;$record=$records | Where-Object {$_.path -ieq $file} | Select-Object -First 1
 if(!$record -or !(Test-Path -LiteralPath $file)){continue}
 if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ine $record.hash){Write-Warning ('User-modified shortcut preserved: '+$name);continue}
 $expected=Join-Path $InstallRoot $(if($name -eq 'Codex Work Pet Settings.lnk'){'codex_work_pet_settings.exe'}else{'codex_work_pet.exe'})
 if($shell.CreateShortcut($file).TargetPath -ine $expected){continue}
 if($record.backup){$allowed=[IO.Path]::GetFullPath((Join-Path $InstallRoot 'data\shortcut-backups'))+[IO.Path]::DirectorySeparatorChar;$backup=[IO.Path]::GetFullPath($record.backup);if(!$backup.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Untrusted shortcut backup path'};Copy-Item -LiteralPath $backup -Destination $file -Force}else{Remove-Item -LiteralPath $file}
}}
