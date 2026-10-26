import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8');
test('durable portrait and easter values win over stale browser cache after restart',()=>{
 const saved={'dshw-mutsumi-index':'3','dshw-easter-count':'4','dshw-easter-goal':'5','dshw-low-dismissed':'["test-cycle"]','dshw-size':'140','dshw-new-setting':'kept'};
 const values=new Map([['dshw-mutsumi-index','0'],['dshw-easter-count','0'],['dshw-easter-goal','2'],['dshw-low-dismissed','[]'],['dshw-size','160']]);
 vm.runInNewContext(source,{require:()=>({contextBridge:{exposeInMainWorld(){}},ipcRenderer:{sendSync:channel=>channel==='whale-storage'?saved:null,on(){},send(){}}}),localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},document:{addEventListener(){}},process:{platform:'win32',argv:[]}});
 assert.equal(values.get('dshw-mutsumi-index'),'3');assert.equal(values.get('dshw-easter-count'),'4');assert.equal(values.get('dshw-easter-goal'),'5');
 assert.equal(values.get('dshw-low-dismissed'),'["test-cycle"]');assert.equal(values.get('dshw-size'),'160');assert.equal(values.get('dshw-new-setting'),'kept');
});
