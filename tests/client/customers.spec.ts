import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test('structured customer request bodies render formatting and track edits made in the app',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Structured request owner',email:'structured-request@example.test',password:'Structured-request-password'}});
  const project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Structured feedback'}})).json();
  const call=async(query:string,variables:any)=>{const result=await(await page.request.post(url+'/graphql',{data:{query,variables}})).json();expect(result.errors).toBeUndefined();return result.data;};
  const comment=await(await page.request.post(url+'/api/v1/comments',{data:{projectId:project.id,body:'<p>Linked customer context</p>'}})).json();
  const bodyData=JSON.stringify({type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Planning feedback'}]},{type:'paragraph',content:[{type:'text',text:'Keep formatting',marks:[{type:'bold'}]}]},{type:'taskList',content:[{type:'taskItem',attrs:{checked:true},content:[{type:'paragraph',content:[{type:'text',text:'A completed task'}]}]}]},{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[{type:'paragraph',content:[{type:'text',text:'Customer context'}]}]}]}]}]});
  const created=await call('mutation($input:CustomerNeedCreateInput!){customerNeedCreate(input:$input){need{id bodyData}}}',{input:{projectId:project.id,bodyData,commentId:comment.id}}),need=created.customerNeedCreate.need;
  await page.goto(url+'/customer-request/'+need.id);const card=page.locator('[id="request-'+need.id+'"]'),body=card.locator('.customer-request-body');
  await expect(body.locator('h2')).toHaveText('Planning feedback');await expect(body.locator('strong')).toHaveText('Keep formatting');await expect(body.getByRole('checkbox',{name:'Task item checkbox for A completed task'})).toBeChecked();await expect(body.locator('td')).toHaveText('Customer context');
  await card.locator('.request-title').click();const dialog=page.getByRole('dialog');await expect(dialog.locator('[contenteditable="true"] h2')).toHaveText('Planning feedback');await dialog.locator('[contenteditable="true"]').fill('Changed through the editor');await dialog.locator('[contenteditable="true"]').press('ControlOrMeta+Alt+0');await expect(dialog.locator('[contenteditable="true"] > p').filter({hasText:'Changed through the editor'})).toHaveText('Changed through the editor');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);await page.reload();await expect(body).toHaveText('Changed through the editor');
  const read=await call('query($id:String!){customerNeed(id:$id){body bodyData comment{id body}}}',{id:need.id});expect(read.customerNeed.comment).toMatchObject({id:comment.id,body:'<p>Linked customer context</p>'});expect(read.customerNeed.body).toBe('Changed through the editor');expect(read.customerNeed.bodyData).toContain('Changed through the editor');expect(read.customerNeed.bodyData).not.toContain('Planning feedback');expect(JSON.parse(read.customerNeed.bodyData).type).toBe('doc');
  const cleared=await call('mutation($id:String!,$input:CustomerNeedUpdateInput!){customerNeedUpdate(id:$id,input:$input){need{body bodyData}}}',{id:need.id,input:{bodyData:null}});expect(cleared.customerNeedUpdate.need).toMatchObject({body:null,bodyData:null});await page.reload();await expect(card.locator('.customer-request-body')).toHaveCount(0);
 }finally{await app.close();}
});

test('API project customer requests retain their target, rich text and backing source through app edits',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Project need owner',email:'project-need@example.test',password:'Project-need-password'}});
  const project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Project customer feedback'}})).json();
  const call=async(query:string,variables:any)=>{const result=await(await page.request.post(url+'/graphql',{data:{query,variables}})).json();expect(result.errors).toBeUndefined();return result.data;};
  const created=await call('mutation($input:CustomerNeedCreateInput!){customerNeedCreate(input:$input){need{id projectAttachment{id url}}}}',{input:{projectId:project.id,body:'Please add **project planning**.',attachmentUrl:'https://example.test/project-request',priority:1}}),need=created.customerNeedCreate.need;
  await page.goto(url+'/customer-request/'+need.id);await expect(page).toHaveURL(new RegExp('/project/'+project.id+'/customer-requests'));const card=page.locator('[id="request-'+need.id+'"]');await expect(card.locator('.customer-request-body strong')).toHaveText('project planning');await expect(card.getByRole('link',{name:'Source',exact:true})).toHaveAttribute('href','https://example.test/project-request');
  await card.locator('.request-title').click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Request target type')).toHaveValue('project');await dialog.getByLabel('Source URL',{exact:true}).fill('https://example.test/revised-project-request');await dialog.locator('[contenteditable="true"]').fill('Revised project feedback');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);await page.reload();await expect(card.locator('.customer-request-body')).toHaveText('Revised project feedback');
  const read=await call('query($id:String!){customerNeed(id:$id){body customerId issue{id} project{id} attachment{id} projectAttachment{id url} url}}',{id:need.id});expect(read.customerNeed.project.id).toBe(project.id);expect(read.customerNeed.issue).toBeNull();expect(read.customerNeed.customerId).toBeNull();expect(read.customerNeed.attachment).toBeNull();expect(read.customerNeed.body).toBe('Revised project feedback');expect(read.customerNeed.projectAttachment.id).not.toBe(need.projectAttachment.id);expect(read.customerNeed.projectAttachment.url).toBe('https://example.test/revised-project-request');expect(read.customerNeed.url).toBe(read.customerNeed.projectAttachment.url);
 }finally{await app.close();}
});

