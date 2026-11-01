import fs from 'node:fs';
import path from 'node:path';
import { ROOT, VERSION } from '../runtime/paths.mjs';

export function validateReleaseMetadata({plugin,packageMetadata,lock,runtimeVersion}) {
  const name=packageMetadata?.name;
  const records=[packageMetadata,lock,lock?.packages?.[''],...(plugin?[plugin]:[])];
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/.test(runtimeVersion || '') ||
      !['codex_work_pet','api-balance-whale'].includes(name) || name==='api-balance-whale'&&!plugin ||
      records.some(record=>record?.name !== name || record.version !== runtimeVersion)) {
    throw new Error('Release metadata mismatch: plugin, package, lockfile and runtime must have the same version.');
  }
  return runtimeVersion;
}

export function verifyReleaseMetadata(root=ROOT) {
  const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''));
  return validateReleaseMetadata({plugin:fs.existsSync(path.join(root,'.codex-plugin/plugin.json'))?read('.codex-plugin/plugin.json'):null,packageMetadata:read('package.json'),
    lock:read('package-lock.json'),runtimeVersion:VERSION});
}
