import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('sort handles, entire-column scope, grouping restoration and custom values',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Sort owner',email:'sort@example.test',password:'isolated-sort-test',workspaceName:'Sort workspace'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const backlog=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='backlog'),done=state.statuses.find((s:any)=>s.teamId===team.id&&s.type==='completed');
  for(const [index,title] of ['Z','A','Y','B'].entries())await page.request.post(url+'/api/v1/issues',{data:{title,teamId:team.id,statusId:index%2?done.id:backlog.id,priority:index===0||index===3?1:2,customFields:{score:{name:'Score',value:[10,30,20,40][index]}},sortOrder:index}});
  await page.goto(url+'/team/'+team.id+'/all');
  const rows=page.getByTestId('issue-row'),titles=()=>page.locator('.issue-row-title').allTextContents();await expect(rows).toHaveCount(4);
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Ordering',{exact:true}).selectOption('title');await page.getByRole('button',{name:'Advanced sorting and display',exact:true}).click();
  await page.getByRole('button',{name:'Add sort rule',exact:true}).click();await page.getByLabel('Sort field 2').selectOption('priority');
  await page.getByRole('button',{name:'Drag sort rule 2',exact:true}).dragTo(page.getByRole('button',{name:'Drag sort rule 1',exact:true}));
  await expect(page.getByLabel('Advanced display',{exact:true}).getByLabel('Ordering',{exact:true})).toHaveValue('priority');
  await page.getByLabel('Sort scope').selectOption('entire');await page.getByLabel('Show column sort controls').check();await page.keyboard.press('Escape');
  await expect.poll(titles).toEqual(['A','Y','B','Z']);
  await page.getByRole('button',{name:'Title column',exact:true}).click();await page.getByRole('menuitem',{name:'Sort entire column',exact:true}).click();
  await expect.poll(titles).toEqual(['Z','Y','B','A']);
  await page.getByRole('button',{name:'Display options',exact:true}).click();await expect(page.getByLabel('Grouping',{exact:true})).toHaveValue('statusId');await page.getByRole('button',{name:'Advanced sorting and display',exact:true}).click();
  await page.getByLabel('Sort scope').selectOption('groups');await page.keyboard.press('Escape');await expect.poll(titles).toEqual(['Z','Y','B','A']);
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Ordering',{exact:true}).selectOption('customFields.score');await page.getByRole('button',{name:'Advanced sorting and display',exact:true}).click();
  await page.getByLabel('Sort scope').selectOption('entire');await page.getByRole('button',{name:'Save order',exact:true}).click();
  await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json();return s.teams[0].displayDefaults?.all?.orderBy}).toBe('customFields.score');
  await page.keyboard.press('Escape');await expect.poll(titles).toEqual(['B','A','Y','Z']);
  await page.reload();await expect.poll(titles).toEqual(['B','A','Y','Z']);
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('button',{name:'Advanced sorting and display',exact:true}).click();await page.getByRole('button',{name:'Clear',exact:true}).click();
  await expect(page.getByLabel('Advanced display',{exact:true}).getByLabel('Ordering',{exact:true})).toHaveValue('sortOrder');await expect(page.locator('.issue-sort-rule')).toHaveCount(1);
  await page.getByLabel('Sort scope').selectOption('groups');await page.keyboard.press('Escape');
  const row=(title:string)=>rows.filter({has:page.locator('.issue-row-title',{hasText:new RegExp('^'+title+'$')})});
  const after=async(source:string,target:string)=>{const box=await row(target).boundingBox();await row(source).dragTo(row(target),{targetPosition:{x:80,y:box!.height-2}})};
  await after('Z','Y');await expect.poll(titles).toEqual(['Y','Z','A','B']);
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Grouping',{exact:true}).selectOption('priority');await page.keyboard.press('Escape');
  await after('Y','A');
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Grouping',{exact:true}).selectOption('statusId');await page.keyboard.press('Escape');
  await expect.poll(titles).toEqual(['Y','Z','A','B']);
 }finally{await app.close();}
});
