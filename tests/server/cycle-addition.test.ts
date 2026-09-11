import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../../src/server/app';import type {Actor} from '../../src/server/repository';import {cycleAddition} from '../../src/shared/cycle-addition';import {matchesFilter as clientFilter} from '../../src/client/query';
test('cycle additions capture assignment time and distinguish the strict first 24 hours and cycle completion',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'cycle-addition@example.test',password:'owner-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-03-02T12:00:00Z')};
 const team=repo.all('teams',actor.workspaceId)[0],cycle=repo.create(actor,'cycles',{name:'Sprint',teamId:team.id,startDate:'2026-03-02T12:00:00Z',endDate:'2026-03-09T12:00:00Z'}),at=(v:string)=>({...actor,now:new Date(v)});
 const planned=repo.create(at('2026-03-01T12:00:00Z'),'issues',{title:'Planned',teamId:team.id,cycleId:cycle.id,cycleAddedAt:'2099-01-01',cycleAddition:'afterCycle'}),edge=repo.create(at('2026-03-03T12:00:00Z'),'issues',{title:'Boundary',teamId:team.id,cycleId:cycle.id}),late=repo.create(at('2026-03-03T12:00:01Z'),'issues',{title:'Added later',teamId:team.id,cycleId:cycle.id});
 assert.equal(planned.cycleAddedAt,'2026-03-01T12:00:00.000Z');assert.equal(cycleAddition(edge,cycle),'duringCycle');assert.equal(cycleAddition(late,cycle),'duringCycle');
 const filter=(value:string)=>({conditions:[{field:'cycleAddition',operator:'eq',value}],match:'all' as const});
 assert.deepEqual(new Set(repo.list(actor,'issues',{filter:filter('planned')}).nodes.map(i=>i.id)),new Set([planned.id]));assert.deepEqual(new Set(repo.list(actor,'issues',{filter:filter('duringCycle')}).nodes.map(i=>i.id)),new Set([edge.id,late.id]));
 assert.equal(clientFilter(late as any,filter('duringCycle'),[],[],[cycle as any]),true);
 const edit=repo.update(at('2026-03-06T12:00:00Z'),'issues',planned.id,{title:'Still planned',cycleId:cycle.id,cycleAddedAt:'2099-01-01'});assert.equal(edit.cycleAddedAt,planned.cycleAddedAt);
 repo.update(actor,'issues',planned.id,{cycleId:null});assert.equal(repo.raw('issues',planned.id)!.cycleAddedAt,null);const readded=repo.update(at('2026-03-10T12:00:00Z'),'issues',planned.id,{cycleId:cycle.id});assert.equal(cycleAddition(readded,cycle),'afterCycle');
 const movedCycle=repo.update(at('2026-03-01T12:00:00Z'),'cycles',cycle.id,{startDate:'2026-03-04T12:00:00Z'});assert.equal(repo.list(actor,'issues',{filter:filter('planned')}).nodes.length,2);assert.equal(clientFilter(late as any,filter('planned'),[],[],[movedCycle as any]),true);
 assert.equal(cycleAddition({cycleId:cycle.id},cycle),null);assert.equal(cycleAddition({cycleAddedAt:late.cycleAddedAt},cycle),null);
 }finally{await app.close()}
});

test('routing and SLA rules use the same Added to cycle boundary for new and reassigned issues',async()=>{
 const app=createApp({databasePath:':memory:',port:0});try{
 const setup=await app.auth.setup({name:'Owner',email:'cycle-rules@example.test',password:'owner-password'}),repo=app.repo,actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['admin'],now:new Date('2027-01-01T00:00:00Z')};
 const team=repo.all('teams',actor.workspaceId)[0];repo.update(actor,'teams',team.id,{triageEnabled:true});const cycle=repo.create(actor,'cycles',{name:'Rule cycle',teamId:team.id,startDate:'2027-01-10T00:00:00Z',endDate:'2027-01-17T00:00:00Z'}),filter=(value:string)=>({conditions:[{field:'cycleAddition',operator:'eq',value}],match:'all'});
 for(const [value,priority] of [['planned',3],['duringCycle',1]] as const)repo.create(actor,'automations',{name:value,type:'routing',teamId:team.id,filter:filter(value),set:{priority}});
 const plannedPolicy=repo.create(actor,'slaPolicies',{name:'Planned SLA',teamId:team.id,action:'apply',duration:48,durationUnit:'hour',filter:filter('planned')}),latePolicy=repo.create(actor,'slaPolicies',{name:'Added SLA',teamId:team.id,action:'apply',duration:2,durationUnit:'hour',filter:filter('duringCycle')});
 const at=(v:string)=>({...actor,now:new Date(v)}),planned=repo.create(at('2027-01-10T23:59:59Z'),'issues',{title:'Planned rule',teamId:team.id,statusId:repo.all('statuses',actor.workspaceId).find(s=>s.teamId===team.id&&s.type==='triage')!.id,cycleId:cycle.id}),late=repo.create(at('2027-01-11T00:00:01Z'),'issues',{title:'Late rule',teamId:team.id,statusId:repo.all('statuses',actor.workspaceId).find(s=>s.teamId===team.id&&s.type==='triage')!.id,cycleId:cycle.id});
 assert.equal(planned.priority,3);assert.equal(planned.slaPolicyId,plannedPolicy.id);assert.equal(late.priority,1);assert.equal(late.slaPolicyId,latePolicy.id);assert.equal(late.slaDueAt,'2027-01-11T02:00:01.000Z');
 const unassigned=repo.create(actor,'issues',{title:'No cycle rule',teamId:team.id,statusId:repo.all('statuses',actor.workspaceId).find(s=>s.teamId===team.id&&s.type==='triage')!.id});assert.equal(unassigned.priority,0);assert.equal(unassigned.slaDueAt,undefined);
 const assigned=repo.update(at('2027-01-12T00:00:00Z'),'issues',unassigned.id,{cycleId:cycle.id});assert.equal(assigned.priority,1);assert.equal(assigned.slaPolicyId,latePolicy.id);
 }finally{await app.close()}
});

test('cycle classification uses exact start grace and actual completion boundaries',()=>{const cycle={id:'c',startDate:'2027-01-01T00:00:00Z',endDate:'2027-01-15T00:00:00Z',completedAt:'2027-01-10T00:00:00Z'},classify=(at:string,c=cycle)=>cycleAddition({cycleId:'c',cycleAddedAt:at},c);assert.equal(classify('2027-01-01T23:59:59.999Z'),'planned');assert.equal(classify('2027-01-02T00:00:00Z'),'duringCycle');assert.equal(classify('2027-01-09T23:59:59.999Z'),'duringCycle');assert.equal(classify('2027-01-10T00:00:00Z'),'afterCycle');assert.equal(classify('2027-01-12T00:00:00Z',{...cycle,completedAt:''}),null);assert.equal(cycleAddition({cycleId:'c',cycleAddedAt:'2027-01-14T23:59:59.999Z'},{...cycle,completedAt:null}),'duringCycle');assert.equal(cycleAddition({cycleId:'c',cycleAddedAt:'2027-01-15T00:00:00Z'},{...cycle,completedAt:null}),'afterCycle');});
