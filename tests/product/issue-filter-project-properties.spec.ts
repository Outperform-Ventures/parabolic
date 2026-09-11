import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('project property choices filter actual linked records and persist across reload',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'project-filter@example.test',password:'filter-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0];
  const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok(),await r.text()).toBeTruthy();return r.json()};
  const label=await create('labels',{name:'Customer-facing',entityType:'projects'});
  const project=await create('projects',{name:'Launch project',teamIds:[team.id],status:'started',priority:2,leadId:state.user.id,labelIds:[label.id]});
  const empty=await create('projects',{name:'Unlabeled project',teamIds:[team.id],status:'planned',priority:0});
  const milestone=await create('milestones',{name:'Launch Alpha',projectId:project.id});
  const a=await create('issues',{title:'Assigned milestone',teamId:team.id,projectId:project.id,milestoneId:milestone.id});
  const b=await create('issues',{title:'Unlabeled project issue',teamId:team.id,projectId:empty.id});
  const c=await create('issues',{title:'Without project',teamId:team.id});
  await page.goto(url+'/team/'+team.id+'/all');
  const trigger=page.getByRole('button',{name:'Filter issues',exact:true}),rows=page.locator('[data-testid=issue-row]');
  const select=async(field:string,option:string)=>{await trigger.click();await page.getByRole('textbox',{name:'Add filter',exact:true}).fill(field);await page.getByRole('menuitem',{name:'Project properties '+field,exact:true}).click();await page.getByRole('menuitem',{name:option,exact:true}).click();await page.keyboard.press('Escape')};
  const clear=async(field:string)=>page.getByRole('button',{name:'Remove '+field+' filter',exact:true}).click();
  for(const [field,option,title] of [['Project status','In Progress','Assigned milestone'],['Project priority','No priority','Unlabeled project issue'],['Project lead','Current user','Assigned milestone'],['Project labels','Customer-facing','Assigned milestone'],['Project labels','No labels','Unlabeled project issue']]){
   await select(field,option);await expect(rows).toHaveCount(1);await expect(rows).toContainText(title);await page.reload();await expect(rows).toHaveCount(1);await clear(field);
  }
  await trigger.click();await page.getByRole('textbox',{name:'Add filter',exact:true}).fill('Milestone name contains');await page.getByRole('menuitem',{name:'Project properties Milestone name Milestone name contains…',exact:true}).click();
  await page.getByRole('textbox',{name:'Milestone name',exact:true}).fill('LAUNCH');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(rows).toHaveCount(1);await expect(rows).toContainText('Assigned milestone');await page.reload();await expect(rows).toHaveCount(1);await clear('Milestone name');
  const predicates=[['projectPriority',[0],[b.id]],['projectStatus',['started'],[a.id]],['projectLeadId',['@current-user'],[a.id]],['projectLeadId',[null],[b.id,c.id]],['projectLabelIds',[null],[b.id]],['projectLabelIds',[null,label.id],[a.id,b.id]]];
  for(const [field,value,ids] of predicates){const r=await page.request.get(url+'/api/v1/issues',{params:{filter:JSON.stringify({conditions:[{field,operator:'in',value}]})}});expect(r.ok(),await r.text()).toBeTruthy();expect((await r.json()).nodes.map((i:any)=>i.id).sort()).toEqual((ids as string[]).sort())}
  const r=await page.request.get(url+'/api/v1/issues',{params:{filter:JSON.stringify({conditions:[{field:'milestoneName',operator:'contains',value:'LAUNCH'}]})}});expect((await r.json()).nodes.map((i:any)=>i.id)).toEqual([a.id]);
 }finally{await page.close();await app.close()}
});
