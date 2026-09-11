import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShortcut, type ShortcutContext, type ShortcutEvent } from '../../src/client/keyboard.ts';
const context: ShortcutContext = { scope: 'list', entity: 'issue', teamId: 'eng' };
const key = (value: string, extra: Partial<ShortcutEvent> = {}) => ({ key: value, ...extra });
test('Shortcut sequences resolve native navigation and expire safely', () => {
  const first = resolveShortcut(key('g'), context, null, 1000); assert.equal(first.preventDefault, true); assert.equal(first.action, null);
  assert.deepEqual(resolveShortcut(key('t'), context, first.pending, 1500).action, { command: 'navigate', route: '/team/eng/triage' });
  assert.equal(resolveShortcut(key('j'), context, first.pending, 1500).action?.command, 'focus-item');
  assert.equal(resolveShortcut(key('i'), context, first.pending, 2300).action?.command, 'assign-to-me');
  assert.equal(resolveShortcut(key('d'), context, first.pending, 1500).action?.command, 'open-drafts');
  assert.equal(resolveShortcut(key('x'),context,first.pending,1500).action?.route,'/archive?team=eng');
});
test('Cycles navigation follows the selected team eligibility', () => {
  const enabled = { ...context, cyclesEnabled: true };
  const enabledPrefix = resolveShortcut(key('g'), enabled, null, 1000);
  assert.deepEqual(resolveShortcut(key('c'), enabled, enabledPrefix.pending, 1100).action, { command: 'navigate', route: '/team/eng/cycles' });
  const disabled = { ...context, cyclesEnabled: false };
  const disabledPrefix = resolveShortcut(key('g'), disabled, null, 1000);
  assert.deepEqual(resolveShortcut(key('c'), disabled, disabledPrefix.pending, 1100).action, { command: 'new-issue' });
});
test('Preserved native settings and recently-viewed shortcuts resolve',()=>{
  const open=resolveShortcut(key('o'),context,null,1000);
  assert.deepEqual(resolveShortcut(key('s'),context,open.pending,1100).action,{command:'settings'});
  assert.deepEqual(resolveShortcut(key('y',{metaKey:true}),{...context,platform:'mac'}).action,{command:'open-recently-viewed'});
});
test('Issue, project and timeline scopes disambiguate shared keys', () => {
  assert.equal(resolveShortcut(key('p'), context).action?.field, 'priority');
  const project: ShortcutContext = { scope: 'project' }; const first = resolveShortcut(key('p'), project, null, 1000);
  assert.equal(resolveShortcut(key('s'), project, first.pending, 1100).action?.field, 'status');
  assert.equal(resolveShortcut(key('m'), { scope: 'timeline' }).action?.value, 'month');
  assert.equal(resolveShortcut(key('m'), { scope: 'issue' }).pending?.key, 'm');
  assert.deepEqual(resolveShortcut(key('j'), { scope: 'inbox', entity: 'issue' }).action, { command: 'focus-item', value: 'down' });
  assert.equal(resolveShortcut(key('Backspace'), { scope: 'inbox', entity: 'issue' }).action?.command, 'delete-notification');
  assert.equal(resolveShortcut(key('s', {shiftKey:true}), { scope: 'inbox', entity: 'issue' }).action?.command, 'toggle-subscription');
  assert.equal(resolveShortcut(key('r',{ctrlKey:true}),context).action?.command,'new-customer-request');
  assert.equal(resolveShortcut(key('r',{ctrlKey:true,altKey:true}),{scope:'project',platform:'other'}).action?.command,'new-customer-request');
  assert.equal(resolveShortcut(key('r',{ctrlKey:true}),{scope:'project',platform:'other'}).action,null);
});
test('Editable focus preserves editor formatting and typing while allowing app tabs', () => {
  const editor: ShortcutContext = { ...context, typing: 'editor' };
  for (const value of ['b', 'i', 'u', 'k']) assert.equal(resolveShortcut(key(value, { metaKey: true }), editor).action, null);
  assert.equal(resolveShortcut(key('c'), editor).action, null);
  assert.equal(resolveShortcut(key('t', { metaKey: true }), editor).action?.command, 'new-tab');
  assert.equal(resolveShortcut(key('Enter', { metaKey: true }), editor).action, null);
  assert.equal(resolveShortcut(key('z',{metaKey:true}),editor).action,null);
  assert.equal(resolveShortcut(key('z',{metaKey:true}),context).action?.command,'undo');
  assert.equal(resolveShortcut(key('z',{metaKey:true,shiftKey:true}),context).action?.command,'redo');
  assert.equal(resolveShortcut(key('y',{ctrlKey:true}),{...context,platform:'other'}).action?.command,'redo');
  assert.equal(resolveShortcut(key('o',{metaKey:true,shiftKey:true}),editor).action?.command,'new-sub-issue');
  assert.equal(resolveShortcut(key('Enter', { metaKey: true }), { ...editor, submitOnCommandEnter: true }).action?.command, 'submit');
  assert.equal(resolveShortcut(key('c', { isComposing: true }), context).action, null);
});
test('Mac option characters and shifted punctuation normalize from physical key metadata', () => {
  assert.equal(resolveShortcut(key('ç', { code: 'KeyC', altKey: true }), context).action?.command, 'new-issue-template');
  assert.equal(resolveShortcut(key('<', { code: 'Comma', metaKey: true, shiftKey: true }), context).action?.command, 'copy-entity-url');
  assert.equal(resolveShortcut(key('?', { code: 'Slash', shiftKey: true }), context).action?.command, 'help-menu');
  assert.equal(resolveShortcut(key('{', { code: 'BracketLeft', metaKey: true, shiftKey: true }), context).action?.command, 'previous-tab');
});
test('Excluded hosted AI and coding navigation is absent', () => {
  for (const second of ['j', 'l', 'r']) {
    const plainContext: ShortcutContext = { scope: 'global' };
    const prefix = resolveShortcut(key('g'), plainContext, null, 1000);
    assert.equal(resolveShortcut(key(second), plainContext, prefix.pending, 1100).action, null);
  }
  assert.equal(resolveShortcut(key('p', { metaKey: true, altKey: true }), context).action, null);
});
test('Modal focus and repeat guards prevent unintended mutations', () => {
  assert.equal(resolveShortcut(key('c'), { ...context, modalOpen: true }).action, null);
  assert.equal(resolveShortcut(key('c', { repeat: true }), context).action, null);
  assert.equal(resolveShortcut(key('ArrowDown', { repeat: true }), context).action?.command, 'focus-item');
  assert.equal(resolveShortcut(key('c', { ctrlKey: true }), { ...context, platform: 'other' }).action, null);
  assert.equal(resolveShortcut(key('k', { ctrlKey: true }), { ...context, platform: 'other' }).action?.command, 'command-menu');
});

