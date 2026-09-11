import {test,expect} from '@playwright/test';import {createApp} from '../../src/server/app';import {resolve} from 'node:path';
test('triage evaluates Current user and milestone filters with the same context as issue lists',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'triage-context@example.test',password:'owner-password'}});
  const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok(),await r.text()).toBeTruthy();return r.json()};
  const team=await create('teams',{name:'Queue',key:'QUE',triageEnabled:true}),state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),status=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='triage');
  const project=await create('projects',{name:'Launch',teamIds:[team.id],priority:2}),milestone=await create('milestones',{name:'Release Alpha',projectId:project.id});
  await create('issues',{title:'Owned milestone issue',teamId:team.id,statusId:status.id,assigneeId:state.user.id,projectId:project.id,milestoneId:milestone.id});await create('issues',{title:'Other queue issue',teamId:team.id,statusId:status.id});
  await page.goto(url+'/team/'+team.id+'/triage');const queue=page.getByRole('listbox',{name:'Triage issues'});await expect(queue.getByRole('option')).toHaveCount(2);
  await page.getByRole('button',{name:'Filter triage'}).click();await page.getByRole('button',{name:'Add filter',exact:true}).click();const row=page.locator('.filter-condition');await row.locator('select').nth(0).selectOption('assigneeId');await row.locator('select').nth(2).selectOption('@current-user');await expect(queue.getByRole('option')).toHaveCount(1);await expect(queue.getByRole('option')).toHaveAccessibleName('Owned milestone issue');
  await row.locator('select').nth(0).selectOption('milestoneName');await row.locator('select').nth(1).selectOption('contains');await row.locator('input').fill('ALPHA');await expect(queue.getByRole('option')).toHaveCount(1);await expect(queue.getByRole('option')).toHaveAccessibleName('Owned milestone issue');
  await row.locator('select').nth(0).selectOption('projectPriority');await row.locator('select').nth(1).selectOption('in');await row.locator('select').nth(2).selectOption('2');await expect(queue.getByRole('option')).toHaveCount(1);await expect(queue.getByRole('option')).toHaveAccessibleName('Owned milestone issue');
 }finally{await page.close();await app.close()}
});
