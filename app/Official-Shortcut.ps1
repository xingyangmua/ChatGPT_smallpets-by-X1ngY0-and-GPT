# Optional maintenance of one explicitly approved, current-user Start menu link.
# This does not intercept direct EXE, MSIX AUMID, notification or other entries.
function New-MutsumiOfficialShortcut([string]$InstallRoot) {
 return @{root=[IO.Path]::GetFullPath($InstallRoot);nextCheck=[DateTime]::MinValue;inputKey='';status='disabled'}
}
function Get-MutsumiOfficialShortcutPath {
 return Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\ChatGPT.lnk'
}
function Get-MutsumiShortcutPackage {
 $packages=@(Get-AppxPackage -Name OpenAI.Codex -ErrorAction Stop)
 if($packages.Count -ne 1 -or $packages[0].PackageFamilyName -cne 'OpenAI.Codex_2p2nqsd0c76g0'){throw 'Official package missing or ambiguous'}
 return $packages[0]
}
function Get-MutsumiShortcutProfile($Package) {
 # Store activation uses the package's existing redirected profile. A direct
 # EXE launch can leave a different logical Roaming profile behind; it must
 # not take priority over the original Store login.
 $virtual=Join-Path $env:LOCALAPPDATA ('Packages\'+$Package.PackageFamilyName+'\LocalCache\Roaming\Codex\web\Codex')
 if(Test-Path -LiteralPath (Join-Path $virtual 'Local State') -PathType Leaf){return $virtual}
 $logical=Join-Path $env:APPDATA 'Codex\web\Codex'
 if(Test-Path -LiteralPath (Join-Path $logical 'Local State') -PathType Leaf){return $logical}
 throw 'Existing browser profile missing; no shortcut changed'
}
function Write-MutsumiShortcutJson([string]$File,$Value) {
 $temporary=$File+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
 try{
  [IO.File]::WriteAllText($temporary,($Value | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($true))
  if(Test-Path -LiteralPath $File){[IO.File]::Replace($temporary,$File,[NullString]::Value)}else{[IO.File]::Move($temporary,$File)}
 }finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -ErrorAction SilentlyContinue}}
}
function Read-MutsumiShortcutJson([string]$File) {
 $text=Get-Content -LiteralPath $File -Raw -Encoding UTF8 -ErrorAction Stop
 if(!$text.TrimStart().StartsWith('{')){throw 'Invalid shortcut record'}
 $value=$text | ConvertFrom-Json
 if($value -isnot [pscustomobject]){throw 'Invalid shortcut record'}
 return $value
}
function Read-MutsumiShortcut([string]$File) {
 $shell=$null;$link=$null;$application=$null;$folder=$null;$item=$null
 try{
  $shell=New-Object -ComObject WScript.Shell;$link=$shell.CreateShortcut($File)
  $application=New-Object -ComObject Shell.Application;$folder=$application.NameSpace([IO.Path]::GetDirectoryName($File));$item=$folder.ParseName([IO.Path]::GetFileName($File))
  return @{target=[string]$link.TargetPath;arguments=[string]$link.Arguments;icon=[string]$link.IconLocation;workingDirectory=[string]$link.WorkingDirectory;description=[string]$link.Description;windowStyle=[int]$link.WindowStyle;hotkey=[string]$link.Hotkey;appId=[string]$item.ExtendedProperty('System.AppUserModel.ID')}
 }finally{foreach($com in @($item,$folder,$application,$link,$shell)){if($com){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($com)}}}
}
function Set-MutsumiShortcutArguments([string]$File,[string]$Arguments) {
 $shell=$null;$link=$null
 try{$shell=New-Object -ComObject WScript.Shell;$link=$shell.CreateShortcut($File);$link.Arguments=$Arguments;$link.Save()}
 finally{foreach($com in @($link,$shell)){if($com){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($com)}}}
}
function Get-MutsumiShortcutArguments([string]$Text,[int]$Port,[string]$Profile) {
 if(!('MutsumiShortcutArgv' -as [type])){
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MutsumiShortcutArgv {
 [DllImport("shell32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CommandLineToArgvW(string text, out int count);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
 public static string[] Parse(string text) {
  int count; IntPtr memory=CommandLineToArgvW("fixture.exe "+text,out count);
  if(memory==IntPtr.Zero)throw new InvalidOperationException("Cannot parse shortcut arguments");
  try {string[] result=new string[count-1];for(int i=1;i<count;i++)result[i-1]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(memory,i*IntPtr.Size));return result;}
  finally {LocalFree(memory);}
 }
}
'@
 }
 $tokens=[MutsumiShortcutArgv]::Parse($Text)
 $expected=@{'--remote-debugging-port'=[string]$Port;'--remote-debugging-address'='127.0.0.1';'--user-data-dir'=$Profile}
 $seen=@{}
 for($i=0;$i -lt $tokens.Length;$i++){
  $token=$tokens[$i]
  if($token -eq '--'){throw 'Custom argument separator preserved'}
  if($token -notmatch '^(--[^=]+)(?:=(.*))?$'){continue}
  $name=$Matches[1];$value=$Matches[2];$hasEquals=$token.Contains('=')
  if(!$expected.ContainsKey($name)){
   if($name -like '--remote-debugging*' -or $name -eq '--remote-allow-origins'){throw 'Custom remote arguments preserved'}
   continue
  }
  if($seen.ContainsKey($name)){throw 'Duplicate managed arguments preserved'}
  if(!$hasEquals){$i++;if($i -ge $tokens.Length){throw 'Incomplete managed arguments preserved'};$value=$tokens[$i]}
  $matchesExpected=if($name -eq '--user-data-dir'){[string]::Equals($value.TrimEnd('\'),$Profile.TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)}else{$value -ceq $expected[$name]}
  if(!$matchesExpected){throw 'Custom profile or remote arguments preserved'}
  $seen[$name]=$true
 }
 $missing=@()
 foreach($name in @('--remote-debugging-port','--remote-debugging-address','--user-data-dir')){
  if(!$seen.ContainsKey($name)){$value=$name+'='+$expected[$name];if($name -eq '--user-data-dir'){$value='"'+$value+'"'};$missing+=@($value)}
 }
 if(!$missing.Count){return $Text}
 return $Text+$(if($Text -and !$Text.EndsWith(' ')){' '}else{''})+($missing -join ' ')
}
function Invoke-MutsumiOfficialShortcut($Monitor,[DateTime]$Now=[DateTime]::UtcNow) {
 if($Now -lt $Monitor.nextCheck){return};$Monitor.nextCheck=$Now.AddSeconds(2)
 $temporary=$null
 try{
  $folder=Join-Path $Monitor.root 'data\official-shortcut';$settingsFile=Join-Path $folder 'settings.json'
  if(!(Test-Path -LiteralPath $settingsFile)){$Monitor.status='disabled';return}
  $settings=Read-MutsumiShortcutJson $settingsFile
  if($settings.enabled -isnot [bool] -or !$settings.enabled){$Monitor.status='disabled';return}
  $file=Get-MutsumiOfficialShortcutPath
  if($settings.schemaVersion -isnot [int] -or $settings.schemaVersion -ne 1 -or $settings.shortcutPath -isnot [string] -or $settings.shortcutPath -ine $file -or $settings.packageFamilyName -cne 'OpenAI.Codex_2p2nqsd0c76g0' -or $settings.appUserModelId -cne 'com.openai.codex' -or $settings.port -isnot [int] -or $settings.port -lt 9335 -or $settings.port -gt 9345){throw 'Invalid explicit shortcut settings'}
  if(!(Test-Path -LiteralPath $file -PathType Leaf)){$Monitor.status='shortcut-missing';return}
  $settingsHash=(Get-FileHash -LiteralPath $settingsFile -Algorithm SHA256).Hash
  $beforeHash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
  $inputKey=$settingsHash+'|'+$beforeHash
  if($Monitor.inputKey -ceq $inputKey){return}
  $package=Get-MutsumiShortcutPackage;$gui=Join-Path $package.InstallLocation 'app\ChatGPT.exe'
  if(!(Test-Path -LiteralPath $gui -PathType Leaf)){throw 'Current official executable missing'}
  $before=Read-MutsumiShortcut $file
  if($before.target -ine $gui -or $before.appId -cne $settings.appUserModelId){$Monitor.status='different-shortcut-preserved';$Monitor.inputKey=$inputKey;return}
  $profile=Get-MutsumiShortcutProfile $package
  $arguments=Get-MutsumiShortcutArguments $before.arguments $settings.port $profile
  if($arguments -ceq $before.arguments){$Monitor.status='already-matched';$Monitor.inputKey=$inputKey;return}
  $temporary=Join-Path ([IO.Path]::GetDirectoryName($file)) ('.ChatGPT.workpet-'+[Guid]::NewGuid().ToString('N')+'.lnk')
  Copy-Item -LiteralPath $file -Destination $temporary -ErrorAction Stop
  if((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash -cne $beforeHash){throw 'Shortcut changed during inspection'}
  Set-MutsumiShortcutArguments $temporary $arguments
  $after=Read-MutsumiShortcut $temporary
  foreach($key in @('target','icon','workingDirectory','description','windowStyle','hotkey','appId')){if($before[$key] -cne $after[$key]){throw 'Shortcut metadata did not survive; original preserved'}}
  if($after.arguments -cne $arguments){throw 'Shortcut arguments did not persist; original preserved'}
  $backup=Join-Path $folder 'original.lnk';$backupRecord=Join-Path $folder 'original.json'
  if(!(Test-Path -LiteralPath $backupRecord)){
   if(Test-Path -LiteralPath $backup){throw 'Incomplete original backup; original shortcut preserved'}
   Copy-Item -LiteralPath $file -Destination $backup -ErrorAction Stop
   if((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -cne $beforeHash){throw 'Shortcut changed while making its original backup'}
   Write-MutsumiShortcutJson $backupRecord @{schemaVersion=1;shortcutPath=$file;hash=$beforeHash;target=$before.target;arguments=$before.arguments;appId=$before.appId}
  }
  $original=Read-MutsumiShortcutJson $backupRecord
  if($original.shortcutPath -ine $file -or $original.hash -cne (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash){throw 'Original backup verification failed'}
  if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -cne $beforeHash -or (Get-FileHash -LiteralPath $settingsFile -Algorithm SHA256).Hash -cne $settingsHash){throw 'Shortcut or settings changed; no replacement made'}
  $appliedHash=(Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash
  # Keep the first original for audit, and the most recent official version
  # as the reversible baseline. Never restore an obsolete WindowsApps target.
  $baseline=Join-Path $folder ('baseline-'+$beforeHash+'.lnk')
  if(!(Test-Path -LiteralPath $baseline)){Copy-Item -LiteralPath $file -Destination $baseline -ErrorAction Stop}
  if((Get-FileHash -LiteralPath $baseline -Algorithm SHA256).Hash -cne $beforeHash){throw 'Current baseline verification failed'}
  # Save ownership before replacing the link; a crash cannot leave an
  # unrecorded modification, and a failed replace cannot match this hash.
  Write-MutsumiShortcutJson (Join-Path $folder 'last-applied.json') @{schemaVersion=1;shortcutPath=$file;hash=$appliedHash;baselineHash=$beforeHash;target=$after.target;arguments=$arguments;appId=$after.appId;packageVersion=[string]$package.Version;updatedAt=$Now.ToString('o')}
  [IO.File]::Replace($temporary,$file,[NullString]::Value);$Monitor.status='updated'
  $Monitor.inputKey=$settingsHash+'|'+$appliedHash
 }catch{$Monitor.status='preserved';$Monitor.reason=$_.Exception.Message}
 finally{if($temporary -and (Test-Path -LiteralPath $temporary)){Remove-Item -LiteralPath $temporary -ErrorAction SilentlyContinue}}
}
function Disable-MutsumiOfficialShortcut([string]$InstallRoot) {
 $folder=Join-Path ([IO.Path]::GetFullPath($InstallRoot)) 'data\official-shortcut'
 if(!(Test-Path -LiteralPath $folder)){return 'not-configured'}
 Write-MutsumiShortcutJson (Join-Path $folder 'settings.json') @{schemaVersion=1;enabled=$false}
 $file=Get-MutsumiOfficialShortcutPath;$backup=Join-Path $folder 'original.lnk';$temporary=$null
 try{
  $applied=Read-MutsumiShortcutJson (Join-Path $folder 'last-applied.json')
  if($applied.shortcutPath -ine $file -or $applied.baselineHash -cnotmatch '^[A-F0-9]{64}$' -or $applied.hash -cne (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash){return 'disabled-current-shortcut-preserved'}
  $backup=Join-Path $folder ('baseline-'+$applied.baselineHash+'.lnk')
  if($applied.baselineHash -cne (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash){throw 'Baseline backup hash mismatch'}
  $original=Read-MutsumiShortcut $backup
  $current=Read-MutsumiShortcut $file
  if($current.target -ine $applied.target -or $current.arguments -cne $applied.arguments -or $current.appId -cne 'com.openai.codex' -or $current.appId -cne $applied.appId -or $original.target -ine $current.target -or $original.appId -cne $current.appId){return 'disabled-current-shortcut-preserved'}
  $temporary=Join-Path ([IO.Path]::GetDirectoryName($file)) ('.ChatGPT.restore-'+[Guid]::NewGuid().ToString('N')+'.lnk')
  Copy-Item -LiteralPath $backup -Destination $temporary -ErrorAction Stop
  if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -cne $applied.hash){return 'disabled-current-shortcut-preserved'}
  [IO.File]::Replace($temporary,$file,[NullString]::Value)
  return 'disabled-original-restored'
 }catch{return 'disabled-current-shortcut-preserved'}
 finally{if($temporary -and (Test-Path -LiteralPath $temporary)){Remove-Item -LiteralPath $temporary -ErrorAction SilentlyContinue}}
}
