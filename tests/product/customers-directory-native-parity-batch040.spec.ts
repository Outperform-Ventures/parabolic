import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('Customers directory exposes the retained native controls, sortable columns, and single-link rows',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Josh Kuechly',email:'customers-native-batch040@example.test',password:'customer-directory-password'}});
    const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']};
    const cleves=app.repo.create(actor,'customers',{name:"Cleve's Gourmet Products",domain:'cleves.example',revenue:100000,size:2,status:'Active',tier:'Enterprise',ownerId:state.user.id});
    app.repo.create(actor,'customers',{name:'Acme',domain:'acme.example',revenue:20000,size:10,status:'Prospect',tier:'Startup',ownerId:state.user.id});
    await page.goto(url+'/customers');

    await expect(page.getByRole('heading',{name:'Customers',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'New customer',exact:true})).toBeVisible();
    await expect(page.getByRole('textbox',{name:'Find by name or domain…',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Add filter',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Display options',exact:true})).toBeVisible();
    for(const label of ['Name','Requests','Annual revenue','Size','Status','Tier'])await expect(page.getByRole('button',{name:'Order by '+label,exact:true})).toBeVisible();
    await expect(page.getByText('Owner',{exact:true})).toBeVisible();
    await expect(page.getByText('Domain',{exact:true})).toHaveCount(0);

    const clevesRow=page.getByRole('link',{name:"Cleve's Gourmet Products Cleve's Gourmet Products 0 $100,000.00 2 Active Enterprise Josh Kuechly",exact:true});
    await expect(clevesRow).toHaveAttribute('href','/customer/'+cleves.id);
    await expect(clevesRow).toContainText('$100.0K');
    await expect(clevesRow.getByRole('link')).toHaveCount(0);

    await page.getByRole('button',{name:'Order by Annual revenue',exact:true}).click();
    await expect(page.locator('.customer-directory-row').first()).toContainText('Acme');
    await page.getByRole('button',{name:'Add filter',exact:true}).click();
    await page.getByLabel('Filter customer tier',{exact:true}).selectOption('Enterprise');
    await expect(page.locator('.customer-directory-row')).toHaveCount(1);
    await expect(clevesRow).toBeVisible();
  }finally{await app.close()}
});
