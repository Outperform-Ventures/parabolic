import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('teams settings matches native sorting, lifecycle selector and settings submenu',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Settings owner',email:'settings-teams@example.test',password:'settings-password-123'}});
    const alpha=await(await page.request.post(url+'/api/v1/teams',{data:{name:'Alpha team',key:'ALP',visibility:'private'}})).json();
    await page.request.post(url+'/api/v1/teams',{data:{name:'Zulu team',key:'ZUL',visibility:'public'}});
    await page.goto(url+'/settings/teams');
    const status=page.getByRole('combobox',{name:'Team status',exact:true});
    await status.click();
    await expect(page.getByRole('listbox',{name:'Team status'}).getByRole('option')).toHaveText(['Active','Retired','Recently deleted']);
    await page.getByRole('option',{name:'Active',exact:true}).click();
    for(const label of ['Name','Visibility','Members','Issues','Created'])await expect(page.getByRole('button',{name:`Order by ${label}`,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Order by Visibility',exact:true}).click();
    await expect(page.getByRole('button',{name:'Order by Visibility',exact:true})).toContainText('↓');
    const row=page.locator('.teams-table-row').filter({hasText:'Alpha team'});
    await row.getByRole('button',{name:'Open menu',exact:true}).click();
    const actions=page.getByRole('listbox',{name:'Alpha team actions',exact:true});
    await expect(actions.getByRole('option')).toHaveText([/Settings/,/Leave team/,/Delete/]);
    await actions.getByRole('option',{name:/Settings/}).hover();
    const settings=page.getByRole('listbox',{name:'Alpha team settings',exact:true});
    await expect(settings.getByRole('option',{name:'Team agents',exact:true})).toHaveCount(0);
    await expect(settings.getByRole('option',{name:'Agent skills',exact:true})).toHaveCount(0);
    await settings.getByLabel('Filter settings',{exact:true}).fill('cycle');
    await expect(settings.getByRole('option')).toHaveText(['Cycles']);
    await settings.getByRole('option',{name:'Cycles',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`/settings/team-${alpha.id}\\?section=Cycles$`));
  }finally{await page.close();await app.close()}
});
