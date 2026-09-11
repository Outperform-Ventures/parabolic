import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac, createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';

async function fixture(options:any={}){
  const errors:unknown[]=[];const app=createApp({seedDemo:true,databasePath:':memory:',port:0,logger:(_m,e)=>errors.push(e),...options});const {url}=await app.start();
  let cookie='';
  const request=async(path:string,method='GET',data?:any,headers:Record<string,string>={})=>{const response=await fetch(url+path,{method,headers:{...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});const text=await response.text();let body:any;try{body=JSON.parse(text);}catch{body=text;}return {status:response.status,body,response};};
  const setup=await request('/auth/setup','POST',{name:'Owner',email:'owner@example.com',password:'correct-horse-battery',workspaceName:'Test workspace'});assert.equal(setup.status,201,JSON.stringify({body:setup.body,errors}));cookie=setup.response.headers.get('set-cookie')!.split(';')[0];const state=(await request('/api/v1/state')).body;
  return {app,url,request,state,cookie,errors,close:()=>app.close()};
}

test('setup, authentication, origin checking and restart persistence',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'parabolic-test-'));const databasePath=join(directory,'db.sqlite');const f=await fixture({databasePath});
  try {
    assert.equal((await f.request('/auth/setup','POST',{email:'other@example.com',password:'long-enough-password'})).status,409);
    assert.equal((await f.request('/auth/login','POST',{email:'owner@example.com',password:'wrong'})).status,401);
    const unauth=await fetch(f.url+'/api/v1/state');assert.equal(unauth.status,401);
    assert.equal((await f.request('/api/v1/issues','POST',{title:'Cross-origin write',teamId:f.state.teams[0].id},{origin:'https://attacker.invalid'})).status,403);
    const issue=await f.request('/api/v1/issues','POST',{title:'Persists after restart',teamId:f.state.teams[0].id});assert.equal(issue.status,201);assert.match(issue.body.identifier,/ENG-\d+/);
    await f.close();const restart=createApp({databasePath,port:0});const {url}=await restart.start();try{const response=await fetch(url+`/api/v1/issues/${issue.body.id}`,{headers:{cookie:f.cookie}});assert.equal(response.status,200);assert.equal((await response.json()).title,'Persists after restart');}finally{await restart.close();}
  }finally{await f.close();rmSync(directory,{recursive:true,force:true});}
});

test('batch transactions, idempotency, optimistic version conflicts and relation validation',async()=>{
  const f=await fixture();try{
    const teamId=f.state.teams[0].id;
    const atomic=await f.request('/api/v1/batch','POST',{operations:[{kind:'issues',action:'create',id:'atomic-good',data:{title:'Atomic valid',teamId}},{kind:'issues',action:'create',id:'atomic-bad',data:{title:'',teamId}}]});assert.equal(atomic.status,422);assert.equal((await f.request('/api/v1/issues/atomic-good')).status,404);
    const payload={clientMutationId:'outbox-retry-1',operations:[{kind:'issues',action:'create',id:'retry-issue',data:{title:'Only once',teamId}}]};const first=await f.request('/api/v1/batch','POST',payload),second=await f.request('/api/v1/batch','POST',payload);assert.equal(first.status,200);assert.deepEqual(first.body,second.body);
    const issue=first.body.results[0];assert.equal((await f.request(`/api/v1/issues/${issue.id}`,'PATCH',{title:'Changed',version:issue.version})).status,200);assert.equal((await f.request(`/api/v1/issues/${issue.id}`,'PATCH',{title:'Stale',version:issue.version})).status,409);
    const child=(await f.request('/api/v1/issues','POST',{title:'Child',teamId,parentId:issue.id})).body;assert.equal((await f.request(`/api/v1/issues/${issue.id}`,'PATCH',{parentId:child.id})).status,422);
    assert.equal((await f.request('/api/v1/issues','POST',{title:'Bad relationship',teamId,relations:[{type:'related',issueId:'missing'}]})).status,422);
    assert.equal((await f.request(`/api/v1/issues/${child.id}`,'DELETE')).status,204);assert.equal((await f.request(`/api/v1/issues/${child.id}`)).status,404);assert.equal((await f.request(`/api/v1/issues/${child.id}/restore`,'POST')).status,200);
  }finally{await f.close();}
});

