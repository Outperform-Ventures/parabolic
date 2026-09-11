import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
test('sidebar customization, native menus, favorites and team controls persist and navigate',async({page},testInfo)=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Sidebar Reviewer',email:'sidebar-ui@example.test',password:'sidebar-password'}});
 const state=()=>page.request.get(url+'/api/v1/state').then(r=>r.json()),initial=await state(),team=initial.teams[0];
 await page.request.post(url+'/api/v1/favorites',{data:{type:'team',entityKind:'teams',entityId:team.id,section:'active',label:`Active issues ${team.name}`,route:`/team/${team.id}/active`}});
 await page.goto(url+'/my-issues');const sidebar=page.locator('.sidebar');
 await sidebar.getByRole('button',{name:'More workspace views'}).click();
 await expect(page.getByRole('menuitem',{name:'Members',exact:true})).toBeVisible();
 await page.getByRole('menuitem',{name:'Customize sidebar'}).click();const dialog=page.getByRole('dialog',{name:'Customize sidebar'});
 await dialog.getByRole('button',{name:'Members visibility',exact:true}).click();await page.getByRole('menuitem',{name:'Always show',exact:true}).click();
 await dialog.getByRole('button',{name:'Default badge style',exact:true}).click();await page.getByRole('menuitem',{name:'Dot',exact:true}).click();
 await dialog.getByRole('button',{name:'Reorder Projects',exact:true}).focus();await page.keyboard.press('ArrowUp');
 await expect.poll(async()=>{const s=await state();const order=s.users.find((u:any)=>u.id===s.user.id).preferences?.sidebar?.[s.workspaceId]?.order;return !!order&&order.indexOf('/projects')<order.indexOf('/initiatives');}).toBe(true);
 await page.screenshot({path:testInfo.outputPath('customize.png')});await page.keyboard.press('Escape');
 await expect(sidebar.getByRole('link',{name:'Members',exact:true})).toBeVisible();await page.reload();await expect(sidebar.getByRole('link',{name:'Members',exact:true})).toBeVisible();
 await sidebar.getByRole('button',{name:'Your teams',exact:true}).click();await expect(sidebar.getByRole('button',{name:`${team.name} menu`,exact:true})).toHaveCount(0);await sidebar.getByRole('button',{name:'Your teams',exact:true}).click();
 await sidebar.getByRole('button',{name:`${team.name} menu`,exact:true}).click();await expect(page.getByRole('menuitem',{name:/^Copy URL/})).toBeVisible();await page.getByRole('menuitem',{name:'Subscribe',exact:true}).hover();await page.getByRole('checkbox',{name:'An issue is added to the team',exact:true}).check();
 await expect.poll(async()=>(await state()).subscriptions.some((s:any)=>s.entityKind==='teams'&&s.entityId===team.id&&s.notifyOnAdded)).toBe(true);
 await page.keyboard.press('Escape');await sidebar.getByRole('button',{name:`${team.name} menu`,exact:true}).click();await page.getByRole('menuitem',{name:'Leave team…',exact:true}).click();await expect(page.getByRole('dialog',{name:`Leave ${team.name}?`})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 const favorite=sidebar.locator('.favorite-row').first();await expect(favorite.locator('.favorite-team-suffix')).toHaveCSS('font-weight','450');await favorite.click({button:'right'});await expect(page.getByRole('menuitem',{name:/^Copy URL/})).toBeVisible();await page.getByRole('menuitem',{name:'Open in new tab',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/team/${team.id}/active`));
 await sidebar.getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('textbox',{name:'Help with…'}).fill('settings');await expect(page.getByRole('menuitem',{name:/^Settings/})).toBeVisible();await expect(page.getByRole('menuitem',{name:'Docs',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');await expect(sidebar.locator('.sidebar-footer').getByRole('button',{name:/^Settings/})).toHaveCount(0);
 await sidebar.getByRole('button',{name:'Join a team',exact:true}).click({force:true});await expect(page.getByRole('dialog',{name:'Create team',exact:true})).toBeVisible();
 }finally{await page.close();await app.close();}
});
