import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../../',import.meta.url));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function run(t,body,setup=()=>{}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-startup-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'data'));fs.mkdirSync(path.join(root,'boot/media'),{recursive:true});
 fs.copyFileSync(path.join(source,'Start-Animation.ps1'),path.join(root,'Start-Animation.ps1'));
 fs.writeFileSync(path.join(root,'boot/WorkPetAnimation.exe'),'fixture');fs.writeFileSync(path.join(root,'boot/media/startup.mp4'),'fixture');
 fs.writeFileSync(path.join(root,'boot/launcher.json'),JSON.stringify({Video:'media/startup.mp4'}));
 fs.writeFileSync(path.join(root,'data/mutsumi-install.json'),JSON.stringify({clientExe:path.join(root,'ChatGPT.exe')}));setup(root);
 const file=path.join(root,'check.ps1');fs.writeFileSync(file,'\uFEFF$ErrorActionPreference="Stop"\n$root='+quote(root)+`\n
 $global:starts=0;$global:start=[DateTime]::UtcNow.AddSeconds(-2);$global:arguments=''
 function Get-Process {param($Id,$ErrorAction) $p=[pscustomobject]@{Path=(Join-Path $root 'ChatGPT.exe');StartTime=$global:start};$p | Add-Member ScriptMethod Dispose {};return $p}
 function Start-Process {param($FilePath,$ArgumentList,$WorkingDirectory,$WindowStyle,[switch]$PassThru) $global:starts++;$global:arguments=$ArgumentList;$p=[pscustomobject]@{Id=42};$p | Add-Member ScriptMethod Dispose {};return $p}
 function Stop-Process {throw 'Client must not be stopped'}
 `+body);
 const result=spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',file],{windowsHide:true,encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stderr||result.stdout);return root;
}

test('official cold-start animation observes one verified session and never activates a client',{skip:process.platform!=='win32'},t=>{
 run(t,`
 & (Join-Path $root 'Start-Animation.ps1') -InstallRoot $root -ObserveProcessId 12
 & (Join-Path $root 'Start-Animation.ps1') -InstallRoot $root -ObserveProcessId 12
 if($global:starts -ne 1 -or $global:arguments -ne '--attach-only --process-id 12'){throw 'Duplicate animation or client activation'}
 `);
});
test('animation does not replay over an existing session after companion repair',{skip:process.platform!=='win32'},t=>{
 run(t,`$global:start=[DateTime]::UtcNow.AddMinutes(-1);& (Join-Path $root 'Start-Animation.ps1') -InstallRoot $root -ObserveProcessId 12;if($global:starts){throw 'Existing task was interrupted by animation'}`);
});
test('managed animation request is adopted by official lifecycle monitoring without replay',{skip:process.platform!=='win32'},t=>{
 run(t,`
 & (Join-Path $root 'Start-Animation.ps1') -InstallRoot $root -ColdLaunch
 & (Join-Path $root 'Start-Animation.ps1') -InstallRoot $root -ObserveProcessId 12
 if($global:starts -ne 1){throw 'Managed and monitored animation ran twice'}
 $state=Get-Content (Join-Path $root 'data/startup-animation-state.json') -Raw | ConvertFrom-Json
 if(!$state.session.StartsWith('12|')){throw 'Animation session was not adopted'}
 `);
});
test('animation respects its own disabled setting independently of background state',{skip:process.platform!=='win32'},t=>{
 run(t,`& (Join-Path $root 'Start-Animation.ps1') -InstallRoot $root -ColdLaunch;if($global:starts){throw 'Disabled animation played'}`,root=>fs.writeFileSync(path.join(root,'data/startup-animation.json'),JSON.stringify({enabled:false})));
});
test('absent animation media is a no-op without substituting another video',{skip:process.platform!=='win32'},t=>{
 run(t,`& (Join-Path $root 'Start-Animation.ps1') -InstallRoot $root -ColdLaunch;if($global:starts){throw 'Missing media opened player'}`,root=>fs.unlinkSync(path.join(root,'boot/media/startup.mp4')));
});
test('managed cold theme launch requests animation before theme launch and activates only once',{skip:process.platform!=='win32'},t=>{
 run(t,`
 $global:reads=0;function Get-Process {param($Name,$ErrorAction) $global:reads++;if($global:reads -gt 1){[pscustomobject]@{Path=(Join-Path $root 'ChatGPT.exe')}}}
 & (Join-Path $root 'Launch-Client.ps1') -InstallRoot $root
 if($global:starts -ne 1){throw 'Second ordinary activation occurred'}
 if((Get-Content (Join-Path $root 'data/order') -Raw) -ne 'animation,theme'){throw 'Animation skipped or ordered after theme startup'}
 `,root=>{
  fs.copyFileSync(path.join(source,'Launch-Client.ps1'),path.join(root,'Launch-Client.ps1'));
  fs.writeFileSync(path.join(root,'data/follow-config.json'),JSON.stringify({launcherPath:'companion.exe'}));
  fs.writeFileSync(path.join(root,'Repair-Client.ps1'),"param($InstallRoot) @{clientExe=(Join-Path $InstallRoot 'ChatGPT.exe');appId='fixture!App'}");
  fs.writeFileSync(path.join(root,'Start-Animation.ps1'),"param($InstallRoot,[switch]$ColdLaunch) [IO.File]::WriteAllText((Join-Path $InstallRoot 'data/order'),'animation')");
  fs.writeFileSync(path.join(root,'Background-Start.ps1'),"param($InstallRoot) [IO.File]::AppendAllText((Join-Path $InstallRoot 'data/order'),',theme')");
 });
});
test('a stale managed request does not silence the next launch animation',{skip:process.platform!=='win32'},t=>{
 run(t,`& (Join-Path $root 'Start-Animation.ps1') -InstallRoot $root -ObserveProcessId 12
 if($global:starts -ne 1){throw 'Stale managed request suppressed the official launch animation'}`,
 root=>fs.writeFileSync(path.join(root,'data/startup-animation-state.json'),
  JSON.stringify({session:'',at:new Date(Date.now()-300000).toISOString(),played:true,reason:'attach-only-animation'})));
});
test('animation failure never blocks the theme launch',{skip:process.platform!=='win32'},t=>{
 run(t,`
 $global:reads=0;function Get-Process {param($Name,$ErrorAction) $global:reads++;if($global:reads -gt 1){[pscustomobject]@{Path=(Join-Path $root 'ChatGPT.exe')}}}
 & (Join-Path $root 'Launch-Client.ps1') -InstallRoot $root
 if($global:starts -ne 1){throw 'Animation failure caused a second ordinary activation'}
 if((Get-Content (Join-Path $root 'data/order') -Raw) -ne ',theme'){throw 'Theme launch was skipped after an animation failure'}
 `,root=>{
  fs.copyFileSync(path.join(source,'Launch-Client.ps1'),path.join(root,'Launch-Client.ps1'));
  fs.writeFileSync(path.join(root,'data/follow-config.json'),JSON.stringify({launcherPath:'companion.exe'}));
  fs.writeFileSync(path.join(root,'Repair-Client.ps1'),"param($InstallRoot) @{clientExe=(Join-Path $InstallRoot 'ChatGPT.exe');appId='fixture!App'}");
  fs.writeFileSync(path.join(root,'Start-Animation.ps1'),"param($InstallRoot,[switch]$ColdLaunch) throw 'animation exploded'");
  fs.writeFileSync(path.join(root,'Background-Start.ps1'),"param([string]$InstallRoot) [IO.File]::AppendAllText((Join-Path $InstallRoot 'data/order'),',theme')");
 });
});

