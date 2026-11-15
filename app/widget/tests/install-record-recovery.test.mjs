import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDispatcher } from '../runtime/dispatcher.mjs';
import { QuotaMonitor } from '../runtime/pet-quota.mjs';

test('damaged discovery records keep the avatar and settings available without reading a fallback account', async t => {
  for (const contents of [Buffer.alloc(388), Buffer.from('{"codexHome":'), Buffer.from('null'), Buffer.from('[]'), Buffer.from('{}'), Buffer.from('{"codexHome":false}'), Buffer.from('{"codexHome":"C:relative"}'), Buffer.from(JSON.stringify({codexHome:'\\current-drive-relative'}))]) {
    await t.test(contents.toString().replace(/\0/g, '').slice(0, 30) || 'zero-filled record', async t => {
      const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-install-recovery-'));
      const file = path.join(dataDir, 'mutsumi-install.json');
      fs.writeFileSync(file, contents);
      const customization = Buffer.from('{"version":1,"background":"private-selection"}');
      fs.writeFileSync(path.join(dataDir, 'mutsumi-customization.json'), customization);
      let server;
      t.after(async () => { await server?.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
      const service = {
        config: { codexHome: path.join(dataDir, 'unused-profile'), publicInfo: () => ({}), resolve: () => ({ setting: {} }) },
        turns: new Map(), close: async () => {},
      };
      server = createDispatcher({ dataDir, service, monitor: false, autoRefresh: false });
      assert.equal((await server.dispatch('/widget.html')).status, 200);
      assert.equal((await server.dispatch('/pet-customize.html')).status, 200);
      assert.equal((await server.dispatch('/api/status')).status, 200);
      const quota = JSON.parse((await server.dispatch('/api/mutsumi-quota')).body);
      assert.equal(quota.status, 'unavailable');
      assert.match(quota.reason, /安装记录/);
      assert.deepEqual(quota.windows, []);
      assert.equal(server.quota.child, undefined);
      assert.equal(server.quota.watch, undefined);
      server.quota.setEnabled(false);
      server.quota.setEnabled(true);
      await server.quota.start();
      assert.equal(server.quota.child, null);
      assert.match(server.quota.snapshot().reason, /安装记录/);
      assert.deepEqual(fs.readFileSync(file), contents);
      assert.deepEqual(fs.readFileSync(path.join(dataDir, 'mutsumi-customization.json')), customization);
      assert.equal(fs.existsSync(path.join(dataDir, 'unused-profile')), false);
    });
  }
});

test('a blocked quota reader never resolves or starts a CLI, including restart and enable requests', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-install-blocked-'));
  let calls = 0;
  const monitor = new QuotaMonitor({ dataDir, blockedReason: '安装记录待修复', resolveCli: async () => { calls++; throw Error('must not run'); } });
  t.after(() => { monitor.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  monitor.restart();
  monitor.setEnabled(false);
  monitor.setEnabled(true);
  await monitor.start();
  assert.equal(calls, 0);
  assert.equal(monitor.child, null);
  assert.equal(monitor.watch, undefined);
  assert.equal(monitor.snapshot().reason, '安装记录待修复');
});
