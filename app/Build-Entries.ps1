param([string]$InstallRoot=$PSScriptRoot,[switch]$SettingsOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$iconFile=Join-Path $InstallRoot 'data\pet.ico'
$image=[Drawing.Image]::FromFile((Join-Path $InstallRoot 'widget\assets\IMG3576.png'))
$bitmap=[Drawing.Bitmap]::new($image,32,32);$handle=$bitmap.GetHicon()
Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class PetIconHandle{[DllImport("user32.dll")]public static extern bool DestroyIcon(IntPtr icon);}' -ErrorAction SilentlyContinue
try{$icon=[Drawing.Icon]::FromHandle($handle);$stream=[IO.File]::Create($iconFile);try{$icon.Save($stream)}finally{$stream.Dispose();$icon.Dispose()}}
finally{[void][PetIconHandle]::DestroyIcon($handle);$bitmap.Dispose();$image.Dispose()}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(!$SettingsOnly){
 & $compiler /nologo /target:winexe /platform:x64 ('/win32icon:'+$iconFile) ('/out:'+(Join-Path $InstallRoot 'codex_work_pet.exe')) (Join-Path $InstallRoot 'ClientLauncher.cs')
 if($LASTEXITCODE -ne 0){throw 'Client entry compilation failed'}
}
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll ('/win32icon:'+$iconFile) ('/out:'+(Join-Path $InstallRoot 'codex_work_pet_settings.exe')) (Join-Path $InstallRoot 'SettingsLauncher.cs')
if($LASTEXITCODE -ne 0){throw 'Settings entry compilation failed'}
