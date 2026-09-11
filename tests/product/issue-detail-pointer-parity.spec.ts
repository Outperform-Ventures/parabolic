import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('issue-detail property menus restore focus and retain native popup, pointer, and tooltip presentation',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Pointer owner',email:'pointer@example.test',password:'pointer-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),team=state.teams[0];
  await page.request.post(url+'/api/v1/projects',{data:{name:'Alpha project',teamIds:[team.id]}});
  const issue=await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title:'Pointer parity',estimate:1,description:'<p>Pointer description</p>'}}).then(response=>response.json());
  await page.setViewportSize({width:1777,height:991});await page.goto(url+'/issues/'+issue.id);
  const description=page.getByRole('textbox',{name:'Issue description',exact:true});
  await expect(description).toHaveCSS('cursor','text');
  const cases=[
   ['statusId','Change status…',208],['priority','Change priority to…',208],['assigneeId','Assign to…',208],['estimate','Change estimate to…',229],['labelIds','Add labels…',208],['projectId','Add to project…',229],
  ] as const;
  for(const [field,label,width] of cases){
   const trigger=page.locator(`[data-property="${field}"]`).first();await trigger.click();
   const dialog=page.getByRole('dialog',{name:'Menu',exact:true});await expect(dialog).toBeVisible();
   const search=dialog.getByRole('searchbox',{name:label,exact:true});await expect(search).toBeFocused();
   await expect(dialog.getByRole('status')).toHaveText('Showing all items');
   if(field==='labelIds'){
    const emptyLabelPrompt=dialog.getByRole('option',{name:'Start typing to create a new label',exact:true});
    await expect(emptyLabelPrompt).toBeVisible();await expect(emptyLabelPrompt).toBeDisabled();
   }
   const outer=await dialog.boundingBox(),input=await search.boundingBox(),target=await trigger.boundingBox();
   expect(outer!.width).toBe(width);expect(input!.width).toBe(148);expect(input!.height).toBe(36);
   expect(input!.x-outer!.x).toBe(15);expect(input!.y-outer!.y).toBe(1);
   expect(outer!.x).toBe(field==='labelIds'?Math.round(target!.x-212):Math.round(target!.x));
   expect(outer!.y).toBe(field==='labelIds'?Math.round(target!.y-4):Math.round(target!.y+target!.height+4));
   await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  }
  const estimate=page.locator('[data-property="estimate"]').first();await estimate.click();
  await expect(page.getByRole('dialog',{name:'Menu'}).getByRole('option',{name:'1 Point',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Menu'})).toContainText('⇧ E');await page.keyboard.press('Escape');
  const project=page.locator('[data-property="projectId"]').first();await project.click();
  const projectMenu=page.getByRole('dialog',{name:'Menu'});await expect(projectMenu.getByRole('group',{name:`Projects in ${team.name} team`})).toBeVisible();await expect(projectMenu.getByRole('group',{name:'New project'})).toBeVisible();await expect(projectMenu.getByRole('option',{name:'Create new project…'})).toBeVisible();await page.keyboard.press('Escape');
  await page.waitForTimeout(50);await description.focus();await project.hover();await expect(project).toHaveCSS('background-color','lch(14.006 0.593 272)');await project.focus();await expect(project).toHaveCSS('outline-width','1px');
  const copyUrl=page.getByRole('button',{name:'Copy issue URL',exact:true}),copyId=page.getByRole('button',{name:'Copy issue ID',exact:true});
  await copyUrl.hover();await expect(page.getByRole('tooltip')).toContainText('⌘ ⇧ ,',{timeout:900});await copyId.hover();await expect(page.getByRole('tooltip')).toContainText('⌘ .',{timeout:300});
 }finally{await page.close();await app.close();}
});
