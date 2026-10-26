[CmdletBinding()]
param([string]$Repository,[string]$InstallRoot=(Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\codex_work_pet'),[switch]$PreflightOnly,[switch]$Launch)
$ErrorActionPreference='Stop';$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release.json') -Raw | ConvertFrom-Json
if(!$Repository){try{$remote=& git -C $PSScriptRoot remote get-url origin 2>$null;if($remote -match 'github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$'){$Repository=$Matches[1]}}catch{}}
$Repository=$Repository -replace '^https://github\.com/','' -replace '\.git$','' -replace '/$',''
if($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'){throw 'Pass -Repository owner/repository, using the exact GitHub project supplied by the user.'}
if($manifest.assetName -notmatch '^[A-Za-z0-9_.-]+\.zip$' -or $manifest.sha256 -notmatch '^[A-Fa-f0-9]{64}$'){throw 'Invalid release manifest'}
$stage=Join-Path ([IO.Path]::GetTempPath()) ('mutsumi-install-'+[guid]::NewGuid().ToString('N'));New-Item -ItemType Directory -Path $stage | Out-Null
$zip=Join-Path $stage $manifest.assetName;$url='https://github.com/'+$Repository+'/releases/download/'+$manifest.tag+'/'+$manifest.assetName
Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ine $manifest.sha256){throw 'Release checksum mismatch; no code was executed'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[IO.Compression.ZipFile]::OpenRead($zip);$root=[IO.Path]::GetFullPath((Join-Path $stage 'package'))+[IO.Path]::DirectorySeparatorChar
try{$total=0;foreach($entry in $archive.Entries){$path=[IO.Path]::GetFullPath((Join-Path $root $entry.FullName));if(!$path.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe ZIP path'};$total+=$entry.Length;if($total -gt 1500000000){throw 'Unexpected uncompressed package size'}}}finally{$archive.Dispose()}
Expand-Archive -LiteralPath $zip -DestinationPath $root
$params=@{InstallRoot=$InstallRoot};if($PreflightOnly){$params.PreflightOnly=$true};if($Launch){$params.Launch=$true}
& (Join-Path $root 'Install.ps1') @params
if($LASTEXITCODE -ne 0){throw 'Installer did not finish successfully'}
