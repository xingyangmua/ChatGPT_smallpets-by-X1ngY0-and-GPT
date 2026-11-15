[CmdletBinding()]
param(
 [string]$InstallRoot,
 [ValidateSet('On','Off','Status')][string]$State='Status',
 [string]$ReviewedCallbackSha256,
 [switch]$AcknowledgeLifecycleChanges,
 [switch]$ConfirmNoOtherDebugger,
 [switch]$AllowPackageUpdates
)
$ErrorActionPreference='Stop'
if([string]::IsNullOrWhiteSpace($InstallRoot)){$InstallRoot=$PSScriptRoot}
$InstallRoot=[IO.Path]::GetFullPath($InstallRoot)
$folder=Join-Path $InstallRoot 'data\official-startup'
$file=Join-Path $folder 'settings.json'
if($State -eq 'Status'){
 if(Test-Path -LiteralPath $file){Get-Content -LiteralPath $file -Raw -Encoding UTF8}
 else{@{enabled=$false;status='not-configured'} | ConvertTo-Json}
 return
}
if($State -eq 'On'){
 if(!$AcknowledgeLifecycleChanges -or !$ConfirmNoOtherDebugger){throw 'Enabling official startup requires explicit confirmation of its package lifecycle effects and absence of another debugger'}
 . (Join-Path $InstallRoot 'official-startup\Lease.ps1') -InstallRoot $InstallRoot
 $callback=Join-Path $InstallRoot 'official-startup\StartupBridge.exe'
 $plan=New-WorkPetStartupPlan $InstallRoot $callback $ReviewedCallbackSha256
 if(!(Test-WorkPetStartupReleaseEligible $plan)){throw 'The startup candidate is not eligible for real-package use yet'}
 $settings=[ordered]@{enabled=$true;consentVersion=1;packageFamilyName='OpenAI.Codex_2p2nqsd0c76g0';packageFullName=$plan.packageFullName;callbackSha256=$plan.hash;lifecycleAcknowledged=$true;noOtherDebuggerConfirmed=$true;allowPackageUpdates=[bool]$AllowPackageUpdates;updatedAt=[DateTime]::UtcNow.ToString('o')}
}else{
 $settings=[ordered]@{enabled=$false;updatedAt=[DateTime]::UtcNow.ToString('o')}
}
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$temp=$file+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
try{
 $encoding=[Text.UTF8Encoding]::new($true)
 [byte[]]$bytes=$encoding.GetPreamble()+$encoding.GetBytes(($settings | ConvertTo-Json))
 $stream=[IO.FileStream]::new($temp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 if(Test-Path -LiteralPath $file){[IO.File]::Replace($temp,$file,[NullString]::Value)}else{[IO.File]::Move($temp,$file)}
}finally{if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue}}
if($State -eq 'Off'){
 & (Join-Path $InstallRoot 'official-startup\Stop.ps1') -InstallRoot $InstallRoot
}else{
 @{enabled=$true;status='awaiting-companion-lease';realOfficialColdStartVerified=$false;packageVersion=$plan.packageVersion} | ConvertTo-Json
}
