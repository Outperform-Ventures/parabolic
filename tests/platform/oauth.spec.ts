import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app';
import { resolve } from 'node:path';
import { createPkcePair } from '../../packages/sdk/src/oauth';

test('OAuth consent preserves the request through login and only authorizes after approval',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    expect((await page.request.post(`${url}/auth/setup`,{data:{name:'Consent QA',email:'consent@example.test',password:'Consent-test-password',workspaceName:'Consent workspace'}})).ok()).toBeTruthy();
    const application=await(await page.request.post(`${url}/api/v1/apps`,{data:{name:'Reporting tools',redirectUris:[`${url}/callback`],scopes:['issues:read']}})).json();
    await page.request.post(`${url}/auth/logout`);
    const query=new URLSearchParams({client_id:application.id,redirect_uri:`${url}/callback`,scope:'issues:read',state:'preserved-state',response_type:'code'});
    await page.route(`${url}/callback?**`,route=>route.fulfill({contentType:'text/html',body:'<h1>Application callback</h1>'}));
    const html=await page.goto(`${url}/oauth/authorize?${query}`);expect(html?.headers()['content-type']).toContain('text/html');
    await expect(page.getByRole('heading',{name:'Log in to your workspace'})).toBeVisible();
    await page.getByLabel('Email',{exact:true}).fill('consent@example.test');await page.getByLabel('Password',{exact:true}).fill('Consent-test-password');await page.getByRole('button',{name:'Continue with email'}).click();
    await expect(page.getByRole('heading',{name:'Connect Reporting tools'})).toBeVisible();await expect(page.locator('.oauth-scopes')).toContainText('Read issues');await expect(page.locator('.oauth-account')).toContainText('consent@example.test');
    expect((app.db.prepare('SELECT COUNT(*) AS n FROM oauth_codes').get() as {n:number}).n).toBe(0);
    await page.getByRole('button',{name:'Deny',exact:true}).click();await expect(page).toHaveURL(/error=access_denied/);expect(new URL(page.url()).searchParams.get('state')).toBe('preserved-state');
    await page.goto(`${url}/oauth/authorize?${query}`);await expect(page.getByRole('heading',{name:'Connect Reporting tools'})).toBeVisible();
    await page.screenshot({path:'artifacts/platform/oauth-consent.png'});
    await page.getByRole('button',{name:'Authorize application',exact:true}).click();await expect(page).toHaveURL(/code=/);const callback=new URL(page.url());expect(callback.searchParams.get('state')).toBe('preserved-state');expect(callback.searchParams.get('code')).toBeTruthy();
    const exchanged=await page.request.post(`${url}/oauth/token`,{form:{grant_type:'authorization_code',client_id:application.id,client_secret:application.clientSecret,redirect_uri:`${url}/callback`,code:callback.searchParams.get('code')!}});expect(exchanged.ok()).toBeTruthy();expect((await exchanged.json()).refresh_token).toMatch(/^flwr_/);
    query.set('redirect_uri','https://unregistered.test/callback');await page.goto(`${url}/oauth/authorize?${query}`);await expect(page.getByRole('heading',{name:'Unable to connect application'})).toBeVisible();await expect(page.getByRole('button',{name:'Authorize application',exact:true})).toHaveCount(0);expect(errors).toEqual([]);
  }finally{await page.close();await app.close();}
});