test('scoped API tokens, revoked credentials, private team and parent data isolation',async()=>{
  const f=await fixture();try{
    const key=(await f.request('/api/v1/api-keys','POST',{name:'Read issues',scopes:['issues:read']})).body;assert.ok(key.token);const headers={authorization:`Bearer ${key.token}`,cookie:''};
    assert.equal((await f.request('/api/v1/issues','GET',undefined,headers)).status,200);assert.equal((await f.request('/api/v1/projects','GET',undefined,headers)).status,403);assert.equal((await f.request('/api/v1/issues','POST',{title:'Denied',teamId:f.state.teams[0].id},headers)).status,403);assert.equal((await f.request('/auth/status','GET',undefined,headers)).body.user.id,f.state.user.id);
    const invitation=(await f.request('/api/v1/invitations','POST',{email:'member@example.com'})).body;const member=await f.request('/auth/join','POST',{token:invitation.token,password:'member-secure-password',name:'Member'},{cookie:''});assert.equal(member.status,201);const memberCookie=member.response.headers.get('set-cookie')!.split(';')[0];
    const privateTeam=(await f.request('/api/v1/teams','POST',{name:'Private',key:'SEC',private:true})).body;const privateIssue=(await f.request('/api/v1/issues','POST',{title:'Private plan',teamId:privateTeam.id})).body;assert.ok(privateIssue.id);
    await f.request('/api/v1/comments','POST',{entityType:'issue',entityId:privateIssue.id,body:'Private comment'});
    const memberState=(await f.request('/api/v1/state','GET',undefined,{cookie:memberCookie})).body;assert.ok(!memberState.issues.some((i:any)=>i.id===privateIssue.id));assert.ok(!memberState.comments.some((c:any)=>c.issueId===privateIssue.id));assert.ok(!memberState.activities.some((a:any)=>a.entityId===privateIssue.id));assert.equal((await f.request(`/api/v1/issues/${privateIssue.id}`,'GET',undefined,{cookie:memberCookie})).status,404);
    assert.equal((await f.request('/api/v1/webhooks','GET',undefined,{cookie:memberCookie})).status,403);
    assert.equal((await f.request(`/api/v1/api-keys/${key.id}`,'DELETE')).status,204);assert.equal((await f.request('/api/v1/issues','GET',undefined,headers)).status,401);
  }finally{await f.close();}
});

test('GraphQL mutations, nested reads, filtering, pagination and indexed search',async()=>{
  const f=await fixture();try{
    const create=await f.request('/graphql','POST',{query:'mutation Create($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title identifier team { id name } } } }',variables:{input:{title:'Unique platypus issue',teamId:f.state.teams[0].id}}});assert.equal(create.status,200);assert.equal(create.body.errors,undefined,JSON.stringify(create.body));assert.equal(create.body.data.issueCreate.success,true);
    const list=await f.request('/graphql','POST',{query:'query { issues(first: 1, filter: { title: { contains: "platypus" } }) { nodes { id title comments { totalCount } } totalCount pageInfo { hasNextPage endCursor } } }'});assert.equal(list.body.errors,undefined,JSON.stringify(list.body));assert.equal(list.body.data.issues.totalCount,1);
    const search=await f.request('/api/v1/search?q=platypus');assert.equal(search.body.nodes[0].id,create.body.data.issueCreate.issue.id);
    const page1=(await f.request('/api/v1/issues?first=2&orderBy=number:asc')).body;assert.equal(page1.nodes.length,2);assert.equal(page1.pageInfo.hasNextPage,true);const page2=(await f.request('/api/v1/issues?first=2&orderBy=number:asc&after='+encodeURIComponent(page1.pageInfo.endCursor))).body;assert.ok(!page1.nodes.some((a:any)=>page2.nodes.some((b:any)=>a.id===b.id)));
  }finally{await f.close();}
});

