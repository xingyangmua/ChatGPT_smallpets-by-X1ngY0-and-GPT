import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute = promisify(execFile);
// Store package directories are versioned. Resolve the registered package again
// on every App Server connection instead of retaining an install-time CLI path.
export async function resolveCodexCli(configured, {platform=process.platform, run=execute, exists=fs.existsSync, systemRoot=process.env.SystemRoot}={}) {
  if (platform !== 'win32') {
    if (typeof configured === 'string' && exists(configured)) return configured;
    throw Error('client-unavailable');
  }
  const powershell=path.win32.join(systemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const command="$ErrorActionPreference='Stop'; $p=Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1; if(!$p){throw 'Supported desktop package missing'}; [pscustomobject]@{root=$p.InstallLocation;name=$p.Name} | ConvertTo-Json -Compress";
  const {stdout}=await run(powershell,['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000,maxBuffer:16384});
  const info=JSON.parse(stdout.replace(/^\uFEFF/,''));
  if (info.name !== 'OpenAI.Codex' || typeof info.root !== 'string' || !path.win32.isAbsolute(info.root)) throw Error('client-unavailable');
  const cli=path.win32.join(info.root,'app','resources','codex.exe');
  if (!exists(cli)) throw Error('client-unavailable');
  return cli;
}
