param([string]$InstallRoot=$PSScriptRoot)
$ErrorActionPreference='Stop'
$source=Join-Path $InstallRoot 'animation\WorkPetAnimation.cs'
if(!(Test-Path -LiteralPath $source)){return}
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$boot=Join-Path $InstallRoot 'boot'
New-Item -ItemType Directory -Path $boot -Force | Out-Null
$refs=@('System.dll','System.Core.dll','System.Xaml.dll','System.Web.Extensions.dll','System.Drawing.dll','System.Windows.Forms.dll')
foreach($name in 'WindowsBase.dll','PresentationCore.dll','PresentationFramework.dll'){$refs+=Join-Path $framework ('WPF\'+$name)}
$compile=@('/nologo','/target:winexe','/platform:x64','/optimize+',('/out:'+(Join-Path $boot 'WorkPetAnimation.exe')),('/win32manifest:'+(Join-Path $InstallRoot 'animation\app.manifest')))
foreach($ref in $refs){$compile+=('/reference:'+$ref)}
& (Join-Path $framework 'csc.exe') @compile $source
if($LASTEXITCODE -ne 0){throw 'Startup animation compilation failed'}
