import {test,expect,type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {createApp} from '../../src/server/app';

async function fixture(page:Page){
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 await page.request.post(url+'/auth/setup',{data:{name:'History tester',email:'history@example.test',password:'isolated-history-test'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),actor={userId:state.user.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin']},team=state.teams[0];
 const issue=app.repo.create(actor,'issues',{title:'History navigation example',teamId:team.id,assigneeId:state.user.id});
 const view=app.repo.create(actor,'views',{name:'History master view',entityType:'issues',filters:{match:'all',conditions:[]},display:{layout:'list',groupBy:'statusId',showCompleted:'all'}});
 const route=url+'/view/'+view.id;
 await page.goto(route);await expect(page.locator('.issue-row-title')).toContainText(issue.title);
 const openIssue=async()=>{await page.locator('.issue-row-title').filter({hasText:issue.title}).click();await expect(page).toHaveURL(url+'/issues/'+issue.id);await expect(page.getByLabel('Issue title',{exact:true})).toHaveValue(issue.title);};
 return {app,url,actor,issue,route,openIssue};
}

// Browser-protocol input is trusted input, so this also exercises Chromium's
// native side-button history default (synthetic DOM events would not).
async function mouseHistory(page:Page,button:'back'|'forward'){
 const session=await page.context().newCDPSession(page);
 try{
  await session.send('Input.dispatchMouseEvent',{type:'mousePressed',x:600,y:85,button,buttons:button==='back'?8:16,clickCount:1});
  await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:600,y:85,button,buttons:0,clickCount:1});
 }finally{await session.detach()}
}
const blur=(page:Page)=>page.evaluate(()=>(document.activeElement as HTMLElement)?.blur());

test('Backspace and mouse side buttons traverse exactly one step and restore the saved view',async({page})=>{
 const f=await fixture(page);try{
  // URL changes can precede the lazy route's commit. Wait for the destination
  // content before sending another hardware event, just as a user would.
  const atIssue=async()=>{await expect(page).toHaveURL(f.url+'/issues/'+f.issue.id);await expect(page.getByLabel('Issue title',{exact:true})).toHaveValue(f.issue.title);};
  const atView=async()=>{await expect(page).toHaveURL(f.route);await expect(page.locator('.issue-row-title')).toContainText(f.issue.title);};
  const atCustomers=async()=>{await expect(page).toHaveURL(f.url+'/customers');await expect(page.locator('header').getByRole('heading',{name:'Customers',exact:true})).toBeVisible();};
  await f.openIssue();await blur(page);
  await page.keyboard.press('Backspace');await atView();
  await page.keyboard.press('Shift+Backspace');await atIssue();
  await page.getByRole('link',{name:'Customers',exact:true}).click();await expect(page.locator('header').getByRole('heading',{name:'Customers',exact:true})).toBeVisible();
  await mouseHistory(page,'back');await atIssue();
  await mouseHistory(page,'back');await atView();
  await mouseHistory(page,'forward');await atIssue();
  await mouseHistory(page,'forward');await atCustomers();
  await mouseHistory(page,'forward');await atCustomers();
  expect(f.app.repo.get(f.actor,'issues',f.issue.id).deletedAt).toBeFalsy();
 }finally{await page.close();await f.app.close()}
});

test('Backspace edits text, respects menus and modal drafts, and does not repeat navigation',async({page})=>{
 const f=await fixture(page);try{
  await f.openIssue();const title=page.getByLabel('Issue title',{exact:true});
  await title.focus();await title.press('End');await title.press('Backspace');
  await expect(title).toHaveValue('History navigation exampl');await expect(page).toHaveURL(f.url+'/issues/'+f.issue.id);
  await title.fill(f.issue.title);await blur(page);
  await page.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',repeat:true,bubbles:true,cancelable:true})));
  await expect(page).toHaveURL(f.url+'/issues/'+f.issue.id);
  await page.getByRole('button',{name:'Change customers',exact:true}).first().click();
  const menu=page.getByRole('dialog',{name:'Assign customers',exact:true}),search=menu.getByRole('combobox');
  await search.fill('Typing');await search.press('Backspace');await expect(search).toHaveValue('Typin');
  await search.press('Enter');const form=page.getByRole('dialog',{name:'New customer',exact:true});
  await expect(form).toBeVisible();await form.getByRole('button',{name:'Cancel',exact:true}).focus();
  await page.keyboard.press('Backspace');await mouseHistory(page,'back');
  await expect(form).toBeVisible();await expect(page).toHaveURL(f.url+'/issues/'+f.issue.id);
  await form.getByRole('button',{name:'Cancel',exact:true}).click();await page.keyboard.press('Escape');
  await page.evaluate(()=>{const el=document.createElement('div');el.contentEditable='plaintext-only';el.setAttribute('aria-label','Plaintext editor probe');el.textContent='Text';document.body.append(el);el.focus()});
  const editor=page.getByLabel('Plaintext editor probe');await editor.press('End');await editor.press('Backspace');await expect(editor).toHaveText('Tex');
  await expect(page).toHaveURL(f.url+'/issues/'+f.issue.id);await editor.evaluate(el=>el.remove());
  await page.getByRole('button',{name:'Change customers',exact:true}).first().focus();
  await page.keyboard.press('Backspace');await expect(page).toHaveURL(f.route);
 }finally{await page.close();await f.app.close()}
});

test('hardware history stays within the active workspace tab and stops at its boundary',async({page})=>{
 const f=await fixture(page);try{
  await f.openIssue();await blur(page);
  await page.keyboard.press('ControlOrMeta+t');await expect(page.locator('.app-tab')).toHaveCount(2);await expect(page.getByRole('heading',{name:'My issues',exact:true})).toBeVisible();
  const second=await page.locator('.app-tab.active').getAttribute('data-tab-id'),start=page.url();
  await mouseHistory(page,'back');await expect(page).toHaveURL(start);
  await page.getByRole('link',{name:'Customers',exact:true}).click();await expect(page.locator('header').getByRole('heading',{name:'Customers',exact:true})).toBeVisible();
  await mouseHistory(page,'back');await expect(page).toHaveURL(start);
  await page.locator(`.app-tab:not([data-tab-id="${second}"])`).click();await expect(page).toHaveURL(f.url+'/issues/'+f.issue.id);
  await blur(page);await page.keyboard.press('Backspace');await expect(page).toHaveURL(f.route);
  await page.locator(`[data-tab-id="${second}"]`).click();await expect(page).toHaveURL(start);
  await mouseHistory(page,'forward');await expect(page).toHaveURL(f.url+'/customers');
 }finally{await page.close();await f.app.close()}
});
