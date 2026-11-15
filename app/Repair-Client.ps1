param([string]$InstallRoot=$PSScriptRoot,[string]$NewCodexHome)
$ErrorActionPreference='Stop'
$InstallRoot=[IO.Path]::GetFullPath($InstallRoot)
$package=Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
if(!$package){throw 'Supported OpenAI.Codex package is missing'}
$client=Join-Path $package.InstallLocation 'app\ChatGPT.exe'
if(!(Test-Path -LiteralPath $client)){$client=Join-Path $package.InstallLocation 'app\Codex.exe'}
$cli=Join-Path $package.InstallLocation 'app\resources\codex.exe'
if(!(Test-Path -LiteralPath $client) -or !(Test-Path -LiteralPath $cli)){throw 'Desktop package is incomplete'}
$file=Join-Path $InstallRoot 'data\mutsumi-install.json'

function Test-MutsumiAbsoluteProfile([string]$Path) {
 if([string]::IsNullOrWhiteSpace($Path) -or $Path.IndexOf([char]0) -ge 0){return $false}
 # Drive-relative and current-drive-rooted values change meaning with the
 # caller's working directory; neither is an existing profile identity.
 return $Path -match '^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))'
}

function Read-MutsumiInstallRecord([string]$Path) {
 if(!(Test-Path -LiteralPath $Path -PathType Leaf)){return $null}
 try {
  $value=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
  # This record selects the existing account profile. Do not guess a new one
  # when a truncated write has destroyed it.
  if($value -isnot [pscustomobject] -or $value.codexHome -isnot [string] -or
     !(Test-MutsumiAbsoluteProfile $value.codexHome)){return $null}
  return $value
 }catch{return $null}
}

# Launch, observation and quota recovery may run at the same time. Serialize
# only this installation, then re-read under the lock before deciding to write.
$hash=[Security.Cryptography.SHA256]::Create()
try{$key=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($file.ToUpperInvariant())))).Replace('-','')}
finally{$hash.Dispose()}
$mutex=[Threading.Mutex]::new($false,('Local\MutsumiInstallRepair-'+$key))
$locked=$false;$temp=$null
try {
 try{$locked=$mutex.WaitOne(15000)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){throw 'Another client-path repair is still running; try again shortly'}
 $config=Read-MutsumiInstallRecord $file
 $recovered=$false
 if(!$config){
  $backupRoot=Join-Path $InstallRoot 'backups'
  if(Test-Path -LiteralPath $backupRoot -PathType Container){
   $backups=@(Get-ChildItem -LiteralPath $backupRoot -Filter 'mutsumi-install.json' -File -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending)
   foreach($backup in $backups){$config=Read-MutsumiInstallRecord $backup.FullName;if($config){break}}
  }
  if(!$config -and !(Test-Path -LiteralPath $file) -and $NewCodexHome){
   if(!(Test-MutsumiAbsoluteProfile $NewCodexHome)){throw 'NewCodexHome must be a fully qualified existing profile location'}
   $config=[pscustomobject]@{codexHome=$NewCodexHome}
  }
  if(!$config){throw 'Client installation record is missing or damaged and no valid backup preserves codexHome; restore the existing profile setting before repairing'}
  $recovered=$true
 }
 $updates=[ordered]@{cli=$cli;clientExe=$client;packageVersion=[string]$package.Version;appId=$package.PackageFamilyName+'!App'}
 $changed=$recovered
 foreach($name in $updates.Keys){
  if($config.$name -cne $updates[$name]){$changed=$true;$config | Add-Member -NotePropertyName $name -NotePropertyValue $updates[$name] -Force}
 }
 if($changed){
  $token=[Guid]::NewGuid().ToString('N')
  $temp=$file+'.repair.'+$token+'.tmp'
  # Retain a BOM for legacy Windows PowerShell readers elsewhere in the app.
  $encoding=[Text.UTF8Encoding]::new($true)
  [byte[]]$bytes=$encoding.GetPreamble()+$encoding.GetBytes(($config | ConvertTo-Json -Depth 16))
  $stream=[IO.FileStream]::new($temp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
  if(Test-Path -LiteralPath $file -PathType Leaf){
   $preserved=[NullString]::Value
   if($recovered){$preserved=$file+'.corrupt.'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')+'.'+$token+'.bak'}
   [IO.File]::Replace($temp,$file,$preserved)
  }else{[IO.File]::Move($temp,$file)}
  $temp=$null
 }
 $config
}finally{
 if($temp -and (Test-Path -LiteralPath $temp)){Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue}
 if($locked){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
