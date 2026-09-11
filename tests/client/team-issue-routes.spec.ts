import{test,expect}from'@playwright/test';
import{createApp}from'../../src/server/app';
import{resolve}from'node:path';

test.use({serviceWorkers:'block'});

test('team issue routes keep strict membership and reject unavailable teams',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Team route owner',email:'team-routes@example.test',password:'team-route-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},team=state.teams[0],status=(type:string)=>state.statuses.find((row:any)=>row.teamId===team.id&&row.type===type);
  for(const issue of state.issues)app.repo.remove(actor,'issues',issue.id);
  await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{triageEnabled:true}});
  const fixtures=[['Active route issue','unstarted'],['Backlog route issue','backlog'],['Triage route issue','triage'],['Completed route issue','completed']].map(([title,type])=>app.repo.create(actor,'issues',{title,teamId:team.id,statusId:status(type).id}));
  const second=app.repo.create(actor,'teams',{name:'Other route team',key:'OTHER'});app.repo.create(actor,'issues',{title:'Other team issue',teamId:second.id});
  const expected:Record<string,string[]>= {active:['Active route issue'],backlog:['Backlog route issue'],all:['Active route issue','Backlog route issue','Completed route issue']};
  for(const section of ['active','backlog','all']){
   await page.goto(`${url}/team/${team.id}/${section}`);const rows=page.getByTestId('issue-row');await expect(rows).toHaveCount(expected[section].length);for(const title of expected[section])await expect(rows.filter({hasText:title})).toHaveCount(1);await expect(page.getByText('Other team issue',{exact:true})).toHaveCount(0);await expect(page.getByText('Triage route issue',{exact:true})).toHaveCount(0);if(section!=='all')await expect(page.getByText('Completed route issue',{exact:true})).toHaveCount(0);
   await expect(page.locator('.page-tabs').getByRole('link',{name:section==='all'?'All issues':section[0].toUpperCase()+section.slice(1),exact:true})).toHaveClass(/active/);
  }
  await page.goto(`${url}/team/missing-team/all`);await expect(page.getByRole('heading',{name:'Team not found',exact:true})).toBeVisible();await expect(page.getByTestId('issue-row')).toHaveCount(0);
  expect(fixtures).toHaveLength(4);
 }finally{await page.close();await app.close()}
});
