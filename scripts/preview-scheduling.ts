// Disposable, loopback-only feature preview. Never opens the user's database.
import {resolve} from 'node:path';
import {createApp} from '../src/server/app';
import {dashboardStarter} from '../src/client/features/dashboard-presets';
const app=createApp({databasePath:':memory:',host:'127.0.0.1',port:0,staticDir:resolve('dist')});
const {url}=await app.start();
const response=await fetch(url+'/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Preview',email:'preview@example.test',password:'preview-only-fixture'})});
const cookie=response.headers.get('set-cookie')?.split(';')[0]||'';
const state=await(await fetch(url+'/api/v1/state',{headers:{cookie}})).json();
const actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},team=state.teams[0];
const customer=app.repo.create(actor,'customers',{name:'Acme Studio'}),project=app.repo.create(actor,'projects',{name:'Autumn launch',teamIds:[team.id],directCustomerIds:[customer.id],startDate:'2026-09-07',targetDate:'2026-09-25',color:'#5d80d6'});
const first=app.repo.create(actor,'issues',{title:'Finish customer onboarding',teamId:team.id,projectId:project.id,estimate:4,startDate:'2026-09-07',dueDate:'2026-09-11',priority:2});
app.repo.create(actor,'issues',{title:'Ship the new dashboard',teamId:team.id,projectId:project.id,estimate:8,startDate:'2026-09-14',dueDate:'2026-09-18',relations:[{type:'blockedBy',issueId:first.id}]});
app.repo.create(actor,'issues',{title:'Review customer feedback',teamId:team.id,projectId:project.id,dueDate:'2026-09-16',estimate:2});
app.repo.create(actor,'issues',{title:'Plan the next release',teamId:team.id});
const view=app.repo.create(actor,'views',{name:'Launch schedule',entityType:'issues',visibility:'workspace',layout:'Calendar',display:{layout:'calendar',scheduleAnchor:'2026-09-13',groupBy:'none',showEmpty:false}});
app.repo.create(actor,'dashboards',{name:'Work overview',visibility:'workspace',ownerId:actor.userId,widgets:dashboardStarter('overview',state.statuses)});
console.log(JSON.stringify({url,viewUrl:url+'/view/'+view.id}));
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>void app.close().then(()=>process.exit(0)));
