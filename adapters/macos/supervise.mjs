import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const app = process.argv[2];
const state = process.env.WORK_PET_STATE;
if (!app || !state || !process.env.WORK_PET_ASSETS) throw Error('Work Pet installation is incomplete');

const children = [
  spawn('/usr/bin/osascript', ['-l', 'JavaScript', join(dir, 'pet.js')], { stdio: 'ignore' }),
  spawn(process.execPath, [join(dir, 'quota.mjs'), '--state', state, '--app', app], { stdio: 'ignore' }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  // A stalled child must not prevent launchd from restarting the pair.
  setTimeout(() => {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, 3500).unref();
}
for (const child of children) {
  child.once('error', () => stop(1));
  child.once('exit', () => stop(1));
}
process.once('SIGTERM', () => stop(0));
process.once('SIGINT', () => stop(0));
