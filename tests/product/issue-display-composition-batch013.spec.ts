import {test,expect,type Locator} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

const visibleOrder=(panel:Locator)=>panel.evaluate(element=>[...element.children].flatMap(child=>{
 if(child.classList.contains('display-section-heading')||child.classList.contains('display-properties-heading'))return [child.textContent?.trim()||''];
 if(!child.classList.contains('display-row'))return [];
 const own=[...child.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent?.trim())?.textContent?.trim();
 return [own||child.querySelector(':scope > button')?.textContent?.trim()||''];
}));

test('Label and direct Team Display panels follow native conditional composition, order, footer, and height',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.setViewportSize({width:1777,height:991});await page.request.post(url+'/auth/setup',{data:{name:'Display composition',email:'display-composition@example.test',password:'display-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],properties=['identifier','statusId','assigneeId','priority','projectId','dueDate','milestoneId','estimate','labelIds','links','customerCount','customerRevenue','timeInStatus','createdAt','updatedAt'];
  const base={layout:'list',groupCount:'issues',subGroupBy:'none',direction:'asc',showCompleted:true,showEmpty:false,showSubIssues:true,nestedSubIssues:true,properties};
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{displayDefaults:{
   active:{...base,groupBy:'statusId',orderBy:'priority',completedWindow:'all'},
   backlog:{...base,groupBy:'statusId',orderBy:'priority',completedWindow:'all'},
   all:{...base,groupBy:'projectId',orderBy:'dueDate',completedWindow:'week'},
  }}});
  const label=await(await page.request.post(url+'/api/v1/labels',{data:{name:'Display label',teamId:team.id}})).json();
  const open=async(path:string)=>{await page.goto(url+path);await page.getByRole('button',{name:'Display options',exact:true}).click();const panel=page.locator('.display-options:visible');await expect(panel).toBeVisible();return panel};
  const outer=(panel:Locator)=>panel.locator('xpath=..');

  let panel=await open('/label/'+label.id);
  expect(await visibleOrder(panel)).toEqual(['Grouping','Sub-grouping','Ordering','Order completed by recency','Completed issues','Show sub-issues','List options','Nested sub-issues','Show empty groups','Display properties']);
  await expect(panel.locator('.display-actions')).toHaveCount(0);await expect(outer(panel)).toHaveCSS('height','566px');

  for(const section of ['active','backlog']){
   panel=await open('/team/'+team.id+'/'+section);
   expect(await visibleOrder(panel)).toEqual(['Grouping','Sub-grouping','Ordering','Order completed by recency','Show sub-issues','List options','Nested sub-issues','Show empty groups','Display properties']);
   await expect(panel.getByLabel('Completed issues',{exact:true})).toHaveCount(0);await expect(panel.locator('.display-actions')).toHaveCount(0);await expect(outer(panel)).toHaveCSS('height','534px');
  }

  panel=await open('/team/'+team.id+'/active');await panel.getByLabel('Ordering',{exact:true}).selectOption('dueDate');
  await expect(panel.getByRole('button',{name:'Set default for everyone',exact:true})).toBeVisible();await expect(outer(panel)).toHaveCSS('height','571px');
  await panel.getByRole('button',{name:'Reset',exact:true}).click();await expect(panel.locator('.display-actions')).toHaveCount(0);await expect(outer(panel)).toHaveCSS('height','534px');

  panel=await open('/team/'+team.id+'/all');
  expect(await visibleOrder(panel)).toEqual(['Grouping','Sub-grouping','Ordering','Completed issues','Show sub-issues','List options','Nested sub-issues','Show empty groups','Display properties']);
  await expect(panel.getByText('Order completed by recency',{exact:true})).toHaveCount(0);await expect(panel.getByLabel('Completed issues',{exact:true})).toHaveValue('week');await expect(panel.locator('.display-actions')).toHaveCount(0);await expect(outer(panel)).toHaveCSS('height','534px');
 }finally{await page.close();await app.close()}
});
