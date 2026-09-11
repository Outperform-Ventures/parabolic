import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("channel preferences preserve Inbox records while browser alerts respect focus, types and scheduled delivery", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Notification QA",
        email: "notifications@example.test",
        password: "isolated-notification-test",
        workspaceName: "Notifications",
      },
    });
    const initial = await (
      await page.request.get(url + "/api/v1/state")
    ).json();
    await page.request.patch(url + "/api/v1/users/" + initial.user.id, {
      data: {
        preferences: {
          notifications: { desktop: true, assigned: false, comments: false },
        },
      },
    });
    const issue = await (
      await page.request.post(url + "/api/v1/issues", {
        data: {
          teamId: initial.teams[0].id,
          title: "Notification destination",
        },
      })
    ).json();
    await page.addInitScript(() => {
      const scope = window as any;
      scope.__desktopAlerts = [];
      scope.__notificationFocused = true;
      Object.defineProperty(document, "hasFocus", {
        value: () => scope.__notificationFocused,
      });
      class MockNotification {
        static permission = "granted";
        static requestPermission = async () => "granted";
        onclick: any;
        constructor(title: string, options: any) {
          scope.__desktopAlerts.push({ title, options });
        }
        close() {}
      }
      Object.defineProperty(window, "Notification", {
        value: MockNotification,
        configurable: true,
      });
      if ("ServiceWorkerRegistration" in window)
        ServiceWorkerRegistration.prototype.showNotification = async function (
          title,
          options,
        ) {
          scope.__desktopAlerts.push({ title, options });
        };
    });
    await page.goto(url + "/inbox");
    await expect(
      page.getByRole("heading", { name: "Inbox", exact: true }),
    ).toBeVisible();
    const createNotice = async (
      type: string,
      extra: Record<string, unknown> = {},
    ) => {
      const response = await page.request.post(url + "/api/v1/notifications", {
        data: {
          userId: initial.user.id,
          issueId: issue.id,
          title: "Alert " + type,
          body: "<p>Readable <strong>body</strong></p>",
          type,
          ...extra,
        },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const alerts = () => page.evaluate(() => (window as any).__desktopAlerts);
    const assigned = await createNotice("assigned");
    await expect(
      page.locator(`[data-notification-id="${assigned.id}"]`),
    ).toBeVisible();
    expect(await alerts()).toEqual([]);
    await page.evaluate(() => {
      (window as any).__notificationFocused = false;
    });
    await createNotice("comments");
    const mention = await createNotice("mentioned", {
      reasons: ["comments", "mentioned"],
    });
    await expect.poll(async () => (await alerts()).length).toBe(1);
    expect((await alerts())[0]).toMatchObject({
      title: "Alert mentioned",
      options: {
        body: "Readable body",
        data: { route: "/issues/" + issue.id },
      },
    });
    expect((await alerts())[0].options.tag).toContain(mention.id);
    await page.evaluate(() => {
      (window as any).__notificationFocused = true;
    });
    const focused = await createNotice("mentioned");
    await expect(
      page.locator(`[data-notification-id="${focused.id}"]`),
    ).toBeVisible();
    expect((await alerts()).length).toBe(1);
    await page.goto(url + "/settings/notifications");
    await page.locator('.settings-notification-row').filter({hasText:'Desktop'}).click();
    const desktopToggle=page.getByRole("switch",{name:"Enable desktop notifications",exact:true});
    await expect(page).toHaveURL(url+"/settings/notifications/desktop");
    await expect(desktopToggle).toHaveAttribute('aria-checked','true');
    await desktopToggle.click();
    await expect(desktopToggle).toHaveAttribute('aria-checked','false');
    await page.evaluate(() => {
      (window as any).__notificationFocused = false;
    });
    await createNotice("projectUpdates");
    await expect
      .poll(
        async () =>
          (await (await page.request.get(url + "/api/v1/state")).json())
            .notifications.length,
      )
      .toBe(5);
    expect(await alerts()).toEqual([]); // A navigation creates a new document and alert recorder.
    await desktopToggle.click();
    await expect(desktopToggle).toHaveAttribute('aria-checked','true');
    const now = Date.now(),
      reminder = await createNotice("reminder", {
        entityKind: "issues",
        entityId: issue.id,
        remindAt: new Date(now + 60000).toISOString(),
      });
    await expect
      .poll(
        async () =>
          (await (await page.request.get(url + "/api/v1/state")).json())
            .notifications.length,
      )
      .toBe(6);
    expect(await alerts()).toEqual([]);
    app.scheduler.tick(new Date(now + 61000));
    await expect.poll(async () => (await alerts()).length).toBe(1);
    expect((await alerts())[0].options.tag).toContain(reminder.id);
    await page.getByRole('switch',{name:'Reminders and deadlines via Desktop',exact:true}).click();
    await expect.poll(()=>app.repo.raw('users',initial.user.id)!.preferences.notifications.sla).toBe(false);
    const risk=await createNotice('slaAtRisk',{reasons:['sla','slaAtRisk']});
    const breach=await createNotice('slaBreached',{reasons:['sla','slaBreached']});
    const sentinel=await createNotice('mentioned');
    await expect.poll(async()=>(await alerts()).some((alert:any)=>alert.options.tag.includes(sentinel.id))).toBe(true);
    expect((await alerts()).length).toBe(2);
    for(const notice of [risk,breach])expect(app.repo.raw('notifications',notice.id)?.userId).toBe(initial.user.id);
  } finally {
    await page.close();
    await app.close();
  }
});

