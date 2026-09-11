import test from 'node:test';
import assert from 'node:assert/strict';
import {retainedPaletteCommands} from '../../src/client/palette-commands';

test('native general command tail exposes only actions with existing dispatch handlers',()=>{
 const rows=retainedPaletteCommands({issue:false,list:true});
 const expected:Record<string,[string,string]>={
  'Open tab':['open-tab-menu','⌘ ⇧ A'],
  'Close tab':['close-tab','⌘ W'],
  'Next tab':['next-tab','⌘ ⇧ ]'],
  'Previous tab':['previous-tab','⌘ ⇧ ['],
  'Pin tab':['pin-tab','⌃ ⇧ P'],
  'Close other tabs':['close-other-tabs','⌘ ⌥ W'],
  'Close tabs to the right':['close-tabs-right',''],
  'Open recently viewed':['open-recently-viewed','⌘ Y'],
  'Open settings…':['settings','O S'],
  'Create or join a workspace':['create-workspace',''],
  'Go to advanced search':['search','/'],
  'Select all':['select-all','⌘ A'],
  'Log out':['logout','⌥ ⇧ Q'],
 };
 for(const [label,[command,shortcut]] of Object.entries(expected)){
  const row=rows.find(item=>item.label===label);
  assert.ok(row,label);
  assert.equal(row.command.command,command,label);
  assert.equal(row.shortcut,shortcut,label);
 }
 for(const label of ['Ask Parabolic','Open agent chat','Go to Agent','Export issues as CSV','Copy git branch name','Copy as prompt'])
  assert.ok(!rows.some(row=>row.label===label),label);
});

test('select-all remains list-scoped while global tab and session actions remain available',()=>{
 const global=retainedPaletteCommands({issue:false});
 assert.ok(!global.some(row=>row.command.command==='select-all'));
 for(const command of ['open-tab-menu','close-tab','next-tab','previous-tab','pin-tab','close-other-tabs','logout'])
  assert.ok(global.some(row=>row.command.command===command),command);
});

test('single private issue exposes the native grouped relation action',()=>{
 const rows=retainedPaletteCommands({issue:true,count:1});
 assert.equal(rows.filter(row=>row.label==='Mark issue as').length,1);
 assert.equal(rows.find(row=>row.label==='Mark issue as')?.command.command,'mark-issue-as');
 assert.ok(!retainedPaletteCommands({issue:true,count:2}).some(row=>row.label==='Mark issue as'));
 assert.ok(!retainedPaletteCommands({issue:true,count:1,shared:true}).some(row=>row.label==='Mark issue as'));
});

test('Batch 018 issue actions are backed and keep shared restrictions',()=>{
 const privateRows=retainedPaletteCommands({issue:true,count:1});
 assert.equal(privateRows.find(row=>row.label==='Show similar issues…')?.command.command,'show-similar-issues');
 assert.equal(privateRows.find(row=>row.label==='Convert into template…')?.command.command,'convert-issue-template');
 const shared=retainedPaletteCommands({issue:true,count:1,shared:true});
 assert.ok(shared.some(row=>row.label==='Show similar issues…'));
 assert.ok(!shared.some(row=>row.label==='Convert into template…'));
});
