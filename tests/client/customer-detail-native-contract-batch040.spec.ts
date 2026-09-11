import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('customer detail exposes the retained native summary, controls, and compact request row',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Josh Kuechly',email:'customer-detail-batch040@example.test',password:'customer-detail-password'}});
  const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),team=state.teams[0],actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
  const customer=app.repo.create(actor,'customers',{name:"Cleve's Gourmet Products",domain:'clevesgourmetproducts.com',status:'Active',revenue:100000,size:2,ownerId:state.user.id});
  const issue=app.repo.create(actor,'issues',{title:'Cleanup Cleves rolling backups',teamId:team.id});
  const request=app.repo.create(actor,'requests',{title:'Cleanup Cleves rolling backups',customerId:customer.id,issueId:issue.id,status:'Open'});
  await page.goto(url+'/customer/'+customer.id);
  const header=page.locator('.feature-header');await expect(header.getByRole('link',{name:'Customers',exact:true})).toHaveAttribute('href','/customers');await expect(header.getByText(customer.name,{exact:true})).toBeVisible();
  await expect(header.getByRole('switch',{name:'Add to favorites',exact:true})).toHaveAttribute('aria-checked','false');
  for(const name of ['Open customer menu','Copy page URL','Setup customer notifications'])await expect(header.getByRole('button',{name,exact:true})).toBeVisible();
  const detail=page.locator('.customer-detail');await expect(detail.getByRole('heading',{name:customer.name,exact:true})).toBeVisible();await expect(detail).toContainText('clevesgourmetproducts.com');
  await expect(detail.getByRole('button',{name:'Edit customer',exact:true})).toBeVisible();await expect(detail.locator('.customer-detail-properties')).toContainText(/StatusActiveRevenue\$100\.0K\/yrSize2Owner.*Josh Kuechly/);
  await expect(detail.getByRole('button',{name:'Display options',exact:true})).toBeVisible();await expect(detail.getByRole('button',{name:'Add customer request',exact:true})).toBeVisible();
  const row=detail.locator('[data-request-id="'+request.id+'"]');await expect(row.getByRole('link',{name:'Open issue',exact:true})).toHaveAttribute('href','/issues/'+issue.id+'#customerRequest-'+request.id);await expect(row).toContainText(request.title);await expect(row.getByRole('button',{name:'Open menu',exact:true})).toBeVisible();await expect(row.getByRole('time')).toHaveAttribute('aria-label',/^Created at /);
  await detail.getByRole('button',{name:'Display options',exact:true}).click();for(const name of ['Important first','Newest first','Oldest first'])await expect(page.getByRole('menuitem',{name,exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await detail.getByRole('button',{name:'Add customer request',exact:true}).click();await expect(page.getByRole('dialog',{name:'New customer request',exact:true})).toBeVisible();
 }finally{await page.close();await app.close()}
});
