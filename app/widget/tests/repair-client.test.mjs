import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../../Repair-Client.ps1',import.meta.url));
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
function fixture(t, record, backups=[]) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-repair-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'data'));
 fs.mkdirSync(path.join(root,'package/app/resources'),{recursive:true});
 fs.writeFileSync(path.join(root,'package/app/ChatGPT.exe'),'fixture');
 fs.writeFileSync(path.join(root,'package/app/resources/codex.exe'),'fixture');
 const file=path.join(root,'data/mutsumi-install.json');
 if(record!==undefined)fs.writeFileSync(file,Buffer.isBuffer(record)?record:JSON.stringify(record));
 backups.forEach((value,index)=>{
  const folder=path.join(root,'backups',String(index),'data');
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'mutsumi-install.json'),JSON.stringify(value));
 });
 const script=path.join(root,'check.ps1');
 fs.writeFileSync(script,'\uFEFF$ErrorActionPreference="Stop"\n'+
  'function Get-AppxPackage { param($Name) [pscustomobject]@{InstallLocation='+quote(path.join(root,'package'))+";Version='26.1111.2228.0';PackageFamilyName='Fixture.Codex_test'} }\n"+
  '& '+quote(source)+' -InstallRoot '+quote(root)+' | ConvertTo-Json -Depth 16\n');
 return {root,file,script,args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',script]};
}
const ps=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
function run(f){return spawnSync(ps,f.args,{windowsHide:true,encoding:'utf8',timeout:25000});}
function read(f){return JSON.parse(fs.readFileSync(f.file,'utf8').replace(/^\uFEFF/,''));}
const oldRecord=()=>({cli:'C:\\old\\codex.exe',clientExe:'C:\\old\\ChatGPT.exe',codexHome:'C:\\existing-custom-profile',appId:'old!App',packageVersion:'old',customSetting:{keep:true}});

test('repair restores NUL-damaged install metadata from backup and preserves exact damaged bytes',windows,t=>{
 const damaged=Buffer.alloc(388);
 const f=fixture(t,damaged,[oldRecord()]);
 const result=run(f);assert.equal(result.status,0,result.stderr);
 const record=read(f);
 assert.equal(record.codexHome,'C:\\existing-custom-profile');
 assert.deepEqual(record.customSetting,{keep:true});
 assert.equal(record.clientExe,path.join(f.root,'package/app/ChatGPT.exe'));
 assert.equal(record.cli,path.join(f.root,'package/app/resources/codex.exe'));
 assert.equal(record.appId,'Fixture.Codex_test!App');
 assert.equal(record.packageVersion,'26.1111.2228.0');
 const preserved=fs.readdirSync(path.dirname(f.file)).filter(name=>name.includes('.corrupt.'));
 assert.equal(preserved.length,1);
 assert.deepEqual(fs.readFileSync(path.join(path.dirname(f.file),preserved[0])),damaged);
});

test('repair upgrades valid metadata once and leaves unchanged records untouched',windows,t=>{
 const f=fixture(t,oldRecord());
 const first=run(f);assert.equal(first.status,0,first.stderr);
 const stamp=new Date('2020-01-01T00:00:00Z');fs.utimesSync(f.file,stamp,stamp);
 const before=fs.readFileSync(f.file);
 const result=run(f);assert.equal(result.status,0,result.stderr);
 assert.equal(fs.statSync(f.file).mtimeMs,stamp.getTime());
 assert.deepEqual(fs.readFileSync(f.file),before);
 assert.equal(fs.readdirSync(path.dirname(f.file)).length,1);
});

test('repair preserves a Unicode profile across writes and legacy PowerShell reads',windows,t=>{
 const record={...oldRecord(),codexHome:'C:\\用户\\原有账户配置'};
 const f=fixture(t,record);
 const first=run(f);assert.equal(first.status,0,first.stderr);
 const bytes=fs.readFileSync(f.file);assert.deepEqual(bytes.subarray(0,3),Buffer.from([0xef,0xbb,0xbf]));
 assert.equal(read(f).codexHome,record.codexHome);
 fs.appendFileSync(f.script,'$legacy=Get-Content -LiteralPath '+quote(f.file)+' -Raw | ConvertFrom-Json\n'+
  'if($legacy.codexHome -cne '+quote(record.codexHome)+"){throw 'Unicode profile changed in legacy reader'}\n");
 const second=run(f);assert.equal(second.status,0,second.stderr);
 assert.equal(read(f).codexHome,record.codexHome);
 assert.deepEqual(fs.readFileSync(f.file),bytes);
});

test('repair fails without changing damaged data when no valid profile backup exists',windows,t=>{
 const damaged=Buffer.alloc(388);
 const f=fixture(t,damaged,[{codexHome:'relative-profile'}]);
 const result=run(f);assert.notEqual(result.status,0);
 assert.match(result.stderr,/no valid backup preserves codexHome/);
 assert.deepEqual(fs.readFileSync(f.file),damaged);
 assert.equal(fs.readdirSync(path.dirname(f.file)).length,1);
});

test('repair restores a missing record and accepts a legacy record without clientExe',windows,t=>{
 const legacy=oldRecord();delete legacy.clientExe;
 const f=fixture(t,undefined,[legacy]);
 const result=run(f);assert.equal(result.status,0,result.stderr);
 assert.equal(read(f).codexHome,legacy.codexHome);
 assert.equal(read(f).clientExe,path.join(f.root,'package/app/ChatGPT.exe'));
 assert.equal(fs.readdirSync(path.dirname(f.file)).length,1);
});

test('a first installation requires an explicit absolute profile and cannot override damaged metadata',windows,t=>{
 const f=fixture(t,undefined);
 fs.writeFileSync(f.script,fs.readFileSync(f.script,'utf8').replace(' | ConvertTo-Json -Depth 16'," -NewCodexHome 'C:\\new-existing-profile' | ConvertTo-Json -Depth 16"));
 const result=run(f);assert.equal(result.status,0,result.stderr);
 assert.equal(read(f).codexHome,'C:\\new-existing-profile');
 fs.writeFileSync(f.file,Buffer.alloc(17));
 const failed=run(f);assert.notEqual(failed.status,0);
 assert.match(failed.stderr,/no valid backup preserves codexHome/);
 assert.deepEqual(fs.readFileSync(f.file),Buffer.alloc(17));
});

test('repair rejects drive-relative profile backups',windows,t=>{
 const f=fixture(t,Buffer.alloc(7),[{codexHome:'C:relative-profile'},{codexHome:'\\current-drive-profile'}]);
 const result=run(f);assert.notEqual(result.status,0);
 assert.match(result.stderr,/no valid backup preserves codexHome/);
 assert.deepEqual(fs.readFileSync(f.file),Buffer.alloc(7));
});

test('concurrent client repairs produce one intact recovered record and one damaged backup',windows,async t=>{
 const f=fixture(t,Buffer.alloc(388),[oldRecord()]);
 const children=Array.from({length:4},()=>new Promise((resolve,reject)=>{
  const child=spawn(ps,f.args,{windowsHide:true});let errors='';
  child.stderr.on('data',chunk=>errors+=chunk);child.on('error',reject);
  child.on('exit',code=>resolve({code,errors}));
 }));
 const results=await Promise.all(children);for(const result of results)assert.equal(result.code,0,result.errors);
 assert.equal(read(f).codexHome,'C:\\existing-custom-profile');
 const files=fs.readdirSync(path.dirname(f.file));
 assert.equal(files.filter(name=>name.includes('.corrupt.')).length,1);
 assert.equal(files.filter(name=>name.endsWith('.tmp')).length,0);
});