test('customer tier settings share API identity and preserve assignments through rename and reload',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Tier editor',email:'tier-editor@example.test',password:'Tier-editor-password'}});
  const call=async(query:string,variables:any)=>{const body=await(await page.request.post(url+'/graphql',{data:{query,variables}})).json();expect(body.errors).toBeUndefined();return body.data;};
  const created=await call('mutation($input:CustomerTierCreateInput!){customerTierCreate(input:$input){tier{id displayName color}}}',{input:{name:'strategic',displayName:'Strategic',color:'#ff8800'}}),tier=created.customerTierCreate.tier;
  const customer=await(await page.request.post(url+'/api/v1/customers',{data:{name:'Tier customer',tierId:tier.id}})).json();
  await page.goto(url+'/settings/customers');const section=page.getByRole('region',{name:'Customer tiers',exact:true}),strategic=section.locator('.customer-list-row',{hasText:'Strategic'});await strategic.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Edit',exact:true}).click();
  await section.getByLabel('Name',{exact:true}).fill('Strategic accounts');await section.getByRole('button',{name:'Submit',exact:true}).click();await expect(section.getByLabel('Name',{exact:true})).toHaveCount(0);await page.reload();await expect(section.getByText('Strategic accounts',{exact:true})).toBeVisible();
  const read=await call('query($id:String!){customer(id:$id){tierId tier{id displayName color}}}',{id:customer.id});expect(read.customer.tierId).toBe(tier.id);expect(read.customer.tier.displayName).toBe('Strategic accounts');expect(read.customer.tier.color).toBe('#ff8800');
  let tierRow=section.locator('.customer-list-row',{hasText:'Strategic accounts'});await tierRow.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Delete',exact:true}).click();await expect(page.getByText('This tier is still in use by a customer',{exact:true})).toBeVisible();
  await page.request.patch(url+'/api/v1/customers/'+customer.id,{data:{tierId:null}});tierRow=section.locator('.customer-list-row',{hasText:'Strategic accounts'});await tierRow.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Delete',exact:true}).click();await expect(section.getByText('Strategic accounts',{exact:true})).toHaveCount(0);
 }finally{await app.close();}
});

test('API customer needs render Markdown and source URLs and remain editable without a customer',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Need editor',email:'need-editor@example.test',password:'Need-editor-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'API feedback issue',teamId:state.teams[0].id}})).json();
  const query='mutation($input:CustomerNeedCreateInput!){customerNeedCreate(input:$input){success need{id attachment{id url}}}}';
  const result=await(await page.request.post(url+'/graphql',{data:{query,variables:{input:{issueId:issue.id,body:'Please support **large tables**.',attachmentUrl:'https://example.test/customer-feedback',priority:1}}}})).json();expect(result.errors).toBeUndefined();const need=result.data.customerNeedCreate.need;
  await page.goto(url+'/customer-request/'+need.id);const card=page.locator('[id="request-'+need.id+'"]');await expect(card).toBeVisible();await expect(card.locator('.customer-request-body strong')).toHaveText('large tables');await expect(card.getByRole('link',{name:'Source',exact:true})).toHaveAttribute('href','https://example.test/customer-feedback');
  await card.locator('.request-title').click();const dialog=page.getByRole('dialog');await dialog.locator('[contenteditable="true"]').fill('Updated customer feedback');await dialog.getByLabel('Source URL',{exact:true}).fill('https://example.test/updated-feedback');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.reload();await expect(card.locator('.customer-request-body')).toHaveText('Updated customer feedback');
  const read=await(await page.request.post(url+'/graphql',{data:{query:'query($id:String!){customerNeed(id:$id){body customerId priority attachmentId attachment{id url}}}',variables:{id:need.id}}})).json();expect(read.errors).toBeUndefined();expect(read.data.customerNeed.body).toBe('Updated customer feedback');expect(read.data.customerNeed.customerId).toBeNull();expect(read.data.customerNeed.attachment.id).not.toBe(need.attachment.id);expect(read.data.customerNeed.attachmentId).toBe(read.data.customerNeed.attachment.id);expect(read.data.customerNeed.attachment.url).toBe('https://example.test/updated-feedback');await expect(card.getByRole('link',{name:'Source',exact:true})).toHaveAttribute('href','https://example.test/updated-feedback');
 }finally{await app.close();}
});

