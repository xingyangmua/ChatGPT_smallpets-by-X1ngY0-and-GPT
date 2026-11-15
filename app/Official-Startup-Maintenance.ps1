# Used only by explicit uninstall/rollback requests. Never enables a lease.
function Enter-MutsumiStartupMaintenance([string]$InstallRoot) {
 $root=[IO.Path]::GetFullPath($InstallRoot)
 $shortcutModule=Join-Path $root 'Official-Shortcut.ps1'
 if((Test-Path -LiteralPath $shortcutModule) -and (Test-Path -LiteralPath (Join-Path $root 'data\official-shortcut\settings.json'))){
  . $shortcutModule
  Disable-MutsumiOfficialShortcut $root | Out-Null
 }
 $folder=Join-Path $root 'data\official-startup'
 $settingsFile=Join-Path $folder 'settings.json'
 $leaseFile=Join-Path $folder 'lease-state.json'
 if((Test-Path -LiteralPath $settingsFile) -or (Test-Path -LiteralPath $leaseFile)){
  $off=Join-Path $root 'Set-OfficialStartup.ps1'
  if(!(Test-Path -LiteralPath $off -PathType Leaf)){throw 'The installed startup Off entry is missing; maintenance stopped before stopping the companion or replacing files'}
  & $off -InstallRoot $root -State Off | Out-Null
 }
 $mutex=[Threading.Mutex]::new($false,'Local\WorkPetOfficialStartupLease-OpenAI.Codex')
 $owned=$false;$returned=$false
 try{
  try{$owned=$mutex.WaitOne(15000)}catch [Threading.AbandonedMutexException]{$owned=$true}
  if(!$owned){throw 'The startup lease has not released; maintenance stopped before stopping the companion or replacing files'}
  if(Test-Path -LiteralPath $settingsFile){
   $text=Get-Content -LiteralPath $settingsFile -Raw -Encoding UTF8
   if(!$text.TrimStart().StartsWith('{')){throw 'Startup settings are damaged; maintenance stopped'}
   $settings=$text | ConvertFrom-Json
   if($settings -isnot [pscustomobject] -or $settings.enabled -isnot [bool] -or $settings.enabled){throw 'Startup remains enabled; maintenance stopped'}
  }
  if(Test-Path -LiteralPath $leaseFile){
   $text=Get-Content -LiteralPath $leaseFile -Raw -Encoding UTF8
   if(!$text.TrimStart().StartsWith('{')){throw 'The startup lease record is damaged; release was not verified'}
   $lease=$text | ConvertFrom-Json
   if($lease -isnot [pscustomobject] -or $lease.status -cne 'released' -or $lease.enabled -isnot [bool] -or $lease.enabled -or $lease.rollback -cne 'DisableDebugging-succeeded'){throw 'Startup lease release was not verified; maintenance stopped before stopping the companion or replacing files'}
  }
  # Lease.ps1 writes its activating record before EnableDebugging, while
  # holding this mutex. No record plus exclusive ownership therefore means
  # no lease was acquired through that path, including an On queued then Off.
  $returned=$true
  return @{mutex=$mutex;owned=$true}
 }finally{
  if(!$returned){if($owned){$mutex.ReleaseMutex()};$mutex.Dispose()}
 }
}
function Exit-MutsumiStartupMaintenance($Guard) {
 if(!$Guard){return}
 try{if($Guard.owned){$Guard.mutex.ReleaseMutex();$Guard.owned=$false}}
 finally{$Guard.mutex.Dispose()}
}
