import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
test('compact My issues display retains advanced sorting and source filters',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{email:'display-owner@example.test',name:'Owner',password:'display-owner-strong'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const create=async(kind:string,data:unknown)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok(),await r.text()).toBeTruthy();return r.json()};
  const initiative=await create('initiatives',{name:'Retained initiative'}),project=await create('projects',{name:'Linked project',teamIds:[team.id],initiativeIds:[initiative.id]});
  await create('issues',{title:'Linked assigned issue',teamId:team.id,projectId:project.id,assigneeId:state.users[0].id,links:[{id:'link-one',url:'https://example.test/proposal',title:'Proposal',sourceType:'url'}]});
  await page.goto(url+'/my-issues');
  await expect(page.getByRole('button',{name:'More issue views'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Toggle insights'})).toHaveCount(0);
  await page.getByRole('button',{name:'Display options',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Ordering',exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Show column sort controls'})).toHaveCount(0);
  await expect(page.locator('.property-toggle-list button')).toHaveCount(15);
  await page.getByRole('button',{name:'Advanced sorting and display'}).click();
  await expect(page.getByRole('checkbox',{name:'Show column sort controls'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Display cycleId',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add sort rule',exact:true}).click();await expect(page.getByRole('combobox',{name:'Sort field 2',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close advanced display'}).click();await expect(page.getByRole('combobox',{name:'Ordering',exact:true})).toContainText('+ 1 rules');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Filter issues',exact:true}).click();
  await page.getByRole('menuitem',{name:'Initiative',exact:true}).click();await page.getByRole('menuitem',{name:'Retained initiative',exact:true}).click();
  await expect(page.locator('.issue-row-title').filter({hasText:'Linked assigned issue'})).toBeVisible();
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('menuitem',{name:'Links',exact:true}).click();await page.getByRole('menuitem',{name:'Web links',exact:true}).click();
  await expect(page.locator('.issue-row-title').filter({hasText:'Linked assigned issue'})).toBeVisible();
 }finally{await app.close()}
});
