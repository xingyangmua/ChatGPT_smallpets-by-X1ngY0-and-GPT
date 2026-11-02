# Loaded by the existing companion supervisor. Never opens or restarts a client.
function New-MutsumiBackgroundReconnect([string]$InstallRoot) {
 return @{root=$InstallRoot;child=$null;hostKey='';nextAttempt=[DateTime]::MinValue;deadline=[DateTime]::MinValue}
}
function Invoke-MutsumiBackgroundReconnect($Monitor,[bool]$HostAlive,[int]$HostProcessId,[DateTime]$Now=[DateTime]::UtcNow) {
 if($Monitor.child){
  if(!$Monitor.child.HasExited){
   if($Now -lt $Monitor.deadline){return}
   # Only this monitor's child is stopped; the official client is untouched.
   try{$Monitor.child.Kill()}catch{return}
  }
  $Monitor.child.Dispose();$Monitor.child=$null
 }
 if(!$HostAlive){$Monitor.hostKey='';$Monitor.nextAttempt=[DateTime]::MinValue;return}
 $key=[string]$HostProcessId
 if($Monitor.hostKey -ne $key){$Monitor.hostKey=$key;$Monitor.nextAttempt=[DateTime]::MinValue}
 if($Now -lt $Monitor.nextAttempt){return}
 $Monitor.nextAttempt=$Now.AddSeconds(30)
 try{
  $stateFile=Join-Path $Monitor.root 'data\background-state.json'
  if(Test-Path -LiteralPath $stateFile){$state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json;if($state.enabled -eq $false){return}}
  $script=Join-Path $Monitor.root 'Background-Start.ps1'
  if(!(Test-Path -LiteralPath $script)){return}
  $ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $reconnectArguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "'+$script+'" -InstallRoot "'+$Monitor.root+'" -AttachOnly'
  $Monitor.child=Start-Process -FilePath $ps -ArgumentList $reconnectArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Monitor.root 'data\background-reconnect.log') -RedirectStandardError (Join-Path $Monitor.root 'data\background-reconnect-error.log')
  $Monitor.deadline=$Now.AddSeconds(120)
 }catch{
  @{status='failed';reason=$_.Exception.Message;at=$Now.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Monitor.root 'data\background-connection.json') -Encoding UTF8
 }
}
function Close-MutsumiBackgroundReconnect($Monitor) {
 if($Monitor.child){
  try{if(!$Monitor.child.HasExited){$Monitor.child.Kill()}}catch{}finally{$Monitor.child.Dispose();$Monitor.child=$null}
 }
}
