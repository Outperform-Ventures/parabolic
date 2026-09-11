import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../src/server/app.ts';
import {ParabolicClient,ApiError} from '../../packages/sdk/src/client.ts';
import {hashToken} from '../../src/server/auth.ts';
import {createPkcePair} from '../../packages/sdk/src/oauth.ts';

async function fixture(){
  const service=createApp({databasePath:':memory:',port:0}),{url}=await service.start();
  const response=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Owner',email:'apps@example.test',password:'Application-test-password',workspaceName:'Apps test'})});assert.equal(response.status,201);
  const owner=new ParabolicClient({baseUrl:url,headers:{Cookie:response.headers.get('set-cookie')!.split(';')[0]},maxRetries:0}),client=new ParabolicClient({baseUrl:url,maxRetries:0}),state=await owner.state();
  const app=await owner.apps.create({name:'Build service',clientCredentialsEnabled:true,scopes:['read','write']});
  const credentials={clientId:app.id,clientSecret:app.clientSecret!,scopes:['read','write']};
  const use=(token:string)=>new ParabolicClient({baseUrl:url,token,maxRetries:0});
  return {service,url,owner,client,state,app,credentials,use};
}
const invalid=(code:string)=>(error:unknown)=>error instanceof ApiError&&error.code?.toLowerCase()===code;

test('client credentials create a non-login app identity with scoped public-team access and attribution',async()=>{
 const f=await fixture();try{
  const privateTeam=await f.owner.teams.create({name:'Private security',key:'SEC',private:true,memberIds:[f.state.user!.id]});
  const hidden=await f.owner.issues.create({title:'Confidential finding',teamId:privateTeam.id});
  const first=await f.client.oauth.clientCredentials(f.credentials);assert.equal(first.expires_in,2592000);assert.equal('refresh_token'in first,false);
  const appClient=f.use(first.access_token),identity=(await appClient.authStatus()).user!;
  assert.equal(identity.isApp,true);assert.equal(identity.appId,f.app.id);assert.equal(identity.name,'Build service');assert.notEqual(identity.id,f.state.user!.id);
  assert.equal(f.service.db.prepare('SELECT id FROM accounts WHERE id=?').get(identity.id),undefined);
  await assert.rejects(appClient.login(identity.email,'Application-test-password'),invalid('invalid_credentials'));
  const created=await appClient.issues.create({title:'Created by service',teamId:f.state.teams[0].id});assert.equal(created.creatorId,identity.id);
  assert.equal((await appClient.issues.list()).nodes.some(issue=>issue.id===hidden.id),false);
  await assert.rejects(appClient.issues.get(hidden.id));await assert.rejects(appClient.issues.create({title:'Attempted private write',teamId:privateTeam.id}));
  await assert.rejects(appClient.apps.list(),invalid('forbidden'));await assert.rejects(appClient.apiKeys.create({name:'escape',scopes:['read']}),invalid('forbidden'));
  await f.owner.apps.update(f.app.id,{allPublicTeams:false,teamIds:[privateTeam.id]});assert.equal((await appClient.authStatus()).user,null);
  const narrowed=f.use((await f.client.oauth.clientCredentials(f.credentials)).access_token);assert.equal((await narrowed.issues.get(hidden.id)).id,hidden.id);await assert.rejects(narrowed.issues.get(created.id));assert.deepEqual((await narrowed.issues.list()).nodes.map(issue=>issue.id),[hidden.id]);assert.equal((await narrowed.issues.list()).totalCount,1);assert.equal((await narrowed.search('Created by service',{kinds:['issues']})).totalCount,0);const gql=await narrowed.graphql<{issues:{nodes:{id:string}[];totalCount:number}}>('{issues{nodes{id} totalCount}}');assert.deepEqual(gql.issues.nodes.map(issue=>issue.id),[hidden.id]);assert.equal(gql.issues.totalCount,1);
  assert.equal((await f.owner.apps.list()).nodes[0].appUserId,identity.id);
 }finally{await f.service.close();}
});

