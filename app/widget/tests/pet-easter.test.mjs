import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={};vm.runInNewContext(fs.readFileSync(new URL('../desktop/ui/pet-easter.js',import.meta.url),'utf8'),sandbox);
const {create,phrases}=sandbox.MutsumiEaster;
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};}
for(let goal=2;goal<=5;goal++)test(`Easter egg triggers exactly on click ${goal} and starts a new round`,()=>{
 const values=[(goal-2)/4,.1,.99];const counter=create(storage(),()=>values.shift()??0);
 for(let i=1;i<goal;i++)assert.equal(counter.click(),'');
 assert.equal(counter.click(),phrases[0]);assert.equal(counter.state().count,0);assert.equal(counter.state().goal,5);
 assert.equal(counter.click(),'');
});
test('Each supplied phrase can be selected, with no prefix or extra text',()=>{
 for(let i=0;i<4;i++){const values=[0,(i+.1)/4,0];const counter=create(storage(),()=>values.shift()??0);counter.click();assert.equal(counter.click(),phrases[i]);}
});
test('Counter and goal survive restart; unknown stored state is repaired',()=>{
 const store=storage();let counter=create(store,()=>.99);counter.click();counter.click();counter=create(store,()=>0);
 assert.equal(counter.state().count,2);assert.equal(counter.state().goal,5);counter.click();counter.click();assert.equal(counter.click(),phrases[0]);
 store.setItem('dshw-easter-count','99');store.setItem('dshw-easter-goal','n/a');counter=create(store,()=>0);assert.equal(counter.state().count,0);assert.equal(counter.state().goal,2);
});
