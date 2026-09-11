import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test.use({serviceWorkers:'block'});

test('stale-tab preferences persist, retain pins and recoverable edits, and close only inactive tabs',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Tab owner',email:'tabs@example.test',password:'Tab-owner-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Recoverable tab edit',teamId:state.teams[0].id}})).json();
  const old=Date.now()-7*3600000,key=`workspace-tabs:${state.user.id}:${state.workspaceId}`,journal=`issue-edit:${state.user.id}:${issue.id}`;
  await page.goto(url+'/settings');await expect(page.getByLabel('Auto-close stale tabs',{exact:true})).toHaveValue('never');
  await page.evaluate(({key,journal,old,issueId})=>{
    localStorage.setItem(key,JSON.stringify([{id:'active',route:'/settings',lastActiveAt:old},{id:'stale',route:'/search',lastActiveAt:old},{id:'pinned',route:'/documents',lastActiveAt:old,pinned:true},{id:'unsaved',route:'/issues/'+issueId,lastActiveAt:old},{id:'recent',route:'/initiatives',lastActiveAt:Date.now()}]));
    localStorage.setItem(journal,JSON.stringify({title:'Recovered unsaved title'}));
  },{key,journal,old,issueId:issue.id});
  await page.reload();await expect(page.locator('.app-tab')).toHaveCount(5);
  const selector=page.getByLabel('Auto-close stale tabs',{exact:true});
  await expect(selector.locator('option')).toHaveText(['Never','6 hours','12 hours','24 hours','3 days','7 days']);
  let release!:()=>void,started!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve}),requestStarted=new Promise<void>(resolve=>{started=resolve});
  await page.route('**/api/v1/batch',async route=>{started();await gate;await route.continue();});
  try{await selector.selectOption('sixHours');await requestStarted;await expect(selector).toHaveValue('sixHours');await expect(page.locator('.app-tab')).toHaveCount(5);}finally{release();}
  await expect.poll(async()=>(await(await page.request.get(url+'/api/v1/state')).json()).user.preferences.desktopTabCleanupInterval).toBe('sixHours');
  await expect(page.locator('.app-tab')).toHaveCount(4);
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'[]').map((tab:any)=>tab.id),key)).toEqual(['pinned','active','unsaved','recent']);
  await page.reload();await expect(selector).toHaveValue('sixHours');await expect(page.locator('.app-tab')).toHaveCount(4);
  await page.locator('.app-tab').filter({hasText:'Recoverable tab edit'}).click();
  await expect.poll(async()=>(await(await page.request.get(url+'/api/v1/issues/'+issue.id)).json()).title).toBe('Recovered unsaved title');
  await expect.poll(()=>page.evaluate(journal=>localStorage.getItem(journal),journal)).toBeNull();
  await page.keyboard.press(await page.evaluate(()=>/Mac/.test(navigator.platform)?'Meta+Shift+t':'Control+Shift+t'));
  await expect(page).toHaveURL(url+'/search');await expect(page.locator('.app-tab')).toHaveCount(5);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'[]'),key);
  expect(saved.find((tab:any)=>tab.route==='/search').lastActiveAt).toBeGreaterThan(old+6*3600000);
 }finally{await page.close();await app.close();}
});
