import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server/app.ts';
import { ParabolicClient, ApiError } from '../../packages/sdk/src/client.ts';
import { createPkcePair } from '../../packages/sdk/src/oauth.ts';
import { hashToken } from '../../src/server/auth.ts';
import { createMcpHttpServer } from '../../src/mcp/server.ts';

const rpc=(method:string,params?:unknown)=>({jsonrpc:'2.0',id:1,method,params});
const headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'};
const invalid=(code:string)=>(error:unknown)=>error instanceof ApiError&&error.code?.toLowerCase()===code;
async function fixture(){
  const service=createApp({databasePath:':memory:',port:0});const {url}=await service.start(),resource=`${url}/mcp`;
  const setup=await fetch(`${url}/auth/setup`,{method:'POST',headers,body:JSON.stringify({name:'MCP owner',email:'mcp@example.test',password:'MCP-integration-password',workspaceName:'MCP workspace'})});assert.equal(setup.status,201);
  const cookie=setup.headers.get('set-cookie')!.split(';')[0],owner=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}}),client=new ParabolicClient({baseUrl:url,maxRetries:0});
  const call=(token:string|undefined,body:unknown=rpc('ping'),extra:Record<string,string>={})=>fetch(resource,{method:'POST',headers:{...headers,...(token?{Authorization:`Bearer ${token}`} :{}),...extra},body:JSON.stringify(body)});
  const register=async(fields:Record<string,unknown>={})=>{
    const response=await fetch(`${url}/oauth/register`,{method:'POST',headers,body:JSON.stringify({client_name:'External MCP client',redirect_uris:['http://127.0.0.1:56789/callback'],...fields})});return {response,data:await response.json() as any};
  };
  const grant=async(clientId:string,scopes=['issues:read'],changes:Record<string,unknown>={})=>{
    const pair=await createPkcePair(),fields={client_id:clientId,redirect_uri:'http://127.0.0.1:56789/callback',response_type:'code',state:'state-for-this-attempt',scope:scopes.join(' '),resource,code_challenge:pair.challenge,code_challenge_method:'S256',...changes};
    const result=await owner.request<{code:string;redirectUri:string}>('/oauth/authorize','POST',{...fields,approve:true});
    return {result,pair,fields};
  };
  return {service,url,resource,cookie,owner,client,call,register,grant};
}

