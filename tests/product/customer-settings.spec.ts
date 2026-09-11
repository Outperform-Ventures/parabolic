import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('customer request settings persist every retained native control inline',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Customer owner',email:'customer-settings@example.test',password:'customer-settings-password'}});
    const state=await(await page.request.get(url+'/api/v1/state')).json(),workspaceId=state.workspaceId,team=state.teams[0];
    for(const tier of state.customerTiers)await page.request.delete(url+'/api/v1/customerTiers/'+tier.id);
    const settings=()=>app.repo.raw('workspaces',workspaceId)?.customerSettings||{};
    await page.goto(url+'/settings/customers');
    await expect(page.getByText('No customer tiers',{exact:true})).toBeVisible();
    const enabled=page.getByRole('switch',{name:'Enable customer requests',exact:true});
    await enabled.click();await expect.poll(()=>app.repo.raw('workspaces',workspaceId)?.customersEnabled).toBe(false);
    await enabled.click();await expect.poll(()=>app.repo.raw('workspaces',workspaceId)?.customersEnabled).toBe(true);
    await page.getByRole('combobox',{name:'Default team for customer requests',exact:true}).click();await page.getByRole('option',{name:team.name,exact:true}).click();await expect.poll(()=>settings().defaultTeamId).toBe(team.id);
    await page.getByRole('combobox',{name:'Revenue formatting',exact:true}).click();await page.getByRole('option',{name:'Monthly',exact:true}).click();await expect.poll(()=>settings().revenueFrequency).toBe('monthly');
    await page.getByRole('combobox',{name:'Revenue currency',exact:true}).click();await page.getByRole('option',{name:'EUR (€)',exact:true}).click();await expect.poll(()=>settings().revenueUnit).toBe('EUR');
    await expect(page.getByText('External data source',{exact:true}).locator('..')).toContainText('None');
    await page.getByRole('switch',{name:'Enable manual customer edits',exact:true}).click();await expect.poll(()=>settings().manualEdits).toBe(false);

    const statuses=page.locator('.customer-status-card');await page.getByRole('button',{name:'Create new customer status',exact:true}).click();await statuses.getByLabel('Name',{exact:true}).fill('Qualified');await statuses.getByLabel('Description',{exact:true}).fill('Sales qualified');await statuses.getByLabel('Color',{exact:true}).fill('#123456');await statuses.getByRole('button',{name:'Submit',exact:true}).click();await expect.poll(()=>settings().statuses).toContain('Qualified');
    const qualified=statuses.locator('.customer-list-row',{hasText:'Qualified'});await qualified.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Delete',exact:true}).click();await expect.poll(()=>settings().statuses).not.toContain('Qualified');

    const tiers=page.getByRole('region',{name:'Customer tiers',exact:true});await page.getByRole('button',{name:'Create new customer tier',exact:true}).click();await tiers.getByLabel('Name',{exact:true}).fill('Strategic');await tiers.getByRole('button',{name:'Submit',exact:true}).click();await expect(page.getByText('Strategic',{exact:true})).toBeVisible();const strategic=tiers.locator('.customer-list-row',{hasText:'Strategic'});await strategic.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Delete',exact:true}).click();await expect(page.getByText('No customer tiers',{exact:true})).toBeVisible();

    await page.getByRole('button',{name:'Add excluded domains and emails',exact:true}).click();await page.getByLabel('Domain or email address',{exact:true}).fill('Internal.Test');await page.getByRole('button',{name:'Submit',exact:true}).click();await expect.poll(()=>settings().excludedDomains).toEqual(['internal.test']);let row=page.locator('.customer-list-row',{hasText:'internal.test'});await row.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Remove',exact:true}).click();await expect.poll(()=>settings().excludedDomains).toEqual([]);
    await page.getByRole('button',{name:'Add generic domains and emails',exact:true}).click();await page.getByLabel('Domain or email address',{exact:true}).fill('Example.Mail');await page.getByRole('button',{name:'Submit',exact:true}).click();await expect.poll(()=>settings().genericDomains).toEqual(['example.mail']);row=page.locator('.customer-list-row',{hasText:'example.mail'});await row.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Remove',exact:true}).click();await expect.poll(()=>settings().genericDomains).toEqual([]);
  }finally{await page.close();await app.close()}
});
