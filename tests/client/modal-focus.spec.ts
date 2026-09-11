import {test, expect} from "@playwright/test";
import {resolve} from "node:path";
import {createApp} from "../../src/server/app";
test.use({serviceWorkers:"block"});

test("a late-loading background page cannot steal command-dialog focus and closing restores the invoking field", async ({page})=>{
  test.setTimeout(60000);
  const app=createApp({databasePath:":memory:",port:0,staticDir:resolve("dist")}), {url}=await app.start();
  let release!:()=>void, intercepted=false;
  const gate=new Promise<void>(resolve=>{release=resolve});
  try {
    await page.request.post(url+"/auth/setup",{data:{email:"modal-focus@example.test",password:"isolated-modal-focus-password",name:"Focus owner"}});
    const state=await(await page.request.get(url+"/api/v1/state")).json(), actor={userId:state.user.id,workspaceId:state.workspaceId,role:"owner",scopes:["admin"]};
    // Project-label commands still open search; issue labels have dedicated pages.
    const label=app.repo.create(actor,"labels",{name:"Delayed route label",entityType:"projects"}), document=app.repo.create(actor,"documents",{title:"Focus-safe document"});
    app.repo.create(actor,"projects",{teamIds:[state.teams[0].id],name:"Background project must stay closed",labelIds:[label.id]});
    await page.route("**/assets/search-*.js",async route=>{intercepted=true;await gate;await route.continue()});
    await page.goto(url+"/my-issues");await expect(page.locator(".workspace-shell")).toBeVisible();
    const mod=await page.evaluate(()=>/Mac/.test(navigator.platform)?"Meta":"Control"), palette=page.getByRole("combobox",{name:"Command menu",exact:true});
    await page.keyboard.press(mod+"+k");await palette.fill("l Delayed route label");await expect(page.locator(".command-results").getByRole("option",{selected:true})).toContainText(label.name);await palette.press("Enter");
    await expect(page).toHaveURL(/\/search\?/);await expect.poll(()=>intercepted).toBe(true);
    await page.keyboard.press(mod+"+k");await palette.fill("d Focus-safe document");await expect(page.locator(".command-results").getByRole("option",{selected:true})).toContainText(document.title);
    release();
    const background=page.getByRole("combobox",{name:"Search workspace content",exact:true});
    await expect(background).toBeAttached();await expect(palette).toBeFocused();
    await page.keyboard.press("Escape");await expect(palette).toHaveCount(0);
    await background.focus();await page.keyboard.press(mod+"+k");await expect(palette).toBeFocused();await page.keyboard.press("Escape");await expect(background).toBeFocused();
    await page.keyboard.press(mod+"+k");await palette.fill("d Focus-safe document");await expect(page.locator(".command-results").getByRole("option",{selected:true})).toContainText(document.title);await page.keyboard.press("Enter");
    await expect(page).toHaveURL(url+"/document/"+document.id);await expect(palette).toHaveCount(0);
    await page.getByRole("button",{name:"Create new issue",exact:true}).click();
    const more=page.getByRole("button",{name:"More properties",exact:true});
    await more.focus();await more.press("ArrowDown");
    const due=page.getByRole("menuitem",{name:"Set due date",exact:true});
    await expect(due).toBeFocused();await page.keyboard.press("Escape");await expect(more).toBeFocused();
    await more.press("ArrowDown");await expect(due).toBeFocused();await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog",{name:"Set due date",exact:true})).toBeVisible();await page.keyboard.press("Escape");
    await expect(page.locator(".issue-composer")).toBeVisible();
    const title=page.getByRole("textbox",{name:"Issue title",exact:true});
    await title.focus();await page.keyboard.press(mod+"+f");
    await expect(page.getByRole("textbox",{name:"Find in page",exact:true})).toBeFocused();
    await page.keyboard.press("Escape");await expect(title).toBeFocused();
    await page.getByRole("button",{name:"Close composer",exact:true}).click();
    for(const route of ["/inbox","/team/"+state.teams[0].id+"/all"]) {
      await page.goto(url+route);await page.getByRole("button",{name:"Create new issue",exact:true}).click();
      await title.focus();await page.keyboard.press(mod+"+f");await expect(page.getByRole("textbox",{name:"Find in page",exact:true})).toBeFocused();
      await page.keyboard.press("Escape");await expect(title).toBeFocused();await expect(page.locator(".issue-composer")).toBeVisible();
      await page.getByRole("button",{name:"Close composer",exact:true}).click();
    }
  } finally {release();await page.close();await app.close()}
});

test('native links wait for an open composer and deliver the latest destination after it closes',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.addInitScript(()=>{const w=window as any;w.desktop={isDesktop:true,platform:'darwin',onCommand:(callback:any)=>{w.nativeCommand=callback;return ()=>delete w.nativeCommand;},setBadge:async()=>{},setTheme:async()=>{},notify:async()=>true};});
  await page.request.post(url+'/auth/setup',{data:{name:'Native link owner',email:'native-links@example.test',password:'Native-links-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();const issue=await(await page.request.post(url+'/api/v1/issues',{data:{teamId:state.teams[0].id,title:'Native link destination'}})).json();
  await page.goto(url+'/my-issues');await page.getByRole('button',{name:'Create new issue',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByPlaceholder('Issue title').fill('Keep my unfinished draft');
  await page.evaluate(id=>{(window as any).nativeCommand({command:'navigate',route:'/inbox'});(window as any).nativeCommand({command:'navigate',route:'/issues/'+id});},issue.id);
  await expect(page).toHaveURL(url+'/my-issues');await expect(dialog.getByPlaceholder('Issue title')).toHaveValue('Keep my unfinished draft');await expect(page.getByText('Link will open after you close the current dialog',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(url+'/issues/'+issue.id);await expect(page.getByRole('textbox',{name:'Issue title',exact:true})).toHaveValue('Native link destination');
 }finally{await app.close();}
});
