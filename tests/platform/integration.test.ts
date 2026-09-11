import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.js';
import { ParabolicClient, ApiError } from '../../packages/sdk/src/client.js';
import { verifyWebhook } from '../../packages/sdk/src/webhooks.js';
import { createMcpHandler } from '../../src/mcp/server.js';

test('SDK and MCP operate against the persistent service with actual scoped credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'parabolic-platform-'));
  const service = createApp({ databasePath: join(directory, 'test.sqlite'), port: 0, logger: (_message, error) => { console.error(error); } });
  const { url } = await service.start();
  try {
    const setup = await fetch(`${url}/auth/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'platform@example.test', password: 'Test-password-123', name: 'Platform', workspaceName: 'Platform tests' }) });
    assert.equal(setup.status, 201); const cookie = setup.headers.get('set-cookie')!.split(';')[0];
    const owner = new ParabolicClient({ baseUrl: url, headers: { Cookie: cookie } });
    const issued = await owner.apiKeys.create({ name: 'Integration test', scopes: ['read', 'write', 'admin'] }); assert.ok(issued.token.startsWith('flw_'));
    const client = new ParabolicClient({ baseUrl: url, token: issued.token });
    const state = await client.state(); assert.ok(state.user); const team = state.teams[0];
    const issue = await client.issues.create({ title: 'Platform contract issue', teamId: team.id });
    const changed = await client.issues.update(issue.id, { title: 'Platform updated issue', version: issue.version }); assert.equal(changed.version, issue.version + 1);
    const found = await client.issues.list({ filter: { id: { eq: issue.id } }, first: 1 }); assert.equal(found.nodes[0].title, changed.title);
    assert.equal((await client.search('Platform updated', { kinds: ['issues'] })).nodes[0].id, issue.id);
    const graph = await client.graphql<{ issue: { id: string; title: string } }>('query($id: String!) { issue(id: $id) { id title } }', { id: issue.id }); assert.equal(graph.issue.id, issue.id);
    const created = await client.batch([{ kind: 'comments', action: 'create', data: { issueId: issue.id, body: 'A comment through the SDK' } }], 'platform-batch-1');
    const replay = await client.batch([{ kind: 'comments', action: 'create', data: { issueId: issue.id, body: 'A comment through the SDK' } }], 'platform-batch-1'); assert.deepEqual(replay, created);
    await client.issues.remove(issue.id); await assert.rejects(() => client.issues.get(issue.id), (error: any) => error instanceof ApiError && error.status === 404); assert.equal((await client.issues.restore(issue.id)).id, issue.id);
    const key = await owner.apiKeys.create({ name: 'Read issues', scopes: ['issues:read'] });
    const reader = new ParabolicClient({ baseUrl: url, token: key.token }); assert.ok((await reader.authStatus()).user);
    await assert.rejects(() => reader.issues.create({ title: 'Forbidden', teamId: team.id }), (error: any) => error instanceof ApiError && error.status === 403);
    const mcp = createMcpHandler({ client: reader, collections: ['issues'] });
    const read = await mcp.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_entity', arguments: { kind: 'issues', id: issue.id } } }) as any; assert.equal(read.result.structuredContent.result.id, issue.id);
    const write = await mcp.handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'update_entity', arguments: { kind: 'issues', id: issue.id, fields: { title: 'Denied by token scope' } } } }) as any; assert.equal(write.result.isError, true);
    await owner.apiKeys.revoke(key.id); assert.equal((await reader.authStatus()).user, null);
    const list = await owner.apiKeys.list(); assert.ok(list.nodes.length >= 1); assert.equal(list.nodes[0].token, undefined);
    const application = await owner.apps.create({ name: 'Platform tool', redirectUris: ['https://example.test/callback'], scopes: ['issues:read'] }); assert.ok(application.clientSecret);
    assert.equal((await owner.apps.update(application.id, { name: 'Renamed platform tool' })).name, 'Renamed platform tool');
    assert.equal((await owner.apps.list()).nodes[0].clientSecret, undefined); await owner.apps.remove(application.id);
    const invitation = await owner.invitations.create({ email: 'invited@example.test', role: 'member' }); assert.ok(invitation.token);
    assert.equal((await owner.invitations.list()).nodes[0].token, undefined); await owner.invitations.remove(invitation.id);
    assert.equal((await owner.sessions.list()).nodes[0].current, true);
    const workspace = await owner.createWorkspace('Second platform workspace'); assert.notEqual(workspace.workspaceId, state.workspaceId);
    assert.equal((await owner.accessibleWorkspaces()).nodes.length, 2); await owner.switchWorkspace(state.workspaceId);
  } finally { await service.close(); await rm(directory, { recursive: true, force: true }); }
});

test('SDK verifies a real webhook and receives replayed server events', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'parabolic-webhook-'));
  const received: { body: Buffer; signature: string }[] = [];
  const receiver = createServer(async (req, res) => { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); received.push({ body: Buffer.concat(chunks), signature: String(req.headers['x-parabolic-signature']) }); res.writeHead(204); res.end(); });
  await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve));
  const address = receiver.address() as { port: number };
  const service = createApp({ databasePath: join(directory, 'test.sqlite'), port: 0, webhookAllowPrivateHosts: true });
  const { url } = await service.start();
  try {
    const setup = await fetch(`${url}/auth/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'webhook@example.test', password: 'Test-password-123', name: 'Webhook' }) });
    const client = new ParabolicClient({ baseUrl: url, headers: { Cookie: setup.headers.get('set-cookie')!.split(';')[0] } });
    const hook = await client.webhooks.create({ url: `http://127.0.0.1:${address.port}/receive`, events: ['issues.create'] }); assert.ok(hook.secret);
    const before = service.db.prepare('SELECT MAX(seq) AS seq FROM changes').get() as { seq: number };
    const team = (await client.teams.list()).nodes[0]; const issue = await client.issues.create({ title: 'Webhook contract issue', teamId: team.id });
    const abort = new AbortController();
    for await (const event of client.events({ lastEventId: String(before.seq), signal: abort.signal })) {if(event.event==='access')continue; assert.equal(event.id, issue.id); break; }
    abort.abort();
    const deadline = Date.now() + 5000;
    while (!received.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(received.length, 1); assert.equal((verifyWebhook({ ...received[0], secret: hook.secret! }).data as any).id, issue.id);
    const deliveries = await client.webhooks.deliveries(hook.id); assert.equal(deliveries.nodes.length, 1);
  } finally { await service.close(); await new Promise<void>(resolve => receiver.close(() => resolve())); await rm(directory, { recursive: true, force: true }); }
});

