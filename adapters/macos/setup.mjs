import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const [action, app, source, locked] = process.argv.slice(2);
const label = 'io.github.xingyangmua.work-pet';
const catalog = 'x1ngy0-work-pet';
const plugin = 'work-pet-macos@' + catalog;
const home = os.homedir();
const root = path.join(home, 'Library/Application Support/Codex Work Pet');
const current = path.join(root, 'current');
const previous = path.join(root, '.previous');
const manager = path.join(root, 'manage.sh');
const managerTarget = 'current/adapters/macos/manage.sh';
const agentDir = path.join(home, 'Library/LaunchAgents');
const plist = path.join(agentDir, label + '.plist');
const domain = 'gui/' + process.getuid();
const service = domain + '/' + label;
const cli = path.join(app || '', 'Contents/Resources/codex-cli/bin/codex');
const owner = path.join(root, '.work-pet-owner');
const receipt = '.work-pet-files.json';
const fileList = 'adapters/macos/files.json';
const launchSpec = {
  Label: label,
  ProgramArguments: ['/bin/bash', manager, 'run'],
  RunAtLoad: true, KeepAlive: true, ThrottleInterval: 10, LimitLoadToSessionType: 'Aqua',
};
const stat = p => fs.lstatSync(p, { throwIfNoEntry: false });
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fail = message => { throw Error(message); };

