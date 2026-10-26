import {test,expect,type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
import type {FilterSpec} from '../../src/client/query';

async function fixture(page:Page){
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Filter Owner',email:'multi-owner@example.test',password:'filter-password'}});
 const state=await page.request.get(url+'/api/v1/state').then(r=>r.json());
 const actor={workspaceId:state.workspaceId,userId:state.user.id,role:'owner',scopes:['admin']};
 const create=(kind:string,data:any)=>app.repo.create(actor,kind as any,data);
 const invitation=await page.request.post(url+'/api/v1/invitations',{data:{email:'multi-member@example.test',role:'member'}}).then(r=>r.json());
 const joined=await fetch(url+'/auth/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:invitation.token,name:'Filter Member',password:'filter-password'})}).then(r=>r.json());
 const users=[state.user,joined.user];
 const teams=[state.teams[0],create('teams',{name:'Second team',key:'SEC'})];
 for(const team of teams)app.repo.update(actor,'teams',team.id,{cycleEnabled:true});
 const statuses=app.repo.all('statuses',state.workspaceId);
 const labels=['Alpha label','Beta label'].map(name=>create('labels',{name,color:'#7775df'}));
 const projectLabels=['Alpha project label','Beta project label'].map(name=>create('labels',{name,entityType:'projects',color:'#7775df'}));
 const initiatives=['Alpha initiative','Beta initiative'].map(name=>create('initiatives',{name}));
 for(const name of ['Gold','Silver'])create('customerTiers',{name,color:'#7775df'});
 const customers=['Alpha customer','Beta customer'].map((name,i)=>create('customers',{name,ownerId:users[i].id,status:i?'Prospect':'Active',tier:i?'Silver':'Gold'}));
 const projects=['Alpha project','Beta project'].map((name,i)=>create('projects',{name,teamIds:teams.map(t=>t.id),status:i?'planned':'started',priority:i?4:2,leadId:users[i].id,labelIds:[projectLabels[i].id],initiativeIds:[initiatives[i].id],directCustomerIds:[customers[i].id]}));
 const templates=['Alpha template','Beta template'].map(name=>create('templates',{name,type:'issue'}));
 const cycles=['Alpha cycle','Beta cycle'].map((name,i)=>create('cycles',{name,teamId:teams[i].id,startDate:'2099-01-01',endDate:'2099-01-15'}));
 const issues=['Alpha task','Beta task'].map((title,i)=>app.repo.create({...actor,userId:users[i].id},'issues',{
  title,teamId:teams[i].id,statusId:statuses.find(s=>s.teamId===teams[i].id&&s.type===(i?'unstarted':'backlog'))!.id,
  priority:i?4:2,estimate:i?4:2,assigneeId:users[i].id,subscribers:[users[i].id],labelIds:[labels[i].id],
  projectId:projects[i].id,templateId:templates[i].id,cycleId:cycles[i].id,
  links:[{url:'https://example.test/'+i,sourceType:i?'github':'url'}],recurrence:i?{frequency:'weekly',startDate:'2099-01-01'}:null,
 }));
 for(let i=0;i<2;i++)create('requests',{title:'Request '+i,customerId:customers[i].id,issueId:issues[i].id});
 const both=create('issues',{title:'Both labels task',teamId:teams[0].id,labelIds:labels.map(l=>l.id),priority:2});
 const view=create('views',{name:'Multiselect fixture',entityType:'issues',filters:{match:'all',conditions:[]},display:{groupBy:'none',showEmpty:false}});
 const route=url+'/view/'+view.id;
 await page.goto(route);await expect(page.locator('[data-testid=issue-row]')).toHaveCount(3);
 return{app,url,actor,route,view,teams,users,statuses,labels,projectLabels,initiatives,customers,projects,templates,cycles,issues,both};
 }catch(error){await app.close();throw error}
}

function currentFilter(page:Page):FilterSpec{return JSON.parse(new URL(page.url()).searchParams.get('filter')||'{"match":"all","conditions":[]}')}
async function openField(page:Page,path:string[]){
 await page.getByRole('button',{name:'Filter issues',exact:true}).click();
 for(const name of path)await page.locator('.filter-cascade-panel').last().getByRole('menuitem',{name,exact:true}).click();
 return page.locator('.filter-cascade-panel').last();
}

test('every categorical filter accepts multiple choices without closing, jumping, or losing saved values',async({page},info)=>{
 test.setTimeout(120000);
 const f=await fixture(page);
 try{
  const cases:[string[],string,[string,string]][]=[
   [['Team'],'teamId',[f.teams[0].name,'Second team']],
   [['Status'],'statusId',['Backlog','Todo']],
   [['Assignee'],'assigneeId',['Filter Owner','Filter Member']],
   [['Creator'],'creatorId',['Filter Owner','Filter Member']],
   [['Priority'],'priority',['High','Low']],
   [['Estimate'],'estimate',['2','4']],
   [['Labels'],'labelIds',['Alpha label','Beta label']],
   [['Customer'],'effectiveCustomerIds',['Alpha customer','Beta customer']],
   [['Project'],'projectId',['Alpha project','Beta project']],
   [['Project properties','Project status'],'projectStatus',['In Progress','Planned']],
   [['Project properties','Project priority'],'projectPriority',['High','Low']],
   [['Project properties','Project labels'],'projectLabelIds',['Alpha project label','Beta project label']],
   [['Project properties','Project lead'],'projectLeadId',['Filter Owner','Filter Member']],
   [['Initiative'],'initiativeIds',['Alpha initiative','Beta initiative']],
   [['Cycle'],'cycleId',['Alpha cycle','Beta cycle']],
   [['Customers','Customer name'],'customerIds',['Alpha customer','Beta customer']],
   [['Customers','Customer owner'],'customerOwnerIds',['Filter Owner','Filter Member']],
   [['Customers','Customer status'],'customerStatus',['Active','Prospect']],
   [['Customers','Customer tier'],'customerTier',['Gold','Silver']],
   [['Subscribers'],'subscribers',['Filter Owner','Filter Member']],
   [['Links'],'linkSourceTypes',['Web links','github']],
   [['Template'],'templateId',['Alpha template','Beta template']],
   [['Relations','Recurring issues'],'recurringSeriesId',['Not recurring','Beta task']],
  ];
  for(const [path,field,names] of cases)await test.step(path.join(' / '),async()=>{
   const panel=await openField(page,path),rows=panel.getByRole('menuitem');
   const order=await rows.allTextContents();
   const option=(name:string)=>panel.getByRole('menuitem',{name,exact:true});
   for(const name of names){
    await expect(option(name).locator('.filter-check')).toBeVisible();
    await option(name).click();
    await expect(option(name)).toHaveAttribute('aria-pressed','true');
   }
   await expect(rows).toHaveText(order);
   const filter=currentFilter(page),condition=filter.conditions.find(c=>c.field===field)!;
   expect(condition.value.length,path.join(' / ')).toBe(field==='statusId'?4:2);
   const api=await page.request.get(f.url+'/api/v1/issues',{params:{filter:JSON.stringify(filter)}}).then(r=>r.json());
   await expect(page.locator('[data-testid=issue-row]')).toHaveCount(api.nodes.length);
   expect(api.nodes.length).toBeGreaterThan(0);
   if(field==='statusId')await page.screenshot({path:info.outputPath('multiple-statuses.png')});
   await option(names[0]).click();await expect(option(names[0])).toHaveAttribute('aria-pressed','false');
   await expect(option(names[1])).toHaveAttribute('aria-pressed','true');
   await page.reload();
   const reopened=await openField(page,path);
   await expect(reopened.getByRole('menuitem',{name:names[0],exact:true})).toHaveAttribute('aria-pressed','false');
   await expect(reopened.getByRole('menuitem',{name:names[1],exact:true})).toHaveAttribute('aria-pressed','true');
   await reopened.getByRole('menuitem',{name:names[1],exact:true}).click();
   await expect(reopened.getByRole('menuitem',{name:names[1],exact:true})).toHaveAttribute('aria-pressed','false');
   expect(currentFilter(page).conditions).toEqual([]);
   for(let i=0;i<=path.length;i++)await page.keyboard.press('Escape');
  });
 }finally{await page.close();await f.app.close()}
});

test('keyboard and searched multi-selection combine fields, preserve chip position, and save to a view',async({page},info)=>{
 const f=await fixture(page);
 try{
  const trigger=page.getByRole('button',{name:'Filter issues',exact:true});
  const panel=await openField(page,['Assignee']);
  const owner=panel.getByRole('menuitem',{name:'Filter Owner',exact:true}),member=panel.getByRole('menuitem',{name:'Filter Member',exact:true});
  await owner.focus();await page.keyboard.press('Space');await expect(owner).toBeFocused();
  await member.focus();await page.keyboard.press('Enter');await expect(member).toBeFocused();
  await expect(owner).toHaveAttribute('aria-pressed','true');await expect(member).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-testid=issue-row]')).toHaveCount(2);
  await page.keyboard.press('Escape');await expect(page.locator('.filter-cascade-panel')).toHaveCount(1);
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  await trigger.click();const search=page.getByRole('textbox',{name:'Add filter',exact:true});
  await search.fill('Priority High');await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem',{name:'Priority High',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(search).toHaveValue('Priority High');await search.fill('Priority Low');await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem',{name:'Priority Low',exact:true}).locator('.filter-check.checked')).toBeVisible();
  await page.keyboard.press('Escape');
  const chips=page.locator('.issue-filter-chip');await expect(chips).toHaveCount(2);
  await chips.first().getByRole('button',{name:'Filter Owner, Filter Member',exact:true}).click();
  await page.getByRole('menuitem',{name:'Filter Owner',exact:true}).click();
  await expect(chips.first()).toContainText('Assignee');
  await expect(page.getByRole('menuitem',{name:'Filter Member',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('menuitem',{name:'Filter Owner',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid=issue-row]')).toHaveCount(2);
  const expected=currentFilter(page);
  await page.locator('.issue-filter-chips').getByRole('button',{name:'Save',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'New view',exact:true});
  await dialog.getByLabel('Name',{exact:true}).fill('Saved multiple filters');
  await dialog.getByRole('button',{name:'Create view',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const saved=()=>f.app.repo.all('views',f.actor.workspaceId).find(v=>v.name==='Saved multiple filters');
  await expect.poll(()=>saved()?.filters).toEqual({match:'all',conditions:[],groups:[expected]});
  await page.goto(f.url+'/view/'+saved()!.id);await page.reload();
  await expect(page.locator('[data-testid=issue-row]')).toHaveCount(2);
  await expect(chips).toHaveCount(2);
  await chips.first().getByRole('button',{name:'Filter Member, Filter Owner',exact:true}).click();
  for(const name of ['Filter Member','Filter Owner'])await expect(page.getByRole('menuitem',{name,exact:true})).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:info.outputPath('saved-multiple-assignees.png')});
  // Removing the final selection closes its chip; its menu must not move onto Priority.
  for(const name of ['Filter Member','Filter Owner'])await page.getByRole('menuitem',{name,exact:true}).click();
  await expect(chips).toHaveCount(1);await expect(chips).toContainText('Priority');
  await expect(page.locator('.filter-cascade-panel')).toHaveCount(0);
 }finally{await page.close();await f.app.close()}
});

test('project milestone filters accept multiple milestones in the scoped project view',async({page})=>{
 const f=await fixture(page);
 try{
  const milestones=['First milestone','Second milestone'].map(name=>f.app.repo.create(f.actor,'milestones',{name,projectId:f.projects[0].id}));
  for(let i=0;i<2;i++)f.app.repo.create(f.actor,'issues',{title:'Milestone task '+i,teamId:f.teams[0].id,projectId:f.projects[0].id,milestoneId:milestones[i].id});
  await page.goto(f.url+'/project/'+f.projects[0].id+'/issues');
  const panel=await openField(page,['Project milestone']);
  for(const milestone of milestones)await panel.getByRole('menuitem',{name:milestone.name,exact:true}).click();
  expect(currentFilter(page).conditions).toContainEqual({field:'milestoneId',operator:'in',value:milestones.map(m=>m.id)});
  await expect(page.locator('[data-testid=issue-row]')).toHaveCount(2);
  await page.reload();await expect(page.locator('[data-testid=issue-row]')).toHaveCount(2);
 }finally{await page.close();await f.app.close()}
});
