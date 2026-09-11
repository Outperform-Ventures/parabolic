import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('tabs keep independent navigation histories, restore full closed histories, and preserve pinned content',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Tab history',email:'history@example.test',password:'Tab-history-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Independent history issue',teamId:state.teams[0].id}})).json();
  const project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Independent history project',teamIds:[state.teams[0].id]}})).json();
  await page.goto(url+'/my-issues');await expect(page.locator('.workspace-shell')).toBeVisible();
  const mod=await page.evaluate(()=>/Mac/.test(navigator.platform)?'Meta':'Control');
  const open=async(text:string)=>{await page.keyboard.press(mod+'+k');const input=page.getByRole('combobox',{name:'Command menu',exact:true});await input.fill(text);const choice=page.locator('.command-results').getByRole('option',{selected:true});await expect(choice).toBeVisible();await input.press('Enter');await expect(input).toHaveCount(0);};
  await open('p Independent history project');await expect(page).toHaveURL(new RegExp('/project/'+project.id));const projectRoute=new URL(page.url()).pathname;
  await open('i Independent history issue');await expect(page).toHaveURL(url+'/issues/'+issue.id);
  const firstId=await page.locator('.app-tab.active').getAttribute('data-tab-id');
  await page.keyboard.press(mod+'+t');await expect(page.locator('.app-tab')).toHaveCount(2);await expect(page).toHaveURL(url+'/my-issues');
  await page.locator('.sidebar').getByRole('link',{name:'Inbox',exact:true}).click();await expect(page).toHaveURL(url+'/inbox');
  await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page).toHaveURL(url+'/my-issues');await page.getByRole('button',{name:'Forward',exact:true}).click();await expect(page).toHaveURL(url+'/inbox');
  await page.keyboard.press(mod+'+1');await expect(page).toHaveURL(url+'/issues/'+issue.id);await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page).toHaveURL(url+projectRoute);await page.getByRole('button',{name:'Forward',exact:true}).click();await expect(page).toHaveURL(url+'/issues/'+issue.id);
  await page.keyboard.press(mod+'+w');await expect(page.locator('.app-tab')).toHaveCount(1);await expect(page).toHaveURL(url+'/inbox');
  await page.keyboard.press(mod+'+Shift+t');await expect(page.locator('.app-tab')).toHaveCount(2);await expect(page).toHaveURL(url+'/issues/'+issue.id);await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page).toHaveURL(url+projectRoute);
  await page.evaluate(()=> (document.activeElement as HTMLElement)?.blur());await page.keyboard.press('Control+Shift+p');await expect(page.locator('.app-tab.pinned')).toHaveCount(1);await expect(page.locator('.app-tab').first()).toHaveAttribute('data-tab-id',firstId!);
  await open('i Independent history issue');await expect(page).toHaveURL(url+'/issues/'+issue.id);await expect(page.locator('.app-tab')).toHaveCount(3);await expect(page.locator('.app-tab.pinned')).toContainText(project.name);
  await page.locator('.app-tab.pinned').click();await expect(page).toHaveURL(url+projectRoute);await page.reload();await expect(page.locator('.app-tab.pinned')).toContainText(project.name);await expect(page.locator('.app-tab.active')).toHaveAttribute('data-tab-id',firstId!);
 }finally{await page.close();await app.close();}
});

test('Undo and Redo interleave tab groups with deliberate edits and new actions invalidate stale redo',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'History ordering',email:'ordering@example.test',password:'Tab-history-password'}});
  const state=async()=>await(await page.request.get(url+'/api/v1/state')).json(),initial=await state();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Ordered history issue',teamId:initial.teams[0].id,priority:0}})).json();
  await page.goto(url+'/issues/'+issue.id);await expect(page.locator('.issue-detail-view')).toBeVisible();
  const mod=await page.evaluate(()=>/Mac/.test(navigator.platform)?'Meta':'Control');
  const shortcut=async(key:string)=>{await page.evaluate(()=>(document.activeElement as HTMLElement)?.blur());await page.keyboard.press(mod+'+'+key);};
  const priority=async()=> (await state()).issues.find((row:any)=>row.id===issue.id).priority;
  await page.evaluate(()=>(document.activeElement as HTMLElement)?.blur());await page.keyboard.press('p');await page.getByRole('dialog').getByRole('button',{name:'High',exact:true}).click();await expect.poll(priority).toBe(2);
  await shortcut('t');await expect(page.locator('.app-tab')).toHaveCount(2);await expect(page).toHaveURL(url+'/my-issues');await shortcut('w');await expect(page.locator('.app-tab')).toHaveCount(1);
  await shortcut('z');await expect(page.locator('.app-tab')).toHaveCount(2);expect(await priority()).toBe(2);
  await shortcut('z');await expect.poll(priority).toBe(0);await expect(page.locator('.app-tab')).toHaveCount(2);
  await shortcut('Shift+z');await expect.poll(priority).toBe(2);await expect(page.locator('.app-tab')).toHaveCount(2);
  await shortcut('Shift+z');await expect(page.locator('.app-tab')).toHaveCount(1);
  await shortcut('z');await expect(page.locator('.app-tab')).toHaveCount(2);await shortcut('1');await expect(page).toHaveURL(url+'/issues/'+issue.id);
  await page.locator('.page-header').click({position:{x:300,y:20}});await page.keyboard.press('p');await page.getByRole('dialog').getByRole('button',{name:'Urgent',exact:true}).click();await expect.poll(priority).toBe(1);
  await shortcut('Shift+z');await expect(page.locator('.app-tab')).toHaveCount(2);expect(await priority()).toBe(1);
  await shortcut('t');await expect(page.locator('.app-tab')).toHaveCount(3);await shortcut('Alt+w');await expect(page.locator('.app-tab')).toHaveCount(1);
  await shortcut('z');await expect(page.locator('.app-tab')).toHaveCount(3);expect(await priority()).toBe(1);
  await shortcut('Shift+z');await expect(page.locator('.app-tab')).toHaveCount(1);
 }finally{await page.close();await app.close();}
});