function invoke(program, args, options = {}) {
  return spawnSync(program, args, { cwd: home, encoding: 'utf8', timeout: 25000, ...options });
}
function run(program, args, options) {
  const result = invoke(program, args, options);
  if (result.error || result.status !== 0) {
    fail(path.basename(program) + ' ' + args.slice(0, 3).join(' ') + ' 执行失败。' +
      (result.error?.message || result.stderr?.trim() || ''));
  }
  return result.stdout;
}
function codex(args) { return JSON.parse(run(cli, ['plugin', ...args, '--json'])); }
function marketplace() {
  const record = codex(['marketplace', 'list']).marketplaces.find(p => p.name === catalog);
  if (record && (record.marketplaceSource?.sourceType !== 'local' || record.root !== current))
    fail('官方插件目录中已有同名来源 ' + record.root + '。已保留该来源。');
  return record;
}
function installed() {
  return codex(['list', '--marketplace', catalog]).installed.find(p => p.pluginId === plugin);
}
function serviceLoaded() {
  const info = invoke('/bin/launchctl', ['print', service]);
  if (info.error) throw info.error;
  if (info.status !== 0) return false;
  if (!info.stdout.split('\n').some(line => line.trim() === 'path = ' + plist))
    fail('同名后台服务已由其他程序注册。');
  return true;
}
async function stopService() {
  if (!serviceLoaded()) return;
  run('/bin/launchctl', ['bootout', service]);
  for (let i = 0; i < 80 && serviceLoaded(); i++) await delay(100);
  if (serviceLoaded()) fail('停止后台服务超时。');
}
async function startService() {
  const started = Date.now();
  const directory = path.join(root, 'state');
  const petFile = path.join(directory, 'pet-status.json');
  const quotaFile = path.join(directory, 'quota.json');
  run('/bin/launchctl', ['bootstrap', domain, plist]);
  for (let i = 0; i < 60; i++) {
    await delay(150);
    try {
      const pet = JSON.parse(fs.readFileSync(petFile, 'utf8'));
      // An active window or an online quota response is optional. Both worker
      // processes must have published their own state since this bootstrap.
      if (!Number.isSafeInteger(pet.at) || pet.at < started || !Number.isSafeInteger(pet.pid) || pet.pid <= 0 ||
          fs.statSync(quotaFile).mtimeMs < started - 1) continue;
      process.kill(pet.pid, 0);
      if (serviceLoaded()) return;
    } catch { /* Workers may still be starting. */ }
  }
  fail('后台服务已注册，但角色和额度进程未就绪。');
}
function verifyPlist() {
  if (!stat(plist)) return false;
  if (!stat(plist).isFile() ||
      !isDeepStrictEqual(JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '--', plist])), launchSpec))
    fail('已有后台配置与 Work Pet 不符，已保留 ' + plist);
  return true;
}
function verifyEntry() {
  if (stat(manager) && (!stat(manager).isSymbolicLink() || fs.readlinkSync(manager) !== managerTarget))
    fail('安装目录中的 manage.sh 已由其他程序使用。');
}
function checkReceipt(dir) {
  const record = path.join(dir, receipt);
  if (!stat(dir)?.isDirectory() || !stat(record)?.isFile()) fail('无法验证安装文件归属 ' + dir);
  const metadata = JSON.parse(fs.readFileSync(record, 'utf8'));
  if (metadata.owner !== label || !metadata.files || typeof metadata.files !== 'object')
    fail('无效的安装记录 ' + dir);
  return metadata.files;
}
function preserveOrRemove(dir) {
  if (!stat(dir)) return;
  const expected = checkReceipt(dir);
  function pristine(folder) {
    return fs.readdirSync(folder, { withFileTypes: true }).every(entry => {
      const full = path.join(folder, entry.name);
      const relative = path.relative(dir, full);
      if (relative === receipt) return true;
      if (entry.isDirectory()) return pristine(full);
      return entry.isFile() && expected[relative] === hash(full);
    });
  }
  if (pristine(dir)) fs.rmSync(dir, { recursive: true });
  else {
    const backup = path.join(root, 'saved-files-' + randomUUID());
    fs.renameSync(dir, backup);
    console.log('已保留修改过的文件：' + backup);
  }
}
function stageFiles() {
  const base = fs.realpathSync(source);
  function ordinary(relative) {
    if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) ||
        relative.split('/').some(x => !x || x === '.' || x === '..') || relative === receipt)
      fail('文件清单路径无效。');
    const name = path.join(base, relative);
    if (fs.realpathSync(name) !== name || !fs.lstatSync(name).isFile()) fail('无效的安装文件 ' + relative);
    return name;
  }
  const names = JSON.parse(fs.readFileSync(ordinary(fileList), 'utf8'));
  if (!Array.isArray(names) || new Set(names).size !== names.length) fail('文件清单无效。');
  for (const required of [fileList, '.agents/plugins/marketplace.json', 'adapters/macos/pet.js',
    'adapters/macos/manage.sh', 'adapters/macos/supervise.mjs', 'adapters/macos/setup.mjs', 'adapters/macos/quota.mjs'])
    if (!names.includes(required)) fail('文件清单缺少 ' + required);
  const stage = fs.mkdtempSync(path.join(root, '.staging-'));
  try {
    const files = Object.create(null);
    for (const name of names) {
      const src = ordinary(name);
      const dest = path.join(stage, name);
      fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
      fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
      files[name] = hash(dest);
    }
    fs.writeFileSync(path.join(stage, receipt), JSON.stringify({ owner: label, files }), { mode: 0o600 });
    return stage;
  } catch (error) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}
