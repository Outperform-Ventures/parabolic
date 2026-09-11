import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server/app.ts';
import { ParabolicClient, ApiError } from '../../packages/sdk/src/client.ts';
import { createPkcePair } from '../../packages/sdk/src/oauth.ts';
import { hashToken } from '../../src/server/auth.ts';

async function fixture() {
  const service=createApp({databasePath:':memory:',port:0});const {url}=await service.start();
  const response=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'OAuth test',email:'oauth@example.test',password:'OAuth-test-password',workspaceName:'OAuth test workspace'})});
  assert.equal(response.status,201);const cookie=response.headers.get('set-cookie')!.split(';')[0];
  const owner=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}}),client=new ParabolicClient({baseUrl:url});
  const application=await owner.apps.create({name:'Internal reporting',redirectUris:['https://example.test/callback'],scopes:['issues:read','issues:write']});
  const grant=async(challenge?:string)=>{
    const fields={client_id:application.id,redirect_uri:application.redirectUris[0],response_type:'code',state:'test-state',scope:'issues:read issues:write',...(challenge?{code_challenge:challenge,code_challenge_method:'S256'}:{})};
    return owner.request<{code:string;redirectUri:string}>('/oauth/authorize','POST',{...fields,approve:true});
  };
  return {service,url,owner,client,application,grant};
}
const invalid=(code:string)=>(error:unknown)=>error instanceof ApiError&&error.code?.toLowerCase()===code;

test('OAuth code exchange and rotating refresh preserve scopes and revoke a reused grant',async()=>{
  const f=await fixture();try{
    const grant=await f.grant();assert.equal(new URL(grant.redirectUri).searchParams.get('state'),'test-state');
    const fields={clientId:f.application.id,clientSecret:f.application.clientSecret!,code:grant.code,redirectUri:f.application.redirectUris[0]};
    await assert.rejects(f.client.oauth.exchangeCode({...fields,clientSecret:'incorrect'}),invalid('invalid_client'));
    const first=await f.client.oauth.exchangeCode(fields);assert.equal(first.expires_in,3600);assert.ok(first.refresh_token.startsWith('flwr_'));
    await assert.rejects(f.client.oauth.exchangeCode(fields),invalid('invalid_grant'));
    assert.ok((await new ParabolicClient({baseUrl:f.url,token:first.access_token}).authStatus()).user);
    await assert.rejects(f.client.oauth.refresh({clientId:fields.clientId,clientSecret:fields.clientSecret,refreshToken:first.refresh_token,scopes:['read']}),invalid('invalid_scope'));
    const second=await f.client.oauth.refresh({clientId:fields.clientId,clientSecret:fields.clientSecret,refreshToken:first.refresh_token,scopes:['issues:read']});assert.notEqual(second.refresh_token,first.refresh_token);assert.equal(second.scope,'issues:read');
    assert.equal((await new ParabolicClient({baseUrl:f.url,token:first.access_token}).authStatus()).user,null);
    assert.ok((await new ParabolicClient({baseUrl:f.url,token:second.access_token}).authStatus()).user);
    const stored=f.service.db.prepare('SELECT * FROM oauth_refresh_tokens').all();assert.equal(stored.length,2);assert.equal(JSON.stringify(stored).includes(first.refresh_token),false);assert.ok(stored.some(row=>row.hash===hashToken(second.refresh_token)));
    await assert.rejects(f.client.oauth.refresh({clientId:fields.clientId,clientSecret:fields.clientSecret,refreshToken:first.refresh_token}),invalid('invalid_grant'));
    assert.equal((await new ParabolicClient({baseUrl:f.url,token:second.access_token}).authStatus()).user,null);
    await assert.rejects(f.client.oauth.refresh({clientId:fields.clientId,clientSecret:fields.clientSecret,refreshToken:second.refresh_token}),invalid('invalid_grant'));
  }finally{await f.service.close();}
});

