import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('project Activity exposes the native update composer and searchable health menu',async({page})=>{
 test.setTimeout(60000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Update owner',email:'project-update-native-batch039@example.test',password:'project-update-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},project=app.repo.create(actor,'projects',{name:'Native activity project',status:'started',leadId:state.user.id,teamIds:[state.teams[0].id]});
  app.repo.create(actor,'updates',{projectId:project.id,body:'Previous delivery update',health:'At risk'});
  await page.goto(url+'/project/'+project.id+'/activity?compose=1');
  await expect(page.getByRole('button',{name:'Activity',exact:true})).toHaveClass(/active/);
  const composer=page.locator('.feature-update-compose');
  await expect(composer.getByRole('tab',{name:'Comment',exact:true})).toHaveAttribute('aria-selected','false');
  await expect(composer.getByRole('tab',{name:'Update',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(composer.getByRole('textbox',{name:'Project update',exact:true})).toBeVisible();
  await expect(composer.locator('[data-placeholder="Write a project update..."]')).toBeVisible();
  await expect(composer.getByRole('button',{name:'Submit update',exact:true})).toBeDisabled();
  await composer.getByRole('button',{name:'On track',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Set project health',exact:true})).toBeFocused();
  for(const health of ['On track','At risk','Off track'])await expect(page.getByRole('option',{name:health,exact:true})).toBeVisible();
  await page.getByRole('option',{name:'Off track',exact:true}).click();
  await expect(composer.getByRole('button',{name:'Off track',exact:true})).toBeVisible();
  await expect(page.locator('[data-update-id]')).toContainText('Previous delivery update');
 }finally{await app.close()}
});
