import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server/app.ts';
import { advanceOccurrence } from '../../src/server/calendar.ts';

async function fixture(){const app=createApp({seedDemo:true,databasePath:':memory:',port:0});const {url}=await app.start();let cookie='';const request=async(path:string,method='GET',data?:any,extra:any={})=>{const r=await fetch(url+path,{method,headers:{cookie,'content-type':'application/json',...extra},...(data?{body:JSON.stringify(data)}:{})});const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null,response:r};};const setup=await request('/auth/setup','POST',{name:'Owner',email:'owner@example.com',password:'owner-test-password'});cookie=setup.response.headers.get('set-cookie')!.split(';')[0];const state=(await request('/api/v1/state')).body;return {app,request,state,cookie,setCookie:(value:string)=>{cookie=value;}};}

test('rich text retains editor structure while removing stored script and URL attacks',async()=>{const f=await fixture();try{
  const response=await f.request('/api/v1/documents','POST',{title:'Document',content:'<h2>Heading</h2><script>alert(1)</script><p onclick="alert(2)">Text <strong>bold</strong><a href="javascript:alert(3)">link</a></p><table><tbody><tr><td colspan="2">Cell</td></tr></tbody></table><img src="x" onerror="alert(4)"><input type="checkbox" checked>'});assert.equal(response.status,201);const html=response.body.content;assert.ok(html.includes('<h2>Heading</h2>'));assert.ok(html.includes('<strong>bold</strong>'));assert.ok(html.includes('<table>'));assert.ok(!/script|onclick|onerror|javascript:/i.test(html));assert.match(html,/type="checkbox"/);assert.match(html,/checked="checked"/);
  const edited=await f.request(`/api/v1/documents/${response.body.id}`,'PATCH',{title:'Changed',content:'<p>Updated</p>'});assert.equal(edited.body.history.length,1);assert.equal(edited.body.history[0].title,'Document');
  const dimensions=await f.request(`/api/v1/documents/${response.body.id}`,'PATCH',{content:'<pre><code class="language-typescript">const size = 640;</code></pre><img src="/image.png" width="640" height="480"><img src="/other.png" width="999999999" height="bad">'});assert.match(dimensions.body.content,/class="language-typescript"/);assert.match(dimensions.body.content,/width="640" height="480"/);assert.ok(!dimensions.body.content.includes('999999999'));assert.ok(!dimensions.body.content.includes('height="bad"'));
}finally{await f.app.close();}});

test('routing, template defaults, Inbox delivery and parent completion share persistence',async()=>{const f=await fixture();try{
  const invitation=(await f.request('/api/v1/invitations','POST',{email:'member@example.com'})).body;const joined=await f.request('/auth/join','POST',{token:invitation.token,name:'Member',password:'member-test-password'});const memberId=joined.body.user.id,memberCookie=joined.response.headers.get('set-cookie')!.split(';')[0],teamId=f.state.teams[0].id;
  await f.request(`/api/v1/users/${memberId}`,'PATCH',{preferences:{notifications:{assigned:false,comments:true}}},{cookie:memberCookie});
  const policy=(await f.request('/api/v1/slaPolicies','POST',{name:'Fast',durationMinutes:60})).body;
  await f.request('/api/v1/automations','POST',{name:'Payments',type:'routing',teamId,matchText:'payment',assigneeId:memberId,slaPolicyId:policy.id,enabled:true});
  const issue=(await f.request('/api/v1/issues','POST',{teamId,title:'Payment retry bug',statusId:f.state.statuses.find((s:any)=>s.type==='triage').id})).body;assert.equal(issue.assigneeId,memberId);assert.equal(issue.slaPolicyId,policy.id);assert.ok(issue.slaDueAt);
  const notifications=(await f.request('/api/v1/notifications','GET',undefined,{cookie:memberCookie})).body;assert.equal(notifications.totalCount,1);
  await f.request('/api/v1/comments','POST',{entityType:'issue',entityId:issue.id,body:'A comment'});assert.equal((await f.request('/api/v1/notifications','GET',undefined,{cookie:memberCookie})).body.totalCount,2);
  const template=(await f.request('/api/v1/templates','POST',{name:'Bug template',type:'issue',properties:{priority:2,description:'<p>Steps to reproduce</p>'}})).body;const templated=(await f.request('/api/v1/issues','POST',{teamId,title:'Bug report',templateId:template.id})).body;assert.equal(templated.priority,2);assert.equal(templated.description,'<p>Steps to reproduce</p>');
  await f.request(`/api/v1/teams/${teamId}`,'PATCH',{autoCloseParentIssues:true});const child=(await f.request('/api/v1/issues','POST',{teamId,title:'Finish child',parentId:templated.id})).body;const done=f.state.statuses.find((s:any)=>s.type==='completed');await f.request(`/api/v1/issues/${child.id}`,'PATCH',{statusId:done.id});assert.equal((await f.request(`/api/v1/issues/${templated.id}`)).body.statusId,done.id);
}finally{await f.app.close();}});

