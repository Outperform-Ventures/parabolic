import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test.use({serviceWorkers:'block',colorScheme:'dark'});

test('Teams display menu matches native root controls and persists property choices',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Directory display owner',email:'teams-display-wave015@example.test',password:'teams-display-password'}});
  await page.goto(url+'/teams');
  const display=page.getByRole('button',{name:'Display options',exact:true});
  await display.click();
  await expect(page.getByText('Ordering',{exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'View ordering',exact:true})).toHaveValue('name');
  await expect(page.getByRole('button',{name:'Direction',exact:true})).toBeVisible();
  for(const name of ['ID','Membership','Owners','Projects','Created','Updated','Members'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();

  await page.getByRole('button',{name:'Owners',exact:true}).click();
  await page.getByRole('button',{name:'Created',exact:true}).click();
  await page.getByRole('button',{name:'Membership',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:'Owners',exact:true})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Created',exact:true})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Membership',exact:true})).toHaveCount(0);

  await page.getByRole('button',{name:'Direction',exact:true}).click();
  await expect(page.getByRole('button',{name:'Direction',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('columnheader',{name:'Owners',exact:true})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Created',exact:true})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Membership',exact:true})).toHaveCount(0);
  await expect(page.getByRole('columnheader',{name:'Order by Name',exact:true})).toHaveAttribute('aria-sort','descending');
 }finally{await app.close()}
});