test('MCP dynamic clients receive explicit browser consent for an audience-bound PKCE grant',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();
  try{
    await page.request.post(`${url}/auth/setup`,{data:{name:'MCP Consent QA',email:'mcp-consent@example.test',password:'MCP-consent-password',workspaceName:'MCP consent workspace'}});
    const metadata=await (await page.request.get(`${url}/.well-known/oauth-authorization-server`)).json();
    const registration=await page.request.post(metadata.registration_endpoint,{data:{client_name:'External MCP tools',redirect_uris:[`${url}/mcp-callback`],scope:'issues:read'}});expect(registration.status()).toBe(201);const client=await registration.json();
    const pair=await createPkcePair(),resource=`${url}/mcp`,query=new URLSearchParams({client_id:client.client_id,redirect_uri:`${url}/mcp-callback`,scope:'issues:read',state:'mcp-state',response_type:'code',resource,code_challenge:pair.challenge,code_challenge_method:'S256'});
    await page.route(`${url}/mcp-callback?**`,route=>route.fulfill({contentType:'text/html',body:'<h1>MCP client callback</h1>'}));
    await page.goto(`${metadata.authorization_endpoint}?${query}`);await expect(page.getByRole('heading',{name:'Connect External MCP tools'})).toBeVisible();await expect(page.getByText('This client registered itself.',{exact:false})).toBeVisible();await expect(page.getByText('MCP access to',{exact:false})).toContainText(new URL(resource).host);
    expect((app.db.prepare('SELECT COUNT(*) AS n FROM oauth_codes').get() as {n:number}).n).toBe(0);
    await page.getByRole('button',{name:'Deny',exact:true}).click();await expect(page).toHaveURL(/error=access_denied/);expect(new URL(page.url()).searchParams.get('state')).toBe('mcp-state');
    await page.goto(`${metadata.authorization_endpoint}?${query}`);await expect(page.getByRole('heading',{name:'Connect External MCP tools'})).toBeVisible();await page.screenshot({path:'artifacts/platform/mcp-oauth-consent.png'});
    await page.getByRole('button',{name:'Authorize application',exact:true}).click();await expect(page).toHaveURL(/code=/);
    const token=await page.request.post(metadata.token_endpoint,{form:{grant_type:'authorization_code',client_id:client.client_id,redirect_uri:`${url}/mcp-callback`,code:new URL(page.url()).searchParams.get('code')!,code_verifier:pair.verifier,resource}});expect(token.ok()).toBeTruthy();const credentials=await token.json();
    const result=await page.request.post(resource,{headers:{Authorization:`Bearer ${credentials.access_token}`,Accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_entities',arguments:{kind:'issues'}}}});expect(result.status()).toBe(200);expect((await result.json()).result.structuredContent.result.nodes).toEqual([]);
  }finally{await page.close();await app.close();}
});

test('application settings configure service identity, selected teams, consent and secret rotation',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.request.post(`${url}/auth/setup`,{data:{name:'App owner',email:'app-owner@example.test',password:'App-owner-password',workspaceName:'App workspace'}});
  const state=await(await page.request.get(`${url}/api/v1/state`)).json(),privateTeam=await(await page.request.post(`${url}/api/v1/teams`,{data:{name:'Private delivery',key:'PRV',private:true,memberIds:[state.user.id]}})).json();
  await page.goto(`${url}/settings/applications?manage=1`);await page.getByRole('button',{name:'New application',exact:true}).click();
  const form=page.getByRole('dialog',{name:'New application',exact:true});await form.getByLabel('Application name',{exact:true}).fill('Scheduled reporter');await form.getByLabel('Permissions',{exact:true}).fill('read,write');await form.getByLabel('Enable client credentials',{exact:true}).check();await form.getByLabel('Access all public teams',{exact:true}).uncheck();
  await form.getByRole('button',{name:'Additional teams',exact:true}).click();const picker=page.getByRole('dialog',{name:'Change Additional teams',exact:true});await picker.getByRole('combobox').fill('Private delivery');await picker.getByRole('option',{name:'Private delivery',exact:true}).click();await page.keyboard.press('Escape');await expect(form).toBeVisible();await form.getByRole('button',{name:'Create',exact:true}).click();
  const secretDialog=page.getByRole('dialog',{name:'Save your credential',exact:true});await expect(secretDialog).toBeVisible();const secret=await secretDialog.getByLabel('Credential',{exact:true}).inputValue(),application=(await(await page.request.get(`${url}/api/v1/apps`)).json()).nodes[0];expect(application.clientCredentialsEnabled).toBe(true);expect(application.allPublicTeams).toBe(false);expect(application.teamIds).toEqual([privateTeam.id]);expect(application.redirectUris).toEqual([]);await secretDialog.getByRole('button',{name:'Done',exact:true}).click();
  const token=await(await page.request.post(`${url}/oauth/token`,{form:{grant_type:'client_credentials',client_id:application.id,client_secret:secret,scope:'read write'}})).json();expect(token.access_token).toBeTruthy();expect(token.refresh_token).toBeUndefined();
  const identity=await(await page.request.get(`${url}/auth/status`,{headers:{Authorization:`Bearer ${token.access_token}`}})).json();expect(identity.user.isApp).toBe(true);
  await page.getByRole('button',{name:'Edit',exact:true}).click();const editing=page.getByRole('dialog',{name:'Edit application',exact:true});await editing.getByLabel('Redirect URLs (one per line)',{exact:true}).fill(`${url}/app-callback`);await editing.getByRole('button',{name:'Save changes',exact:true}).click();await expect(editing).toHaveCount(0);
  const query=new URLSearchParams({client_id:application.id,redirect_uri:`${url}/app-callback`,scope:'read write',state:'install-state',response_type:'code',actor:'app'});await page.route(`${url}/app-callback?**`,route=>route.fulfill({contentType:'text/html',body:'<h1>App callback</h1>'}));
  await page.goto(`${url}/oauth/authorize?${query}`);await expect(page.getByRole('heading',{name:'Install Scheduled reporter'})).toBeVisible();await expect(page.getByText('Actions will be attributed to',{exact:false})).toContainText('Private delivery');await page.getByRole('button',{name:'Install application',exact:true}).click();await expect(page).toHaveURL(/code=/);
  const exchanged=await page.request.post(`${url}/oauth/token`,{form:{grant_type:'authorization_code',client_id:application.id,client_secret:secret,redirect_uri:`${url}/app-callback`,code:new URL(page.url()).searchParams.get('code')!}});expect(exchanged.status()).toBe(200);const installed=await exchanged.json();
  await page.goto(`${url}/settings/applications?manage=1`);await page.getByRole('button',{name:'Rotate secret',exact:true}).click();const rotation=page.getByRole('dialog',{name:'Rotate application secret?',exact:true});await rotation.getByRole('button',{name:'Confirm',exact:true}).click();await expect(secretDialog).toBeVisible();expect(await secretDialog.getByLabel('Credential',{exact:true}).inputValue()).not.toBe(secret);
  const revoked=await(await page.request.get(`${url}/auth/status`,{headers:{Authorization:`Bearer ${installed.access_token}`}})).json();expect(revoked.user).toBeNull();expect(errors).toEqual([]);
 }finally{await page.close();await app.close();}
});