test('official session recovery continues when optional animation settings fail',{skip:process.platform!=='win32'},t=>{
 run(t,`
 function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) [pscustomobject]@{ProcessId=12;ParentProcessId=1;ExecutablePath=(Join-Path $root 'ChatGPT.exe')}}
 & (Join-Path $root 'Observe-Client.ps1') -InstallRoot $root -AttachOnly
 if($global:starts){throw 'Observer must never activate a client'}
 if((Get-Content (Join-Path $root 'data/background-request') -Raw) -ne 'True'){throw 'Background recovery was blocked or was allowed to launch a client'}
 `,root=>{
  fs.copyFileSync(path.join(source,'Observe-Client.ps1'),path.join(root,'Observe-Client.ps1'));
  fs.writeFileSync(path.join(root,'Repair-Client.ps1'),"param($InstallRoot) @{clientExe=(Join-Path $InstallRoot 'ChatGPT.exe')}");
  fs.writeFileSync(path.join(root,'Start-Animation.ps1'),"param($InstallRoot,$ObserveProcessId) throw 'invalid animation JSON'");
  fs.writeFileSync(path.join(root,'Background-Start.ps1'),"param($InstallRoot,[switch]$AttachOnly) [IO.File]::WriteAllText((Join-Path $InstallRoot 'data/background-request'),[string]$AttachOnly.IsPresent)");
 });
});

test('animation geometry follows resized client areas and preserves natural video aspect ratios',{skip:process.platform!=='win32'},t=>{
 const root=run(t,`& ${quote(path.join(source,'Build-Animation.ps1'))} -InstallRoot $root
 $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=Join-Path $root 'boot/WorkPetAnimation.exe'
 $info.Arguments='--self-test';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden'
 $child=[Diagnostics.Process]::Start($info)
 try{if(!$child.WaitForExit(10000) -or $child.ExitCode -ne 0){throw 'Animation headless geometry check failed'}}finally{$child.Dispose()}
 `,root=>{
  fs.mkdirSync(path.join(root,'animation'));
  for(const file of ['WorkPetAnimation.cs','app.manifest'])fs.copyFileSync(path.join(source,'animation',file),path.join(root,'animation',file));
  fs.writeFileSync(path.join(root,'boot/launcher.json'),JSON.stringify({Video:'media/startup.mp4',AppLaunch:'shell:AppsFolder\\Fixture.Package!App',ProcessPathContains:'fixture',ProcessNames:['fixture'],PlayerWidth:900,PlayerHeight:506,MatchClientToPlayer:true,HoldAt:1,TransitionStart:2,TransitionEnd:3,MaxWaitSeconds:10,Volume:0,ScreenFrames:[{Time:2,X:0,Y:0,Width:1,Height:1},{Time:3,X:0,Y:0,Width:1,Height:1}]}));
 });
 const result=JSON.parse(fs.readFileSync(path.join(root,'boot/qa/self-test.json'),'utf8'));
 assert.equal(result.ok,true);assert.equal(result.followingPlacementCases,18);assert.equal(result.aspectRatioCases,3);
 assert.equal(result.nativeUiTested,false);
});
