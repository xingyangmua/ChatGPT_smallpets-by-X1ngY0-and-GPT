param([Parameter(Mandatory=$true)][string]$OutputPath,[switch]$SelfTest,[switch]$ExperimentalPatch)
$ErrorActionPreference='Stop'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$arguments=@('/nologo','/target:winexe','/platform:x64','/optimize+','/reference:System.Web.Extensions.dll',('/out:'+[IO.Path]::GetFullPath($OutputPath)))
if($SelfTest){$arguments+='/define:SELF_TEST'}
elseif($ExperimentalPatch){$arguments+='/define:EXPERIMENTAL_PATCH'}
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))) -Force | Out-Null
& $compiler @arguments (Join-Path $PSScriptRoot 'StartupBridge.cs')
if($LASTEXITCODE -ne 0){throw 'Official startup prototype compilation failed'}
