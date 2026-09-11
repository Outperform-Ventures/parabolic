import {test,expect} from '@playwright/test';import {resolve} from 'node:path';import {createApp} from '../../src/server/app';
test('Search issue preview exposes retained native header actions with persistent favorite and exact copy payloads',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'preview-actions@example.test',name:'Preview owner',password:'preview-actions-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();const response=await page.request.post(url+'/api/v1/issues',{data:{title:'Preview header action specimen',teamId:state.teams[0].id}});expect(response.ok()).toBeTruthy();const issue=await response.json();
  await page.goto(url+'/search?q=Preview%20header%20action%20specimen');await page.getByRole('option').filter({hasText:'Preview header action specimen'}).click();const preview=page.getByRole('complementary',{name:'Search result preview'});await expect(preview).toBeVisible();
  await expect(preview.locator('.search-preview-header button')).toHaveCount(4);await expect(preview.getByRole('switch',{name:'Add to favorites'})).toHaveAttribute('aria-checked','false');await preview.getByRole('switch',{name:'Add to favorites'}).click();await expect(preview.getByRole('switch',{name:'Remove from favorites'})).toHaveAttribute('aria-checked','true');
  const saved=await(await page.request.get(url+'/api/v1/state')).json();expect(saved.favorites.some((f:any)=>!f.deletedAt&&f.entityId===issue.id&&f.userId===state.user.id)).toBeTruthy();
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copiedPreviewText=text}}})});
  const copies=preview.getByRole('group',{name:'Issue copy actions'});await expect(copies.getByRole('button')).toHaveCount(2);expect(await copies.getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))).toEqual(['Copy issue URL','Copy issue ID']);
  await copies.getByRole('button',{name:'Copy issue URL',exact:true}).click();expect(await page.evaluate(()=>(window as any).copiedPreviewText)).toBe(url+'/issues/'+issue.id);
  await copies.getByRole('button',{name:'Copy issue ID',exact:true}).click();expect(await page.evaluate(()=>(window as any).copiedPreviewText)).toBe(issue.identifier);
  await expect(preview.getByRole('button',{name:/branch|Work on issue|coding/i})).toHaveCount(0);
  await preview.getByRole('button',{name:'Issue options',exact:true}).click();await expect(page.getByRole('menuitem').filter({hasText:'Copy'}).first()).toBeVisible();await page.keyboard.press('Escape');
  await preview.getByRole('switch',{name:'Remove from favorites'}).click();await expect(preview.getByRole('switch',{name:'Add to favorites'})).toHaveAttribute('aria-checked','false');
  await preview.getByRole('button',{name:'Close search preview',exact:true}).click();await expect(preview).toHaveCount(0);await page.goto(url+'/search?q=Preview%20header%20action%20specimen');await page.getByRole('option').filter({hasText:'Preview header action specimen'}).click();await expect(preview).toBeVisible();
  await preview.getByRole('button',{name:'Go to issue',exact:true}).click();await expect(page.getByRole('complementary',{name:'Search result preview'})).toHaveCount(0);await expect(page.locator('.issue-detail-view')).toBeVisible();
 }finally{await app.close()}
});