test('SDK binary attachments, incremental sync and access invalidations operate against the service',async()=>{
  const app=createApp({databasePath:':memory:',port:0});const {url}=await app.start();const controller=new AbortController();
  try{
    const setup=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'SDK Sync',email:'sdk-sync@example.test',password:'Sdk-sync-password'})});const cookie=setup.headers.get('set-cookie')!.split(';')[0];let connected!:()=>void;const ready=new Promise<void>(resolve=>connected=resolve);
    const client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie},fetch:(async(input,init)=>{const response=await fetch(input,init);if(String(input).endsWith('/api/v1/events'))connected();return response;}) as typeof fetch});
    const bootstrap=await client.sync.bootstrap();assert.ok(bootstrap.seq>0);const doc=await client.documents.create({title:'Attachment and access',content:'<p>Base</p>',visibility:'workspace'});const data=new Uint8Array([0,1,255,13,10,128]);const upload=await client.uploadFile(new Blob([data],{type:'application/octet-stream'}),{filename:'data.bin',entityKind:'documents',entityId:doc.id});assert.deepEqual(await client.downloadAttachment(upload.id),data);
    const changes=await client.sync.changes({after:bootstrap.seq,accessRevision:bootstrap.accessRevision});assert.ok(changes.events.some(event=>event.id===doc.id));const scan=await client.sync.scan('documents',{first:1});assert.equal(scan.nodes[0].id,doc.id);
    const iterator=client.events({signal:controller.signal});const first=iterator.next();await ready;await client.documents.update(doc.id,{visibility:'private'});const access=await first;assert.equal(access.value?.event,'access');if(access.value?.event==='access')assert.ok(access.value.accessRevision>bootstrap.accessRevision);await iterator.return(undefined);
    assert.equal((await client.sync.changes({after:changes.nextSeq,accessRevision:bootstrap.accessRevision})).resetRequired,true);await client.deleteAttachment(upload.id);await assert.rejects(()=>client.downloadAttachment(upload.id),(error:any)=>error instanceof ApiError&&error.status===404);
    const invitation=await client.invitations.create({email:'sdk-joined@example.test',role:'member'});let joiningCookie='';const joining=new ParabolicClient({baseUrl:url,fetch:async(input,init)=>{const headers=new Headers(init?.headers);if(joiningCookie)headers.set('cookie',joiningCookie);const response=await fetch(input,{...init,headers});const cookie=response.headers.get('set-cookie');if(cookie)joiningCookie=cookie.split(';')[0];return response;}});const account=await joining.join({token:invitation.token!,name:'Joined SDK',password:'Sdk-joined-password'});assert.equal(account.user.email,'sdk-joined@example.test');
    const form=await client.asksForms.create({name:'SDK intake',teamId:bootstrap.state.teams[0].id,enabled:true,fields:[{id:'impact',label:'Impact',required:true}]});assert.equal((await joining.publicAsks.get(form.id)).name,'SDK intake');const request=await joining.publicAsks.submit(form.id,{title:'SDK public request',email:'external@example.test',answers:{impact:'Several colleagues'}});assert.equal(request.status,'received');assert.equal((await client.requests.get(request.id)).answers?.impact,'Several colleagues');assert.equal((await client.requests.get(request.id)).requesterEmail,account.user.email);assert.equal((await client.requests.get(request.id)).requesterId,account.user.id);
    const insights=await client.insights({kind:'issues',groupBy:'priority',filter:{title:'SDK public request'}});assert.equal(insights.totalCount,1);assert.equal(insights.nodes[0].count,1);
    const source=await client.customers.create({name:'Customer source'}),target=await client.customers.create({name:'Customer destination'}),linked=await client.requests.create({title:'Customer link',customerId:source.id});const merged=await client.mergeCustomer(source.id,target.id);assert.equal(merged.id,target.id);assert.equal((await client.requests.get(linked.id)).customerId,target.id);
    const parent=await client.initiatives.create({name:'Parent initiative'}),child=await client.initiatives.create({name:'Child initiative',parentIds:[parent.id]}),project=await client.projects.create({name:'Rolled up project',teamIds:[bootstrap.state.teams[0].id],initiativeIds:[child.id]});const rollup=await client.initiativeRollup(parent.id);assert.deepEqual(rollup.children.map(item=>item.id),[child.id]);assert.deepEqual(rollup.projects.map(item=>item.id),[project.id]);assert.equal((await client.initiativeRollup(parent.id,{directOnly:true})).projects.length,0);
    await client.documents.remove(doc.id);const mcp=createMcpHandler({client,collections:['documents']});const result=await mcp.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_entities',arguments:{kind:'documents',includeDeleted:true,filter:{id:doc.id}}}}) as any;assert.equal(result.result.structuredContent.result.nodes[0].id,doc.id);
  }finally{controller.abort();await app.close();}
});