test('Triage shortcuts require one triage issue and preserve editable and modal focus',()=>{
  const triage={...context,triageIssueId:'triage-issue'};
  for(const [value,command]of [['1','triage-accept'],['2','triage-duplicate'],['3','triage-decline'],['h','triage-snooze']]){
    assert.deepEqual(resolveShortcut(key(value),triage).action,{command,value:'triage-issue'});assert.notEqual(resolveShortcut(key(value),context).action?.command,command);assert.equal(resolveShortcut(key(value),{...triage,typing:'editor'}).action,null);assert.equal(resolveShortcut(key(value),{...triage,modalOpen:true}).action,null);
  }
});
test('H schedules all supported entity reminders while Inbox and triage keep contextual snooze',()=>{
 for(const entity of ['issue','document','project','initiative'] as const){assert.equal(resolveShortcut(key('h'),{...context,entity}).action?.command,'remind');assert.equal(resolveShortcut(key('h'),{...context,entity,typing:'editor'}).action,null);}
 assert.equal(resolveShortcut(key('h'),{scope:'inbox',entity:'issue'}).action?.command,'snooze-notification');assert.equal(resolveShortcut(key('h'),{...context,triageIssueId:'triage'}).action?.command,'triage-snooze');
 assert.equal(resolveShortcut(key('u',{metaKey:true}),{scope:'global',entity:'document'}).action,null);
});

test('Issue view Insights shortcut preserves editor formatting and modal focus',()=>{assert.equal(resolveShortcut(key('i',{metaKey:true,shiftKey:true}),context).action?.command,'toggle-insights');assert.equal(resolveShortcut(key('i',{ctrlKey:true,shiftKey:true}),{...context,platform:'other'}).action?.command,'toggle-insights');assert.equal(resolveShortcut(key('i',{metaKey:true,shiftKey:true}),{...context,typing:'editor'}).action,null);assert.equal(resolveShortcut(key('i',{metaKey:true,shiftKey:true}),{...context,modalOpen:true}).action,null);});

test('composition keys never dispatch global actions or preserve shortcut prefixes',()=>{for(const event of [{key:'k',metaKey:true,isComposing:true},{key:'k',metaKey:true,keyCode:229},{key:'Dead'},{key:'Process'}]){const result=resolveShortcut(event,context,{key:'g',at:1000},1100);assert.equal(result.action,null);assert.equal(result.pending,null);assert.equal(result.preventDefault,false);}});

test('Shift+X extends selection to the active list item without changing input mode',()=>{
 assert.deepEqual(resolveShortcut(key('x',{shiftKey:true}),{scope:'list'}).action,{command:'toggle-selection',value:'extend-current'});
});
