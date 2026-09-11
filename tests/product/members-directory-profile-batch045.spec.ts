import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../src/server/app';

test('Members directory and profiles expose the retained native controls and views',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Directory owner',email:'owner@example.test',password:'owner-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},id=randomUUID(),now=new Date().toISOString(),team=state.teams[0];
  app.repo.save('users',{id,workspaceId:state.workspaceId,name:'Member Person',username:'member',email:'member@example.test',title:'Founder',createdAt:now,updatedAt:now,version:1},'create',actor);
  app.repo.save('memberships',{id:randomUUID(),workspaceId:state.workspaceId,userId:id,role:'member',createdAt:now,updatedAt:now,version:1},'create',actor);
  app.repo.create(actor,'memberships',{teamId:team.id,userId:id,role:'member'});
  const project=app.repo.create(actor,'projects',{name:'Member project',teamIds:[team.id],memberIds:[id]}),status=state.statuses.find((row:any)=>row.type==='started')||state.statuses[0];
  app.repo.create(actor,'issues',{title:'Assigned member work',teamId:team.id,assigneeId:id,projectId:project.id,statusId:status.id,estimate:4});
  app.repo.create(actor,'issues',{title:'Created member work',teamId:team.id,creatorId:id,projectId:project.id,statusId:status.id});
  await page.goto(url+'/members');
  await expect(page.getByRole('heading',{name:'Members',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Invite members',exact:true})).toBeVisible();
  await expect(page.getByPlaceholder('Find members…')).toBeVisible();
  await expect(page.getByRole('button',{name:'Add filter',exact:true})).toBeVisible();
  await expect(page.getByText('Applications',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('columnheader')).toHaveText(['Name ↓','Status','Joined','Teams','Last seen']);
  const display=page.getByRole('button',{name:'Display options',exact:true});await display.click();
  await expect(page.getByLabel('Member ordering')).toHaveValue('name');
  await expect(page.getByRole('button',{name:'Direction',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Teams',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:'Teams',exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:/Member Person/}).click();
  await expect(page).toHaveURL(url+'/profiles/'+id);
  await expect(page.getByTitle('Issue summary (])')).toHaveCount(0);
  await expect(page.locator('[data-group-field=statusId]')).toBeVisible();
  const details=page.getByRole('complementary',{name:'Member details'});await expect(details).toContainText('Member Person');await expect(details).toContainText('member@example.test');await expect(details.getByRole('link',{name:team.name,exact:true})).toBeVisible();await expect(details.getByRole('link',{name:'Member project',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Created',exact:true}).click();
  await expect(page.locator('[data-group-field=statusId]')).toHaveCount(0);
  await page.getByRole('button',{name:'Display options',exact:true}).click();
  await expect(page.getByLabel('Grouping',{exact:true})).toHaveValue('none');await expect(page.getByLabel('Ordering',{exact:true})).toHaveValue('createdAt');await expect(page.getByLabel('Completed issues')).toHaveValue('all');await expect(page.getByLabel('Nested sub-issues')).toBeChecked();
  for(const field of ['identifier','statusId','assigneeId','priority','projectId','dueDate','milestoneId','estimate','labelIds','links','customerCount','customerRevenue','timeInStatus','createdAt','updatedAt'])await expect(page.getByRole('button',{name:'Display '+field,exact:true})).toHaveAttribute('aria-pressed','true');
 }finally{await app.close()}
});