test('PKCE clients rotate without a stored client secret; wrong verifiers and app changes fail',async()=>{
  const f=await fixture();try{
    const pair=await createPkcePair();assert.match(pair.verifier,/^[\w-]{43}$/);assert.match(pair.challenge,/^[\w-]{43}$/);
    const authUrl=new URL(f.client.oauth.authorizationUrl({clientId:f.application.id,redirectUri:f.application.redirectUris[0],state:'csrf-test',codeChallenge:pair.challenge,scopes:['issues:read']}));assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');
    const grant=await f.grant(pair.challenge);const fields={clientId:f.application.id,code:grant.code,redirectUri:f.application.redirectUris[0]};
    await assert.rejects(f.client.oauth.exchangeCode({...fields,codeVerifier:'incorrect-verifier'}),invalid('invalid_grant'));
    const first=await f.client.oauth.exchangeCode({...fields,codeVerifier:pair.verifier});
    const second=await f.client.oauth.refresh({clientId:fields.clientId,refreshToken:first.refresh_token});
    assert.ok(second.access_token);
    await f.owner.apps.update(f.application.id,{scopes:['issues:read']});
    await assert.rejects(f.client.oauth.refresh({clientId:fields.clientId,refreshToken:second.refresh_token}),invalid('invalid_grant'));
  }finally{await f.service.close();}
});

test('OAuth revocation is idempotent and API-key revocation also prevents refresh',async()=>{
  const f=await fixture();try{
    const exchange=async()=>{const grant=await f.grant();return f.client.oauth.exchangeCode({clientId:f.application.id,clientSecret:f.application.clientSecret!,redirectUri:f.application.redirectUris[0],code:grant.code});};
    const first=await exchange();const credentials={clientId:f.application.id,clientSecret:f.application.clientSecret!};
    await assert.rejects(f.client.oauth.revoke({...credentials,clientSecret:'incorrect',token:first.refresh_token}),invalid('invalid_client'));
    await f.client.oauth.revoke({...credentials,token:first.access_token,tokenTypeHint:'access_token'});
    await f.client.oauth.revoke({...credentials,token:first.access_token});
    await f.client.oauth.revoke({...credentials,token:'unknown-token'});
    await assert.rejects(f.client.oauth.refresh({...credentials,refreshToken:first.refresh_token}),invalid('invalid_grant'));
    const second=await exchange();const stored=f.service.db.prepare('SELECT id FROM api_tokens WHERE hash=?').get(hashToken(second.access_token)) as {id:string};
    await f.owner.apiKeys.revoke(stored.id);
    await assert.rejects(f.client.oauth.refresh({...credentials,refreshToken:second.refresh_token}),invalid('invalid_grant'));
    const third=await exchange();f.service.db.prepare('UPDATE oauth_refresh_tokens SET expires_at=? WHERE hash=?').run('2000-01-01T00:00:00.000Z',hashToken(third.refresh_token));
    await assert.rejects(f.client.oauth.refresh({...credentials,refreshToken:third.refresh_token}),invalid('invalid_grant'));
  }finally{await f.service.close();}
});

test('OAuth consent denies safely and rejects unregistered redirects and non-code responses',async()=>{
  const f=await fixture();try{
    const fields={client_id:f.application.id,redirect_uri:f.application.redirectUris[0],scope:'issues:read',state:'unchanged-state',response_type:'code'};
    const consent=await f.owner.request<{name:string;consentRequired:boolean}>(`/oauth/authorize?${new URLSearchParams(fields)}`);assert.equal(consent.name,f.application.name);assert.equal(consent.consentRequired,true);
    const denied=await f.owner.request<{redirectUri:string}>('/oauth/authorize','POST',{...fields,approve:false});const callback=new URL(denied.redirectUri);assert.equal(callback.searchParams.get('error'),'access_denied');assert.equal(callback.searchParams.get('state'),fields.state);assert.equal(callback.searchParams.has('code'),false);
    assert.equal((f.service.db.prepare('SELECT COUNT(*) AS n FROM oauth_codes').get() as {n:number}).n,0);
    await assert.rejects(f.owner.request('/oauth/authorize','POST',{...fields,redirect_uri:'https://wrong.test/callback',approve:false}),invalid('invalid_redirect'));
    await assert.rejects(f.owner.request(`/oauth/authorize?${new URLSearchParams({...fields,response_type:'token'})}`),invalid('invalid_request'));
  }finally{await f.service.close();}
});
