import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';

export const FRESH_MS = 5 * 60_000;
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function normalizeLimits(result, scope, at = Date.now()) {
  const buckets = result?.rateLimitsByLimitId;
  let bucket = buckets && typeof buckets === 'object' ? buckets.codex : null;
  if (!bucket && !buckets && result?.rateLimits?.limitId === 'codex') bucket = result.rateLimits;
  if (bucket?.limitId !== 'codex') bucket=null;
  const windows = [300, 10080].map(minutes => {
    const matches = [bucket?.primary, bucket?.secondary].filter(w => w?.windowDurationMins === minutes);
    const w = matches.length === 1 ? matches[0] : null;
    const valid = w && finite(w.usedPercent) && w.usedPercent >= 0 && w.usedPercent <= 100 && finite(w.resetsAt) && w.resetsAt * 1000 > at;
    return {minutes, label: minutes === 300 ? '五小时' : '每周', remaining: valid ? Math.max(0, Math.min(100, 100 - w.usedPercent)) : null,
      usedPercent: valid ? w.usedPercent : null, resetsAt: valid ? w.resetsAt : null, status: valid ? 'fresh' : 'unavailable'};
  });
  const count = result?.rateLimitResetCredits?.availableCount;
  return {scope, limitId: bucket?.limitId === 'codex' ? 'codex' : null, at,
    windows, resetCount: Number.isSafeInteger(count) && count >= 0 ? count : null,
    status: windows.some(w => w.status === 'fresh') ? 'fresh' : 'unavailable', source: '官方 App Server'};
}
export function lowAlerts(snapshot, seen, enabled = true, now = Date.now()) {
  if (!enabled || snapshot?.status !== 'fresh' || !snapshot.scope || now - snapshot.at > FRESH_MS || now < snapshot.at - 5000) return [];
  const low = snapshot.windows.filter(w => w.status === 'fresh' && finite(w.remaining) && w.remaining < 10 && w.resetsAt * 1000 > now);
  const fresh = low.filter(w => !seen[`${snapshot.scope}|${snapshot.limitId}|${w.minutes}|${w.resetsAt}`]);
  if (!fresh.length) return [];
  for (const w of low) seen[`${snapshot.scope}|${snapshot.limitId}|${w.minutes}|${w.resetsAt}`] = now;
  return low; // Include both low windows in one bubble.
}
function read(file, fallback = {}) { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; } }
function write(file, value) { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(value, null, 2), {mode: 0o600}); fs.renameSync(tmp, file); }
export class QuotaMonitor extends EventEmitter {
  constructor({dataDir, codexHome, cli, fixture = false, enabled = true}) {
    super(); this.dir = dataDir; this.home = codexHome; this.cli = cli; this.fixture = fixture;
    this.enabled=enabled!==false;this.generation=0;this.seq = 0; this.pending = new Map(); this.failures = 0; this.closed = false; this.settings = read(path.join(dataDir, 'mutsumi-settings.json'), {alerts: true});
    this.seen = read(path.join(dataDir, 'mutsumi-alerts.json')); this.value = {status:'unavailable',at:null,scope:null,windows:[],resetCount:null,reason:'正在连接官方额度服务'};
    if (!fixture) { if(this.enabled)this.start(); this.authStamp = this.stamp(); this.watch = setInterval(() => { if(!this.enabled)return;const s = this.stamp(); if (s !== this.authStamp) { this.authStamp = s; this.invalidate('账号状态已变化，正在重新核对'); this.restart(); } }, 3000); this.watch.unref(); }
  }
  setEnabled(value){if(typeof value!=='boolean'||this.closed||value===this.enabled)return;this.enabled=value;this.generation++;
    for(const t of [this.timer,this.reconnect,this.eventTimer])clearTimeout(t);const old=this.child;this.child=null;this.ready=false;this.busy=false;old?.kill();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('companion disabled'));}this.pending.clear();this.invalidate(value?'正在连接官方额度服务':'额度挂件已关闭');if(value&&!this.fixture){this.authStamp=this.stamp();this.start();}}
  stamp() { try { const s=fs.statSync(path.join(this.home,'auth.json'));return `${s.mtimeMs}:${s.size}`; } catch { return 'none'; } }
  invalidate(reason) { this.scope = null; this.value = {status:'unavailable',at:null,scope:null,windows:[],resetCount:null,reason}; this.emit('updated', this.snapshot()); }
  snapshot() {
    const v=structuredClone(this.value), now=Date.now();
    if (v.status === 'fresh' && (now-v.at>FRESH_MS || now<v.at-5000)) v.status='stale';
    for (const w of v.windows) if (w.status==='fresh' && (v.status!=='fresh' || w.resetsAt*1000<=now)) w.status='stale';
    return {...v, alertsEnabled:this.settings.alerts !== false};
  }
  setSettings(input) { if (typeof input.alerts === 'boolean') this.settings.alerts = input.alerts; write(path.join(this.dir,'mutsumi-settings.json'),this.settings); this.emit('updated',this.snapshot()); return this.settings; }
  rpc(method, params) {
    // No login, purchase, consume-reset or inference methods are exposed.
    if (!['initialize','account/read','account/rateLimits/read'].includes(method)) return Promise.reject(Error('read-only'));
    return new Promise((resolve,reject) => {
      const id=++this.seq, timer=setTimeout(()=>{this.pending.delete(id);reject(Error('timeout'));},20000);timer.unref();
      this.pending.set(id,{resolve,reject,timer});
      try { this.child.stdin.write(JSON.stringify({id,method,params})+'\n'); } catch { clearTimeout(timer);this.pending.delete(id);reject(Error('transport')); }
    });
  }
  async identity() {
    const a=await this.rpc('account/read',{refreshToken:false});
    const account=a.account, route=a.workspaceRouting;
    if (account?.type!=='chatgpt' || !route?.chatgptAccountId) throw Error('auth');
    return {scope:crypto.createHash('sha256').update(JSON.stringify([route.backendOrigin,route.chatgptAccountId,route.accountRoutingOverride??null,account.type,account.planType])).digest('hex'), accountId:route.chatgptAccountId,plan:account.planType};
  }
  async accept(result, identity) {
    if(!this.enabled||this.closed)return;
    if (!identity || result?.accountId && result.accountId!==identity.accountId) { this.invalidate('账号或工作区不匹配');return; }
    if (this.scope && this.scope!==identity.scope) this.invalidate('账号已切换');
    this.scope=identity.scope;
    this.value={...normalizeLimits(result,identity.scope),plan:identity.plan,reason:'',...(this.fixture?{source:'隔离测试数据（非真实额度）'}:{})};
    const low=lowAlerts(this.value,this.seen,this.settings.alerts!==false);
    if (low.length) {
      write(path.join(this.dir,'mutsumi-alerts.json'),this.seen);
      this.value.notice={id:crypto.randomUUID(),text:'老大 你的额度不够啦',windows:low};
    }
    // Only sanitized quota data is persisted; never tokens, email, account IDs or credit IDs.
    write(path.join(this.dir,'mutsumi-last-quota.json'),this.value);
    this.failures=0;this.emit('updated',this.snapshot());
  }
  async refresh() {
    if (this.closed || !this.enabled || this.busy || !this.ready) return;
    this.busy=true;const generation=this.generation;
    try {
      const before=await this.identity();
      if (this.scope && this.scope!==before.scope) this.invalidate('账号已切换');
      const result=await this.rpc('account/rateLimits/read');
      const after=await this.identity();
      if(!this.enabled||generation!==this.generation)return;
      if (before.scope!==after.scope) { this.invalidate('账号切换中，等待新数据');return; }
      await this.accept(result,after);
    } catch {
      if(!this.enabled||generation!==this.generation)return;
      this.failures++;this.value={...this.value,status:this.value.at?'stale':'unavailable',resetCount:null,reason:'暂不可用：连接、鉴权或网络失败'};this.emit('updated',this.snapshot());
    } finally { if(generation===this.generation){this.busy=false;this.schedule();} }
  }
  schedule() { clearTimeout(this.timer);if(!this.closed&&this.enabled)this.timer=setTimeout(()=>this.refresh(),Math.min(900000,60000*2**Math.min(this.failures,4)));this.timer?.unref(); }
  async start() {
    if(this.closed||!this.enabled)return;
    this.ready=false;
    const child=this.child=spawn(this.cli,['app-server'],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,CODEX_HOME:this.home}});
    let tail='';child.stderr.on('data',()=>{}); // Deliberately do not record App Server logs.
    child.stdout.on('data',bytes=>{if(this.child!==child||!this.enabled)return;tail+=bytes;let i;while((i=tail.indexOf('\n'))>=0){const line=tail.slice(0,i);tail=tail.slice(i+1);try{
      const m=JSON.parse(line),p=this.pending.get(m.id);
      if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error('rpc')):p.resolve(m.result);}
      else if(m.method==='account/rateLimits/updated' && this.ready){
        // Event is a signal; re-read identity and authoritative full response to avoid partial/mixed-account state.
        clearTimeout(this.eventTimer);this.eventTimer=setTimeout(()=>this.refresh(),250);this.eventTimer.unref();
      } else if(m.method==='account/updated'){this.invalidate('账号状态已变化');clearTimeout(this.eventTimer);this.eventTimer=setTimeout(()=>this.refresh(),500);this.eventTimer.unref();}
    }catch{}}});
    child.on('error',()=>this.disconnected(child));child.on('exit',()=>this.disconnected(child));
    try {await this.rpc('initialize',{clientInfo:{name:'mutsumi_quota',title:'Mutsumi quota companion',version:'1.0.0'},capabilities:{experimentalApi:true}});if(this.child!==child)return;child.stdin.write('{"method":"initialized"}\n');this.ready=true;await this.refresh();}
    catch{this.disconnected(child);}
  }
  disconnected(child) {
    if(this.closed || this.child!==child)return;this.child=null;this.ready=false;this.busy=false;
    for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('disconnected'));}this.pending.clear();
    this.value={...this.value,status:this.value.at?'stale':'unavailable',resetCount:null,reason:'暂不可用：额度服务已断开'};this.emit('updated',this.snapshot());
    clearTimeout(this.reconnect);this.reconnect=setTimeout(()=>this.start(),Math.min(900000,60000*2**Math.min(this.failures++,4)));this.reconnect.unref();
  }
  restart() { const old=this.child;this.child=null;this.ready=false;clearTimeout(this.timer);clearTimeout(this.reconnect);old?.kill();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('identity changed'));}this.pending.clear();this.busy=false;this.start(); }
  close() { this.closed=true;for(const t of [this.timer,this.reconnect,this.eventTimer])clearTimeout(t);clearInterval(this.watch);const c=this.child;this.child=null;c?.kill();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('closed'));}this.pending.clear(); }
}