test('MCP discovers, dynamically registers, consents with PKCE, enforces audience/scopes, rotates and revokes',async()=>{
  const f=await fixture();try{
    const unauthorized=await f.call(undefined);assert.equal(unauthorized.status,401);const challenge=unauthorized.headers.get('www-authenticate')!;
    const metadataUrl=challenge.match(/resource_metadata="([^"]+)"/)![1],metadata=await (await fetch(metadataUrl)).json() as any;
    assert.equal(metadata.resource,f.resource);assert.deepEqual(metadata.authorization_servers,[f.url]);assert.ok(metadata.scopes_supported.includes('issues:write'));
    assert.deepEqual(await (await fetch(`${f.url}/.well-known/oauth-protected-resource`)).json(),metadata);
    const authMetadata=await (await fetch(`${metadata.authorization_servers[0]}/.well-known/oauth-authorization-server`)).json() as any;
    assert.deepEqual(authMetadata.code_challenge_methods_supported,['S256']);assert.equal(authMetadata.registration_endpoint,`${f.url}/oauth/register`);
    const registered=await f.register();assert.equal(registered.response.status,201);assert.equal(registered.data.token_endpoint_auth_method,'none');assert.equal(registered.data.client_secret,undefined);
    const application=registered.data,granted=await f.grant(application.client_id);
    const consent=await f.owner.request<any>(`/oauth/authorize?${new URLSearchParams(granted.fields)}`);assert.equal(consent.resource,f.resource);assert.equal(consent.dynamicallyRegistered,true);assert.deepEqual(consent.scopes,['issues:read']);
    assert.equal(new URL(granted.result.redirectUri).searchParams.get('state'),granted.fields.state);
    const fields={clientId:application.client_id,redirectUri:granted.fields.redirect_uri,code:granted.result.code,codeVerifier:granted.pair.verifier,resource:f.resource};
    await assert.rejects(f.client.oauth.exchangeCode({...fields,resource:undefined}),invalid('invalid_target'));
    await assert.rejects(f.client.oauth.exchangeCode({...fields,resource:`${f.url}/api`}),invalid('invalid_target'));
    await assert.rejects(f.client.oauth.exchangeCode({...fields,codeVerifier:'wrong'}),invalid('invalid_grant'));
    const first=await f.client.oauth.exchangeCode(fields);assert.equal(first.scope,'issues:read');
    const init=await f.call(first.access_token,rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test-client',version:'1'}}));assert.equal(init.status,200);assert.equal((await init.json() as any).result.protocolVersion,'2025-11-25');
    const listed=await f.call(first.access_token,rpc('tools/call',{name:'list_entities',arguments:{kind:'issues'}}));assert.equal(listed.status,200);assert.deepEqual((await listed.json() as any).result.structuredContent.result.nodes,[]);
    const forbidden=await f.call(first.access_token,rpc('tools/call',{name:'create_entity',arguments:{kind:'issues',fields:{title:'Attempt without write'}}}));assert.equal(forbidden.status,403);assert.match(forbidden.headers.get('www-authenticate')!,/error="insufficient_scope"/);assert.match(forbidden.headers.get('www-authenticate')!,/issues:read issues:write/);
    // A credential intended for MCP cannot be repurposed to call the REST resource server.
    assert.equal((await fetch(`${f.url}/api/v1/issues`,{headers:{Authorization:`Bearer ${first.access_token}`}})).status,401);
    await assert.rejects(f.client.oauth.refresh({clientId:application.client_id,refreshToken:first.refresh_token,resource:`${f.url}/other`}),invalid('invalid_target'));
    const rotated=await f.client.oauth.refresh({clientId:application.client_id,refreshToken:first.refresh_token,resource:f.resource});assert.equal((await f.call(first.access_token)).status,401);assert.equal((await f.call(rotated.access_token)).status,200);
    await f.client.oauth.revoke({clientId:application.client_id,token:rotated.refresh_token});await f.client.oauth.revoke({clientId:application.client_id,token:'unknown-token'});assert.equal((await f.call(rotated.access_token)).status,401);
    const writable=await f.grant(application.client_id,['read','issues:write']);const writeToken=await f.client.oauth.exchangeCode({...fields,code:writable.result.code,codeVerifier:writable.pair.verifier});
    const team=(await f.owner.teams.list()).nodes[0];const created=await f.call(writeToken.access_token,rpc('tools/call',{name:'create_entity',arguments:{kind:'issues',fields:{title:'Created through OAuth MCP',teamId:team.id}}}));assert.equal(created.status,200);const issue=(await created.json() as any).result.structuredContent.result;assert.equal((await f.owner.issues.get(issue.id)).title,'Created through OAuth MCP');
    const deniedOrigin=await f.call(writeToken.access_token,rpc('ping'),{Origin:'https://untrusted.example'});assert.equal(deniedOrigin.status,403);
    assert.equal((await f.call(writeToken.access_token,[rpc('ping')])).status,400);
    const tokenRow=f.service.db.prepare('SELECT id FROM api_tokens WHERE hash=?').get(hashToken(writeToken.access_token)) as {id:string};f.service.db.prepare('UPDATE api_tokens SET expires_at=? WHERE id=?').run('2000-01-01',tokenRow.id);assert.equal((await f.call(writeToken.access_token)).status,401);
  }finally{await f.service.close();}
});

