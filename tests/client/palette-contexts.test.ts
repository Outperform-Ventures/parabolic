import test from 'node:test';
import assert from 'node:assert/strict';
import {retainedPaletteCommands} from '../../src/client/palette-commands';

test('selection count suppresses single-issue history while retaining bulk property dispatch',()=>{
 const none=retainedPaletteCommands({issue:false,list:true,count:0});
 const one=retainedPaletteCommands({issue:true,list:true,count:1});
 const many=retainedPaletteCommands({issue:true,list:true,count:2});
 assert.ok(!none.some(row=>row.command.command==='edit-property'));
 assert.ok(one.some(row=>row.command.command==='issue-description-history'));
 assert.ok(!many.some(row=>row.command.command==='issue-description-history'));
 for(const field of ['statusId','assigneeId','priority','labelIds'])assert.ok(many.some(row=>row.command.command==='edit-property'&&row.command.field===field));
});

test('shared issue command projection excludes destructive and scope-changing actions',()=>{
 const rows=retainedPaletteCommands({issue:true,shared:true,list:true,count:2});
 for(const command of ['delete-issue','manage-subscribers'])assert.ok(!rows.some(row=>row.command.command===command));
 for(const field of ['teamId','projectId','cycleId','parentId'])assert.ok(!rows.some(row=>row.command.field===field));
 assert.ok(!rows.some(row=>row.command.command==='add-relation'&&row.command.value==='duplicate'));
 assert.ok(rows.some(row=>row.command.command==='edit-property'&&row.command.field==='statusId'));
});

test('project selection count preserves bulk actions without single-project rename',()=>{
 const one=retainedPaletteCommands({issue:false,project:true,count:1});
 const many=retainedPaletteCommands({issue:false,project:true,count:2});
 assert.ok(one.some(row=>row.command.command==='rename-project'));
 assert.ok(!many.some(row=>row.command.command==='rename-project'));
 for(const command of ['archive-projects','favorite-projects','copy-project-links'])assert.ok(many.some(row=>row.command.command===command));
});

test('single project commands retain native labels and backed dispatch identities',()=>{
 const rows=retainedPaletteCommands({issue:false,project:true,count:1,projectSubscribed:false});
 const expected:Record<string,string>={'Edit project':'edit-selected-project','Change project dependencies':'edit-project-dependencies','Create new document for project':'new-project-document','Open project updates and activity':'open-updates','Remind me about project':'remind','Subscribe to project notifications':'toggle-subscription','Create new project milestone':'new-project-milestone','Copy project URL':'copy-entity-url','Copy project title':'copy-entity-title','Copy project title as link':'copy-project-links'};
 for(const [label,command] of Object.entries(expected))assert.equal(rows.find(row=>row.label===label)?.command.command,command,label);
 assert.equal(retainedPaletteCommands({issue:false,project:true,count:1,projectSubscribed:true}).find(row=>row.command.command==='toggle-subscription')?.label,'Unsubscribe from project notifications');
});

