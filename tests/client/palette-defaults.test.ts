import test from 'node:test';import assert from 'node:assert/strict';
import {defaultPaletteItems,paletteDefaultInventory} from '../../src/client/palette-defaults';
test('native empty-query sections and retained commands preserve source order and dispatch identity',()=>{
 const calls:string[]=[];const commands=[{label:'Open user',action:()=>calls.push('extra')},...paletteDefaultInventory.map(([,label])=>({label,action:()=>calls.push(label)}))];const rows=defaultPaletteItems(commands);
 assert.deepEqual([...new Set(rows.map(row=>row.section))],['Issues','Projects','Documents','Views','Initiatives','Customers','Filter','Templates']);
 assert.deepEqual(rows.map(row=>row.label),['Create new issue…','Create issue in fullscreen…','Create new label…','Create new project…','Create new document in…','Create view…','Create new initiative','Add customer request…','Create new customer…','Search workspace…','Find in view…','Add Filter…','Create new issue template…']);
 assert.equal(rows[0].shortcut,'C');assert.equal(rows[1].shortcut,'V');assert.equal(rows[11].shortcut,'F');rows[7].action();assert.deepEqual(calls,['Add customer request']);assert.equal(commands[0].label,'Open user');
});
test('permission/context omissions stay omitted and duplicate sources are not duplicated',()=>{
 const rows=defaultPaletteItems([{label:'Create new issue'},{label:'Create new issue'},{label:'Search workspace'}]);assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.section),['Issues','Filter']);assert.ok(!rows.some(row=>/customer|initiative|label/.test(row.label)));
});
