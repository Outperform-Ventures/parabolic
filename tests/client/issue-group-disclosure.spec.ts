import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('Option-clicking a group disclosure toggles every group in workspace and team issue collections',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Disclosure owner',email:'issue-group-disclosure@example.test',password:'disclosure-password'}});
    const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),team=state.teams[0];
    const statuses=state.statuses.filter((status:any)=>status.teamId===team.id&&['backlog','started','unstarted'].includes(status.type));
    for(const status of statuses)app.repo.create({userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},'issues',{title:'Disclosure '+status.name,teamId:team.id,statusId:status.id});
    for(const route of ['/issues/all','/issues/active','/issues/backlog','/team/'+team.id+'/all','/team/'+team.id+'/active','/team/'+team.id+'/backlog']){
      await page.goto(url+route);
      const rows=page.getByTestId('issue-row'),toggles=page.getByRole('button',{name:'Collapse group',exact:true});
      const rowCount=await rows.count(),groupCount=await toggles.count();
      expect(rowCount).toBeGreaterThan(0);
      expect(groupCount).toBeGreaterThan(0);
      await toggles.first().click({modifiers:['Alt']});
      await expect(rows).toHaveCount(0);
      const expand=page.getByRole('button',{name:'Expand group',exact:true});
      await expect(expand).toHaveCount(groupCount);
      await expand.first().click({modifiers:['Alt']});
      await expect(rows).toHaveCount(rowCount);
      await expect(toggles).toHaveCount(groupCount);
    }
  }finally{
    await page.close();
    await app.close();
  }
});
