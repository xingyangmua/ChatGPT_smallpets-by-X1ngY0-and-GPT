import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { FRESH_MS, normalizeLimits } from '../../app/widget/runtime/pet-quota.mjs';

const activeLifetime = 20_000;
const refreshInterval = 60_000;
const maxDateSeconds = 8_640_000_000_000; // Upper bound of a JavaScript Date, in epoch seconds.
const empty = () => ({ status: 'unavailable', at: null, windows: [], plan: null });
const plans = new Set([
  'free', 'go', 'plus', 'pro', 'prolite', 'promax', 'team', 'self_serve_business_prolite',
  'self_serve_business_usage_based', 'business', 'ent26', 'enterprise_cbp_automation',
  'enterprise_cbp_usage_based', 'enterprise', 'edu', 'edu_plus', 'edu_pro', 'sci', 'sci_plus', 'unknown',
]);

// Keep only the fields used by the pet. The same quota response provides the
// plan and both windows, so there is no need to request account information.
export function aggregate(result, at = Date.now()) {
  const normalized = normalizeLimits(result, null, at);
  const bucket = result?.rateLimitsByLimitId?.codex ?? result?.rateLimits;
  const plan = normalized.limitId && plans.has(bucket?.planType)
    ? bucket.planType : null;
  const windows = normalized.windows.filter(win => !['pro', 'prolite'].includes(plan) || win.minutes === 10080);
  return { at, plan, windows, resetCount: normalized.resetCount };
}

export function publicQuota(sample, failed = false, now = Date.now()) {
  if (!sample) return empty();
  const expired = failed || now - sample.at > FRESH_MS || now < sample.at - 5000;
  const windows = sample.windows.map(({ minutes, remaining, resetsAt, status }) => {
    if (status === 'fresh' && (!Number.isSafeInteger(resetsAt) || resetsAt > maxDateSeconds)) status = 'unavailable';
    if (status === 'fresh' && (expired || resetsAt * 1000 <= now)) status = 'stale';
    return status === 'fresh' ? { minutes, remaining, status, resetsAt } : { minutes, remaining: null, status };
  });
  const status = windows.some(win => win.status === 'fresh') ? 'fresh'
    : windows.some(win => win.status === 'stale') ? 'stale' : 'unavailable';
  const result = { status, at: sample.at, windows, plan: sample.plan };
  if (status === 'fresh' && Number.isSafeInteger(sample.resetCount) && sample.resetCount >= 0) {
    result.resetCount = sample.resetCount;
  }
  return result;
}

export function recentlyActive(file, now = Date.now()) {
  try {
    const st = fs.lstatSync(file);
    const age = now - st.mtimeMs;
    return st.isFile() && age >= -1000 && age < activeLifetime;
  } catch { return false; }
}

function officialCLI(app) {
  const bundles = app ? [app] : ['/Applications/ChatGPT.app', path.join(os.homedir(), 'Applications/ChatGPT.app')];
  for (const bundle of bundles) {
    const cli = path.join(bundle, 'Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');
    try { fs.accessSync(cli, fs.constants.X_OK); return cli; } catch {}
  }
  throw Error('Official desktop CLI unavailable');
}

// A single read-only stdio session. Do not log protocol replies or stderr:
// those channels can contain profile information unrelated to the quota.
export function readOfficialQuota(cli, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(cli, ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = createInterface({ input: child.stdout });
    const timer = setTimeout(() => finish(Error('Quota read timed out')), 30_000);
    const abort = () => finish(Error('Inactive'));
    let initialized = false;
    let done = false;
    function finish(error, result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      lines.close();
      child.stdin.end();
      child.kill();
      if (error) reject(error); else resolve(result);
    }
    function send(value) { child.stdin.write(JSON.stringify(value) + '\n'); }
    signal.addEventListener('abort', abort, { once: true });
    child.once('error', () => finish(Error('Official service unavailable')));
    child.once('close', () => finish(Error('Official service closed')));
    child.stdin.on('error', () => finish(Error('Official service disconnected')));
    lines.on('line', line => {
      if (done) return;
      let reply;
      try { reply = JSON.parse(line); } catch { return; }
      if (reply.id !== (initialized ? 2 : 1)) return;
      if (reply.error || !reply.result) return finish(Error('Official service refused quota read'));
      if (initialized) return finish(null, aggregate(reply.result));
      initialized = true;
      send({ method: 'initialized' });
      send({ id: 2, method: 'account/rateLimits/read', params: { excludeResetCreditDetails: true } });
    });
    send({ id: 1, method: 'initialize', params: {
      clientInfo: { name: 'codex_work_pet', title: 'Work Pet', version: '1.0.0' },
      capabilities: { experimentalApi: true },
    } });
  });
}

export function startWorker(state, { app, read = signal => readOfficialQuota(officialCLI(app), signal), now = Date.now } = {}) {
  fs.mkdirSync(state, { recursive: true, mode: 0o700 });
  const activeFile = path.join(state, 'active');
  const quotaFile = path.join(state, 'quota.json');
  let sample = null;
  let failed = false;
  let pending = null;
  let due = 0;
  let saved;
  let stopped = false;
  function persist() {
    const json = JSON.stringify(publicQuota(sample, failed, now())) + '\n';
    if (json === saved) return;
    const temp = quotaFile + '.' + randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temp, json, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temp, quotaFile);
      saved = json;
    } finally { fs.rmSync(temp, { force: true }); }
  }
  function clear() {
    pending?.abort();
    pending = null;
    sample = null;
    failed = false;
    due = 0;
    persist();
  }
  async function tick() {
    if (stopped) return;
    if (!recentlyActive(activeFile, now())) return clear();
    persist();
    if (pending || now() < due) return;
    const request = new AbortController();
    pending = request;
    try {
      const value = await read(request.signal);
      if (!request.signal.aborted) { sample = value; failed = false; }
    } catch {
      if (!request.signal.aborted) failed = true;
    } finally {
      if (pending === request) {
        pending = null;
        due = now() + refreshInterval;
        if (recentlyActive(activeFile, now())) persist(); else clear();
      }
    }
  }
  const timer = setInterval(tick, 2000);
  void tick();
  return { tick, close() { stopped = true; clearInterval(timer); clear(); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { state: { type: 'string' }, app: { type: 'string' } } });
  if (process.platform !== 'darwin' || !values.state || !path.isAbsolute(values.state))
    throw Error('Expected macOS and --state /absolute/path');
  const worker = startWorker(values.state, { app: values.app });
  process.once('SIGTERM', worker.close);
  process.once('SIGINT', worker.close);
}
