import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('official shortcut uses real temporary COM links, preserves metadata and restores only owned changes',{skip:process.platform!=='win32'},t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-official-shortcut-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const module=fileURLToPath(new URL('../../Official-Shortcut.ps1',import.meta.url));
 const q=value=>"'"+value.replaceAll("'","''")+"'";
 const script=String.raw`
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -Force
. MODULE
$fixture=ROOT
$link=Join-Path $fixture 'ChatGPT.lnk'
$packagePath=Join-Path $fixture 'package'
New-Item -ItemType Directory -Path (Join-Path $packagePath 'app') -Force | Out-Null
$gui=Join-Path $packagePath 'app\ChatGPT.exe';[IO.File]::WriteAllText($gui,'inert fixture')
$shell=New-Object -ComObject WScript.Shell;$sc=$shell.CreateShortcut($link)
$sc.TargetPath=$gui;$sc.Arguments='--fixture-flag=preserved';$sc.Description='Fixture';$sc.IconLocation=$gui+',0';$sc.Save()
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sc);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
public static class ShortcutFixture {
 [StructLayout(LayoutKind.Sequential)] public struct Key {public Guid id;public uint pid;}
 [StructLayout(LayoutKind.Explicit)] public struct Value {[FieldOffset(0)] public ushort type;[FieldOffset(8)] public IntPtr text;}
 [ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Store {
  void GetCount(out uint count);void GetAt(uint index,out Key key);void GetValue(ref Key key,out Value value);void SetValue(ref Key key,ref Value value);void Commit();
 }
 public static void SetId(string file) {
  object link=Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("00021401-0000-0000-C000-000000000046")));
  Value value=new Value{type=31,text=Marshal.StringToCoTaskMemUni("com.openai.codex")};
  try {IPersistFile persist=(IPersistFile)link;persist.Load(file,2);Key key=new Key{id=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),pid=5};Store store=(Store)link;store.SetValue(ref key,ref value);store.Commit();persist.Save(file,true);}
  finally{Marshal.FreeCoTaskMem(value.text);Marshal.FinalReleaseComObject(link);}
 }
}
'@
[ShortcutFixture]::SetId($link)
$env:APPDATA=Join-Path $fixture 'roaming';$env:LOCALAPPDATA=Join-Path $fixture 'local'
$profile=Join-Path $env:APPDATA 'Codex\web\Codex';New-Item -ItemType Directory -Path $profile -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $profile 'Local State'),'inert fixture')
function Get-MutsumiOfficialShortcutPath {$link}
$script:packageReads=0
function Get-MutsumiShortcutPackage {$script:packageReads++;[pscustomobject]@{PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';InstallLocation=$packagePath;Version='1.0.0.0'}}
function Check($Condition,[string]$Message){if(!$Condition){throw $Message}}
Check ((Get-MutsumiShortcutProfile (Get-MutsumiShortcutPackage)) -ieq $profile) 'Existing logical profile fallback failed'
$storeProfile=Join-Path $env:LOCALAPPDATA 'Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Codex\web\Codex'
New-Item -ItemType Directory -Path $storeProfile -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $storeProfile 'Local State'),'original Store fixture')
Check ((Get-MutsumiShortcutProfile (Get-MutsumiShortcutPackage)) -ieq $storeProfile) 'A direct-launch profile took priority over the original Store login'
$folder=Join-Path $fixture 'data\official-shortcut';New-Item -ItemType Directory -Path $folder -Force | Out-Null
function Enable-Fixture {Write-MutsumiShortcutJson (Join-Path $folder 'settings.json') @{schemaVersion=1;enabled=$true;shortcutPath=$link;packageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';appUserModelId='com.openai.codex';port=9335}}
$monitor=New-MutsumiOfficialShortcut $fixture
$originalHash=(Get-FileHash -LiteralPath $link).Hash
Invoke-MutsumiOfficialShortcut $monitor
Check ($monitor.status -eq 'disabled' -and (Get-FileHash -LiteralPath $link).Hash -eq $originalHash) 'Default must remain disabled'
Enable-Fixture
Invoke-MutsumiOfficialShortcut $monitor ([DateTime]::UtcNow.AddSeconds(3))
Check ($monitor.status -eq 'updated') ('Initial update: '+$monitor.reason)
$after=Read-MutsumiShortcut $link
Check ($after.target -ieq $gui -and $after.appId -ceq 'com.openai.codex' -and $after.icon -ieq ($gui+',0') -and $after.description -ceq 'Fixture') 'Shortcut metadata changed'
Check ($after.arguments.StartsWith('--fixture-flag=preserved ') -and $after.arguments.Contains('--remote-debugging-address=127.0.0.1')) 'Arguments not retained'
Check ((Get-FileHash -LiteralPath (Join-Path $folder 'original.lnk')).Hash -eq $originalHash) 'First backup mismatch'
$hash=(Get-FileHash -LiteralPath $link).Hash;$stamp=(Get-Item -LiteralPath $link).LastWriteTimeUtc;$reads=$script:packageReads
Invoke-MutsumiOfficialShortcut $monitor ([DateTime]::UtcNow.AddSeconds(6))
Check ((Get-FileHash -LiteralPath $link).Hash -eq $hash -and (Get-Item -LiteralPath $link).LastWriteTimeUtc -eq $stamp -and $script:packageReads -eq $reads) 'Unchanged inputs caused writing or package lookup'
Set-MutsumiShortcutArguments $link ''
Invoke-MutsumiOfficialShortcut $monitor ([DateTime]::UtcNow.AddSeconds(9))
Check ($monitor.status -eq 'updated' -and (Read-MutsumiShortcut $link).arguments.Contains('--remote-debugging-port=9335')) 'Official empty rewrite not repaired'
Check ((Disable-MutsumiOfficialShortcut $fixture) -eq 'disabled-original-restored' -and (Read-MutsumiShortcut $link).arguments -ceq '') 'Off did not restore latest baseline'
Enable-Fixture
$packagePath=Join-Path $fixture 'package-v2';New-Item -ItemType Directory -Path (Join-Path $packagePath 'app') -Force | Out-Null
$gui=Join-Path $packagePath 'app\ChatGPT.exe';[IO.File]::WriteAllText($gui,'inert fixture')
$shell=New-Object -ComObject WScript.Shell;$sc=$shell.CreateShortcut($link);$sc.TargetPath=$gui;$sc.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sc);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
Invoke-MutsumiOfficialShortcut $monitor ([DateTime]::UtcNow.AddSeconds(12))
Check ($monitor.status -eq 'updated') 'New registered version not maintained'
Check ((Disable-MutsumiOfficialShortcut $fixture) -eq 'disabled-original-restored' -and (Read-MutsumiShortcut $link).target -ieq $gui) 'Off restored an obsolete package target'
Enable-Fixture
Set-MutsumiShortcutArguments $link '--user-data-dir="C:\custom profile"'
$hash=(Get-FileHash -LiteralPath $link).Hash
Invoke-MutsumiOfficialShortcut $monitor ([DateTime]::UtcNow.AddSeconds(15))
Check ($monitor.status -eq 'preserved' -and (Get-FileHash -LiteralPath $link).Hash -eq $hash) 'Custom profile overwritten'
Set-MutsumiShortcutArguments $link '--remote-debugging-port=9999'
$hash=(Get-FileHash -LiteralPath $link).Hash
Invoke-MutsumiOfficialShortcut $monitor ([DateTime]::UtcNow.AddSeconds(18))
Check ((Get-FileHash -LiteralPath $link).Hash -eq $hash) 'Custom remote port overwritten'
Check ((Disable-MutsumiOfficialShortcut $fixture) -eq 'disabled-current-shortcut-preserved' -and (Get-FileHash -LiteralPath $link).Hash -eq $hash) 'Off replaced a later user edit'
Enable-Fixture
$shell=New-Object -ComObject WScript.Shell;$sc=$shell.CreateShortcut($link);$sc.TargetPath=Join-Path $fixture 'other.exe';$sc.Save();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sc);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
$hash=(Get-FileHash -LiteralPath $link).Hash
Invoke-MutsumiOfficialShortcut $monitor ([DateTime]::UtcNow.AddSeconds(21))
Check ($monitor.status -eq 'different-shortcut-preserved' -and (Get-FileHash -LiteralPath $link).Hash -eq $hash) 'Unrelated shortcut overwritten'
'16 focused COM checks passed'
`.replace('MODULE',q(module)).replace('ROOT',q(root));
 const file=path.join(root,'test.ps1');fs.writeFileSync(file,'\uFEFF'+script);
 const ps=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const result=spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',file],{encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(result.status,0,result.stderr||result.stdout);assert.match(result.stdout,/focused COM checks passed/);
});
