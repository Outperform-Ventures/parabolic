import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('cached label/group views restart offline and synchronize scoped creation and favorites on reconnect',async({page,context,browserName})=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 let disconnected=false;const listeners=app.server.listeners('request');
 if(browserName==='webkit'){app.server.removeAllListeners('request');app.server.on('request',(request,response)=>{if(disconnected)request.socket.destroy();else for(const listener of listeners)listener.call(app.server,request,response)})}
 const offline=async(value:boolean)=>{if(browserName==='webkit'){disconnected=value;if(value)app.server.closeAllConnections()}else await context.setOffline(value)};
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Offline labels',email:'offline-labels@example.test',password:'label-password'}});
 const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
 const create=async(kind:string,data:any)=>{const r=await page.request.post(url+'/api/v1/'+kind,{data});expect(r.ok()).toBeTruthy();return r.json()};
 const label=await create('labels',{name:'Cached label',group:'Cached group',teamId:team.id}),sibling=await create('labels',{name:'Cached sibling',group:'Cached group',teamId:team.id});
 await create('issues',{title:'Cached first',teamId:team.id,labelIds:[label.id],priority:1});await create('issues',{title:'Cached second',teamId:team.id,labelIds:[sibling.id]});await create('issues',{title:'Outside scope',teamId:team.id});
 await page.goto(url+'/label/'+label.id);await expect(page.locator('.issue-row')).toHaveCount(1);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await offline(true);await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.page-header h1')).toHaveText('Cached label');await expect(page.locator('.issue-row')).toHaveCount(1);
 await page.getByRole('switch',{name:'Add to favorites',exact:true}).click();await expect(page.getByRole('switch',{name:'Remove from favorites',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create new issue',exact:true}).click();await page.getByLabel('Issue title',{exact:true}).fill('Created offline in label');await page.getByRole('button',{name:'Create issue',exact:true}).click();await expect(page.locator('.issue-row')).toHaveCount(2);
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.issue-row')).toHaveCount(2);await expect(page.getByRole('switch',{name:'Remove from favorites',exact:true})).toBeVisible();
 await page.keyboard.press('o');await page.keyboard.press('l');await page.getByRole('button',{name:'Cached group',exact:true}).click();await expect(page.locator('.page-header h1')).toHaveText('Cached group');await expect(page.locator('.issue-row')).toHaveCount(3);
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.issue-row')).toHaveCount(3);
 await page.getByRole('button',{name:'Filter issues',exact:true}).click();await page.getByRole('menuitem',{name:'Advanced filter',exact:true}).click();await page.getByRole('button',{name:'Add filter',exact:true}).click();await page.locator('.filter-condition select').nth(0).selectOption('priority');await page.locator('.filter-condition select').nth(2).selectOption('1');await expect(page.locator('.issue-row')).toHaveCount(1);await expect(page.locator('.issue-row')).toContainText('Cached first');await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.issue-row')).toHaveCount(3);
 await offline(false);
 await expect.poll(async()=>{const s=await(await page.request.get(url+'/api/v1/state')).json();const issue=s.issues.find((i:any)=>i.title==='Created offline in label');return issue?{teamId:issue.teamId,labelIds:issue.labelIds,favorites:s.favorites.filter((f:any)=>f.route==='/label/'+label.id&&!f.deletedAt).length}:null},{timeout:20000}).toEqual({teamId:team.id,labelIds:[label.id],favorites:1});
 await page.reload();await expect(page.locator('.issue-row')).toHaveCount(3);
 }finally{await offline(false);await page.close();await app.close()}
});
