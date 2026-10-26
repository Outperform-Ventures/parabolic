import {test,expect,type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
import {defaultInsight} from '../../src/client/features/insight-data';

async function fixture(page:Page){
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 await page.request.post(url+'/auth/setup',{data:{name:'Dashboard tester',email:'dashboard@example.test',password:'isolated-dashboard-test'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},team=state.teams[0];
 const customer=app.repo.create(actor,'customers',{name:'Example customer'}),project=app.repo.create(actor,'projects',{name:'Example project',teamIds:[team.id],directCustomerIds:[customer.id]});
 app.repo.create(actor,'issues',{title:'Prepare launch',teamId:team.id,projectId:project.id,priority:2,estimate:4});
 app.repo.create(actor,'issues',{title:'Follow up',teamId:team.id,priority:3,estimate:2});
 const dashboard=app.repo.create(actor,'dashboards',{name:'Delivery overview',description:'Priorities, effort, and customer delivery in one place.',visibility:'workspace',widgets:[
  {...defaultInsight,id:'count',name:'Open issues',chartType:'Metric',layout:{x:0,y:0,w:4,h:3}},
  {...defaultInsight,id:'chart',name:'Work by priority',group:'Priority',layout:{x:4,y:0,w:8,h:4}},
  {...defaultInsight,id:'table',name:'Customer effort',group:'Assigned customer',measure:'Effort',chartType:'Table',layout:{x:0,y:4,w:6,h:4}},
 ]});
 const route=url+'/dashboards/'+dashboard.id;await page.goto(route);await expect(page.getByRole('heading',{name:dashboard.name,exact:true})).toBeVisible();
 return {app,url,route,actor,state,dashboard,current:()=>app.repo.get(actor,'dashboards',dashboard.id)};
}
const card=(page:Page,id:string)=>page.locator(`[data-widget-id="${id}"]`);
async function options(page:Page,id:string,name:string){await card(page,id).hover();await card(page,id).getByRole('button',{name:'Options for '+name,exact:true}).click();}

test('dashboard cards have one presentation and no nested chart scrollbars',async({page},info)=>{
 const f=await fixture(page);try{
  await expect(page).toHaveTitle('Delivery overview');
  await expect(page.locator('.app-tab-label').filter({hasText:'Delivery overview'})).toHaveText('Delivery overview');
  await expect(card(page,'chart').locator('table')).toHaveCount(0);await expect(card(page,'table').locator('.feature-insight-bars')).toHaveCount(0);await expect(card(page,'table').locator('table')).toHaveCount(1);await expect(card(page,'count').locator('table')).toHaveCount(0);
  await expect(card(page,'count').locator('.feature-insight-metric strong')).toHaveText('2');
  expect(await card(page,'table').locator('.feature-insight-table-scroll').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBeTruthy();
  const overflow=await page.locator('.dashboard-chart-body,.dashboard-metric-body').evaluateAll(nodes=>nodes.some(n=>n.scrollHeight>n.clientHeight+1||n.scrollWidth>n.clientWidth+1));expect(overflow).toBeFalsy();
  await page.screenshot({path:info.outputPath('dashboard-desktop.png')});
  await card(page,'chart').locator('.feature-insight-bar-track button').first().hover();
  await expect(card(page,'chart').locator('.feature-insight-tooltip')).toBeVisible();
  await page.waitForTimeout(650);await expect(page.locator('.workspace-tooltip')).toHaveCount(0);
  await card(page,'chart').hover();await card(page,'chart').getByRole('button',{name:'Expand Work by priority',exact:true}).click();
  const expanded=page.getByRole('dialog',{name:'Work by priority',exact:true});await expect(expanded.locator('table')).toBeVisible();await expect(expanded.locator('.feature-insight-bars')).toBeVisible();await expanded.getByRole('button',{name:'Done',exact:true}).click();await expect(expanded).toHaveCount(0);
 }finally{await page.close();await f.app.close();}
});

test('card presentation persists without changing the data or source analysis',async({page,browser})=>{
 const f=await fixture(page);try{
  const issues=JSON.stringify(f.app.repo.all('issues',f.state.workspaceId)),before=f.current();
  await options(page,'chart','Work by priority');await page.getByRole('menuitem',{name:'Table',exact:true}).click();
  await expect.poll(()=>f.current().widgets[1].displayMode).toBe('table');expect(f.current().widgets[1].chartType).toBe(before.widgets[1].chartType);
  await expect(card(page,'chart').locator('table')).toBeVisible();await expect(card(page,'chart').locator('.feature-insight-bars')).toHaveCount(0);
  const context=await browser.newContext({storageState:await page.context().storageState()}),fresh=await context.newPage();await fresh.goto(f.route);await expect(card(fresh,'chart').locator('table')).toBeVisible();await context.close();
  await options(page,'chart','Work by priority');await page.getByRole('menuitem',{name:'Metric',exact:true}).click();await expect(card(page,'chart').locator('.feature-insight-metric strong')).toHaveText('2');
  expect(JSON.stringify(f.app.repo.all('issues',f.state.workspaceId))).toBe(issues);
 }finally{await page.close();await f.app.close();}
});

test('live preview supports chart table and metric, cancellation and explicit save',async({page},info)=>{
 const f=await fixture(page);try{
  await options(page,'chart','Work by priority');await page.getByRole('menuitem',{name:'Edit insight',exact:true}).click();
  let editor=page.getByRole('dialog',{name:'Edit insight',exact:true});await editor.getByRole('button',{name:'Metric',exact:true}).click();
  await expect(editor.locator('.dashboard-editor-preview .feature-insight-metric strong')).toHaveText('2');
  await editor.getByRole('button',{name:'Explore Issue count',exact:true}).click();await expect(page.getByRole('dialog',{name:'2 issues',exact:true})).toBeVisible();await page.getByRole('dialog',{name:'2 issues',exact:true}).getByRole('button',{name:'Done',exact:true}).click();await expect(editor).toBeVisible();expect(f.current().widgets[1].displayMode).toBeUndefined();
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();await expect(card(page,'chart').locator('.feature-insight-bars')).toBeVisible();
  await options(page,'chart','Work by priority');await page.getByRole('menuitem',{name:'Edit insight',exact:true}).click();editor=page.getByRole('dialog',{name:'Edit insight',exact:true});
  await editor.getByRole('button',{name:'Table',exact:true}).click();await editor.getByLabel('Measure',{exact:true}).selectOption('Effort');await editor.getByLabel('Title',{exact:true}).fill('Effort by priority');await expect(editor.locator('.dashboard-editor-preview table')).toBeVisible();
  await page.screenshot({path:info.outputPath('dashboard-editor.png')});await editor.getByRole('button',{name:'Save insight',exact:true}).click();await expect(editor).toHaveCount(0);
  await expect.poll(()=>f.current().widgets[1].displayMode).toBe('table');expect(f.current().widgets[1].measure).toBe('Effort');await expect(card(page,'chart').getByRole('heading',{name:'Effort by priority',exact:true})).toBeVisible();
 }finally{await page.close();await f.app.close();}
});

test('drilldown keeps the dashboard open even for a single issue',async({page})=>{
 const f=await fixture(page);try{
  await card(page,'chart').getByRole('button',{name:'High, All: 1 issues',exact:true}).click();await expect(page).toHaveURL(f.route);
  const detail=page.getByRole('dialog',{name:'1 issues',exact:true});await expect(detail.getByRole('link',{name:/Prepare launch/})).toBeVisible();await detail.getByRole('link',{name:/Prepare launch/}).click();await expect(page).toHaveURL(/\/issues\//);
 }finally{await page.close();await f.app.close();}
});

test('small cards and narrow windows stay contained; layout changes persist',async({page},info)=>{
 const f=await fixture(page);try{
  await card(page,'chart').getByRole('button',{name:'Resize Work by priority',exact:true}).focus();await page.keyboard.press('ArrowUp');await expect.poll(()=>f.current().widgets.find((w:any)=>w.id==='chart').layout.h).toBe(3);
  expect(await card(page,'chart').locator('.dashboard-chart-body').evaluate(n=>n.scrollHeight<=n.clientHeight+1&&n.scrollWidth<=n.clientWidth+1)).toBeTruthy();
  const move=card(page,'count').getByRole('button',{name:'Move Open issues',exact:true});await move.focus();await page.keyboard.press('ArrowDown');await expect.poll(()=>f.current().widgets.find((w:any)=>w.id==='count').layout.y).toBe(1);
  await page.setViewportSize({width:760,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await expect(card(page,'chart')).toHaveAttribute('data-grid-width','12');await page.screenshot({path:info.outputPath('dashboard-narrow.png')});
  await page.reload();expect(f.current().widgets.find((w:any)=>w.id==='chart').layout.h).toBe(3);
 }finally{await page.close();await f.app.close();}
});

test('purpose-built templates create saved dashboards with explicit presentation modes',async({page})=>{
 const f=await fixture(page);try{
  for(const template of ['customer','workload','business']){
   await page.goto(f.url+'/dashboards');await page.getByRole('button',{name:'New dashboard',exact:true}).first().click();
   const dialog=page.getByRole('dialog',{name:'New dashboard',exact:true});await dialog.getByLabel('Name',{exact:true}).fill('Template '+template);await dialog.getByLabel('Start with',{exact:true}).selectOption(template);await dialog.getByLabel('Description',{exact:true}).fill('Purposeful reporting');await dialog.getByRole('button',{name:'Create dashboard',exact:true}).click();await expect(dialog).toHaveCount(0);
   const saved=f.app.repo.all('dashboards',f.state.workspaceId).find(d=>d.name==='Template '+template)!;expect(saved.widgets.length).toBeGreaterThan(3);expect(saved.widgets.every((w:any)=>['chart','table','metric'].includes(w.displayMode))).toBeTruthy();expect(saved.description).toBe('Purposeful reporting');
   await page.reload();await expect(page.getByRole('heading',{name:saved.name,exact:true})).toBeVisible();
   if(template==='customer'){
    await options(page,saved.widgets[0].id,saved.widgets[0].name);await page.getByRole('menuitem',{name:'Edit insight',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'Edit insight',exact:true}),operator=editor.getByLabel('Issue filter 1 operator',{exact:true});
    await expect(operator).toHaveValue('none');await expect(operator.locator('option:checked')).toHaveText('is none of');await editor.getByRole('button',{name:'Cancel',exact:true}).click();
   }
  }
 }finally{await page.close();await f.app.close();}
});

test('linked card presentation stays independent while filters apply even when hidden',async({page})=>{
 const f=await fixture(page);try{
  const source=f.app.repo.create(f.actor,'views',{name:'High priority',entityType:'issues',visibility:'workspace',filters:{match:'all',conditions:[{field:'priority',operator:'eq',value:2}]},insightConfig:defaultInsight});
  const linked={...defaultInsight,id:'linked',name:'Linked analysis',sourceViewId:source.id};
  await page.request.patch(f.url+'/api/v1/dashboards/'+f.dashboard.id,{data:{widgets:[linked],filters:{match:'all',conditions:[{field:'estimate',operator:'eq',value:4}]}}});await page.reload();
  await expect(card(page,'linked').getByText('1 matching issues',{exact:true})).toBeVisible();await expect(page.getByText('Applied to every insight',{exact:true})).toBeVisible();
  await options(page,'linked','Linked analysis');await page.getByRole('menuitem',{name:'Metric',exact:true}).click();await expect.poll(()=>f.current().widgets[0].displayMode).toBe('metric');
  expect(f.app.repo.get(f.actor,'views',source.id).insightConfig).toEqual(defaultInsight);await page.reload();await expect(card(page,'linked').locator('.feature-insight-metric strong')).toHaveText('1');
  await page.getByRole('button',{name:'Saved filters'}).click();await page.getByRole('button',{name:/^Hide saved filters/}).click();await expect(card(page,'linked').getByText('1 matching issues',{exact:true})).toBeVisible();
  await page.request.patch(f.url+'/api/v1/views/'+source.id,{data:{filters:{match:'all',conditions:[{field:'priority',operator:'eq',value:3}]}}});await expect(card(page,'linked').locator('.feature-insight-metric strong')).toHaveText('0');
 }finally{await page.close();await f.app.close();}
});

test('an open drilldown drops issues removed from its current scope',async({page})=>{
 const f=await fixture(page);try{
  await card(page,'count').getByRole('button',{name:'Explore Open issues issues',exact:true}).click();await expect(page.getByRole('dialog',{name:'2 issues',exact:true})).toBeVisible();
  await page.request.patch(f.url+'/api/v1/dashboards/'+f.dashboard.id,{data:{filters:{match:'all',conditions:[{field:'priority',operator:'eq',value:2}]}}});
  const detail=page.getByRole('dialog',{name:'1 issues',exact:true});await expect(detail).toBeVisible();await expect(detail.getByRole('link',{name:/Follow up/})).toHaveCount(0);await expect(detail.getByRole('link',{name:/Prepare launch/})).toBeVisible();
 }finally{await page.close();await f.app.close();}
});