test('notification channel pages persist mobile schedules, email formats and retained per-channel types',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    await page.request.post(url+'/auth/setup',{data:{name:'Channel settings',email:'channels@example.test',password:'channel-settings-password'}});
    const state=await(await page.request.get(url+'/api/v1/state')).json();
    await page.goto(url+'/settings/notifications');
    await page.locator('.settings-notification-row').filter({hasText:'Mobile'}).click();
    await expect(page).toHaveURL(url+'/settings/notifications/mobile');
    const schedule=page.getByRole('switch',{name:'Schedule mobile notifications',exact:true});
    await expect(schedule).toHaveAttribute('aria-checked','false');await schedule.click();await expect(schedule).toHaveAttribute('aria-checked','true');
    await page.getByRole('button',{name:'Schedule day 6',exact:true}).click();
    await page.getByLabel('Mobile schedule from',{exact:true}).fill('08:30');
    await expect.poll(()=>app.repo.raw('users',state.user.id)!.preferences.notifications.mobileScheduleFrom).toBe('08:30');
    await page.getByRole('link',{name:'Notifications',exact:true}).click();
    await page.locator('.settings-notification-row').filter({hasText:'Email'}).click();
    await page.getByRole('combobox',{name:'Notification format',exact:true}).selectOption({label:'Immediate'});
    await page.getByRole('switch',{name:'Assignments via Email',exact:true}).click();
    await expect.poll(()=>app.repo.raw('users',state.user.id)!.preferences?.notifications?.emailTypes?.assignments).toBe(false);
    await page.goto(url+'/settings/notifications/slack');
    await expect(page.getByRole('link',{name:'Connected accounts ›',exact:true})).toBeVisible();
    await expect(page.getByRole('switch',{name:'Assignments via Slack',exact:true})).toBeDisabled();
    await page.reload();
    expect(app.repo.raw('users',state.user.id)!.preferences.notifications.mobileScheduleDays).toContain(6);
    expect(app.repo.raw('users',state.user.id)!.preferences.notifications.emailFormat).toBe('immediate');
  }finally{await page.close();await app.close()}
});

