import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION } from '../runtime/paths.mjs';
import { validateReleaseMetadata,verifyReleaseMetadata } from '../scripts/release-metadata.mjs';

const record=()=>({name:'api-balance-whale',version:VERSION});
const fixture=()=>({plugin:record(),packageMetadata:record(),lock:{...record(),packages:{'':record()}},runtimeVersion:VERSION});
test('public component metadata, runtime and release identify the same version',()=>{
  assert.equal(verifyReleaseMetadata(),VERSION);
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.name,'codex_work_pet');assert.equal(pkg.releaseTag,'v'+VERSION);
  const release=JSON.parse(fs.readFileSync(new URL('../../../release.json',import.meta.url),'utf8'));
  assert.equal(release.version,VERSION);assert.equal(release.tag,pkg.releaseTag);
});
test('changing only a manifest or lockfile version fails the package preflight',()=>{
  for(const edit of [x=>x.plugin.version='0.3.0',x=>x.packageMetadata.version='0.3.0',
    x=>x.lock.version='0.3.0',x=>x.lock.packages[''].version='0.3.0',x=>x.plugin.name='another-plugin']) {
    const data=fixture();edit(data);assert.throws(()=>validateReleaseMetadata(data),/metadata mismatch/);
  }
  assert.equal(validateReleaseMetadata(fixture()),VERSION);
});
test('both installers validate package metadata before changing the machine',()=>{
  const win=fs.readFileSync(new URL('../scripts/install-package.ps1',import.meta.url),'utf8');
  const mac=fs.readFileSync(new URL('../scripts/install-macos.mjs',import.meta.url),'utf8');
  assert.ok(win.indexOf('scripts\\check-package.mjs')<win.indexOf('$null = New-Item'));
  assert.ok(mac.indexOf("'check-package.mjs'")<mac.indexOf('const rollbackReceipt = backupMacInstall'));
  assert.ok(mac.includes('version: VERSION'));
  const rollback=fs.readFileSync(new URL('../scripts/rollback-package.ps1',import.meta.url),'utf8');
  assert.ok(rollback.includes('$priorManifest.version -cne $saved.previousVersion'));
  assert.ok(!rollback.includes("'"+VERSION+"'"));
});
