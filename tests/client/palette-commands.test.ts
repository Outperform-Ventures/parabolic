import test from 'node:test';
import assert from 'node:assert/strict';
import {availablePaletteCommands,retainedPaletteCommands} from '../../src/client/palette-commands';
test('global command inventory exposes native quick-open, search, drafts and template workflows without destructive issue actions',()=>{
 const rows=retainedPaletteCommands({issue:false});
 for(const value of ['issue','project','document','team','user','cycle','view','initiative','customer','favorite','workspace'])assert.ok(rows.some(row=>row.command.command==='open-picker'&&row.command.value===value));
 assert.ok(rows.some(row=>row.label==='Find in view'&&row.command.command==='find-in-page'));
 assert.ok(rows.some(row=>row.command.command==='new-issue-template'));
 for(const [label,command] of [
  ['Open tab','open-tab-menu'],['Close tab','close-tab'],['Next tab','next-tab'],
  ['Previous tab','previous-tab'],['Pin tab','pin-tab'],['Close other tabs','close-other-tabs'],
  ['Go to advanced search','search'],['Log out','logout'],
 ])assert.ok(rows.some(row=>row.label===label&&row.command.command===command));
 assert.ok(!rows.some(row=>row.command.command==='delete-issue'));
 assert.equal(new Set(rows.map(row=>row.label)).size,rows.length);
});
test('selected issue command inventory reuses property and subscriber handlers and limits shared issue controls',()=>{
 const normal=retainedPaletteCommands({issue:true,list:true}),shared=retainedPaletteCommands({issue:true,shared:true});
 for(const field of ['statusId','priority','assigneeId','labelIds','projectId','teamId','cycleId'])assert.ok(normal.some(row=>row.command.command==='edit-property'&&row.command.field===field));
 assert.ok(normal.some(row=>row.command.command==='manage-subscribers'));
 assert.ok(normal.some(row=>row.command.command==='add-filter'));
 assert.ok(normal.some(row=>row.label==='Select all'&&row.command.command==='select-all'&&row.shortcut==='⌘ A'));
 assert.ok(shared.some(row=>row.command.command==='toggle-subscription'));
 for(const name of ['delete-issue','manage-subscribers'])assert.ok(!shared.some(row=>row.command.command===name));
 for(const field of ['teamId','projectId','cycleId','parentId'])assert.ok(!shared.some(row=>row.command.field===field));
});

test('guest command availability removes workspace-only actions from defaults and search',()=>{
 const source=['Create new issue','Create new project','Create new document','Create view','Create new customer','Create new initiative','Create new label','Create new issue template','Go to recently deleted issues','Invite to Parabolic','Open issue','Open settings'].map(label=>({label}));
 const joined=availablePaletteCommands(source,{guest:true,canCreate:true});
 assert.deepEqual(joined.map(row=>row.label),['Create new issue','Create new project','Create new document','Create view','Open issue','Open settings']);
 const withoutTeam=availablePaletteCommands(source,{guest:true,canCreate:false});
 assert.deepEqual(withoutTeam.map(row=>row.label),['Open issue','Open settings']);
 assert.equal(availablePaletteCommands(source,{guest:false,canCreate:true}),source);
});

import {joinedSidebarTeams} from '../../src/client/sidebar-teams';
import type {Entity} from '../../src/shared/types';
test('Your teams includes joined and owned teams, excludes merely visible and departed teams',()=>{
 const teams=[{id:'owner',ownerId:'me'},{id:'member',memberIds:['me']},{id:'membership'},{id:'left'},{id:'visible',memberIds:['other']},{id:'archived',ownerId:'me',archivedAt:'now'}]as unknown as Entity[];
 const memberships=[{id:'joined',userId:'me',teamId:'membership'},{id:'left',userId:'me',teamId:'left',deletedAt:'now'}]as unknown as Entity[];
 assert.deepEqual(joinedSidebarTeams(teams,memberships,'me').map(team=>team.id),['owner','member','membership']);
});