test('SDK issue and project lifecycle methods preserve atomic results and idempotent copies',async()=>{
  const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();
  try{
    const setup=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Lifecycle SDK',email:'lifecycle-sdk@example.test',password:'Lifecycle-sdk-password'})});
    const client=new ParabolicClient({baseUrl:url,headers:{Cookie:setup.headers.get('set-cookie')!.split(';')[0]}}),team=(await client.teams.list()).nodes[0];
    const parent=await client.issues.create({title:'SDK parent',teamId:team.id}),child=await client.issues.create({title:'SDK child',teamId:team.id,parentId:parent.id});
    const copy=await client.duplicateIssue(parent.id,{title:'SDK copied parent',includeSubIssues:true,clientMutationId:'sdk-issue-copy'});
    assert.equal(copy.issue.title,'SDK copied parent');assert.equal(copy.issues.length,2);assert.notEqual(copy.issue.id,parent.id);assert.equal(copy.issues.find(issue=>issue.id!==copy.issue.id)?.parentId,copy.issue.id);
    assert.equal((await client.duplicateIssue(parent.id,{title:'SDK copied parent',includeSubIssues:true,clientMutationId:'sdk-issue-copy'})).issue.id,copy.issue.id);
    const converted=await client.convertIssueToProject(copy.issue.id,{name:'SDK converted project',clientMutationId:'sdk-convert'});assert.equal(converted.project.name,'SDK converted project');assert.ok(converted.issues.every(issue=>issue.projectId===converted.project.id));assert.equal((await client.issues.get(child.id)).parentId,parent.id);
    const milestone=await client.milestones.create({name:'SDK milestone',projectId:converted.project.id});await client.documents.create({title:'SDK project document',projectId:converted.project.id,content:'<p>Context</p>'});
    const projectCopy=await client.duplicateProject(converted.project.id,{name:'SDK duplicated project',includeIssues:true,includeDocuments:true,includeMilestones:true,clientMutationId:'sdk-project-copy'});assert.equal(projectCopy.project.name,'SDK duplicated project');assert.equal(projectCopy.issues.length,2);assert.equal(projectCopy.documents.length,1);assert.equal(projectCopy.milestones.length,1);assert.notEqual(projectCopy.milestones[0].id,milestone.id);assert.equal((await client.duplicateProject(converted.project.id,{clientMutationId:'sdk-project-copy'})).project.id,projectCopy.project.id);
    const convertMilestone=projectCopy.milestones[0];await client.issues.update(projectCopy.issues[0].id,{milestoneId:convertMilestone.id});const milestoneProject=await client.convertMilestoneToProject(convertMilestone.id,{name:'SDK milestone project',version:convertMilestone.version,clientMutationId:'sdk-milestone-convert'});assert.equal(milestoneProject.project.name,'SDK milestone project');assert.equal(milestoneProject.issues.length,1);assert.equal(milestoneProject.issues[0].id,projectCopy.issues[0].id);assert.equal((await client.convertMilestoneToProject(convertMilestone.id,{clientMutationId:'sdk-milestone-convert'})).project.id,milestoneProject.project.id);assert.equal((await client.issues.get(projectCopy.issues[1].id)).projectId,projectCopy.project.id);
    const accessible=await client.sync.access([{kind:'projects',id:milestoneProject.project.id},{kind:'issues',id:'not-an-entity'}]);assert.deepEqual(accessible.allowed,['projects:'+milestoneProject.project.id]);
    const comment=await client.comments.create({issueId:child.id,body:'Retain merge context'}),request=await client.requests.create({title:'Retain customer context',issueId:child.id});const merged=await client.mergeIssue(child.id,parent.id,{clientMutationId:'sdk-merge'});assert.equal(merged.issue.duplicateOfId,parent.id);assert.equal(merged.target.id,parent.id);assert.equal((await client.comments.get(comment.id)).issueId,parent.id);assert.equal((await client.requests.get(request.id)).issueId,parent.id);
  }finally{await app.close();}
});