async function install() {
  const hadPlist = verifyPlist();
  const wasLoaded = serviceLoaded();
  if (wasLoaded && !hadPlist) fail('后台服务已有同名记录，缺少安装配置。');
  verifyEntry();
  if (stat(previous) && !stat(current)) fs.renameSync(previous, current);
  if (stat(current)) checkReceipt(current);
  if (stat(previous)) preserveOrRemove(previous);
  const hadCurrent = Boolean(stat(current));
  const hadManager = Boolean(stat(manager));
  const hadCatalog = Boolean(marketplace());
  const oldPlugin = hadCatalog && installed();
  const stage = stageFiles();
  let swapped = false, createdPlist = false, addedCatalog = false, addedPlugin = false, stopped = false;
  try {
    await stopService();
    stopped = true;
    if (hadCurrent) fs.renameSync(current, previous);
    fs.renameSync(stage, current);
    swapped = true;
    if (!hadManager) fs.symlinkSync(managerTarget, manager);
    if (!hadCatalog) { codex(['marketplace', 'add', current]); addedCatalog = true; }
    // Respect an explicit disabled setting. Enabled installations refresh the cached skill.
    if (!oldPlugin || oldPlugin.enabled) {
      codex(['add', plugin]); addedPlugin = !oldPlugin;
      if (!installed()?.enabled) fail('官方插件目录尚未启用 Work Pet。');
    }
    if (!hadPlist) {
      const xml = run('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', '--', '-'], { input: JSON.stringify(launchSpec) });
      fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
      const temporary = path.join(agentDir, '.' + label + '-' + randomUUID());
      try {
        fs.writeFileSync(temporary, xml, { flag: 'wx', mode: 0o600 });
        fs.linkSync(temporary, plist);
        createdPlist = true;
      } finally { fs.rmSync(temporary, { force: true }); }
    }
    await startService();
  } catch (error) {
    const recoveryErrors = [];
    async function attempt(fn) { try { await fn(); } catch (e) { recoveryErrors.push(e.message); } }
    if (swapped) await attempt(stopService);
    if (addedPlugin) await attempt(() => codex(['remove', plugin]));
    if (addedCatalog) await attempt(() => codex(['marketplace', 'remove', catalog]));
    if (createdPlist) await attempt(() => fs.unlinkSync(plist));
    if (!hadManager && stat(manager)) await attempt(() => { verifyEntry(); fs.unlinkSync(manager); });
    if (swapped) await attempt(() => preserveOrRemove(current));
    if (stat(previous)) await attempt(() => fs.renameSync(previous, current));
    if (oldPlugin?.enabled && swapped) await attempt(() => codex(['add', plugin]));
    if (wasLoaded && stopped) await attempt(() => run('/bin/launchctl', ['bootstrap', domain, plist]));
    if (recoveryErrors.length) fail(error.message + '\n恢复时遇到：' + recoveryErrors.join('\n'));
    throw error;
  } finally {
    if (stat(stage)) fs.rmSync(stage, { recursive: true, force: true });
  }
  preserveOrRemove(previous);
  console.log('Work Pet 已安装。打开官方 ChatGPT 即可使用。');
}
async function uninstall() {
  const hadPlist = verifyPlist();
  verifyEntry();
  if (stat(current)) checkReceipt(current);
  const hasCatalog = marketplace();
  if (hasCatalog && installed()) codex(['remove', plugin]);
  if (hasCatalog) codex(['marketplace', 'remove', catalog]);
  await stopService();
  if (hadPlist) fs.unlinkSync(plist);
  if (stat(manager)) fs.unlinkSync(manager);
  preserveOrRemove(current);
  preserveOrRemove(previous);
  console.log('Work Pet 已卸载，角色设置保存在 ' + path.join(root, 'state'));
}

async function main() {
  if (!['install', 'uninstall'].includes(action) || process.platform !== 'darwin' || process.getuid() === 0)
    fail('需要从当前 Mac 登录用户运行安装工具。');
  process.umask(0o077);
  const appId = run('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', path.join(app, 'Contents/Info.plist')]).trim();
  if (appId !== 'com.openai.codex') fail('需要官方 ChatGPT 应用。');
  const parent = path.dirname(root);
  if (!stat(parent)?.isDirectory()) fail('缺少用户 Application Support 目录。');
  if (!stat(root) && action === 'install') {
    fs.mkdirSync(root, { mode: 0o700 });
    fs.writeFileSync(owner, label + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (!stat(root)?.isDirectory() || !stat(owner)?.isFile() || fs.readFileSync(owner, 'utf8') !== label + '\n')
    fail('安装目录已存在且无法验证归属，已保留 ' + root);
  if (locked !== 'locked') {
    const lock = path.join(root, '.operation-lock');
    if (stat(lock) && !stat(lock).isFile()) fail('安装锁路径无效。');
    const result = spawnSync('/usr/bin/lockf', ['-k', '-t', '15', lock, process.execPath,
      fileURLToPath(import.meta.url), action, app, source || '', 'locked'], { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
    return;
  }
  if (action === 'install') {
    const state = path.join(root, 'state');
    if (stat(state) && !stat(state).isDirectory()) fail('设置目录类型无效。');
    fs.mkdirSync(state, { recursive: true, mode: 0o700 });
    await install();
  } else await uninstall();
}
try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
