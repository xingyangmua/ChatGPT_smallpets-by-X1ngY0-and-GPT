import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aggregate, publicQuota, recentlyActive, startWorker } from '../quota.mjs';

const at = Date.parse('2026-07-01T14:00:00Z');
function response(planType = 'plus') {
  const window = (minutes, usedPercent) => ({ windowDurationMins: minutes, usedPercent, resetsAt: at / 1000 + minutes });
  return {
    accountId: 'private-account-identifier',
    rateLimitsByLimitId: { codex: {
      limitId: 'codex', planType, primary: window(300, 15), secondary: window(10080, 3),
      credits: { balance: 'should stay private' },
    } },
  };
}

test('only publishes validated remaining values, freshness, and public plan names', () => {
  const result = publicQuota(aggregate(response(), at), false, at);
  assert.deepEqual(result, { status: 'fresh', at, plan: 'plus', windows: [
    { minutes: 300, remaining: 85, status: 'fresh', resetsAt: at / 1000 + 300 },
    { minutes: 10080, remaining: 97, status: 'fresh', resetsAt: at / 1000 + 10080 },
  ] });
  assert.equal(publicQuota(aggregate(response('private-value'), at), false, at).plan, null);
  assert.equal(publicQuota(aggregate({ accountId: 'test' }, at), false, at).status, 'unavailable');
  for (const plan of ['pro', 'prolite']) {
    assert.deepEqual(publicQuota(aggregate(response(plan), at), false, at).windows.map(w => w.minutes), [10080]);
  }
});

test('only the aggregate available reset count reaches fresh quota snapshots', () => {
  const raw = response();
  for (const count of [0, 2, null, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
    raw.rateLimitResetCredits = { availableCount: count, credits: [{ id: 'private-credit-identifier' }] };
    const sample = aggregate(raw, at);
    const data = publicQuota(sample, false, at);
    if (count === 0 || count === 2) assert.equal(data.resetCount, count);
    else assert.equal(Object.hasOwn(data, 'resetCount'), false);
    assert.doesNotMatch(JSON.stringify([sample, data]), /private-credit|private-account|should stay private/);
    assert.equal(Object.hasOwn(publicQuota(sample, true, at), 'resetCount'), false);
  }
});

test('expired windows, failed refreshes and clock changes do not present live numbers', () => {
  const raw = response();
  raw.rateLimitResetCredits = { availableCount: 0 };
  raw.rateLimitsByLimitId.codex.primary.resetsAt = at / 1000 + 1;
  const sample = aggregate(raw, at);
  const partial = publicQuota(sample, false, at + 2000);
  assert.deepEqual(partial.windows.map(w => w.status), ['stale', 'fresh']);
  assert.equal(Object.hasOwn(partial.windows[0], 'resetsAt'), false);
  assert.equal(partial.windows[1].resetsAt, at / 1000 + 10080);
  for (const [failed, now] of [[false, at + 310_000], [false, at - 6000], [true, at]]) {
    const result = publicQuota(sample, failed, now);
    assert.equal(result.status, 'stale');
    assert.ok(result.windows.every(win => win.remaining === null && win.status === 'stale' && !Object.hasOwn(win, 'resetsAt')));
    assert.equal(Object.hasOwn(result, 'resetCount'), false);
  }
  raw.rateLimitsByLimitId.codex.primary.resetsAt = Number.MAX_VALUE;
  assert.deepEqual(publicQuota(aggregate(raw, at), false, at).windows[0],
    { minutes: 300, remaining: null, status: 'unavailable' });
});

test('heartbeat gates polling and inactive, stale, or symlink marks clear cached quota', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-pet-worker-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'active');
  const quota = () => JSON.parse(fs.readFileSync(path.join(dir, 'quota.json')));
  let now = at;
  const pulse = () => {
    fs.writeFileSync(file, '');
    fs.utimesSync(file, now / 1000, now / 1000);
  };
  let calls = 0;
  let offline = false;
  const worker = startWorker(dir, { now: () => now, read: async () => {
    calls++;
    if (offline) throw Error('offline');
    return aggregate(response(), now);
  } });
  try {
    assert.equal(quota().status, 'unavailable');
    assert.equal(calls, 0);
    pulse();
    await worker.tick();
    await worker.tick();
    assert.equal(calls, 1);
    assert.equal(quota().status, 'fresh');
    assert.equal(fs.statSync(path.join(dir, 'quota.json')).mode & 0o777, 0o600);

    now += 61_000;
    pulse();
    offline = true;
    await worker.tick();
    assert.equal(quota().status, 'stale');
    assert.equal(calls, 2);
    now += 20_001;
    await worker.tick();
    assert.equal(quota().status, 'unavailable');
    assert.equal(calls, 2);

    fs.unlinkSync(file);
    fs.symlinkSync(path.join(dir, 'quota.json'), file);
    assert.equal(recentlyActive(file, now), false);
    await worker.tick();
    assert.equal(calls, 2);
  } finally { worker.close(); }
});

test('deactivation cancels a pending read, late responses cannot restore its data', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-pet-cancel-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let finish;
  let signal;
  const worker = startWorker(dir, { read: async s => {
    signal = s;
    return new Promise(resolve => { finish = resolve; });
  } });
  try {
    const active = path.join(dir, 'active');
    fs.writeFileSync(active, '');
    const pending = worker.tick();
    fs.unlinkSync(active);
    await worker.tick();
    assert.equal(signal.aborted, true);
    finish(aggregate(response(), at));
    await pending;
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'quota.json'))),
      { status: 'unavailable', at: null, windows: [], plan: null });
  } finally { worker.close(); }
});
