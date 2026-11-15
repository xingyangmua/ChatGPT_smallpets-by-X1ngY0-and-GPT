param([string]$InstallRoot=$PSScriptRoot,[int]$ObserveProcessId=0,[switch]$ColdLaunch)
$ErrorActionPreference='Stop'
$data=Join-Path $InstallRoot 'data'
$stateFile=Join-Path $data 'startup-animation-state.json'
$settings=Join-Path $data 'startup-animation.json'
if(Test-Path -LiteralPath $settings){$config=Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json;if($config.enabled -eq $false){return}}
$player=Join-Path $InstallRoot 'boot\WorkPetAnimation.exe'
$configFile=Join-Path $InstallRoot 'boot\launcher.json'
if(!(Test-Path -LiteralPath $player) -or !(Test-Path -LiteralPath $configFile)){return}
$boot=Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
if(!(Test-Path -LiteralPath (Join-Path (Split-Path $player) $boot.Video))){return}
$hash=[Security.Cryptography.SHA256]::Create()
try{$key=[BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($InstallRoot).ToLowerInvariant()))).Replace('-','').Substring(0,24)}finally{$hash.Dispose()}
$owns=$false;$mutex=[Threading.Mutex]::new($true,('Local\WorkPetAnimationRequest-'+$key),[ref]$owns)
if(!$owns){$mutex.Dispose();return}
try{
 $now=[DateTime]::UtcNow;$session='';$process=$null;$previous=$null
 if(Test-Path -LiteralPath $stateFile){$previous=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json}
 if($ObserveProcessId -gt 0){
  $process=Get-Process -Id $ObserveProcessId -ErrorAction SilentlyContinue
  if(!$process){return}
  try{
   $clientConfig=Get-Content -LiteralPath (Join-Path $data 'mutsumi-install.json') -Raw | ConvertFrom-Json
   if($process.Path -ine $clientConfig.clientExe){return}
   $started=$process.StartTime.ToUniversalTime();$session=([string]$ObserveProcessId)+'|'+$started.ToString('o')
   if($previous.session -eq $session){return}
   $age=[double]::PositiveInfinity
   if($previous -and ![string]::IsNullOrWhiteSpace([string]$previous.at)){try{$age=($now-[DateTimeOffset]::Parse([string]$previous.at,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime).TotalSeconds}catch{$age=[double]::PositiveInfinity}}
   if($previous -and !$previous.session -and $age -lt 45){
    $previous.session=$session;$previous | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8;return
   }
   if(($now-$started).TotalSeconds -gt 20){
    @{session=$session;at=$now.ToString('o');played=$false;reason='existing-session'} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8;return
   }
  }finally{$process.Dispose()}
 }elseif(!$ColdLaunch){return}
 $arguments='--attach-only'
 if($ObserveProcessId -gt 0){$arguments+=' --process-id '+$ObserveProcessId}
 $child=Start-Process -FilePath $player -ArgumentList $arguments -WorkingDirectory (Split-Path $player) -WindowStyle Normal -PassThru
 try{@{session=$session;at=$now.ToString('o');played=$true;playerPid=$child.Id;reason='attach-only-animation'} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8}finally{$child.Dispose()}
}catch{
 @{at=[DateTime]::UtcNow.ToString('o');reason=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $data 'startup-animation-error.json') -Encoding UTF8
}finally{$mutex.Dispose()}