test('workspace switching isolates entities and preserves global account identity',async()=>{const f=await fixture();try{
  const original=f.state.workspaceId;const created=await f.request('/auth/workspaces','POST',{name:'Second workspace'});assert.equal(created.status,201);const state=(await f.request('/api/v1/state')).body;assert.equal(state.workspaceId,created.body.workspaceId);assert.equal(state.user.id,f.state.user.id);assert.equal(state.users[0].id,f.state.user.id);assert.equal(state.workspaces.length,2);assert.equal(state.issues.length,0);assert.equal((await f.request(`/api/v1/issues/${f.state.issues[0].id}`)).status,404);
  const issue=await f.request('/api/v1/issues','POST',{title:'Second workspace task',teamId:state.teams[0].id,assigneeId:f.state.user.id});assert.equal(issue.status,201);assert.equal((await f.request('/api/v1/users')).body.nodes[0].id,f.state.user.id);
  await f.request('/auth/workspace','POST',{workspaceId:original});assert.equal((await f.request(`/api/v1/issues/${issue.body.id}`)).status,404);assert.equal((await f.request(`/api/v1/issues/${f.state.issues[0].id}`)).status,200);
}finally{await f.app.close();}});

test('malformed filters and GraphQL cost are rejected without internal server errors',async()=>{const f=await fixture();try{
  assert.equal((await f.request('/graphql','POST',{query:'query {'})).status,400);
  const query='{ issues(first:500) { nodes { children(first:500) { nodes { id title } } } } }';assert.equal((await f.request('/graphql','POST',{query})).status,400);
  assert.equal((await f.request('/api/v1/issues?filter='+encodeURIComponent(JSON.stringify({title:{unsupported:'x'}})))).status,400);
  assert.equal((await f.request('/api/v1/issues','POST',{title:'Missing team'})).status,422);
  const deletion=await f.request(`/api/v1/issues/${f.state.issues[0].id}`,'DELETE');assert.equal(deletion.status,204);assert.ok((await f.request('/api/v1/state')).body.issues.find((i:any)=>i.id===f.state.issues[0].id).deletedAt);
}finally{await f.app.close();}});

test('recurrence calendar retains month end and wall-clock time through DST',()=>{
  const january=new Date('2026-01-31T09:00:00Z');const recurrence={frequency:'monthly',startDate:january.toISOString()};const february=advanceOccurrence(january,recurrence);assert.equal(february.toISOString(),'2026-02-28T09:00:00.000Z');assert.equal(advanceOccurrence(february,recurrence).toISOString(),'2026-03-31T09:00:00.000Z');
  const beforeSpring=new Date('2026-03-07T14:00:00Z');assert.equal(advanceOccurrence(beforeSpring,{frequency:'daily',timeZone:'America/New_York'}).toISOString(),'2026-03-08T13:00:00.000Z');
  const beforeAutumn=new Date('2026-10-31T13:00:00Z');assert.equal(advanceOccurrence(beforeAutumn,{frequency:'daily',timeZone:'America/New_York'}).toISOString(),'2026-11-01T14:00:00.000Z');
});

test('editor dates, mentions and referenced issues persist semantic relationships without leaking private issues',async()=>{const f=await fixture();try{
  const invitation=(await f.request('/api/v1/invitations','POST',{email:'mentioned@example.com'})).body;
  const member=(await f.request('/auth/join','POST',{token:invitation.token,name:'Mentioned',password:'mentioned-password'})).body.user;
  const teamId=f.state.teams[0].id;
  const related=(await f.request('/api/v1/issues','POST',{teamId,title:'Referenced issue'})).body;
  const mention=`<span data-mention-kind="user" data-mention-id="${member.id}" data-mention-label="Mentioned">@Mentioned</span>`;
  const reference=`<span data-mention-kind="issue" data-mention-id="${related.id}">${related.identifier}</span>`;
  const issue=(await f.request('/api/v1/issues','POST',{teamId,title:'Mentions',description:`<p>${mention} ${reference} <span data-date="2027-10-02" data-type="date">Oct 2, 2027</span></p>`})).body;
  assert.ok(issue.subscriberIds.includes(member.id));assert.ok(issue.relations.some((r:any)=>r.type==='related'&&r.issueId===related.id));assert.match(issue.description,/data-date="2027-10-02"/);
  await f.request(`/api/v1/issues/${issue.id}`,'PATCH',{subscriberIds:[],relations:[]});
  const edited=(await f.request(`/api/v1/issues/${issue.id}`,'PATCH',{priority:2})).body;
  assert.deepEqual(edited.subscriberIds,[]);assert.deepEqual(edited.relations,[],'Unrelated edits do not re-add manually removed mentions');
  await f.request('/api/v1/comments','POST',{entityType:'issue',entityId:issue.id,body:`<p>${mention} ${reference}</p>`});
  const commented=(await f.request(`/api/v1/issues/${issue.id}`)).body;
  assert.ok(commented.subscriberIds.includes(member.id));assert.ok(commented.relations.some((r:any)=>r.issueId===related.id));
  const plain=(await f.request('/api/v1/issues','POST',{teamId,title:'Identifier reference',description:`<p>See ${related.identifier} and UNKNOWN-99119</p>`})).body;
  assert.deepEqual(plain.relations,[{type:'related',issueId:related.id}]);
  const privateTeam=(await f.request('/api/v1/teams','POST',{name:'Private',key:'PVT',private:true,memberIds:[f.state.user.id]})).body;
  const privateIssue=(await f.request('/api/v1/issues','POST',{teamId:privateTeam.id,title:'Private mention',description:mention})).body;
  assert.ok(!privateIssue.subscriberIds?.includes(member.id),'Mentioning an excluded user cannot grant private issue access');
}finally{await f.app.close();}});
