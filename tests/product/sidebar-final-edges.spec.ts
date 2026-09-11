import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
test('final audit: persistence and viewport evidence',async({page,context})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();const evidence:any={};
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Final audit',email:'final@example.test',password:'test-password'}});
 const state=await page.request.get(url+'/api/v1/state').then(r=>r.json()),team=state.teams[0];
 await page.request.post(url+'/api/v1/favorites',{data:{type:'view',label:'A long favorite label that should truncate without pushing controls outside the sidebar',route:'/projects'}});
 await page.goto(url+'/my-issues');
 const fav=page.getByRole('region',{name:'Favorites',exact:true});await fav.getByRole('button',{name:'Favorites',exact:true}).click();evidence.favoriteCollapseBefore=await fav.getByRole('button',{name:'Favorites',exact:true}).getAttribute('aria-expanded');await page.reload();evidence.favoriteCollapseAfter=await fav.getByRole('button',{name:'Favorites',exact:true}).getAttribute('aria-expanded');
 for(const width of [1777,1280,800,610]){
 await page.setViewportSize({width,height:600});await page.getByRole('button',{name:team.name+' menu',exact:true}).click();await page.getByRole('menuitem',{name:'Subscribe',exact:true}).focus();await page.keyboard.press('ArrowRight');
 evidence['subscribe'+width]=await page.locator('.sidebar-subscribe-menu').evaluate(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,bottom:e.getBoundingClientRect().bottom,viewport:innerWidth}));await page.screenshot({path:`artifacts/verification/sidebar-final/subscribe-${width}.png`});await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1280,height:720});
 const customize=async(p:any)=>{await p.getByRole('button',{name:'More workspace views'}).click();await p.getByRole('menuitem',{name:'Customize sidebar'}).click();};
 await customize(page);await page.screenshot({path:'artifacts/verification/sidebar-final/owned-customization.png'});await page.getByRole('button',{name:'My issues visibility'}).click();await page.getByRole('menuitem',{name:"Don't show",exact:true}).click();await page.keyboard.press('Escape');
 const second=await context.newPage();await second.goto(url+'/projects');await customize(second);await second.getByRole('button',{name:'My issues visibility'}).click();await second.getByRole('menuitem',{name:'Always show',exact:true}).click();await second.keyboard.press('Escape');
 await page.getByRole('link',{name:'Projects',exact:true}).first().click();await expect(second.getByRole('link',{name:'My issues',exact:true})).toBeVisible();await page.waitForTimeout(500);
 evidence.crossWindowMyIssues={first:await page.getByRole('link',{name:'My issues',exact:true}).count(),second:await second.getByRole('link',{name:'My issues',exact:true}).count()};await second.close();
 await page.goto(url+'/settings');await page.screenshot({path:'artifacts/verification/sidebar-final/owned-settings.png'});evidence.backToAppHref=await page.getByRole('link',{name:'Back to app',exact:true}).getAttribute('href');
 const issueResponse=await page.request.post(url+'/api/v1/issues',{data:{teamId:team.id,title:'Comment draft audit'}});const issue=await issueResponse.json();expect(issueResponse.ok()).toBeTruthy();
 await page.evaluate(({uid,wid,iid})=>localStorage.setItem('comment-drafts:'+uid+':'+wid,JSON.stringify([{id:iid+':root',issueId:iid,parentId:null,body:'Sidebar audit draft',updatedAt:new Date().toISOString(),revision:'audit'}])),{uid:state.users[0].id,wid:state.workspaceId,iid:issue.id});
 await page.goto(url+'/projects');evidence.commentOnlyDraftSidebar=await page.locator('.sidebar').getByRole('link',{name:'Drafts',exact:true}).count();await page.goto(url+'/drafts');evidence.commentDraftPageVisible=await page.getByText('Sidebar audit draft',{exact:true}).count();
 }finally{writeFileSync('artifacts/verification/sidebar-final/edges.json',JSON.stringify(evidence,null,2));await page.close();await app.close();}
});
