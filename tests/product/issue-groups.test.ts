import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,type Entity} from '../../src/shared/types';
import {groupIssues,issueGroupCreationDefaults,issueGroupPatch,acceptsIssueGroupPath,nestIssueGroups} from '../../src/client/issue-groups';
test('focus order separates completed urgency, outstanding SLA, blockers and active work',()=>{
 const data=emptyData();data.statuses=[{id:'todo',type:'unstarted'},{id:'done',type:'completed'}]as unknown as Entity[];
 const issues=[{id:'completed',statusId:'done',priority:1},{id:'active',statusId:'todo',priority:2},{id:'sla',statusId:'todo',slaDueAt:'2099-01-01'},{id:'urgent',statusId:'todo',priority:1},{id:'blocker',statusId:'todo',relations:[{type:'blocks',issueId:'active'}]}]as unknown as Entity[];data.issues=issues;
 assert.deepEqual(groupIssues(issues,'focus',data).map(g=>[g.id,g.issues[0].id]),[['urgent','urgent'],['sla','sla'],['blockers','blocker'],['active','active'],['completed','completed']]);
});
test('dragging a grouped label replaces its sibling and team moves use the destination workflow',()=>{
 const data=emptyData();data.labels=[{id:'frontend',group:'Component',teamId:'a'},{id:'backend',group:'Component',teamId:'a'},{id:'shared'}]as unknown as Entity[];data.statuses=[{id:'a-started',teamId:'a',type:'started'},{id:'b-started',teamId:'b',type:'started'}]as unknown as Entity[];const issue={id:'issue',teamId:'a',statusId:'a-started',labelIds:['frontend','shared']}as unknown as Entity;
 assert.deepEqual(issueGroupPatch('labelIds','backend',data,issue),{labelIds:['shared','backend']});assert.deepEqual(issueGroupPatch('priority','0',data),{priority:0});assert.deepEqual(issueGroupPatch('teamId','b',data,issue),{teamId:'b',statusId:'b-started',cycleId:null,labelIds:['shared']});
});

test('upstream project labels group issues without copying or exposing deleted labels',()=>{
 const data=emptyData();data.labels=[{id:'a',name:'Enterprise',entityType:'projects'},{id:'b',name:'Large',entityType:'projects',archivedAt:'today'},{id:'c',name:'Unused',entityType:'projects'},{id:'deleted',entityType:'projects',deletedAt:'today'},{id:'issue',entityType:'issues'}]as unknown as Entity[];
 data.projects=[{id:'p',labelIds:['a','b','a','deleted','issue']}]as unknown as Entity[];const issues=[{id:'linked',projectId:'p'},{id:'missing',projectId:'unreadable'},{id:'none'}]as unknown as Entity[];
 assert.deepEqual(groupIssues(issues,'projectLabelIds',data).map(g=>[g.id,g.issues.map(i=>i.id)]),[['a',['linked']],['b',['linked']],['none',['missing','none']]]);
 assert.deepEqual(groupIssues([], 'projectLabelIds',data,undefined,true).map(g=>g.id),['a','c','none']);
 assert.deepEqual(issueGroupPatch('projectLabelIds','a',data,issues[0]),{});
 assert.equal(acceptsIssueGroupPath([{field:'projectLabelIds',id:'a'}],issues[0],data),true);
 assert.equal(acceptsIssueGroupPath([{field:'projectLabelIds',id:'c'}],issues[0],data),false);
 assert.equal(acceptsIssueGroupPath([{field:'projectLabelIds',id:'none'}],issues[1],data),true);
 assert.equal(nestIssueGroups(issues,'projectLabelIds','priority',data).columns[0].subgroups?.[0].issues.length,1);
});

test('creation from historical label buckets retains the other grouping dimension without retired labels',()=>{
 const data=emptyData();data.labels=[{id:'active'},{id:'archived',archivedAt:'today'},{id:'deleted',deletedAt:'today'},{id:'project',entityType:'projects'}] as Entity[];
 for(const id of ['archived','deleted','missing','project'])assert.deepEqual(issueGroupCreationDefaults({path:[{field:'labelIds',id},{field:'priority',id:'1'}]},data),{labelIds:[],priority:1});
 assert.deepEqual(issueGroupCreationDefaults({path:[{field:'labelIds',id:'active'},{field:'priority',id:'2'}]},data),{labelIds:['active'],priority:2});
 assert.deepEqual(issueGroupPatch('labelIds','archived',data,{id:'issue',workspaceId:'workspace',createdAt:'today',updatedAt:'today',version:1,labelIds:['archived']}),{labelIds:['archived']});
});

test('archived label destinations reject new assignments but retain historical editing',()=>{const data=emptyData();data.labels=[{id:'retired',workspaceId:'workspace',createdAt:'today',updatedAt:'today',version:1,archivedAt:'today'}];const path=[{field:'labelIds',id:'retired'},{field:'priority',id:'1'}];assert.equal(acceptsIssueGroupPath(path,{labelIds:[]} as unknown as Entity,data),false);assert.equal(acceptsIssueGroupPath(path,{labelIds:['retired']} as unknown as Entity,data),true);assert.equal(acceptsIssueGroupPath([{field:'labelIds',id:'missing'}],{labelIds:[]} as unknown as Entity,data),false);});
