import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {apply,buildInjectionRows,inject} from '../index.mjs';

test('DSH injection needs no account services and includes only self-contained decoration assets',()=>{
 assert.deepEqual(inject,[]);
 const listeners=[];apply({on:(event,handler)=>listeners.push({event,handler})});
 assert.equal(listeners[0].event,'webserver/index-inject');
 const rows=[];listeners[0].handler(rows);
 assert.deepEqual(rows.map(row=>row.kind),['style','script']);
 assert.equal(rows[1].placement,'body');assert.doesNotThrow(()=>new vm.Script(rows[1].text));
 assert.match(rows[1].text,/data:image\/png;base64,/);assert.match(rows[1].text,/data:image\/jpeg;base64,/);
 assert.doesNotMatch(rows[1].text,/<\/script|https?:\/\/|fetch\(|XMLHttpRequest/);
});
test('disabled bundle contributes no rows and malformed event input does not break boot',()=>{
 assert.deepEqual(buildInjectionRows({enabled:false}),[]);
 let callback;apply({on:(_,fn)=>callback=fn},{enabled:false});
 assert.doesNotThrow(()=>callback(null));const rows=[];callback(rows);assert.deepEqual(rows,[]);
});
test('configuration is allowlisted, escaped and bounded',()=>{
 const rows=buildInjectionRows({opacity:15,secret:'must-not-appear',petEnabled:false,backgroundEnabled:false});
 assert.match(rows[1].text,/"opacity":0.8/);assert.match(rows[1].text,/"petEnabled":false/);
 assert.doesNotMatch(rows[1].text,/must-not-appear/);
});
test('distribution declares both packaged images and uses an independent bundle identity',()=>{
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));
 assert.equal(pkg.name,'dsh-work-pet');assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml');
 assert.ok(pkg.files.includes('assets'));assert.ok(pkg.files.includes('THIRD_PARTY_NOTICES.md'));assert.equal(pkg.dependencies,undefined);
 for(const image of ['IMG3576.png','IMG3575.jpg'])assert.ok(fs.statSync(new URL('../assets/'+image,import.meta.url)).size>0);
});