test('client credential enablement, scope changes and secret rotation revoke the appropriate grants',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.client.oauth.clientCredentials({...f.credentials,clientSecret:'wrong'}),invalid('invalid_client'));
  await assert.rejects(f.client.oauth.clientCredentials({...f.credentials,scopes:['admin']}),invalid('invalid_scope'));
  const first=await f.client.oauth.clientCredentials(f.credentials),second=await f.client.oauth.clientCredentials(f.credentials);assert.ok((await f.use(first.access_token).authStatus()).user);assert.ok((await f.use(second.access_token).authStatus()).user);
  const read=await f.client.oauth.clientCredentials({...f.credentials,scopes:['read']});assert.equal((await f.use(first.access_token).authStatus()).user,null);assert.equal((await f.use(second.access_token).authStatus()).user,null);
  await assert.rejects(f.use(read.access_token).issues.create({title:'Forbidden write',teamId:f.state.teams[0].id}),invalid('forbidden'));
  await f.owner.apps.update(f.app.id,{clientCredentialsEnabled:false,redirectUris:['https://example.test/callback']});assert.equal((await f.use(read.access_token).authStatus()).user,null);await assert.rejects(f.client.oauth.clientCredentials(f.credentials),invalid('unauthorized_client'));
  await f.owner.apps.update(f.app.id,{clientCredentialsEnabled:true});const last=await f.client.oauth.clientCredentials(f.credentials),rotated=await f.owner.apps.rotateSecret(f.app.id);assert.equal(rotated.credentialsRevoked,true);assert.notEqual(rotated.clientSecret,f.app.clientSecret);assert.equal((await f.use(last.access_token).authStatus()).user,null);await assert.rejects(f.client.oauth.clientCredentials(f.credentials),invalid('invalid_client'));
  const renewed=await f.client.oauth.clientCredentials({...f.credentials,clientSecret:rotated.clientSecret});assert.ok((await f.use(renewed.access_token).authStatus()).user);
  await f.owner.apps.remove(f.app.id);assert.equal((await f.use(renewed.access_token).authStatus()).user,null);
 }finally{await f.service.close();}
});

