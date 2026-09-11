import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('milestone actions match the captured native root menu and isolate target-date editing',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Milestone actions QA',email:'milestone-actions-batch039@example.test',password:'milestone-actions-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
  const project=app.repo.create(actor,'projects',{name:'Native milestone actions',teamId:team.id,teamIds:[team.id],status:'started'});
  const milestone=app.repo.create(actor,'milestones',{name:'Design test',projectId:project.id,position:0,targetDate:'2024-06-19T00:00:00.000Z'});
  await page.goto(url+'/project/'+project.id+'/overview');
  const rail=page.getByRole('complementary',{name:'Project details',exact:true}),row=rail.locator('[data-planning-milestone="'+milestone.id+'"]');
  await expect(row.getByRole('button',{name:'Choose date',exact:true})).toBeVisible();
  const trigger=row.getByRole('button',{name:'Milestone actions',exact:true});await expect(trigger).toBeVisible();await trigger.click();
  const menu=page.locator('.dropdown-content[role="menu"]:visible');await expect(menu).toHaveCount(1);
  const rootItems=menu.locator(':scope > [role="menuitem"]');await expect(rootItems).toHaveCount(7);
  expect(await rootItems.evaluateAll(nodes=>nodes.map(node=>node.querySelector('span')?.textContent?.trim()))).toEqual(['Open milestone issues','Edit…','Edit target date… Jun 2024','Copy','Move milestone to','Convert to project','Delete…']);
  await expect(menu.getByRole('menuitem',{name:'Copy',exact:true})).toHaveAttribute('aria-haspopup','menu');
  await expect(menu.getByRole('menuitem',{name:'Move milestone to',exact:true})).toHaveAttribute('aria-haspopup','menu');
  await expect(menu.getByRole('menuitem',{name:/Delete…/})).toContainText('⌘⌫');
  await menu.getByRole('menuitem',{name:'Edit target date… Jun 2024',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Edit target date',exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Target date',{exact:true})).toHaveValue('2024-06-19');
  await expect(dialog.getByLabel('Name',{exact:true})).toHaveCount(0);
  await expect(dialog.locator('[contenteditable="true"]')).toHaveCount(0);
  await dialog.getByLabel('Target date',{exact:true}).fill('2024-07-23');await dialog.getByRole('button',{name:'Save target date',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect.poll(()=>app.repo.get(actor,'milestones',milestone.id)?.targetDate).toContain('2024-07-23');
 }finally{await page.close();await app.close()}
});