test('webhooks are signed, durable, retried and inspectable',async()=>{
  let fail=true;const received:any[]=[];const target=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);received.push({raw:Buffer.concat(chunks).toString(),headers:req.headers});res.writeHead(fail?503:204);res.end();});await new Promise<void>(resolve=>target.listen(0,'127.0.0.1',resolve));const port=(target.address() as any).port;
  const f=await fixture({webhookAllowPrivateHosts:true});try{
    const hook=await f.request('/api/v1/webhooks','POST',{url:`http://127.0.0.1:${port}/hook`,events:['issues.create']});assert.equal(hook.status,201,JSON.stringify({body:hook.body,errors:f.errors}));assert.ok(hook.body.secret);
    await f.request('/api/v1/issues','POST',{title:'Webhook delivery',teamId:f.state.teams[0].id});await f.app.webhooks.tick();assert.equal(received.length,1);assert.equal(received[0].headers['parabolic-signature'],createHmac('sha256',hook.body.secret).update(received[0].raw).digest('hex'));
    let deliveries=(await f.request(`/api/v1/webhooks/${hook.body.id}/deliveries`)).body.nodes;assert.equal(deliveries[0].status,'retrying');assert.equal(deliveries[0].lastStatus,503);fail=false;await f.request(`/api/v1/webhook-deliveries/${deliveries[0].id}/retry`,'POST');await f.app.webhooks.tick();deliveries=(await f.request(`/api/v1/webhooks/${hook.body.id}/deliveries`)).body.nodes;assert.equal(deliveries[0].status,'delivered');assert.equal(received.length,2);
    const list=(await f.request('/api/v1/webhooks')).body;assert.equal(list.nodes[0].secret,undefined);
  }finally{await f.close();await new Promise<void>(resolve=>target.close(()=>resolve()));}
  const restricted=await fixture();try{assert.equal((await restricted.request('/api/v1/webhooks','POST',{url:'http://127.0.0.1:80'})).status,422);}finally{await restricted.close();}
});

test('OAuth consent, PKCE, code single use, token scope and app revocation',async()=>{
  const f=await fixture();try{
    const app=await f.request('/api/v1/apps','POST',{name:'Local utility',redirectUris:['http://127.0.0.1:9999/callback'],scopes:['issues:read']});assert.equal(app.status,201,JSON.stringify({body:app.body,errors:f.errors}));
    const verifier=randomBytes(32).toString('base64url');const challenge=createHash('sha256').update(verifier).digest('base64url');const authorize={client_id:app.body.id,redirect_uri:'http://127.0.0.1:9999/callback',scope:'issues:read',code_challenge:challenge,code_challenge_method:'S256',state:'unchanged'};
    assert.equal((await f.request('/oauth/authorize','POST',authorize)).status,400);const consent=await f.request('/oauth/authorize','POST',{...authorize,approve:true});assert.equal(consent.status,200,JSON.stringify(consent.body));assert.equal(new URL(consent.body.redirectUri).searchParams.get('state'),'unchanged');
    const tokenFields={grant_type:'authorization_code',client_id:app.body.id,redirect_uri:authorize.redirect_uri,code:consent.body.code,code_verifier:verifier};const token=await f.request('/oauth/token','POST',tokenFields,{cookie:''});assert.equal(token.status,200,JSON.stringify({body:token.body,errors:f.errors}));const headers={authorization:`Bearer ${token.body.access_token}`,cookie:''};const scopedIssues=await f.request('/api/v1/issues','GET',undefined,headers);assert.equal(scopedIssues.status,200);assert.ok(scopedIssues.body.nodes.some((issue:any)=>issue.id===f.state.issues[0].id),'Issue read scope includes visible issues belonging to projects');assert.equal((await f.request(`/api/v1/issues/${f.state.issues[0].id}`,'GET',undefined,headers)).status,200);assert.equal((await f.request('/api/v1/projects','GET',undefined,headers)).status,403);assert.equal((await f.request('/oauth/token','POST',tokenFields,{cookie:''})).status,400);
    await f.request(`/api/v1/apps/${app.body.id}`,'DELETE');assert.equal((await f.request('/api/v1/issues','GET',undefined,headers)).status,401);
  }finally{await f.close();}
});