import {contextualPaletteItems} from '../../src/client/palette-contexts';
test('native selected issue actions precede global actions and use plural labels without duplicating source handlers',()=>{
 const source=['Create new issue','Change assignee','Assign to me','Change status','Change priority','Change project','Change labels','Change estimate','Change team','Change due date','Copy issue ID','Copy issue URL','Copy issue title','Copy issue title as link','Manage subscribers'].map(label=>({label,action:()=>label}));
 const rows=contextualPaletteItems(source,{issueCount:2,assignedToMe:true});
 assert.deepEqual(rows.slice(0,9).map(row=>row.label),['Assign to…','Un-assign from me','Change status…','Change priority…','Add to project…','Add labels…','Change estimate…','Move to a different team…','Set due date…']);
 assert.equal(rows[9].label,'Copy issue IDs');assert.equal(rows[10].label,'Copy issue URLs');assert.equal(rows[11].label,'Copy issue titles');assert.equal(rows[12].label,'Copy titles as links');assert.equal(rows[0].action,source[1].action);assert.equal(rows.at(-1)?.label,'Create new issue…');
 assert.equal(new Set(rows.map(row=>row.action)).size,rows.length);
});
test('native project route starts with project creation and restores retained virtualized template/navigation tail',()=>{
 const rows=contextualPaletteItems(['Create new issue','Create new project','Find in view','Search workspace','Add filter','Create new document template','Open issue','Open user…'].map(label=>({label})),{projects:true});
 assert.equal(rows[0].label,'Create new project…');
 assert.deepEqual(rows.filter(row=>row.section==='Filter').map(row=>row.label),['Search workspace…','Add Filter…','Find in view…']);
 assert.ok(rows.some(row=>row.label==='Create new document template…'));assert.ok(rows.some(row=>row.label==='Open issue…'&&row.shortcut==='O I'));
});
test('context projection never reinstates omitted shared or guest commands',()=>{
 const rows=contextualPaletteItems([{label:'Change status'},{label:'Create new issue'},{label:'Copy issue ID'}],{issueCount:1});
 assert.deepEqual(rows.map(row=>row.label),['Change status…','Copy issue ID','Create new issue…']);
});
test('team context follows native overview and issue-detail section order',()=>{
 const source=['Add document to team overview…','Create new issue','Create new initiative','Favorite team','Copy team title','Copy title as link','Add customer request'].map(label=>({label}));
 const overview=contextualPaletteItems(source,{teamLabel:'Ops',teamOverview:true});
 assert.deepEqual(overview.slice(0,2).map(row=>[row.section,row.label]),[['Team overview','Add document to team overview…'],['Issues','Create new issue…']]);
 assert.deepEqual(overview.filter(row=>row.section==='Team ⋅ Ops').map(row=>row.label),['Copy team title','Copy title as link']);
 assert.deepEqual(overview.filter(row=>row.section==='Favorites').map(row=>row.label),['Favorite page']);
 const issue=contextualPaletteItems(source,{issueCount:1,issueLabel:'OPS-23 ⋅ Clone Parabolic',teamLabel:'Ops'});
 assert.deepEqual(issue.filter(row=>row.section==='Team ⋅ Ops').map(row=>row.label),['Favorite team','Copy team title','Copy title as link']);
});

test('issue detail projection matches the preserved native relation and filter inventory',()=>{
 const commands=['Manage subscribers','Mark issue as','Remove all subscribers','Find in view','Search workspace'].map(label=>({label}));
 const rows=contextualPaletteItems(commands,{issueCount:1,issueLabel:'ENG-1 · Example',issueDetail:true});
 assert.ok(rows.some(row=>row.label==='Mark issue as…'&&row.section==='ENG-1 · Example'));
 assert.ok(!rows.some(row=>row.label==='Remove all subscribers'));
 assert.ok(!rows.some(row=>row.label==='Find in view…'));
 assert.ok(rows.some(row=>row.label==='Search workspace…'));
});
test('backed retained command tail projects in native navigation order',()=>{
 const labels=['Go to advanced search','Open settings','Toggle sidebar','Open tab','Close tab','New tab','Next tab','Previous tab','Pin tab','Close other tabs','Select all','Copy page URL','Keyboard shortcuts','Log out'];
 const rows=contextualPaletteItems(labels.map(label=>({label})));
 assert.deepEqual(rows.map(row=>row.label),['Go to advanced search','Go to settings','Collapse navigation sidebar','Open tab…','Close tab','New tab','Next tab','Previous tab','Pin tab','Close other tabs','Select all','Copy page URL','Open Keyboard Shortcuts Cheat Sheet','Log out']);
});

test('single project projection follows the captured native project command inventory',()=>{
 const labels=['Edit project','Change project status','Change project priority','Change project labels','Change project target date','Change project start date','Change project dependencies','Rename project','Create new document for project','Open project updates and activity','Add customer request','Remind me about project','Change project lead','Change project members','Change project teams','Favorite project','Subscribe to project notifications','Copy project URL','Copy project title','Copy project title as link','Copy project as Markdown','Delete project','Create new project milestone'];
 const rows=contextualPaletteItems(labels.map(label=>({label,dispatch:label})),{projects:true,projectCount:1,projectLabel:'Honey Rock Group'});
 assert.deepEqual(rows.filter(row=>row.section==='Project ⋅ Honey Rock Group').map(row=>row.label),['Edit project…','Change project status…','Change project priority…','Add labels…','Set project target date…','Set project start date…','Change project dependencies…','Rename project','Create new document…','Open project updates and activity','Add customer request to project…','Remind me about this project…','Set project lead…','Change project members…','Change project teams…','Favorite project','Subscribe to project notifications…','Copy project URL','Copy project title','Copy title as link','Copy project overview as Markdown','Delete project','Create new project milestone…']);
 assert.equal(rows[0].section,'Project ⋅ Honey Rock Group');
 assert.equal(new Set(rows.map(row=>row.dispatch)).size,rows.length);
});