test('app-actor consent requires an administrator and refresh retains application attribution',async()=>{
 const f=await fixture();try{
  const redirectUri='https://example.test/callback';await f.owner.apps.update(f.app.id,{redirectUris:[redirectUri]});
  const authUrl=new URL(f.client.oauth.authorizationUrl({clientId:f.app.id,redirectUri,state:'app-mode',actor:'app',scopes:['read','write']}));assert.equal(authUrl.searchParams.get('actor'),'app');
  const consent=await f.owner.request<{actor:string;allPublicTeams:boolean}>(authUrl.pathname+authUrl.search);assert.equal(consent.actor,'app');assert.equal(consent.allPublicTeams,true);
  const grant=await f.owner.request<{code:string}>('/oauth/authorize','POST',{...Object.fromEntries(authUrl.searchParams),approve:true});
  const first=await f.client.oauth.exchangeCode({clientId:f.app.id,clientSecret:f.app.clientSecret!,code:grant.code,redirectUri}),identity=(await f.use(first.access_token).authStatus()).user!;assert.equal(identity.isApp,true);
  const second=await f.client.oauth.refresh({clientId:f.app.id,clientSecret:f.app.clientSecret!,refreshToken:first.refresh_token});assert.equal((await f.use(second.access_token).authStatus()).user!.id,identity.id);
  const issue=await f.use(second.access_token).issues.create({title:'Refreshed app grant',teamId:f.state.teams[0].id});assert.equal(issue.creatorId,identity.id);
  const invitation=await f.owner.invitations.create({email:'member@example.test',role:'member'}),joined=await fetch(`${f.url}/auth/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:invitation.token,name:'Member',password:'Member-test-password'})});assert.equal(joined.status,201);
  const member=new ParabolicClient({baseUrl:f.url,headers:{Cookie:joined.headers.get('set-cookie')!.split(';')[0]}});await assert.rejects(member.request(authUrl.pathname+authUrl.search),invalid('forbidden'));
  // A removed installer cannot exchange an outstanding application installation.
  const outstanding=await f.owner.request<{code:string}>('/oauth/authorize','POST',{...Object.fromEntries(authUrl.searchParams),approve:true});
  const membership=f.state.memberships.find(item=>item.userId===f.state.user!.id&&!item.teamId)!;const row=JSON.parse(String((f.service.db.prepare("SELECT data FROM entities WHERE kind='memberships' AND id=?").get(membership.id) as {data:string}).data));row.role='member';f.service.db.prepare("UPDATE entities SET data=? WHERE kind='memberships' AND id=?").run(JSON.stringify(row),membership.id);
  await assert.rejects(f.client.oauth.exchangeCode({clientId:f.app.id,clientSecret:f.app.clientSecret!,code:outstanding.code,redirectUri}),invalid('forbidden'));
 }finally{await f.service.close();}
});

test('client credentials cap active tokens and discard expired credentials before counting',async()=>{
 const f=await fixture();try{
  const first=await f.client.oauth.clientCredentials(f.credentials),row=f.service.db.prepare('SELECT * FROM api_tokens WHERE hash=?').get(hashToken(first.access_token))!;
  const insert=f.service.db.prepare('INSERT INTO api_tokens(id,hash,user_id,workspace_id,name,scopes,created_at,expires_at,app_id) VALUES(?,?,?,?,?,?,?,?,?)'),grant=f.service.db.prepare('INSERT INTO oauth_app_token_grants VALUES(?,?)');f.service.db.exec('BEGIN');for(let i=1;i<1000;i++){const id=randomUUID();insert.run(id,hashToken(id),row.user_id,row.workspace_id,row.name,row.scopes,row.created_at,row.expires_at,row.app_id);grant.run(id,'client_credentials');}f.service.db.exec('COMMIT');
  await assert.rejects(f.client.oauth.clientCredentials(f.credentials),invalid('token_limit'));
  f.service.db.prepare('UPDATE api_tokens SET expires_at=? WHERE hash=?').run('2000-01-01T00:00:00.000Z',hashToken(first.access_token));const next=await f.client.oauth.clientCredentials(f.credentials);assert.ok(next.access_token);assert.equal((f.service.db.prepare('SELECT COUNT(*) n FROM api_tokens WHERE app_id=?').get(f.app.id) as {n:number}).n,1000);
 }finally{await f.service.close();}
});

test('service grants cannot impersonate public MCP clients or revoke an individual user grant',async()=>{
 const f=await fixture();try{
  const redirectUri='https://example.test/callback';await f.owner.apps.update(f.app.id,{redirectUris:[redirectUri]});
  const fields={client_id:f.app.id,redirect_uri:redirectUri,scope:'read',response_type:'code',approve:true};
  const userGrant=await f.owner.request<{code:string}>('/oauth/authorize','POST',fields),userToken=await f.client.oauth.exchangeCode({clientId:f.app.id,clientSecret:f.app.clientSecret!,code:userGrant.code,redirectUri});
  await f.client.oauth.clientCredentials(f.credentials);await f.client.oauth.clientCredentials({...f.credentials,scopes:['read']});assert.equal((await f.use(userToken.access_token).authStatus()).user!.id,f.state.user!.id);
  const pair=await createPkcePair(),appGrant=await f.owner.request<{code:string}>('/oauth/authorize','POST',{...fields,actor:'app',code_challenge:pair.challenge,code_challenge_method:'S256'});
  await assert.rejects(f.client.oauth.exchangeCode({clientId:f.app.id,code:appGrant.code,redirectUri,codeVerifier:pair.verifier}),invalid('invalid_client'));
  const installed=await f.client.oauth.exchangeCode({clientId:f.app.id,clientSecret:f.app.clientSecret!,code:appGrant.code,redirectUri,codeVerifier:pair.verifier});assert.equal((await f.use(installed.access_token).authStatus()).user!.isApp,true);
  const registered=await f.client.request<{client_id:string}>('/oauth/register','POST',{client_name:'External tool',redirect_uris:[redirectUri],scope:'read'});
  await assert.rejects(f.client.oauth.clientCredentials({clientId:registered.client_id,clientSecret:'',scopes:['read']}),invalid('invalid_client'));
  await assert.rejects(f.owner.request('/oauth/authorize','POST',{...fields,client_id:registered.client_id,resource:`${f.url}/mcp`,actor:'app',code_challenge:pair.challenge,code_challenge_method:'S256'}),invalid('invalid_request'));
 }finally{await f.service.close();}
});

test('SDK reverse connections and team-scoped webhooks use the specialized API contracts',async()=>{
 const f=await fixture();try{
  for(const title of ['A','B','C','D','E'])await f.owner.issues.create({title,teamId:f.state.teams[0].id});
  const final=await f.owner.issues.list({last:2,orderBy:'title:asc'});assert.deepEqual(final.nodes.map(x=>x.title),['D','E']);assert.deepEqual(final.edges.map(x=>x.node.id),final.nodes.map(x=>x.id));assert.equal(final.pageInfo.hasPreviousPage,true);assert.equal(final.pageInfo.hasNextPage,false);
  const previous=await f.owner.issues.list({last:2,before:final.pageInfo.startCursor!,orderBy:'title:asc'});assert.deepEqual(previous.nodes.map(x=>x.title),['B','C']);
  const backwards=[];for await(const issue of f.owner.issues.iterate({last:2,orderBy:'title:asc'}))backwards.push(issue.title);assert.deepEqual(backwards,['E','D','C','B','A']);
  await assert.rejects(f.owner.issues.list({first:2,last:2}),invalid('invalid_pagination'));
  const hook=await f.owner.webhooks.create({url:'https://example.test/events',events:['issues.create'],teamId:f.state.teams[0].id});assert.equal(hook.teamId,f.state.teams[0].id);assert.equal(hook.allPublicTeams,false);
  const updated=await f.owner.webhooks.update(hook.id,{teamId:null,allPublicTeams:true});assert.equal(updated.allPublicTeams,true);assert.equal(updated.teamId,null);
  await assert.rejects(f.owner.webhooks.update(hook.id,{teamId:f.state.teams[0].id,allPublicTeams:true}),invalid('invalid_webhook_scope'));
 }finally{await f.service.close();}
});