test('authorized attachment bytes, recurrence, SLA timers and public request intake',async()=>{
  const f=await fixture();try{
    const issue=f.state.issues[0];const upload=await f.request('/api/v1/attachments','POST',{filename:'notes.txt',mimeType:'text/plain',content:Buffer.from('Attachment bytes').toString('base64'),issueId:issue.id});assert.equal(upload.status,201,JSON.stringify({body:upload.body,errors:f.errors}));const downloaded=await f.request(upload.body.url);assert.equal(downloaded.body,'Attachment bytes');assert.match(downloaded.response.headers.get('content-disposition')||'',/^attachment/);assert.equal((await fetch(f.url+upload.body.url)).status,401);
    const policy=(await f.request('/api/v1/slaPolicies','POST',{name:'Urgent',durationMinutes:5})).body;const recurring=(await f.request('/api/v1/issues','POST',{title:'Recurring action',teamId:issue.teamId,slaPolicyId:policy.id,recurrence:{frequency:'weekly',interval:1,startDate:'2026-01-01T00:00:00Z'}})).body;assert.ok(recurring.slaDueAt);f.app.scheduler.tick(new Date('2027-01-01T00:00:00Z'));const updated=(await f.request(`/api/v1/issues/${recurring.id}`)).body;assert.ok(updated.slaBreachedAt);const generated=(await f.request('/api/v1/issues?filter='+encodeURIComponent(JSON.stringify({recurrenceSourceId:recurring.id})))).body;assert.equal(generated.totalCount,1);
    const form=(await f.request('/api/v1/asksForms','POST',{name:'Team requests',teamId:issue.teamId,enabled:true,fields:[{id:'context',label:'Context',required:true}]})).body;const denied=await f.request(`/public/asks/${form.id}`,'POST',{title:'Customer request'},{cookie:''});assert.equal(denied.status,401);const submitted=await f.request(`/public/asks/${form.id}`,'POST',{title:'Customer request',email:'requester@example.com',body:'Please help',answers:{context:'Account settings'}});assert.equal(submitted.status,201,JSON.stringify(submitted.body));assert.equal(submitted.body.status,'received');const intake=(await f.request('/api/v1/requests')).body;assert.equal(intake.nodes[0].title,'Customer request');
  }finally{await f.close();}
});

test('multipart attachment bytes survive uploads and draft attachments bind to their saved parent',async()=>{
  const f=await fixture();try{
    const invitation=(await f.request('/api/v1/invitations','POST',{email:'files-member@example.com'})).body;const joined=await f.request('/auth/join','POST',{token:invitation.token,password:'files-member-password',name:'Files member'});const memberCookie=joined.response.headers.get('set-cookie')!.split(';')[0];
    const upload=async(name:string,content:string)=>{const form=new FormData();form.append('file',new File([content],name,{type:'text/plain'}));const response=await fetch(f.url+'/api/v1/attachments',{method:'POST',headers:{cookie:f.cookie},body:form});assert.equal(response.status,201);return response.json();};
    const file=await upload('notes.txt','Exact multipart bytes\nSecond line');assert.equal(file.filename,'notes.txt');assert.equal(file.mimeType,'text/plain');assert.equal(file.size,33);assert.equal((await f.request(file.url)).body,'Exact multipart bytes\nSecond line');assert.equal((await f.request(file.url,'GET',undefined,{cookie:memberCookie})).status,404);
    await f.request('/api/v1/issues','POST',{title:'Published attachment',teamId:f.state.teams[0].id,description:`<p><a href="${file.url}">Notes</a></p>`});assert.equal((await f.request(file.url,'GET',undefined,{cookie:memberCookie})).body,'Exact multipart bytes\nSecond line');
    const privateFile=await upload('private.txt','Unshared bytes');await f.request('/api/v1/issues','POST',{title:'Cannot claim another uploader file',teamId:f.state.teams[0].id,description:`<a href="${privateFile.url}">Attempt</a>`},{cookie:memberCookie});assert.equal((await f.request(privateFile.url,'GET',undefined,{cookie:memberCookie})).status,404);
  }finally{await f.close();}
});