test('webhook settings persist one team or public teams as mutually exclusive scopes',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(`${url}/auth/setup`,{data:{name:'Webhook owner',email:'webhook-owner@example.test',password:'Webhook-owner-password'}});const state=await(await page.request.get(`${url}/api/v1/state`)).json();
  await page.goto(`${url}/settings/webhooks`);await page.getByRole('button',{name:'New webhook',exact:true}).click();const form=page.getByRole('dialog',{name:'New webhook',exact:true});await form.getByLabel('Endpoint URL',{exact:true}).fill('https://example.test/events');await form.getByLabel('Team scope',{exact:true}).selectOption(state.teams[0].id);await form.getByRole('button',{name:'Create',exact:true}).click();const secret=page.getByRole('dialog',{name:'Save your credential'});await expect(secret).toBeVisible();await secret.getByRole('button',{name:'Done',exact:true}).click();
  let hook=(await(await page.request.get(`${url}/api/v1/webhooks`)).json()).nodes[0];expect(hook.teamId).toBe(state.teams[0].id);expect(hook.allPublicTeams).toBe(false);
  await page.getByRole('button',{name:'Edit',exact:true}).click();const edit=page.getByRole('dialog',{name:'Edit webhook',exact:true});await edit.getByLabel('Team scope',{exact:true}).selectOption('public');await edit.getByRole('button',{name:'Save changes',exact:true}).click();await expect(edit).toHaveCount(0);hook=(await(await page.request.get(`${url}/api/v1/webhooks`)).json()).nodes[0];expect(hook.teamId).toBeNull();expect(hook.allPublicTeams).toBe(true);await expect(page.locator('.feature-settings-row')).toContainText('All public teams');
 }finally{await page.close();await app.close();}
});
