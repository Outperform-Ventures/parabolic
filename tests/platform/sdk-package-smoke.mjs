import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { tsImport } from 'tsx/esm/api';

const artifact=resolve('release/parabolic-sdk-0.1.0.tgz'),directory=await mkdtemp(join(tmpdir(),'parabolic-sdk-package-'));
const {createApp}=await tsImport(resolve('src/server/app.ts'),import.meta.url);
const app=createApp({databasePath:':memory:',port:0});
try{
  await promisify(execFile)('tar',['-xzf',artifact,'-C',directory]);
  const {ParabolicClient,createPkcePair}=await import(pathToFileURL(join(directory,'package/dist/index.js')).href);
  const {verifyWebhook}=await import(pathToFileURL(join(directory,'package/dist/webhooks.js')).href);
  const canceled=new AbortController(),waiting=new ParabolicClient({baseUrl:'http://localhost',token:()=>new Promise(()=>{}),fetch:async()=>{throw Error('Canceled credentials must never open a request');}}).issues.list({}, {signal:canceled.signal});canceled.abort(new Error('Cancel pending credentials'));await assert.rejects(waiting,/Cancel pending credentials/);
  const {url}=await app.start(),setup=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Packaged SDK',email:'sdk-package@example.test',password:'Packaged-SDK-password',workspaceName:'Packaged SDK'})});assert.equal(setup.status,201);
  const client=new ParabolicClient({baseUrl:url,headers:{Cookie:setup.headers.get('set-cookie').split(';')[0]}});
  const key=await client.apiKeys.create({name:'Distribution smoke',scopes:['read','write']});
  const scoped=new ParabolicClient({baseUrl:url,token:key.token}),team=(await scoped.teams.list()).nodes[0];
  const issue=await scoped.issues.create({title:'Created by installed SDK artifact',teamId:team.id});
  assert.equal((await scoped.issues.get(issue.id)).title,issue.title);assert.equal((await scoped.issues.update(issue.id,{priority:1})).priority,1);
  const pair=await createPkcePair();assert.equal(pair.challenge.length,43);
  const resource=`${url}/mcp`;assert.equal(new URL(scoped.oauth.authorizationUrl({clientId:'example',redirectUri:'http://localhost/callback',state:'state',codeChallenge:pair.challenge,resource})).searchParams.get('resource'),resource);
  const body=JSON.stringify({webhookTimestamp:Date.now(),data:{id:issue.id}}),secret='distribution-test-secret',signature=createHmac('sha256',secret).update(body).digest('hex');assert.equal(verifyWebhook({body,signature,secret}).data.id,issue.id);
  await scoped.issues.remove(issue.id);assert.equal((await scoped.issues.restore(issue.id)).id,issue.id);
  const state=await scoped.state(),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  const avatar=await scoped.uploadAvatar(state.user.id,new Blob([png],{type:'image/png'}),'package-avatar.png');assert.ok(avatar.avatar);assert.equal((await scoped.removeAvatar(state.user.id)).avatar,null);
  const emoji=await scoped.customEmojis.upload('package_check',new Blob([png],{type:'image/png'}),'package-emoji.png');assert.equal((await scoped.customEmojis.list()).nodes[0].id,emoji.id);await scoped.customEmojis.remove(emoji.id);assert.equal((await scoped.customEmojis.list()).nodes.length,0);
  await scoped.teams.update(team.id,{triageEnabled:true});const triageStatus=(await scoped.statuses.list()).nodes.find(status=>status.teamId===team.id&&status.type==='triage'),candidate=await scoped.issues.create({teamId:team.id,statusId:triageStatus.id,title:'Packaged triage check'}),accepted=await scoped.triageIssue(candidate.id,{action:'accept',comment:'<p>Packaged SDK acceptance</p>',clientMutationId:'package-triage'});assert.ok(accepted.comment.id);assert.notEqual(accepted.issue.statusId,triageStatus.id);
  const next=(await scoped.cycles.list({filter:{teamId:{eq:team.id}},orderBy:'startDate:asc'})).nodes.find(cycle=>Date.parse(cycle.startDate)>Date.now()),started=await scoped.startCycleToday(next.id,{clientMutationId:'package-cycle-start'}),ended=await scoped.endCycleToday(next.id,{version:started.cycle.version});assert.equal(ended.cycle.id,next.id);assert.ok(Date.parse(ended.cycle.endDate)>Date.now());
  const application=await client.apps.create({name:'Packaged service',scopes:['read','write'],clientCredentialsEnabled:true,allPublicTeams:false,teamIds:[team.id]}),credentials=await scoped.oauth.clientCredentials({clientId:application.id,clientSecret:application.clientSecret,scopes:['read','write']}),serviceClient=new ParabolicClient({baseUrl:url,token:credentials.access_token});assert.equal(credentials.expires_in,2592000);assert.equal(credentials.refresh_token,undefined);const serviceIssue=await serviceClient.issues.create({title:'Packaged service identity',teamId:team.id});assert.equal(serviceIssue.creatorId,(await serviceClient.authStatus()).user.id);const rotation=await client.apps.rotateSecret(application.id);assert.notEqual(rotation.clientSecret,application.clientSecret);assert.equal((await serviceClient.authStatus()).user,null);
  const last=await scoped.issues.list({last:1,orderBy:'title:asc'});assert.equal(last.edges[0].node.id,last.nodes[0].id);assert.equal(last.pageInfo.hasPreviousPage,true);const previous=await scoped.issues.list({last:1,before:last.pageInfo.startCursor,orderBy:'title:asc'});assert.notEqual(previous.nodes[0].id,last.nodes[0].id);const webhook=await client.webhooks.create({url:'https://example.test/events',events:['issues.create'],teamId:team.id});assert.equal(webhook.teamId,team.id);await client.webhooks.remove(webhook.id);
  const report={result:'passed',artifact,checks:['Emitted ESM and webhook subpath load without runtime dependencies','Scoped packaged SDK CRUD and restore against SQLite','Packaged PKCE and resource authorization URL','Raw webhook HMAC verification','Packaged multipart avatar and custom emoji upload/removal','Packaged triage transaction and cycle start/end wrappers','Packaged app actor credentials, attribution and secret rotation','Packaged reverse connections and team-scoped webhooks']};
  await mkdir(resolve('artifacts/platform'),{recursive:true});await writeFile(resolve('artifacts/platform/sdk-package-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await app.close();await rm(directory,{recursive:true,force:true});}
