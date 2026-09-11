import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('direct Team Active Display controls match native geometry',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.setViewportSize({width:1777,height:991});
  await page.request.post(url+'/auth/setup',{data:{name:'Batch 016 geometry',email:'batch016-geometry@example.test',password:'test-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const properties=['identifier','statusId','assigneeId','priority','projectId','dueDate','milestoneId','estimate','labelIds','links','customerCount','customerRevenue','timeInStatus','createdAt','updatedAt'];
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{displayDefaults:{active:{layout:'list',groupBy:'statusId',groupCount:'issues',subGroupBy:'none',orderBy:'priority',direction:'asc',completedWindow:'all',showCompleted:true,showEmpty:false,showSubIssues:true,nestedSubIssues:true,properties}}}});
  await page.goto(url+'/team/'+team.id+'/active');
  await page.getByRole('button',{name:'Display options',exact:true}).click();
  const panel=page.locator('.team-display-options:visible');
  await expect(panel).toBeVisible();
  await expect(panel.locator('xpath=..')).toHaveCSS('width','302px');
  await expect(panel.locator('xpath=..')).toHaveCSS('height','534px');

  const boxes=[];
  for(const label of ['Grouping','Sub-grouping','Ordering'])boxes.push(await panel.getByLabel(label,{exact:true}).boundingBox());
  expect(boxes).toEqual([
   {x:1609,y:160,width:100,height:24},
   {x:1609,y:192,width:100,height:24},
   {x:1609,y:224,width:100,height:24},
  ]);
 }finally{await page.close();await app.close()}
});
