import {test,expect,type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

async function fixture(page:Page){
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  await page.request.post(url+'/auth/setup',{data:{name:'Customer Example',email:'customers-ui@example.test',password:'isolated-customer-ui'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={workspaceId:state.workspaceId,userId:state.user.id,role:'owner',scopes:['admin']},repo=app.repo,team=state.teams[0];
  const a=repo.create(actor,'customers',{name:'Alpha Company'}),b=repo.create(actor,'customers',{name:'Beta Company'}),feedback=repo.create(actor,'customers',{name:'Feedback only'});
  const project=repo.create(actor,'projects',{name:'Client implementation',teamIds:[team.id],directCustomerIds:[a.id]}),other=repo.create(actor,'projects',{name:'Another project',teamIds:[team.id]});
  const issue=repo.create(actor,'issues',{title:'Customer-linked task',teamId:team.id,projectId:project.id,assigneeId:state.user.id}),standalone=repo.create(actor,'issues',{title:'Standalone task',teamId:team.id,assigneeId:state.user.id});
  repo.create(actor,'requests',{title:'Feedback on implementation',projectId:project.id,customerId:feedback.id});
  const route=url+'/team/'+team.id+'/all';
  const key=`display:${state.workspaceId}:${state.user.id}:${team.id}:all`;
  await page.addInitScript(key=>!localStorage.getItem(key)&&localStorage.setItem(key,JSON.stringify({groupBy:'none',properties:['identifier','statusId','projectId','effectiveCustomerIds']})),key);
  await page.goto(route);await expect(page.locator('.issue-row')).toHaveCount(2);
  const saved=()=>repo.get(actor,'issues',issue.id);
  return{app,url,repo,actor,a,b,feedback,project,other,issue,standalone,route,key,team,saved};
}

for(const board of [false,true])test(`customer picker replaces inherited customers with a single selection from ${board?'board':'list'} without opening issue`,async({page},info)=>{
  const f=await fixture(page);try{
    if(board){await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('tab',{name:'Board',exact:true}).click();await page.keyboard.press('Escape')}
    await expect(page.locator(board?'.board-card':'.issue-row').filter({hasText:'Standalone task'}).locator('.customer-assignment-control')).toHaveCount(0);
    const row=page.locator(board?'.board-card':'.issue-row').filter({hasText:'Customer-linked task'});
    await row.getByRole('button',{name:'Change customers',exact:true}).click();const menu=page.getByRole('dialog',{name:'Assign customers',exact:true});
    await expect(menu.getByRole('option',{name:'Alpha Company',exact:true})).toHaveAttribute('aria-selected','true');await expect(menu.getByRole('checkbox')).toHaveCount(0);await expect(menu.getByRole('button',{name:/^(Cancel|Apply)$/})).toHaveCount(0);await page.keyboard.press('Escape');expect(f.saved().directCustomerIds??[]).toEqual([]);
    await row.getByRole('button',{name:'Change customers',exact:true}).click();await menu.getByRole('option',{name:'Beta Company',exact:true}).click();await expect(menu).toHaveCount(0);await expect.poll(()=>f.saved().directCustomerIds).toEqual([f.b.id]);await expect(page).toHaveURL(f.route);await expect(row).not.toContainText('Alpha Company');await expect(row).toContainText('Beta Company');expect(f.repo.all('requests',f.actor.workspaceId)).toHaveLength(1);
    expect(f.saved().inheritProjectCustomers).toBe(false);expect(f.repo.present(f.actor,'issues',f.saved()).effectiveCustomerIds).toEqual([f.b.id]);
    await page.reload();await expect(row).toContainText('Beta Company');await expect(row).not.toContainText('Alpha Company');await page.screenshot({path:info.outputPath('customer-assignment.png')});
  }finally{await page.close();await f.app.close()}
});

test('unassigned customer cells stay blank and customers can still be added from issue details',async({page},info)=>{
  const f=await fixture(page);try{
    const row=page.locator(`[data-issue-id="${f.standalone.id}"]`);
    await expect(row.locator('.customer-assignment-control')).toHaveCount(0);
    await expect(row).not.toContainText('Add customer');
    await page.getByRole('button',{name:'Edit columns',exact:true}).click();
    await expect(row.locator('[data-column-cell="effectiveCustomerIds"]')).toBeEmpty();
    await expect(row.locator('[data-column-cell="projectId"]')).toBeEmpty();
    await expect(page.locator(`[data-issue-id="${f.issue.id}"] [data-column-cell="effectiveCustomerIds"]`)).toContainText('Alpha Company');
    await page.screenshot({path:info.outputPath('blank-customer-cell.png')});
    await page.locator('.issue-column-toolbar').getByRole('button',{name:'Cancel',exact:true}).click();
    await row.locator('.issue-row-title').click();
    await page.locator('.issue-properties-panel').getByRole('button',{name:'Change customers',exact:true}).click();
    const menu=page.getByRole('dialog',{name:'Assign customers',exact:true});
    await menu.getByRole('option',{name:'Beta Company',exact:true}).click();
    await expect.poll(()=>f.repo.get(f.actor,'issues',f.standalone.id).directCustomerIds).toEqual([f.b.id]);
    await page.goto(f.route);
    await expect(row).toContainText('Beta Company');
    await row.getByRole('button',{name:'Change customers',exact:true}).click();
    await menu.getByRole('option',{name:'No customer',exact:true}).click();
    await expect(row.locator('.customer-assignment-control')).toHaveCount(0);
    await page.reload();
    await expect(row).toBeVisible();
    await expect(row.locator('.customer-assignment-control')).toHaveCount(0);
    await expect(row).not.toContainText('Add customer');
  }finally{await page.close();await f.app.close()}
});

test('customer pages show independently assigned work, support inline editing and creation, and keep requests separate',async({page},info)=>{
  const f=await fixture(page);try{
    await page.goto(f.url+'/customer/'+f.a.id);
    const cards=page.getByRole('group',{name:'Customer sections',exact:true});
    await expect(page.getByRole('button',{name:'Overview',exact:true})).toHaveCount(0);
    await expect(page.locator('.customer-detail>.feature-tabs')).toHaveCount(0);
    await expect(cards.getByRole('button')).toHaveCount(3);
    await expect(cards.getByRole('button',{pressed:true})).toHaveCount(0);
    await page.screenshot({path:info.outputPath('customer-card-navigation.png')});
    await cards.getByRole('button',{name:'Issues',exact:true}).click();await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Customer-linked task');
    const issueRoute=f.url+'/customer/'+f.a.id+'/issues';
    await expect(page).toHaveURL(issueRoute);
    await expect(cards).toHaveCount(0);
    await expect(page.locator('.customer-detail-summary,.customer-detail-properties,.customer-work-summary,.issue-filter-chips')).toHaveCount(0);
    await page.screenshot({path:info.outputPath('clean-customer-issues.png')});
    await page.goBack();await expect(cards).toBeVisible();
    await cards.getByRole('button',{name:'Issues',exact:true}).press('Enter');
    await expect(page).toHaveURL(issueRoute);await page.reload();
    await expect(page.locator('.issue-row')).toHaveCount(1);
    await page.locator('.issue-row-title').click();
    await expect(page).toHaveURL(f.url+'/issues/'+f.issue.id);
    await page.goBack();await expect(page).toHaveURL(issueRoute);
    await expect(cards).toHaveCount(0);
    await page.locator('.issue-row').getByRole('button',{name:'Change customers',exact:true}).click();await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'New issue',exact:true}).click();await expect(page.locator('.composer-properties')).toContainText('Alpha Company');await page.keyboard.press('Escape');
    await page.locator('.feature-header').getByRole('link',{name:f.a.name,exact:true}).click();
    await page.getByRole('button',{name:'Projects',exact:true}).click();await expect(page.locator('[data-project-row]')).toHaveCount(1);await expect(page.locator('[data-project-row]')).toContainText('Client implementation');
    await page.getByRole('button',{name:'New project',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Alpha Company');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Requests',exact:true}).click();await expect(page.getByText('No requests yet', {exact:true})).toBeVisible();
    await expect(cards.getByRole('button',{pressed:true})).toHaveText('0Requests');
    await expect(cards.getByRole('button')).toHaveCount(3);
    await page.goto(f.url+'/customer/'+f.feedback.id);await page.getByRole('button',{name:'Issues',exact:true}).click();await expect(page.locator('.issue-row')).toHaveCount(0);await page.locator('.feature-header').getByRole('link',{name:f.feedback.name,exact:true}).click();await page.getByRole('button',{name:'Requests',exact:true}).click();await expect(page.getByText('Feedback on implementation',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('customer-requests-separate.png')});
  }finally{await page.close();await f.app.close()}
});

test('project picker, direct customer filter and inline customer creation persist',async({page})=>{
  const f=await fixture(page);try{
    await page.goto(f.url+'/project/'+f.other.id+'/overview');await page.getByRole('button',{name:'Change customers',exact:true}).first().click();const menu=page.getByRole('dialog',{name:'Assign customers'});await menu.getByRole('option',{name:'Beta Company',exact:true}).click();await expect.poll(()=>f.repo.get(f.actor,'projects',f.other.id).directCustomerIds).toEqual([f.b.id]);
    await page.goto(f.route);await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('menuitem',{name:'Customer',exact:true}).click();await page.getByRole('menuitem',{name:'Alpha Company'}).click();await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Customer-linked task');
    await page.locator('.issue-row').getByRole('button',{name:'Change customers',exact:true}).click();await menu.getByRole('combobox',{name:'Search customers'}).fill('Gamma Company');await menu.getByRole('button',{name:'Create Gamma Company',exact:true}).click();const create=page.getByRole('dialog',{name:'New customer',exact:true});await create.getByRole('button',{name:'Create customer',exact:true}).click();await expect(create).toHaveCount(0);await expect(menu).toHaveCount(0);await expect.poll(()=>f.saved().directCustomerIds?.length).toBe(1);const gamma=f.repo.all('customers',f.actor.workspaceId).find(c=>c.name==='Gamma Company')!;expect(f.saved().directCustomerIds).toEqual([gamma.id]);expect(f.repo.present(f.actor,'issues',f.saved()).effectiveCustomerIds).toEqual([gamma.id]);
  }finally{await page.close();await f.app.close()}
});

test('customer assignment popup stays within the window and bulk add/remove preserves project inheritance',async({page},info)=>{
  const f=await fixture(page);try{
    await page.locator(`[data-issue-id="${f.issue.id}"]`).getByRole('button',{name:'Change customers',exact:true}).click();const menu=page.getByRole('dialog',{name:'Assign customers'});
    for(const width of [1280,610,360]){await page.setViewportSize({width,height:700});await expect.poll(()=>menu.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth})).toBe(true)}await page.screenshot({path:info.outputPath('customer-picker-narrow.png')});await page.keyboard.press('Escape');await page.setViewportSize({width:1280,height:900});
    for(const issue of [f.issue,f.standalone])await page.getByRole('button',{name:'Select '+issue.identifier,exact:true}).click();
    const toolbar=page.getByRole('toolbar',{name:'Selected issues'});await toolbar.getByRole('button',{name:'Choose customers…',exact:true}).click();await menu.getByRole('checkbox',{name:'Assign Beta Company',exact:true}).check();await menu.getByRole('button',{name:'Apply',exact:true}).click();await expect.poll(()=>f.repo.get(f.actor,'issues',f.standalone.id).directCustomerIds).toEqual([f.b.id]);expect(f.repo.present(f.actor,'issues',f.saved()).effectiveCustomerIds).toContain(f.a.id);
  }finally{await page.close();await f.app.close()}
});
test('context menus, undo, direct removal and offline synchronization retain customer assignments',async({page,context})=>{
  const f=await fixture(page);try{
    const row=page.locator('.issue-row').filter({hasText:'Customer-linked task'}),menu=page.getByRole('dialog',{name:'Assign customers',exact:true});
    await row.click({button:'right'});await page.getByRole('button',{name:'Customers…',exact:true}).click();await menu.getByRole('option',{name:'Beta Company',exact:true}).click();await expect.poll(()=>f.saved().directCustomerIds).toEqual([f.b.id]);await page.keyboard.press('Escape');await page.locator('.view-toolbar').click({position:{x:2,y:2}});await page.keyboard.press('ControlOrMeta+z');await expect.poll(()=>f.saved().directCustomerIds??[]).toEqual([]);
    await page.goto(f.url+'/projects');const project=page.locator('[data-project-row="'+f.other.id+'"]');await project.click({button:'right'});await page.getByRole('button',{name:'Customers…',exact:true}).click();await menu.getByRole('option',{name:'Beta Company',exact:true}).click();await expect.poll(()=>f.repo.get(f.actor,'projects',f.other.id).directCustomerIds).toEqual([f.b.id]);
    await page.goto(f.route);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);
    await row.getByRole('button',{name:'Change customers',exact:true}).click();await menu.getByRole('option',{name:'Beta Company',exact:true}).click();await expect(row).toContainText('Beta Company');expect(f.saved().directCustomerIds??[]).toEqual([]);await page.reload();await expect(row).toContainText('Beta Company');await context.setOffline(false);await expect.poll(()=>f.saved().directCustomerIds,{timeout:20000}).toEqual([f.b.id]);
    await row.getByRole('button',{name:'Select '+f.issue.identifier,exact:true}).click();const toolbar=page.getByRole('toolbar',{name:'Selected issues'});await toolbar.getByRole('combobox',{name:'Customer assignment operation'}).selectOption('remove');await toolbar.getByRole('button',{name:'Choose customers…'}).click();await menu.getByRole('checkbox',{name:'Assign Beta Company',exact:true}).check();await menu.getByRole('button',{name:'Apply',exact:true}).click();await expect.poll(()=>f.saved().directCustomerIds).toEqual([]);expect(f.repo.present(f.actor,'issues',f.saved()).effectiveCustomerIds).toEqual([]);
  }finally{await context.setOffline(false);await page.close();await f.app.close()}
});
test('customer directory and work pages fit narrow windows without nested horizontal scrollbars',async({page},info)=>{
 const f=await fixture(page);try{
  for(let n=0;n<60;n++)f.repo.create(f.actor,'issues',{title:'Customer work '+n,teamId:f.team.id,projectId:f.project.id});
  await page.goto(f.url+'/customers');
  for(const width of [1280,768,610]){await page.setViewportSize({width,height:900});await expect.poll(()=>page.locator('.customer-directory-page').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await expect.poll(()=>page.locator('.customer-directory-table').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)}
  await page.screenshot({path:info.outputPath('customer-directory-narrow.png')});await page.goto(f.url+'/customer/'+f.a.id);await page.getByRole('button',{name:'Issues',exact:true}).click();await expect(page.locator('.issue-row').first()).toBeVisible();await expect.poll(()=>page.locator('.customer-work-page').evaluate(el=>el.scrollHeight<=el.clientHeight&&el.scrollWidth<=el.clientWidth)).toBe(true);await expect.poll(()=>page.locator('.customer-work-view').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);await page.screenshot({path:info.outputPath('customer-work-narrow.png')});
 }finally{await page.close();await f.app.close()}
});
test('saved customer views retain their customer scope after clearing extra filters',async({page})=>{
 const f=await fixture(page);try{
  await page.goto(f.url+'/customer/'+f.a.id+'/issues');
  await expect(page.locator('.issue-filter-chips')).toHaveCount(0);
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();
  await expect(page.getByRole('menuitem',{name:'Customer',exact:true})).toHaveCount(0);
  await page.getByRole('menuitem',{name:'Priority',exact:true}).click();
  await page.getByRole('menuitem',{name:'No priority',exact:true}).click();
  await expect(page.locator('.issue-filter-chips')).toContainText('Priority');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await expect(page.locator('.issue-filter-chips')).toHaveCount(0);
  await expect(page.locator('.issue-row')).toHaveCount(1);
  await page.getByRole('button',{name:'Save filtered view',exact:true}).click();const dialog=page.getByRole('dialog',{name:'New view',exact:true});await dialog.getByLabel('Name',{exact:true}).fill('Alpha customer work');await dialog.getByRole('button',{name:'Create view',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Customer-linked task');const view=f.repo.all('views',f.actor.workspaceId).find(v=>v.name==='Alpha customer work')!;expect(view.filters.conditions).toContainEqual({field:'effectiveCustomerIds',operator:'contains',value:f.a.id});
 }finally{await page.close();await f.app.close()}
});

test('customer issue scope cannot be broadened by URL filters, clearing filters, or alternate layouts',async({page})=>{
 const f=await fixture(page);try{
  const direct=f.repo.create(f.actor,'issues',{title:'Direct customer task',teamId:f.team.id,directCustomerIds:[f.a.id]});
  const route=f.url+'/customer/'+f.a.id+'/issues';
  const filter={match:'any',conditions:[{field:'effectiveCustomerIds',operator:'contains',value:f.b.id},{field:'title',operator:'contains',value:'task'}]};
  await page.goto(route+'?filter='+encodeURIComponent(JSON.stringify(filter)));
  await expect(page.locator('.issue-row')).toHaveCount(2);
  await expect(page.locator(`[data-issue-id="${f.standalone.id}"]`)).toHaveCount(0);
  await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page).toHaveURL(route);
  await page.reload();await expect(page.locator('.issue-row')).toHaveCount(2);
  await expect(page.locator('.issue-filter-chips')).toHaveCount(0);
  await page.getByRole('button',{name:'Filter issues',exact:true}).click();
  await page.getByRole('menuitem',{name:'Advanced filter',exact:true}).click();
  await page.locator('.filter-builder').getByRole('button',{name:'Add filter',exact:true}).click();
  await expect(page.getByLabel('Issue filter 1 property').locator('option[value="effectiveCustomerIds"]')).toHaveCount(0);
  await page.locator('.filter-builder').getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.goto(route);
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('tab',{name:'Board',exact:true}).click();await page.keyboard.press('Escape');
  await expect(page.locator('.board-card')).toHaveCount(2);
  await expect(page.locator(`[data-issue-id="${direct.id}"]`)).toBeVisible();
  await expect(page.locator(`[data-issue-id="${f.standalone.id}"]`)).toHaveCount(0);
 }finally{await page.close();await f.app.close()}
});

test('customer picker matches project menu geometry and supports search, keyboard, links and dismissal',async({page},info)=>{
 const f=await fixture(page);try{
  const row=page.locator(`[data-issue-id="${f.issue.id}"]`),menu=page.getByRole('dialog',{name:'Assign customers',exact:true});
  const geometry=async(selector:string)=>page.locator(selector).evaluate(el=>{
    const style=getComputedStyle(el),option=el.querySelector<HTMLElement>('[role="option"]')!,input=el.querySelector('input')!,optionStyle=getComputedStyle(option);
    return {width:el.getBoundingClientRect().width,background:style.backgroundColor,border:style.borderColor,radius:style.borderRadius,inputHeight:input.getBoundingClientRect().height,rowHeight:option.getBoundingClientRect().height,rowFont:optionStyle.fontSize,rowPadding:optionStyle.padding,rowRadius:optionStyle.borderRadius};
  });
  await row.getByRole('button',{name:'Change project',exact:true}).click();
  const projectGeometry=await geometry('[data-property-menu="projectId"]');
  await page.keyboard.press('Escape');
  await row.getByRole('button',{name:'Change customers',exact:true}).click();
  expect(await geometry('.customer-assignment-menu')).toEqual(projectGeometry);
  await expect(menu.getByRole('listbox')).toHaveAttribute('aria-multiselectable','false');
  await expect(menu.getByRole('checkbox')).toHaveCount(0);
  await expect(menu.locator('footer')).toHaveCount(0);
  await expect(menu.getByRole('option',{name:'Alpha Company',exact:true})).toHaveAttribute('aria-selected','true');
  await page.screenshot({path:info.outputPath('single-customer-project-parity.png')});
  await menu.getByRole('combobox',{name:'Search customers'}).fill('bEtA');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect.poll(()=>f.saved().directCustomerIds).toEqual([f.b.id]);
  await row.getByRole('button',{name:'Change customers',exact:true}).click();
  await menu.getByRole('link',{name:'Open customer',exact:true}).click();
  await expect(page).toHaveURL(f.url+'/customer/'+f.b.id);
  await page.goto(f.route);
  await row.getByRole('button',{name:'Change customers',exact:true}).click();
  await menu.getByRole('combobox',{name:'Search customers'}).fill('No such customer');
  await expect(menu.getByRole('button',{name:'Create No such customer',exact:true})).toBeVisible();
  await menu.getByRole('button',{name:'Create No such customer',exact:true}).click();
  const create=page.getByRole('dialog',{name:'New customer',exact:true});
  await create.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(row.getByRole('button',{name:'Change customers',exact:true})).toBeFocused();
  expect(f.saved().directCustomerIds).toEqual([f.b.id]);
  await row.getByRole('button',{name:'Change customers',exact:true}).click();
  await page.locator('.view-toolbar').click({position:{x:2,y:2}});
  await expect(menu).toHaveCount(0);
  expect(f.saved().directCustomerIds).toEqual([f.b.id]);
 }finally{await page.close();await f.app.close()}
});

test('No customer overrides project inheritance and selecting one customer replaces legacy multiple assignments',async({page})=>{
 const f=await fixture(page);try{
  f.repo.update(f.actor,'issues',f.issue.id,{directCustomerIds:[f.b.id,f.feedback.id]});
  await page.reload();
  const row=page.locator(`[data-issue-id="${f.issue.id}"]`),menu=page.getByRole('dialog',{name:'Assign customers',exact:true});
  await row.getByRole('button',{name:'Change customers',exact:true}).click();
  await page.keyboard.press('Escape');
  expect(f.saved().directCustomerIds).toEqual([f.b.id,f.feedback.id]);
  await row.getByRole('button',{name:'Change customers',exact:true}).click();
  await menu.getByRole('option',{name:'Alpha Company',exact:true}).click();
  await expect.poll(()=>f.repo.present(f.actor,'issues',f.saved()).effectiveCustomerIds).toEqual([f.a.id]);
  await row.getByRole('button',{name:'Change customers',exact:true}).click();
  await menu.getByRole('option',{name:'No customer',exact:true}).click();
  await expect.poll(()=>f.repo.present(f.actor,'issues',f.saved()).effectiveCustomerIds).toEqual([]);
  await expect(row.locator('.customer-assignment-control')).toHaveCount(0);
  await page.reload();
  await expect(row).toBeVisible();
  await expect(row.locator('.customer-assignment-control')).toHaveCount(0);
  expect(f.repo.get(f.actor,'projects',f.project.id).directCustomerIds).toEqual([f.a.id]);
 }finally{await page.close();await f.app.close()}
});

test('switching between project and customer pickers closes the old menu and Enter targets the current form',async({page})=>{
 const f=await fixture(page);try{
  const row=page.locator(`[data-issue-id="${f.issue.id}"]`),project=page.locator('[data-property-menu="projectId"]'),customer=page.locator('[data-property-menu="customers"]');
  await row.getByRole('button',{name:'Change project',exact:true}).click();
  await project.locator('input').fill('Uncreated project');
  await row.getByRole('button',{name:'Change customers',exact:true}).click();
  await expect(project).toHaveCount(0);
  await customer.locator('input').fill('Uncreated customer');
  await customer.locator('input').press('Enter');
  const form=page.getByRole('dialog',{name:'New customer',exact:true});
  await expect(form.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('Uncreated customer');
  await expect(page.getByRole('dialog',{name:'New project',exact:true})).toHaveCount(0);
  await form.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(customer).toBeVisible();
  await row.getByRole('button',{name:'Change project',exact:true}).click();
  await expect(customer).toHaveCount(0);
  await expect(project).toBeVisible();
  await project.locator('input').fill('Uncreated project');
  await project.locator('input').press('Enter');
  await expect(page.getByRole('dialog',{name:'New project',exact:true}).getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Uncreated project');
 }finally{await page.close();await f.app.close()}
});

for(const kind of ['project','customer'] as const)for(const activation of ['Enter','click'] as const)test(`${kind} unmatched search shows only Create name and ${activation} opens a prefilled form`,async({page},info)=>{
 const f=await fixture(page);try{
  const row=page.locator(`[data-issue-id="${f.issue.id}"]`);
  const menu=page.locator(`[data-property-menu="${kind==='project'?'projectId':'customers'}"]`);
  await row.getByRole('button',{name:kind==='project'?'Change project':'Change customers',exact:true}).click();
  const input=menu.locator('input');
  await input.fill(kind==='project'?'cLiEnT':'aLpHa');
  await expect(menu.getByRole('option',{name:kind==='project'?'Client implementation':'Alpha Company',exact:true})).toBeVisible();
  await expect(menu.getByText(/^Create (cLiEnT|aLpHa)$/)).toHaveCount(0);
  await input.fill('   ');
  await expect(menu.getByRole('option',{name:`No ${kind}`,exact:true})).toBeVisible();
  await expect(menu.getByText(`New ${kind}`,{exact:true})).toBeVisible();
  await input.fill('No matching name');
  await input.fill('');
  await expect(menu.getByRole('link',{name:`Open ${kind}`,exact:true})).toBeVisible();
  const name=`New ${kind} & research / "Pilot"`;
  await input.fill(`  ${name}  `);
  await expect(menu.locator('.menu-item')).toHaveCount(1);
  await expect(menu.locator('.menu-item')).toHaveText(`Create ${name}`);
  await expect(menu.locator('.property-menu-group,.menu-empty,a')).toHaveCount(0);
  await expect.poll(()=>menu.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(110);
  await expect.poll(()=>menu.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`${kind}-create-only.png`)});
  if(activation==='Enter')await input.press('Enter');else await menu.locator('.menu-item').click();
  const form=page.getByRole('dialog',{name:`New ${kind}`,exact:true});
  const nameInput=form.getByRole('textbox',{name:kind==='project'?'Project name':'Name',exact:true});
  await expect(nameInput).toHaveValue(name);
  await expect(menu).toHaveCount(0);
  expect(f.repo.all(kind==='project'?'projects':'customers',f.actor.workspaceId).some(item=>item.name===name)).toBe(false);
  expect(f.saved().projectId).toBe(f.project.id);
  expect(f.saved().directCustomerIds??[]).toEqual([]);
  if(activation==='Enter'){
    await form.getByRole('button',{name:`Create ${kind}`,exact:true}).click();
    await expect(form).toHaveCount(0);
    await expect.poll(()=>f.repo.all(kind==='project'?'projects':'customers',f.actor.workspaceId).filter(item=>item.name===name).length).toBe(1);
  }else{
    await form.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(form).toHaveCount(0);
    expect(f.repo.all(kind==='project'?'projects':'customers',f.actor.workspaceId).some(item=>item.name===name)).toBe(false);
    if(kind==='project'){
      await page.getByRole('button',{name:'New project',exact:true}).click();
      await expect(nameInput).toHaveValue('');
    }else{
      await expect(menu.locator('.menu-item')).toHaveText(`Create ${name}`);
      await page.keyboard.press('Escape');
    }
  }
 }finally{await page.close();await f.app.close()}
});