test('MCP rejects foreign OAuth audiences and unsafe registration; personal credentials remain usable',async()=>{
  const f=await fixture();try{
    for(const fields of [{redirect_uris:['https://example.test/callback#fragment']},{redirect_uris:['http://example.test/callback']},{redirect_uris:['javascript:alert(1)']},{scope:'admin'},{token_endpoint_auth_method:'client_secret_post'}])assert.equal((await f.register(fields)).response.status,400);
    const registered=await f.register({scope:'issues:read'});assert.equal(registered.response.status,201);
    await assert.rejects(f.grant(registered.data.client_id,['issues:read'],{resource:'https://different.example/mcp'}),invalid('invalid_target'));
    await assert.rejects(f.grant(registered.data.client_id,['issues:read'],{code_challenge:undefined}),invalid('invalid_request'));
    await assert.rejects(f.grant(registered.data.client_id,['issues:read'],{redirect_uri:'http://127.0.0.1:56789/other'}),invalid('invalid_redirect'));
    await assert.rejects(f.grant(registered.data.client_id,['write']),invalid('invalid_scope'));
    const application=await f.owner.apps.create({name:'Ordinary REST client',redirectUris:['https://example.test/callback'],scopes:['read']});
    const code=await f.owner.request<{code:string}>('/oauth/authorize','POST',{client_id:application.id,redirect_uri:application.redirectUris[0],scope:'read',approve:true});
    const apiToken=await f.client.oauth.exchangeCode({clientId:application.id,clientSecret:application.clientSecret!,redirectUri:application.redirectUris[0],code:code.code});assert.equal((await f.call(apiToken.access_token)).status,401);assert.equal((await fetch(`${f.url}/api/v1/issues`,{headers:{Authorization:`Bearer ${apiToken.access_token}`}})).status,200);
    const key=await f.owner.apiKeys.create({name:'Personal MCP',scopes:['issues:read']});assert.equal((await f.call(key.token)).status,200);
    const bridge=createMcpHttpServer({baseUrl:f.url,port:0});const {url}=await bridge.start();try{
      assert.equal((await fetch(url,{method:'POST',headers:{...headers,Authorization:`Bearer ${apiToken.access_token}`},body:JSON.stringify(rpc('ping'))})).status,401);
      assert.equal((await fetch(url,{method:'POST',headers:{...headers,Authorization:`Bearer ${key.token}`},body:JSON.stringify(rpc('ping'))})).status,200);
    }finally{await bridge.close();}
    // Cookies never authorize an MCP call, and query-string credentials are ignored.
    assert.equal((await f.call(undefined,rpc('ping'),{Cookie:f.cookie})).status,401);
    assert.equal((await fetch(`${f.resource}?access_token=${key.token}`,{method:'POST',headers,body:JSON.stringify(rpc('ping'))})).status,401);
  }finally{await f.service.close();}
});

test('MCP OAuth keeps mixed-team presentation and private-record permissions intact for ordinary members',async()=>{
  const f=await fixture();try{
    const state=await f.owner.state(),privateTeam=await f.owner.teams.create({name:'Private planning',key:'PVT',private:true,memberIds:[state.user!.id]});
    const project=await f.owner.projects.create({name:'Joint project',teamIds:[state.teams[0].id,privateTeam.id]});
    const privateIssue=await f.owner.issues.create({title:'Private planning details',teamId:privateTeam.id,projectId:project.id});
    const invitation=await f.owner.invitations.create({email:'ordinary-mcp@example.test',role:'member'});
    const joined=await fetch(`${f.url}/auth/join`,{method:'POST',headers,body:JSON.stringify({token:invitation.token,name:'Ordinary member',password:'Ordinary-MCP-password'})});assert.equal(joined.status,201);
    const user=await joined.json() as any,member=new ParabolicClient({baseUrl:f.url,headers:{Cookie:joined.headers.get('set-cookie')!.split(';')[0]}});
    const registered=await f.register(),pair=await createPkcePair(),fields={client_id:registered.data.client_id,redirect_uri:'http://127.0.0.1:56789/callback',response_type:'code',scope:'read projects:write',resource:f.resource,code_challenge:pair.challenge,code_challenge_method:'S256'};
    const code=await member.request<{code:string}>('/oauth/authorize','POST',{...fields,approve:true});const token=await f.client.oauth.exchangeCode({clientId:fields.client_id,redirectUri:fields.redirect_uri,code:code.code,codeVerifier:pair.verifier,resource:f.resource});
    for(const [name,args] of [['get_entity',{kind:'projects',id:project.id}],['list_entities',{kind:'projects'}],['search',{query:'Joint',kinds:['projects']}],['update_entity',{kind:'projects',id:project.id,fields:{summary:'Updated by ordinary member'}}]] as const){
      const response=await f.call(token.access_token,rpc('tools/call',{name,arguments:args}));assert.equal(response.status,200);const data=await response.json() as any;assert.equal(data.result.isError,undefined,JSON.stringify(data));assert.equal(JSON.stringify(data).includes(privateTeam.id),false,`${name} leaked the private team`);
    }
    const denied=await f.call(token.access_token,rpc('tools/call',{name:'get_entity',arguments:{kind:'issues',id:privateIssue.id}}));const error=await denied.json() as any;assert.equal(error.result.isError,true);assert.equal(JSON.stringify(error).includes(privateIssue.title),false);
    const membership=(await f.owner.memberships.list()).nodes.find(item=>item.userId===user.user.id&&!item.teamId)!;await f.owner.memberships.remove(membership.id);assert.equal((await f.call(token.access_token)).status,401);
  }finally{await f.service.close();}
});
