import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('quick relation, template and content filters operate on records and survive reload',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Owner',email:'families@example.test',password:'filter-password'}});
 const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const template=await create('templates',{name:'Bug report',type:'issue',teamId:team.id});
 const parent=await create('issues',{title:'Parent fixture',teamId:team.id,description:'<p>Uncommon needle in body</p>',templateId:template.id});
 const child=await create('issues',{title:'Child fixture',teamId:team.id,parentId:parent.id});
 const blocker=await create('issues',{title:'Blocker fixture',teamId:team.id,relations:[{type:'blocks',issueId:parent.id}]});
 await page.goto(url+'/team/'+team.id+'/all');
 const open=async(query:string)=>{await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('textbox',{name:'Add filter',exact:true}).fill(query)};
 const select=async(query:string,name:string)=>{await open(query);await page.getByRole('menuitem',{name,exact:true}).click();await page.keyboard.press('Escape')};
 await select('Parent issues','Relations Parent issues');await expect(page.locator('[data-testid=issue-row]')).toHaveCount(1);await expect(page.locator('[data-testid=issue-row]')).toContainText('Parent fixture');
 await page.reload();await expect(page.locator('[data-testid=issue-row]')).toHaveCount(1);await page.getByRole('button',{name:'Remove Parent issues filter',exact:true}).click();
 await select('Blocking issues','Relations Blocking issues');await expect(page.locator('[data-testid=issue-row]')).toHaveCount(1);await expect(page.locator('[data-testid=issue-row]')).toContainText('Blocker fixture');await page.getByRole('button',{name:'Remove Blocking issues filter',exact:true}).click();
 await open('Filter by content');await page.getByRole('menuitem',{name:'Content Filter by content…',exact:true}).click();await page.getByRole('textbox',{name:'Content',exact:true}).fill('uncommon needle');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.locator('[data-testid=issue-row]')).toHaveCount(1);await expect(page.locator('[data-testid=issue-row]')).toContainText('Parent fixture');await page.getByRole('button',{name:'Remove Content filter',exact:true}).click();
 await select('Bug report','Template Bug report');await expect(page.locator('[data-testid=issue-row]')).toHaveCount(1);await expect(page.locator('[data-testid=issue-row]')).toContainText('Parent fixture');await page.getByRole('button',{name:'Remove Template filter',exact:true}).click();
 const checks:[string,string,any,string[]][]=[['isParentIssue','eq',true,[parent.id]],['isSubIssue','eq',true,[child.id]],['isBlockedIssue','eq',true,[parent.id]],['isBlockingIssue','eq',true,[blocker.id]],['searchableContent','contains','uncommon needle',[parent.id]],['templateId','in',[null],[child.id,blocker.id]]];
 for(const [field,operator,value,ids]of checks){const r=await page.request.get(url+'/api/v1/issues',{params:{filter:JSON.stringify({match:'all',conditions:[{field,operator,value}]})}});expect(r.ok()).toBeTruthy();expect((await r.json()).nodes.map((i:any)=>i.id).sort()).toEqual(ids.sort())}
 await open('Relations');await page.screenshot({path:'artifacts/verification/issue-filter-parity/relations-owned.png'});
 }finally{await page.close();await app.close()}
});
