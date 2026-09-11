import{test,expect}from'@playwright/test';
import{createApp}from'../../src/server/app';
import{resolve}from'node:path';

test('project Overview matches the native inline composition and reference rhythm',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'KR',email:'project-overview@example.test',password:'overview-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},team=state.teams[0];
  const project=app.repo.create(actor,'projects',{name:'Honey Rock Group',status:'started',priority:0,leadId:null,memberIds:[state.user.id],startDate:'2026-09-04',targetDate:null,teamIds:[team.id],teamId:team.id});
  await page.setViewportSize({width:1777,height:991});await page.goto(url+'/project/'+project.id+'/overview');
  const main=page.locator('.feature-project-main'),box=async(locator:any)=>{const value=await locator.boundingBox();expect(value).not.toBeNull();return value!},near=(actual:number,expected:number)=>expect(Math.abs(actual-expected)).toBeLessThanOrEqual(1),mainBox=await box(main);
  const icon=await box(main.getByRole('button',{name:'Project icon',exact:true})),labelLocator=main.getByText('Properties',{exact:true}),label=await box(labelLocator),status=await box(main.getByRole('button',{name:'Status',exact:true})),resources=await box(main.getByRole('button',{name:'Add document or link…',exact:true})),customer=await box(main.getByRole('button',{name:'Add customer request',exact:true})),update=await box(main.getByRole('button',{name:'Write first project update',exact:true}));
  for(const [actual,expected]of [[icon.x,404],[icon.y-mainBox.y,64],[icon.width,36],[icon.height,36],[label.x,404],[label.y-mainBox.y,191],[label.height,28],[status.x,487],[status.y-mainBox.y,191],[resources.x,487],[resources.y-mainBox.y,231],[resources.height,28],[customer.x,487],[customer.y-mainBox.y,271],[customer.height,28],[update.x,388],[update.y-mainBox.y,315],[update.width,837],[update.height,66]] as const)near(actual,expected);
  await expect(labelLocator).toHaveCSS('font-size','13px');await expect(labelLocator).toHaveCSS('font-weight','500');
  await expect(main.getByRole('button',{name:'Members',exact:true})).not.toContainText(/members/i);
  await expect(main.getByRole('button',{name:'Change project start date',exact:true})).toHaveText('Sep 4th');
 }finally{await page.close();await app.close()}
});
