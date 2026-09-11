import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';

test('project property popovers support anchored search, keyboard selection and multiple persisted members',async({page,browser})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();const guest=await browser.newContext();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    expect((await page.request.post(`${url}/auth/setup`,{data:{name:'Alice Project',email:'alice-project@example.test',password:'Project-property-password',workspaceName:'Property tests'}})).ok()).toBeTruthy();
    const invitation=await(await page.request.post(`${url}/api/v1/invitations`,{data:{email:'bob-project@example.test',role:'member'}})).json();
    expect((await guest.request.post(`${url}/auth/join`,{data:{name:'Bob Project',email:'bob-project@example.test',password:'Bob-project-password',token:invitation.token}})).ok()).toBeTruthy();
    const initial=await(await page.request.get(`${url}/api/v1/state`)).json();
    const project=await(await page.request.post(`${url}/api/v1/projects`,{data:{name:'Property interaction',status:'planned',teamIds:[initial.teams[0].id],memberIds:[]}})).json();
    const saved=async()=>await(await page.request.get(`${url}/api/v1/projects/${project.id}`)).json();
    await page.goto(`${url}/project/${project.id}`);
    const lead=page.getByRole('button',{name:'Lead',exact:true});await lead.click();const popup=page.getByRole('dialog',{name:'Change Lead',exact:true});await expect(popup).toBeVisible();
    const triggerBox=await lead.boundingBox();await expect.poll(async()=>Math.abs((await popup.boundingBox())!.x-Math.max(8,Math.min(triggerBox!.x,page.viewportSize()!.width-288)))).toBeLessThan(3);await expect.poll(async()=>(await popup.boundingBox())!.width).toBe(280);
    await popup.getByRole('combobox',{name:'Search lead',exact:true}).fill('Bob');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    const bob=initial.users.find((user:any)=>user.name==='Bob Project');await expect.poll(async()=>(await saved()).leadId).toBe(bob.id);await expect(popup).toHaveCount(0);await expect(lead).toBeFocused();
    await page.getByRole('button',{name:'Status',exact:true}).click();await page.getByRole('combobox',{name:'Search status',exact:true}).fill('progress');await page.keyboard.press('Enter');await expect.poll(async()=>(await saved()).status).toBe('started');
    const members=page.getByRole('button',{name:'Members',exact:true});await members.click();const multiple=page.getByRole('dialog',{name:'Change Members',exact:true});
    await multiple.getByRole('combobox').fill('Alice');await page.keyboard.press('Enter');await expect(multiple).toBeVisible();await expect.poll(async()=>(await saved()).memberIds).toContain(initial.user.id);
    await multiple.getByRole('combobox').fill('Bob');await page.keyboard.press('Enter');await expect.poll(async()=>(await saved()).memberIds).toHaveLength(2);
    await page.screenshot({path:'artifacts/platform/project-property-popover.png'});await page.keyboard.press('Escape');await expect(multiple).toHaveCount(0);await expect(members).toBeFocused();
    await members.click();await page.getByRole('dialog',{name:'Change Members'}).getByRole('combobox').fill('Bob');await page.keyboard.press('Enter');await expect.poll(async()=>(await saved()).memberIds).toEqual([initial.user.id]);await page.keyboard.press('Escape');
    await page.reload();await expect(page.getByRole('button',{name:'Lead',exact:true})).toContainText('Bob Project');expect(errors).toEqual([]);
  }finally{await guest.close();await app.close();}
});