test('project bell subscription receives live project activity and unsubscribe stops future events',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Project subscriber',email:'project-subscriber@example.test',password:'project-subscriber-password'}});
 const state=async()=>(await page.request.get(url+'/api/v1/state')).json(),initial=await state();
 const project=await (await page.request.post(url+'/api/v1/projects',{data:{name:'Subscription project',teamIds:[initial.teams[0].id]}})).json();
 const actor={userId:initial.user.id,workspaceId:initial.workspaceId,role:'owner',scopes:['admin'],silent:false};
 // A second member makes activity while this browser stays signed in as the subscriber.
 const id=crypto.randomUUID(),at=new Date().toISOString();app.repo.save('users',{id,workspaceId:initial.workspaceId,name:'Colleague',email:'colleague@example.test',createdAt:at,updatedAt:at,version:1},'create',actor);
 app.repo.save('memberships',{id:crypto.randomUUID(),workspaceId:initial.workspaceId,userId:id,role:'member',createdAt:at,updatedAt:at,version:1},'create',actor);
 const colleague={...actor,userId:id,role:'member',scopes:['read','write']};
 await page.goto(url+'/project/'+project.id);await page.getByTitle('Notifications and update reminders',{exact:true}).click();await page.getByRole('button',{name:'Subscribe',exact:true}).click();await expect(page.getByRole('button',{name:'Unsubscribe',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 app.repo.update(colleague,'projects',project.id,{description:'Colleague revised this plan'});
 await expect.poll(async()=>(await state()).notifications.filter((n:any)=>n.type==='projectDescriptionContentChange').length).toBe(1);
 await page.goto(url+'/inbox');await page.getByRole('button',{name:/^Other/}).click();await expect(page.getByText('Subscription project',{exact:true}).first()).toBeVisible();
 await page.goto(url+'/project/'+project.id);await page.getByTitle('Notifications and update reminders',{exact:true}).click();await page.getByRole('button',{name:'Unsubscribe',exact:true}).click();await expect(page.getByRole('button',{name:'Subscribe',exact:true})).toBeVisible();
 app.repo.update(colleague,'projects',project.id,{description:'After unsubscribe'});expect((await state()).notifications.filter((n:any)=>n.type==='projectDescriptionContentChange')).toHaveLength(1);
 }finally{await page.close();await app.close()}
});

test('document bell subscribes members and creator can opt out across reloads',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Document owner',email:'document-owner@example.test',password:'document-owner-password'}});
 const state=async()=>(await page.request.get(url+'/api/v1/state')).json(),initial=await state(),actor={userId:initial.user.id,workspaceId:initial.workspaceId,role:'owner',scopes:['admin']},id=crypto.randomUUID(),at=new Date().toISOString();
 app.repo.save('users',{id,workspaceId:initial.workspaceId,name:'Document colleague',email:'document-colleague@example.test',createdAt:at,updatedAt:at,version:1},'create',actor);app.repo.save('memberships',{id:crypto.randomUUID(),workspaceId:initial.workspaceId,userId:id,role:'member',createdAt:at,updatedAt:at,version:1},'create',actor);
 const doc=await (await page.request.post(url+'/api/v1/documents',{data:{title:'Document subscriptions',content:'Initial',visibility:'workspace'}})).json();
 const colleague={...actor,userId:id,role:'member',scopes:['read','write']};
 app.repo.update(colleague,'documents',doc.id,{content:'<p>Initial</p>'});expect((await state()).notifications.filter((n:any)=>n.documentId===doc.id)).toHaveLength(0);
 await page.goto(url+'/inbox');await page.getByRole('button',{name:/^Other/}).click();await expect(page.getByText('Document subscriptions',{exact:true})).toHaveCount(0);
 app.repo.update(colleague,'documents',doc.id,{content:'Colleague edited this document'});await expect.poll(async()=>(await state()).notifications.filter((n:any)=>n.documentId===doc.id).length).toBe(1);await expect(page.getByText('Document subscriptions',{exact:true}).first()).toBeVisible();
 app.repo.update(colleague,'documents',doc.id,{content:'<p>Colleague edited this document</p>'});expect((await state()).notifications.filter((n:any)=>n.documentId===doc.id)).toHaveLength(1);
 const legacyDocument={...app.repo.raw('documents',doc.id)!};delete legacyDocument.lastEditedBy;delete legacyDocument.lastEditedAt;app.repo.save('documents',legacyDocument,'update',actor);
 await page.goto(url+'/document/'+doc.id);await expect(page.locator('.feature-document-meta')).toContainText('Document colleague');await page.getByRole('button',{name:'History',exact:true}).click();await expect(page.locator('.feature-history')).toContainText('Document owner');await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('button',{name:'Document subscribers',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Document subscribers',exact:true});await expect(dialog.getByRole('checkbox',{name:'Subscribe Document owner',exact:true})).toBeChecked();await dialog.getByRole('checkbox',{name:'Subscribe Document colleague',exact:true}).check();
 await expect.poll(async()=>(await state()).documents.find((d:any)=>d.id===doc.id).subscriberIds.sort()).toEqual([initial.user.id,id].sort());await dialog.getByRole('checkbox',{name:'Subscribe Document owner',exact:true}).uncheck();await expect.poll(async()=>(await state()).documents.find((d:any)=>d.id===doc.id).subscriberIds).toEqual([id]);
 await dialog.getByRole('button',{name:'Done',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Document subscribers',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:'Subscribe Document owner',exact:true})).not.toBeChecked();await expect(dialog.getByRole('checkbox',{name:'Subscribe Document colleague',exact:true})).toBeChecked();
 await dialog.getByRole('button',{name:'Done',exact:true}).click();
 const legacy=await (await page.request.post(url+'/api/v1/subscriptions',{data:{entityKind:'documents',entityId:doc.id,documentId:doc.id}})).json();expect(legacy.id).toBeTruthy();
 await page.reload();await page.getByRole('button',{name:'Document subscribers',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:'Subscribe Document owner',exact:true})).toBeChecked();await dialog.getByRole('checkbox',{name:'Subscribe Document owner',exact:true}).uncheck();
 await expect.poll(async()=>{const current=await state();return [current.documents.find((d:any)=>d.id===doc.id).subscriberIds,current.subscriptions.filter((s:any)=>s.id===legacy.id&&!s.deletedAt).length]}).toEqual([[id],0]);
 await dialog.getByRole('button',{name:'Done',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Document subscribers',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:'Subscribe Document owner',exact:true})).not.toBeChecked();await dialog.getByRole('button',{name:'Done',exact:true}).click();
 await page.keyboard.press('ControlOrMeta+z');await expect.poll(async()=>(await state()).subscriptions.filter((s:any)=>s.id===legacy.id&&!s.deletedAt).length).toBe(1);
 }finally{await page.close();await app.close()}
});

test('document event summaries and alert, detail and narrow-screen routes target the document rather than its project',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
 await page.request.post(url+'/auth/setup',{data:{name:'Inbox owner',email:'document-route@example.test',password:'document-route-password'}});const state=async()=>(await page.request.get(url+'/api/v1/state')).json(),initial=await state(),actor={userId:initial.user.id,workspaceId:initial.workspaceId,role:'owner',scopes:['admin']},id=crypto.randomUUID(),at=new Date().toISOString();
 app.repo.save('users',{id,workspaceId:initial.workspaceId,name:'Document colleague',email:'document-route-colleague@example.test',createdAt:at,updatedAt:at,version:1},'create',actor);app.repo.save('memberships',{id:crypto.randomUUID(),workspaceId:initial.workspaceId,userId:id,role:'member',createdAt:at,updatedAt:at,version:1},'create',actor);const colleague={...actor,userId:id,role:'member',scopes:['read','write']};
 await page.request.patch(url+'/api/v1/users/'+initial.user.id,{data:{preferences:{notifications:{desktop:true}}}});const project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Parent project',teamIds:[initial.teams[0].id]}})).json(),doc=await(await page.request.post(url+'/api/v1/documents',{data:{title:'Project document notification',projectId:project.id,content:'Original',visibility:'workspace'}})).json();
 await page.addInitScript(()=>{const scope=window as any;scope.__documentAlerts=[];Object.defineProperty(document,'hasFocus',{value:()=>false});class NotificationMock{static permission='granted';static requestPermission=async()=>'granted';constructor(title:string,options:any){scope.__documentAlerts.push({title,options})}close(){}}Object.defineProperty(window,'Notification',{value:NotificationMock,configurable:true});if('ServiceWorkerRegistration'in window)ServiceWorkerRegistration.prototype.showNotification=async function(title,options){scope.__documentAlerts.push({title,options})}});
 await page.goto(url+'/inbox');await page.getByRole('button',{name:/^Other/}).click();app.repo.update(colleague,'documents',doc.id,{content:'Edited by a colleague'});const row=page.locator('.inbox-item').filter({hasText:doc.title});await expect(row).toContainText('Document colleague edited the document');await expect.poll(async()=>page.evaluate(()=>(window as any).__documentAlerts.length)).toBe(1);expect(await page.evaluate(()=>(window as any).__documentAlerts[0].options.data.route)).toBe('/document/'+doc.id);expect(await page.evaluate(()=>(window as any).__documentAlerts[0].options.body)).toBe('Document colleague edited the document');
 await row.click();await expect(page.locator('.inbox-detail-content')).toContainText('Document colleague edited the document');await expect(page.getByRole('button',{name:'Open project',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Open document',exact:true}).click();await expect(page).toHaveURL(url+'/document/'+doc.id);await expect(page.getByRole('textbox',{name:'Document title',exact:true})).toHaveValue(doc.title);
 await page.setViewportSize({width:600,height:800});await page.goto(url+'/inbox');await page.getByRole('button',{name:/^Other/}).click();app.repo.update(colleague,'documents',doc.id,{content:'Another colleague edit'});await expect(row).toBeVisible();await row.click();await expect(page).toHaveURL(url+'/document/'+doc.id);
 }finally{await page.close();await app.close()}
});

test('team SLA Inbox subscription can be enabled, persists and stops future team alerts when disabled',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'SLA settings',email:'sla-settings@example.test',password:'owner-password'}});
  const initial=await(await page.request.get(url+'/api/v1/state')).json();
  const actor:any={userId:initial.user.id,workspaceId:initial.workspaceId,role:'owner',scopes:['admin'],now:new Date('2027-01-01T00:00:00Z')};
  const makeIssue=()=>{const issue=app.repo.create(actor,'issues',{title:'Unsubscribed team SLA',teamId:initial.teams[0].id,slaDuration:{value:48,unit:'hour'}});return app.repo.update(actor,'issues',issue.id,{subscriberIds:[]})};
  const first=makeIssue();
  app.repo.update(actor,'users',initial.user.id,{preferences:{notifications:{teamSla:false}}});
  await page.addInitScript(()=>{class NotificationMock{static permission='granted';static requestPermission=async()=>'granted';constructor(){}close(){}}Object.defineProperty(window,'Notification',{value:NotificationMock,configurable:true})});
  await page.goto(url+'/settings/notifications/desktop');const toggle=page.getByRole('switch',{name:'Reminders and deadlines via Desktop',exact:true});
  await expect(toggle).toHaveAttribute('aria-checked','false');await toggle.click();
  await expect.poll(()=>app.repo.raw('users',actor.userId)!.preferences?.notifications?.teamSla).toBe(true);
  await page.reload();await expect(toggle).toHaveAttribute('aria-checked','true');
  app.scheduler.tick(new Date('2027-01-02T00:00:00Z'));
  const alerts=(id:string)=>app.repo.all('notifications',actor.workspaceId).filter(n=>n.userId===actor.userId&&n.issueId===id&&n.type==='slaAtRisk');
  await expect.poll(()=>alerts(first.id).length).toBe(1);
  await toggle.click();await expect.poll(()=>app.repo.raw('users',actor.userId)!.preferences.notifications.teamSla).toBe(false);
  await page.reload();await expect(toggle).toHaveAttribute('aria-checked','false');
  const second=makeIssue();app.scheduler.tick(new Date('2027-01-02T00:00:00Z'));expect(alerts(second.id)).toHaveLength(0);expect(alerts(first.id)).toHaveLength(1);
 }finally{await app.close()}
});
