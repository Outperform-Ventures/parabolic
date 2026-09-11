import{test,expect}from'@playwright/test';
import{createApp}from'../../src/server/app';
import{resolve}from'node:path';

test('empty label-group details match the native hierarchy and member inventory',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Group QA',email:'group-qa@example.test',password:'group-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],create=async(kind:string,data:any)=>(await(await page.request.post(url+'/api/v1/'+kind,{data})).json());
  const group=await create('labelGroups',{name:'Customer',teamId:team.id}),cleves=await create('labels',{name:'Cleves',teamId:team.id,labelGroupId:group.id}),hrg=await create('labels',{name:'HRG',teamId:team.id,labelGroupId:group.id});
  await page.setViewportSize({width:1777,height:991});await page.goto(url+'/label-group/'+group.id);
  await expect(page.getByRole('status').filter({hasText:'No matching issues'})).toHaveText('No matching issues');const details=page.getByRole('complementary',{name:'Label details'}),cards=details.locator('.view-summary-card');
  await expect(details).toContainText('Label group');await expect(details).toContainText('Customer');await expect(details).toContainText('Visibility');await expect(details).toContainText(team.name);await expect(details).toContainText('Labels');await expect(details).toContainText(`${cleves.name}, ${hrg.name}`);
  await expect(page.locator('.label-group-glyph')).toHaveCount(2);await expect(page.locator('.label-group-glyph path').first()).toHaveAttribute('d',/M7\.95021 6C8\.91671/);
  await expect(cards.nth(0)).toHaveCSS('min-height','88px');await expect(cards.nth(1)).toHaveCSS('min-height','92px');
 }finally{await page.close();await app.close()}
});