test('customer primary-domain edits preserve API aliases and external IDs through reload',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Identity owner',email:'identity-owner@example.test',password:'Identity-owner-password'}});
  const response=await page.request.post(url+'/api/v1/customers',{data:{name:'API Customer',domains:['primary.test','secondary.test'],externalIds:['external-customer']}});expect(response.ok()).toBeTruthy();const customer=await response.json();
  await page.goto(url+'/customer/'+customer.id);await page.getByRole('button',{name:'More actions',exact:true}).first().click();await page.getByRole('button',{name:'Edit details',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Edit customer',exact:true});await dialog.getByLabel('Domain',{exact:true}).fill('updated.test');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.reload();await expect(page.getByRole('heading',{name:'API Customer',exact:true})).toBeVisible();
  const saved=await(await page.request.get(url+'/api/v1/customers/'+customer.id)).json();expect(saved.domain).toBe('updated.test');expect(saved.domains).toEqual(['updated.test','secondary.test']);expect(saved.externalIds).toEqual(['external-customer']);
 }finally{await app.close();}
});

test("customer requests preserve issue and project links, importance, attributes, favorites and saved view filters", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Customer QA",
        email: "customer@example.test",
        password: "isolated-customer-password",
        workspaceName: "Customers",
      },
    });
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state(),
      team = initial.teams[0];
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const acme = await create("customers", {
        name: "Acme",
        domain: "acme.test",
        tier: "Enterprise",
        status: "Active",
        revenue: 40000,
        size: 100,
      }),
      small = await create("customers", {
        name: "Small Company",
        domain: "small.test",
        tier: "Startup",
        revenue: 100,
      });
    const project = await create("projects", {
        name: "Feedback project",
        teamIds: [team.id],
        status: "planned",
      }),
      issue = await create("issues", {
        title: "Improve account controls",
        teamId: team.id,
      });
    await page.goto(`${url}/issues/${issue.id}`);
    await page.getByRole("button", { name: "Issue options", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Customer request", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Customer", { exact: true }).selectOption(acme.id);
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Role controls are critical");
    await dialog.getByLabel("Requester name").fill("Alex");
    await dialog
      .getByLabel("Source URL")
      .fill("https://example.test/feedback/42");
    await dialog.getByLabel("Important to this customer").check();
    await dialog
      .locator("[contenteditable=true]")
      .fill("Need separate permissions for each department.");
    await dialog
      .getByRole("button", { name: "Add request", exact: true })
      .click();
    await expect(page.locator(".entity-customer-requests")).toContainText(
      "Role controls are critical",
    );
    await expect.poll(async () => (await state()).requests.length).toBe(1);
    const linked = (await state()).requests[0];
    expect(linked.issueId).toBe(issue.id);
    expect(linked.important).toBe(true);
    expect(linked.body).toContain("separate permissions");
    await page.goto(`${url}/customer/${acme.id}`);
    await page
      .getByRole("switch", { name: "Add to favorites", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Setup customer notifications", exact: true })
      .click();
    await expect(page.locator(".favorite-row")).toContainText("Acme");
    await page
      .getByRole("button", { name: "Add request", exact: true })
      .click();
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Track feedback project");
    await dialog.getByLabel("Request target type").selectOption("project");
    await dialog.getByLabel("Link to project").selectOption(project.id);
    await dialog
      .getByRole("button", { name: "Add request", exact: true })
      .click();
    await expect.poll(async () => (await state()).requests.length).toBe(2);
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await expect(page.locator(".feature-readable")).toContainText(
      "Feedback project",
    );
    await page.getByRole("button", { name: "Requests", exact: true }).click();
    await page
      .locator(`[data-request-id="${linked.id}"]`)
      .getByRole("button", { name: "Remove important flag", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).requests.find((r: any) => r.id === linked.id)
            .important,
      )
      .toBe(false);
    const view = await create("views", {
      name: "Enterprise requests",
      entityType: "issues",
      visibility: "workspace",
      filters: {
        match: "all",
        conditions: [
          { field: "customerTier", operator: "eq", value: "Enterprise" },
          { field: "customerRevenue", operator: "gte", value: 30000 },
        ],
      },
    });
    await page.goto(`${url}/view/${view.id}`);
    await expect(page.getByTestId("issue-row")).toHaveCount(1);
    await expect(page.getByTestId("issue-row")).toContainText(issue.title);
    await page.goto(`${url}/settings/customers`);
    await page.getByRole("combobox",{name:"Default team for customer requests",exact:true}).click();await page.getByRole('option',{name:team.name,exact:true}).click();
    await page.getByRole("combobox",{name:"Revenue currency",exact:true}).click();await page.getByRole('option',{name:'EUR (€)',exact:true}).click();
    const tiers=page.getByRole('region',{name:'Customer tiers',exact:true});await page.getByRole('button',{name:'Create new customer tier',exact:true}).click();await tiers.getByLabel('Name',{exact:true}).fill('Partner');await tiers.getByRole('button',{name:'Submit',exact:true}).click();await expect(tiers.getByLabel('Name',{exact:true})).toHaveCount(0);
    const lost=page.locator('.customer-status-card .customer-list-row',{hasText:'Lost'});await lost.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
    for(const value of ['ourcompany.test','internal@example.test']){await page.getByRole('button',{name:'Add excluded domains and emails',exact:true}).click();await page.getByLabel('Domain or email address',{exact:true}).fill(value);await page.getByRole('button',{name:'Submit',exact:true}).click()}
    await page.reload();
    await expect(page.getByRole("combobox",{name:"Revenue currency",exact:true})).toContainText("EUR (€)");
    await page.goto(`${url}/customers`);
    await page.getByRole("button",{name:"Add filter",exact:true}).click();
    await page.getByLabel("Filter customer tier").selectOption("Enterprise");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody")).toContainText("Acme");
    await expect(page.locator("tbody")).not.toContainText(small.name);
    const mergingRequest=await create('requests',{title:'Merged request',customerId:small.id,issueId:issue.id});
    await page.goto(`${url}/customer/${small.id}`);await page.getByRole('switch',{name:'Add to favorites',exact:true}).click();await page.getByRole('button',{name:'Merge with',exact:true}).click();await page.getByRole('dialog').getByLabel('Keep customer').selectOption(acme.id);await page.getByRole('dialog').getByRole('button',{name:'Merge customers',exact:true}).click();await expect(page).toHaveURL(`${url}/customer/${acme.id}`);await expect.poll(async()=>(await state()).requests.find((r:any)=>r.id===mergingRequest.id).customerId).toBe(acme.id);expect((await state()).customers.find((c:any)=>c.id===small.id).deletedAt).toBeTruthy();await expect(page.locator('.favorite-row')).toHaveCount(1);await page.screenshot({path:'artifacts/verification/customer-requests.png'});
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});

test('customer request API lifecycle stays in sync with app archive, unarchive, source links and deletion',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Lifecycle owner',email:'lifecycle-owner@example.test',password:'Lifecycle-owner-password'}});
  const project=await(await page.request.post(url+'/api/v1/projects',{data:{name:'Lifecycle feedback'}})).json();
  const call=async(query:string,variables:any)=>{const result=await(await page.request.post(url+'/graphql',{data:{query,variables}})).json();expect(result.errors).toBeUndefined();return result.data;};
  const created=await call('mutation($input:CustomerNeedCreateInput!){customerNeedCreate(input:$input){need{id projectAttachment{id url}}}}',{input:{projectId:project.id,body:'Lifecycle **context**',attachmentUrl:'https://example.test/lifecycle-context'}}),need=created.customerNeedCreate.need;
  await page.goto(url+'/project/'+project.id+'/customer-requests');const card=page.locator('[id="request-'+need.id+'"]');await expect(card.locator('.customer-request-body strong')).toHaveText('context');
  await card.getByRole('button',{name:'More actions',exact:true}).click();await card.getByRole('button',{name:'Archive',exact:true}).click();await expect(card).toHaveCount(0);
  const archived=await call('query($id:String!){customerNeed(id:$id){archivedAt projectAttachment{id}}}',{id:need.id});expect(archived.customerNeed.archivedAt).toBeTruthy();expect(archived.customerNeed.projectAttachment.id).toBe(need.projectAttachment.id);
  await call('mutation($id:String!){customerNeedUnarchive(id:$id){success entity{id}}}',{id:need.id});await page.reload();await expect(card.locator('.customer-request-body strong')).toHaveText('context');await expect(card.getByRole('link',{name:'Source',exact:true})).toHaveAttribute('href','https://example.test/lifecycle-context');
  await call('mutation($id:String!){customerNeedUpdate(id:$id,input:{body:"Updated lifecycle body",priority:1}){success}}',{id:need.id});await page.reload();await expect(card.locator('.customer-request-body')).toHaveText('Updated lifecycle body');
  await call('mutation($id:String!){customerNeedDelete(id:$id,keepAttachment:true){success entityId}}',{id:need.id});await page.reload();await expect(card).toHaveCount(0);
  const second=(await call('mutation($input:CustomerNeedCreateInput!){customerNeedCreate(input:$input){need{id projectAttachment{id}}}}',{input:{projectId:project.id,body:'App deletion',attachmentUrl:'https://example.test/app-delete'}})).customerNeedCreate.need;await page.reload();const secondCard=page.locator('[id="request-'+second.id+'"]');await expect(secondCard).toBeVisible();await secondCard.getByRole('button',{name:'More actions',exact:true}).click();await secondCard.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await expect(secondCard).toHaveCount(0);await expect.poll(()=>app.repo.db.prepare('SELECT id FROM project_attachments WHERE id=?').get(second.projectAttachment.id)).toBeUndefined();

 }finally{await app.close();}
});

