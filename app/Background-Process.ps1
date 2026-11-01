function Test-MutsumiWatcherIdentity($State,$ProcessInfo,$StartedAt,[string]$Injector) {
 if(!$ProcessInfo -or !$State.startedAt -or !$StartedAt){return $false}
 try{
  if(([DateTimeOffset]$State.startedAt).UtcDateTime.Ticks -ne ([DateTimeOffset]$StartedAt).UtcDateTime.Ticks){return $false}
  return [bool]($State.injector -ieq $Injector -and $ProcessInfo.CommandLine -and $ProcessInfo.CommandLine.Contains('"'+$Injector+'"') -and $ProcessInfo.CommandLine -match '(?:^|\s)--watch(?:\s|$)')
 }catch{return $false}
}
function Stop-MutsumiBackgroundWatcher($State,[string]$Injector) {
 $watcher=Get-Process -Id $State.pid -ErrorAction SilentlyContinue
 if(!$watcher){return $false}
 try{
  $meta=Get-CimInstance Win32_Process -Filter ('ProcessId='+$State.pid) -ErrorAction SilentlyContinue
  if(!(Test-MutsumiWatcherIdentity $State $meta $watcher.StartTime $Injector)){return $false}
  Stop-Process -Id $State.pid -ErrorAction Stop
  return $true
 }catch{return $false}finally{$watcher.Dispose()}
}
