import test from 'node:test';
import assert from 'node:assert/strict';
import {issueDefaultsFromLink} from '../../src/client/new-issue-defaults';
test('creation links honor explicit team and field defaults, inherit ancestor templates and reject archived or unrelated templates',()=>{
 const data:any={teams:[{id:'parent',name:'Parent'},{id:'child',name:'Child',parentId:'parent'},{id:'other',name:'Other'}],templates:[{id:'template',name:'Inherited',type:'issue',teamId:'parent',properties:{teamId:'parent',priority:3,title:'Default'},description:'<p>Prompt</p>'},{id:'archived',name:'Archived',teamId:'child',archivedAt:'2026-01-01'},{id:'wrong',name:'Wrong',teamId:'other'}],projects:[],statuses:[],users:[],cycles:[],labels:[{id:'label',name:'Inherited label',teamId:'parent'},{id:'old',name:'Old label',archivedAt:'2026-01-01'}],milestones:[]};
 const defaults=issueDefaultsFromLink(new URLSearchParams({team:'child',template:'template',priority:'urgent',title:'Explicit',labels:'Inherited label,Old label'}),data);
 assert.equal(defaults.teamId,'child');assert.equal(defaults.templateId,'template');assert.equal(defaults.priority,1);assert.equal(defaults.title,'Explicit');assert.deepEqual(defaults.labelIds,['label']);
 for(const template of ['wrong','archived'])assert.equal(issueDefaultsFromLink(new URLSearchParams({team:'child',template}),data).templateId,undefined);
});
