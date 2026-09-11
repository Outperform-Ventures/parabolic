import test from 'node:test';import assert from 'node:assert/strict';
import {activityStatusChange,groupActivityStatusChanges} from '../../src/client/issue-activity-status';
const statuses:any[]=[{id:'backlog',teamId:'a',name:'Backlog'},{id:'started',teamId:'a',name:'In Progress'},{id:'done',teamId:'a',name:'Done'}];
test('status event uses its recorded destination and preserves exact transition wording',()=>{
 const result=activityStatusChange({changes:{statusId:{from:'backlog',to:'started'}}} as any,statuses,'a');
 assert.equal(result?.status?.id,'started');assert.equal(result?.message,'moved from Backlog to In Progress');
 assert.equal(activityStatusChange({changes:{priority:{from:0,to:1}}} as any,statuses,'a'),undefined);
});
test('continuous status chains retain originals and stop at other events, actors or missing links',()=>{
 const a:any={id:'a',actorId:'one',changes:{statusId:{from:'backlog',to:'started'}}},b:any={id:'b',actorId:'one',changes:{statusId:{from:'started',to:'done'}}};
 assert.deepEqual(groupActivityStatusChanges([a,b],statuses,'a'),[[a,b]]);
 for(const separator of [{id:'other',actorId:'one',action:'update'},{...b,actorId:'two'},{...b,changes:{statusId:{from:'backlog',to:'done'}}}])assert.equal(groupActivityStatusChanges([a,separator,b] as any,statuses,'a')[0].length,1);
 assert.equal(groupActivityStatusChanges([{...a,actorId:undefined},{...b,actorId:undefined}],statuses,'a').length,2);
});
test('observed imported changes resolve only an unambiguous team-local status',()=>{
 const event:any={sourceAnchor:'update-abc-state-change',sourceObservedText:'moved from Backlog to In Progress'};
 assert.equal(activityStatusChange(event,statuses,'a')?.status?.id,'started');
 assert.equal(activityStatusChange(event,[...statuses,{id:'duplicate',teamId:'a',name:'In Progress'}] as any,'a'),undefined);
 assert.equal(activityStatusChange(event,statuses,'b'),undefined);
});