test('customer request moves through the app editor and API preserve source identity and target navigation',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Move owner',email:'move-owner@example.test',password:'Move-owner-password'}});
  const create=async(kind:string,data:any)=>{const response=await page.request.post(url+'/api/v1/'+kind,{data});expect(response.ok()).toBeTruthy();return response.json();};
  const a=await create('projects',{name:'Original feedback project'}),b=await create('projects',{name:'Destination feedback project'}),teams=await(await page.request.get(url+'/api/v1/teams')).json(),issue=await create('issues',{title:'Destination issue',teamId:teams.nodes[0].id});
  const call=async(query:string,variables:any)=>{const result=await(await page.request.post(url+'/graphql',{data:{query,variables}})).json();expect(result.errors).toBeUndefined();return result.data;};
  const need=(await call('mutation($input:CustomerNeedCreateInput!){customerNeedCreate(input:$input){need{id projectAttachment{id}}}}',{input:{projectId:a.id,body:'Move **this request**',attachmentUrl:'https://example.test/editor-move'}})).customerNeedCreate.need;
  await page.goto(url+'/project/'+a.id+'/customer-requests');const card=page.locator('[id="request-'+need.id+'"]');await card.locator('.request-title').click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Link to project',{exact:true}).selectOption(b.id);await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(card).toHaveCount(0);
  await page.goto(url+'/customer-request/'+need.id);await expect(page).toHaveURL(new RegExp('/project/'+b.id+'/customer-requests'));await expect(card.locator('.customer-request-body strong')).toHaveText('this request');
  const read=await call('query($id:String!){customerNeed(id:$id){project{id} projectAttachment{id url} originalIssue{id}}}',{id:need.id});expect(read.customerNeed.projectAttachment.id).toBe(need.projectAttachment.id);expect(read.customerNeed.originalIssue).toBeNull();
  const moved=await call('mutation($id:String!,$input:CustomerNeedUpdateInput!){customerNeedUpdate(id:$id,input:$input){need{issue{id} attachment{id url} projectAttachment{id}}}}',{id:need.id,input:{issueId:issue.identifier}});expect(moved.customerNeedUpdate.need.attachment.id).toBe(need.projectAttachment.id);expect(moved.customerNeedUpdate.need.projectAttachment).toBeNull();
  await page.goto(url+'/customer-request/'+need.id);await expect(page).toHaveURL(new RegExp('/issues/'+issue.id));await page.reload();const persisted=await call('query($id:String!){customerNeed(id:$id){body issue{id} attachment{id url}}}',{id:need.id});expect(persisted.customerNeed.body).toBe('Move **this request**');expect(persisted.customerNeed.attachment.id).toBe(need.projectAttachment.id);expect(persisted.customerNeed.issue.id).toBe(issue.id);
 }finally{await app.close();}
});
