function Get-MutsumiNode([string]$InstallRoot) {
 $electron=Join-Path $InstallRoot 'data\desktop-runtime\node_modules\electron\dist\electron.exe'
 if(Test-Path -LiteralPath $electron){return $electron}
 $bundled=Join-Path $InstallRoot 'data\node-runtime\node.exe'
 if(Test-Path -LiteralPath $bundled){return $bundled}
 $candidate=Get-Command node.exe -ErrorAction SilentlyContinue
 if($candidate){$version=& $candidate.Source --version;if($version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 24){return $candidate.Source}}
 throw 'Node.js runtime missing. Reinstall the complete release package.'
}
function Invoke-MutsumiNode([string]$NodePath,[string[]]$Arguments) {
 $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$NodePath
 $quoted=foreach($value in $Arguments){$v=[regex]::Replace([string]$value,'(\\*)"','$1$1\"');$v=[regex]::Replace($v,'(\\+)$','$1$1');'"'+$v+'"'}
 $info.Arguments=$quoted -join ' ';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle='Hidden';$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 if([IO.Path]::GetFileName($NodePath) -ieq 'electron.exe'){$info.EnvironmentVariables['ELECTRON_RUN_AS_NODE']='1'}
 $p=[Diagnostics.Process]::new();$p.StartInfo=$info;$code=1
 try{[void]$p.Start();$stdout=$p.StandardOutput.ReadToEndAsync();$stderr=$p.StandardError.ReadToEndAsync();if(!$p.WaitForExit(45000)){try{$p.Kill()}catch{};throw 'Local helper timed out'};$code=$p.ExitCode;$text=$stdout.GetAwaiter().GetResult();$errorText=$stderr.GetAwaiter().GetResult();if($errorText -and $code -ne 0){Write-Error $errorText};if($text){Write-Output $text.TrimEnd()}}
 finally{$global:LASTEXITCODE=$code;$p.Dispose()}
}
function Start-MutsumiNode([string]$NodePath,[string]$ArgumentLine,[string]$Stdout,[string]$Stderr) {
 $mutsumiNodeMode=$env:ELECTRON_RUN_AS_NODE
 try{if([IO.Path]::GetFileName($NodePath) -ieq 'electron.exe'){$env:ELECTRON_RUN_AS_NODE='1'};return Start-Process -FilePath $NodePath -ArgumentList $ArgumentLine -WindowStyle Hidden -PassThru -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr}
 finally{$env:ELECTRON_RUN_AS_NODE=$mutsumiNodeMode}
}
