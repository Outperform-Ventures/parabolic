import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';
test('scatter, table and bar selections cross-highlight and percentile zoom preserves physical points',async({page})=>{
  test.setTimeout(60000);page.setDefaultTimeout(10000);
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Analyst',email:'chart-interactions@example.test',password:'chart-interaction-password'}});
    const data=await(await page.request.get(url+'/api/v1/state')).json(),team=data.teams[0],done=data.statuses.find((s:any)=>s.teamId===team.id&&s.type==='completed'),actor={userId:data.user.id,workspaceId:data.workspaceId,role:'owner',scopes:['admin']};
    const labels=['Primary slice','Secondary slice'].map(name=>app.repo.create(actor,'labels',{name}));
    for(const [index,days] of [5,10,20].entries()){
      const issue=app.repo.create(actor,'issues',{title:'Duration '+days,teamId:team.id,statusId:done.id,priority:index===2?4:2,labelIds:index===0?labels.map(label=>label.id):[]});
      app.repo.save('issues',{...issue,createdAt:'2026-08-01T12:00:00Z',startedAt:'2026-08-02T12:00:00Z',completedAt:new Date(Date.parse('2026-08-02T12:00:00Z')+days*86400000).toISOString()},'update',actor);
    }
    const query=new URLSearchParams({tab:'Assigned',insights:JSON.stringify({measure:'Cycle Time',group:'Priority',segment:'Status type',chartType:'Auto',latencyPercentiles:[.25,.5,.75,.95],latencyScale:'linear'}),insightContext:JSON.stringify({filter:{conditions:[],match:'all'},query:'',showCompleted:true,showSubIssues:true})});
    await page.goto(url+'/team/'+team.id+'/all?'+query);
    const panel=page.getByRole('complementary',{name:'View insights',exact:true}),canvas=panel.locator('canvas');
    await expect(canvas).toHaveAttribute('data-point-count','3');
    await panel.getByRole('button',{name:'Filter view by High',exact:true}).hover();
    await expect(canvas).toHaveAttribute('data-highlighted-point-count','2');
    await canvas.focus();await page.keyboard.press('Home');
    await expect(panel.locator('.feature-insight-tooltip')).toContainText('completed');
    await expect(panel.locator('.view-insight-table tr[data-highlighted="true"]')).toHaveCount(1);
    await panel.getByRole('button',{name:'Zoom to 50th percentile',exact:true}).click();
    await expect(canvas).toHaveAttribute('data-point-count','2');
    await panel.getByRole('button',{name:'Reset percentile zoom',exact:true}).click();
    await expect(canvas).toHaveAttribute('data-point-count','3');
    await panel.getByRole('button',{name:'Filter at or below P75',exact:true}).click();await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveCount(2);await panel.getByRole('button',{name:'Clear insight selection',exact:true}).click();
    await panel.getByRole('button',{name:'Filter above P75',exact:true}).click();await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveCount(1);await expect(page.locator('.issue-list-scroll [data-issue-id]')).toContainText('Duration 20');await panel.getByRole('button',{name:'Clear insight selection',exact:true}).click();
    await panel.getByLabel('Latency scale',{exact:true}).selectOption('log');await expect(canvas).toHaveAttribute('data-point-count','3');await panel.getByLabel('Latency scale',{exact:true}).selectOption('linear');
    await panel.getByRole('button',{name:'Filter view by High',exact:true}).click();
    await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveCount(2);
    await panel.getByRole('button',{name:'Clear insight selection',exact:true}).click();
    await panel.getByLabel('Measure',{exact:true}).selectOption('Issue count');
    const bar=panel.getByRole('button',{name:'High, completed: 2 issues',exact:true});await page.mouse.move(20,20);await bar.hover();
    await expect(panel.locator('.view-insight-table tr[data-highlighted="true"]')).toContainText('High');
    await bar.click();await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveCount(2);
    await panel.getByRole('button',{name:'Clear insight selection',exact:true}).click();
    await panel.getByLabel('Slice',{exact:true}).selectOption('Burn-up');
    await expect(panel.getByRole('img',{name:'Historical burn-up chart',exact:true})).toBeVisible();
    await panel.getByLabel('Interval',{exact:true}).selectOption('week');await expect(panel.getByLabel('Interval',{exact:true})).toHaveValue('week');
    await panel.getByLabel('Interval',{exact:true}).selectOption('month');await expect(panel.getByRole('img',{name:'Historical burn-up chart',exact:true})).toBeVisible();
    await panel.getByLabel('Slice',{exact:true}).selectOption('Label group');await panel.getByLabel('Measure',{exact:true}).selectOption('Cycle Time');await expect(canvas).toHaveAttribute('data-point-count','4');
    await canvas.focus();await page.keyboard.press('Home');const visited:string[]=[];
    for(let index=0;index<4;index++){visited.push(await panel.locator('.feature-insight-tooltip').innerText());if(index<3)await page.keyboard.press('ArrowRight');}
    expect(visited.filter(text=>text.includes('Duration 5'))).toHaveLength(2);expect(visited.some(text=>text.includes('Duration 5')&&text.includes('Primary slice'))).toBe(true);expect(visited.some(text=>text.includes('Duration 5')&&text.includes('Secondary slice'))).toBe(true);
    await panel.getByLabel('Measure',{exact:true}).selectOption('Issue count');await panel.getByLabel('Slice',{exact:true}).selectOption('Created date');await panel.getByLabel('Interval',{exact:true}).selectOption('week');await expect(panel.getByRole('button',{name:'Filter view by 2026-07-27',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('insights:')).map(key=>JSON.parse(localStorage.getItem(key)||'{}')).some(value=>value.group==='Created date'&&value.interval==='week'))).toBe(true);await page.reload();await expect(panel.getByLabel('Slice',{exact:true})).toHaveValue('Priority');await panel.getByLabel('Slice',{exact:true}).selectOption('Label group');await expect(panel.getByLabel('Slice label group',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Filter view by Primary slice',exact:true})).toBeVisible();await panel.getByLabel('Slice',{exact:true}).selectOption('Customer');await expect(panel.getByRole('button',{name:'Filter view by No customer',exact:true})).toBeVisible();
    const customerResponse=await page.request.post(url+'/api/v1/customers',{data:{name:'Initial customer'}});expect(customerResponse.ok()).toBeTruthy();const customer=await customerResponse.json();const current=await(await page.request.get(url+'/api/v1/state')).json();expect((await page.request.patch(url+'/api/v1/issues/'+current.issues.find((issue:any)=>issue.title==='Duration 5').id,{data:{customerId:customer.id}})).ok()).toBeTruthy();await expect(panel.getByRole('button',{name:'Filter view by Initial customer',exact:true})).toBeVisible();await page.request.patch(url+'/api/v1/customers/'+customer.id,{data:{name:'Renamed customer'}});await expect(panel.getByRole('button',{name:'Filter view by Renamed customer',exact:true})).toBeVisible();
    await panel.getByLabel('Hide empty slices',{exact:true}).check();await expect(panel.getByRole('button',{name:'Filter view by No customer',exact:true})).toHaveCount(0);await panel.getByLabel('Hide empty slices',{exact:true}).uncheck();await expect(panel.getByRole('button',{name:'Filter view by No customer',exact:true})).toBeVisible();await panel.getByLabel('Slice',{exact:true}).selectOption('Created date');await panel.getByLabel('Interval',{exact:true}).selectOption('quarter');await expect(panel.getByRole('button',{name:'Filter view by 2026-07-01',exact:true})).toBeVisible();
    query.set('insights',JSON.stringify({measure:'Cycle Time',group:'Priority',chartType:'Auto'}));await page.goto(url+'/team/'+team.id+'/all?'+query);await expect(panel.getByLabel('Latency scale',{exact:true})).toHaveValue('log');await expect(panel.getByRole('button',{name:'Filter at or below P50',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Filter at or below P95',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Filter at or below P75',exact:true})).toHaveCount(0);await expect(panel.getByLabel('Segment',{exact:true})).toHaveCount(0);await panel.getByLabel('Insight order',{exact:true}).selectOption('0.5');await panel.getByLabel('Insight direction',{exact:true}).selectOption('desc');await expect(panel.locator('.view-insight-table tbody tr').first()).toContainText('Low');
    await panel.getByLabel('Insight display',{exact:true}).selectOption('Metric');await expect(panel.getByRole('button',{name:'Explore Cycle Time P50',exact:true}).locator('strong')).toHaveText('10');await expect(panel.getByRole('button',{name:'Explore Cycle Time P95',exact:true})).toBeVisible();await expect(panel.locator('.feature-insight-metric')).toHaveCount(2);await panel.getByRole('button',{name:'Explore Cycle Time P95',exact:true}).click();await expect(page.locator('.issue-list-scroll [data-issue-id]')).toHaveCount(1);await expect(page.locator('.issue-list-scroll [data-issue-id]')).toContainText('Duration 20');await panel.getByRole('button',{name:'Clear insight selection',exact:true}).click();
    await panel.getByLabel('Measure',{exact:true}).selectOption('Issue count');await panel.getByLabel('Insight display',{exact:true}).selectOption('Bar');await panel.getByLabel('Slice',{exact:true}).selectOption('Label');await page.request.patch(url+'/api/v1/labels/'+labels[0].id,{data:{color:'#123456'}});const colored=panel.getByRole('button',{name:'Primary slice, All: 1 issues',exact:true});await expect(colored).toHaveCSS('background-color','rgb(18, 52, 86)');await panel.getByLabel('Insight colors',{exact:true}).selectOption('categorical');await expect(colored).not.toHaveCSS('background-color','rgb(18, 52, 86)');
  }finally{await page.close();await app.close();}
});
