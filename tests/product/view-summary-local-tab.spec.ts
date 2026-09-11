import {expect,test} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

test('team-local issue-tab details use the compact native structure without changing saved-view details',async({page})=>{
  await page.setViewportSize({width:1777,height:991});
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Summary owner',email:'local-summary@example.test',password:'summary-password'}});
    const state=await page.request.get(url+'/api/v1/state').then(response=>response.json()),team=state.teams[0];
    await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title:'Visible summary work'}});
    const create=async(data:Record<string,unknown>)=>{
      const response=await page.request.post(url+'/api/v1/views',{data:{entityType:'issues',teamId:team.id,display:{layout:'board',groupBy:'statusId',summaryOpen:true},...data}});
      expect(response.ok()).toBeTruthy();
      return response.json();
    };
    const local=await create({name:'Triage',nativePlacement:'localIssueTab'});
    await page.goto(url+'/view/'+local.id);
    let summary=page.getByRole('complementary',{name:'Issue summary',exact:true});
    await expect(summary).toBeVisible();
    expect(Math.round((await summary.boundingBox())!.width)).toBe(440);
    expect(Math.round((await summary.locator('.view-summary-description').boundingBox())!.height)).toBe(50);
    expect(Math.round((await summary.locator('.view-summary-properties').boundingBox())!.height)).toBe(54);
    await expect(summary.locator('.view-summary-heading')).toHaveText('Triage');
    await expect(summary.getByText('Visibility',{exact:true})).toHaveCount(0);
    await expect(summary.getByLabel('View owner Triage',{exact:true})).toContainText('Summary owner');
    await expect(summary.getByRole('button',{name:/favorite view/i})).toHaveCount(0);

    const saved=await create({name:'General saved view',visibility:'workspace'});
    await page.goto(url+'/view/'+saved.id);
    summary=page.getByRole('complementary',{name:'Issue summary',exact:true});
    await expect(summary).toBeVisible();
    expect(Math.round((await summary.boundingBox())!.width)).toBe(400);
    await expect(summary.getByText('Visibility',{exact:true})).toBeVisible();
    await expect(summary.getByRole('button',{name:'Favorite view',exact:true})).toBeVisible();
  }finally{
    await page.close();
    await app.close();
  }
});
