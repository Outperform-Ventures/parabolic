import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project update settings edit and persist the workspace schedule',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Update owner',email:'update-settings@example.test',password:'update-settings-password'}});
    const state=await(await page.request.get(url+'/api/v1/state')).json();
    await page.goto(url+'/settings/project-updates');
    await expect(page.getByText('No expectation for updates',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    await page.getByRole('button',{name:'No expectation for updates',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'Every 2 weeks',exact:true}).click();
    await page.getByRole('button',{name:'Wednesday',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'Friday',exact:true}).click();
    await page.getByRole('button',{name:'9AM - 10AM',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'10AM - 11AM',exact:true}).click();
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await expect.poll(()=>app.repo.raw('workspaces',state.workspaceId)?.projectUpdateSchedule).toMatchObject({enabled:true,frequency:'weekly',interval:2,weekday:5,hour:10});
    await expect(page.getByText('Every 2 weeks · Friday at 10:00',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Connect slack channel',exact:true}).click();
    await expect(page).toHaveURL(/\/settings\/integrations$/);
  }finally{await page.close();await app.close()}
});

test('initiative settings persist enablement and schedule and expose retained scaffolds',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Initiative owner',email:'initiative-settings@example.test',password:'initiative-settings-password'}});
    const initial=await(await page.request.get(url+'/api/v1/state')).json();
    await page.goto(url+'/settings/initiatives');
    await expect(page.getByRole('heading',{name:'Initiatives',exact:true})).toBeVisible();
    const enable=page.getByRole('switch',{name:'Enable initiatives',exact:true});
    await expect(enable).toHaveAttribute('aria-checked','true');
    await enable.click();
    await expect.poll(()=>app.repo.raw('workspaces',initial.workspaceId)?.initiativesEnabled).toBe(false);
    await enable.click();
    await expect.poll(()=>app.repo.raw('workspaces',initial.workspaceId)?.initiativesEnabled).toBe(true);

    await page.getByRole('button',{name:'Edit',exact:true}).click();
    await page.getByRole('button',{name:'No expectation for updates',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'Every 2 weeks',exact:true}).click();
    await page.getByRole('button',{name:'Wednesday',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'Friday',exact:true}).click();
    await page.getByRole('button',{name:'9AM - 10AM',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'10AM - 11AM',exact:true}).click();
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await expect.poll(()=>app.repo.raw('workspaces',initial.workspaceId)?.initiativeUpdateSchedule).toMatchObject({enabled:true,frequency:'weekly',interval:2,weekday:5,hour:10});
    await expect(page.getByText('Every 2 weeks · Friday at 10:00',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Connect slack channel',exact:true}).click();
    await expect(page).toHaveURL(/\/settings\/integrations$/);
    await page.goto(url+'/settings/initiatives');
    await page.getByRole('link',{name:'Manage initiative labels',exact:true}).click();
    await expect(page).toHaveURL(/\/settings\/initiative-labels$/);
    await expect(page.getByRole('heading',{name:'Initiative labels',exact:true})).toBeVisible();
  }finally{await page.close();await app.close()}
});
