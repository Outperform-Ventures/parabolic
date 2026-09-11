import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project Overview property menus match the native inventory, accelerators, and focus',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Overview owner',email:'overview-batch023@example.test',password:'overview-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),team=state.teams[0];await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{name:'Ops'}});const other=await page.request.post(url+'/api/v1/teams',{data:{name:'GTM',key:'GTM'}}).then(response=>response.json());
  const project=await page.request.post(url+'/api/v1/projects',{data:{name:'Native property menus',teamIds:[team.id],teamId:team.id,status:'started',leadId:state.user.id,memberIds:[state.user.id],startDate:'2026-09-04',targetDate:'2026-09-10'}}).then(response=>response.json());
  await page.request.post(url+'/api/v1/issues',{data:{title:'Counted project issue',teamId:team.id,projectId:project.id}});
  await page.goto(url+'/project/'+project.id+'/overview');
  const inline=page.locator('.project-overview-inline-properties');
  const status=inline.getByRole('button',{name:'Status',exact:true});await status.click();
  const menu=page.getByRole('dialog',{name:'Menu',exact:true}),statusSearch=menu.getByRole('combobox',{name:'Change status…',exact:true});
  await expect(statusSearch).toBeFocused();await expect(menu.getByRole('option')).toHaveText([/Backlog\s*1/,/Planned\s*2/,/In Progress\s*3/,/Completed\s*4/,/Canceled\s*5/]);
  await expect(menu.getByRole('option',{name:'In Progress',exact:true})).toHaveAttribute('data-active','true');await expect(menu).toContainText('P, then S');
  await page.keyboard.press('4');await expect.poll(()=>app.repo.raw('projects',project.id)?.status).toBe('completed');await expect(status).toBeFocused();
  const priority=inline.getByRole('button',{name:'Priority',exact:true});await priority.click();await expect(menu.getByRole('combobox',{name:'Change priority…',exact:true})).toBeFocused();await expect(menu).toContainText('P, then P');await page.keyboard.press('2');await expect.poll(()=>app.repo.raw('projects',project.id)?.priority).toBe(2);await expect(priority).toBeFocused();
  const lead=inline.getByRole('button',{name:'Lead',exact:true});await lead.click();await expect(menu.getByRole('combobox',{name:'Set lead…',exact:true})).toBeFocused();await expect(menu).toContainText('Users from the project team');await expect(menu).toContainText('New user');await expect(menu.getByRole('button',{name:'Invite and add…',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(lead).toBeFocused();
  const members=inline.getByRole('button',{name:'Members',exact:true});await members.click();await expect(menu.getByRole('combobox',{name:'Change members…',exact:true})).toBeFocused();await expect(menu).toContainText('P, then M');await expect(menu.getByRole('option',{name:'Overview owner',exact:true})).toHaveAttribute('aria-checked','true');await expect(menu).toContainText('New user');await expect(menu.getByRole('button',{name:'Invite and add…',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(members).toBeFocused();
  const teams=inline.getByRole('button',{name:'Change project teams',exact:true});await teams.click();await expect(menu.getByRole('combobox',{name:'Change teams…',exact:true})).toBeFocused();await expect(menu).toContainText('P, then T');await expect(menu).toContainText('Your teams');await expect(menu.getByRole('option',{name:'Ops',exact:true})).toHaveAttribute('aria-checked','true');await expect(menu.getByRole('option',{name:'Ops',exact:true})).toContainText('1 issues');await expect(menu.getByRole('option',{name:other.name,exact:true})).toHaveAttribute('aria-checked','false');await page.keyboard.press('Escape');await expect(teams).toBeFocused();
  const start=inline.getByRole('button',{name:'Change project start date',exact:true});await start.click();const startMenu=page.getByRole('dialog',{name:'Start date',exact:true});await expect(startMenu.getByRole('tab')).toHaveText(['Day','Month','Quarter','Half-year','Year']);await page.keyboard.press('Escape');
  const target=inline.getByRole('button',{name:'Change project target date',exact:true});await target.click();const targetMenu=page.getByRole('dialog',{name:'Target date',exact:true});for(const day of [31,1,2,3])await expect(targetMenu.getByRole('gridcell',{name:new RegExp(`(August ${day}|September ${day}), 2026`)})).toBeDisabled();
 }finally{await page.close();await app.close()}
});
