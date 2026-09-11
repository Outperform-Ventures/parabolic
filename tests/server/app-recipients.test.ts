import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app.ts';
import {ParabolicClient} from '../../packages/sdk/src/client.ts';
import {runReminders} from '../../src/server/reminders.ts';

test('trusted application recipients keep installation team bounds and cannot inherit a human or removed app role',async()=>{
  const service=createApp({databasePath:':memory:',port:0}),{url}=await service.start();try{
    const setup=await fetch(url+'/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Owner',email:'recipient@example.test',password:'app-recipient-password'})}),client=new ParabolicClient({baseUrl:url,headers:{cookie:setup.headers.get('set-cookie')!.split(';')[0]},maxRetries:0}),state=await client.state(),owner=service.repo.actorForUser(state.user!.id,state.workspaceId,['admin']);
    const application=await client.apps.create({name:'Recipient service',clientCredentialsEnabled:true,scopes:['read','write']}),issued=await client.oauth.clientCredentials({clientId:application.id,clientSecret:application.clientSecret!,scopes:['read','write']}),appClient=new ParabolicClient({baseUrl:url,token:issued.access_token,maxRetries:0}),identity=(await appClient.authStatus()).user!,repo=service.repo;
    const first=await appClient.issues.create({title:'Subscribed service issue',teamId:state.teams[0].id});repo.create(owner,'comments',{issueId:first.id,body:'Public comment'});assert.ok(repo.all('notifications',state.workspaceId).some(n=>n.userId===identity.id));
    const reminder=await appClient.notifications.create({type:'reminder',entityKind:'issues',entityId:first.id,remindAt:new Date(Date.now()+60000).toISOString()}),before=repo.all('notifications',state.workspaceId).filter(n=>n.userId===identity.id).length,other=repo.create(owner,'teams',{name:'Selected elsewhere',key:'ELSE'});
    await client.apps.update(application.id,{allPublicTeams:false,teamIds:[other.id]});const recipient=repo.actorForUser(identity.id,state.workspaceId);assert.equal(recipient.appId,application.id);assert.equal(repo.canRead(recipient,'issues',repo.raw('issues',first.id)!),false);repo.create(owner,'comments',{issueId:first.id,body:'No longer within app access'});assert.equal(repo.all('notifications',state.workspaceId).filter(n=>n.userId===identity.id).length,before);
    runReminders(repo,owner,new Date(Date.now()+120000));assert.ok(repo.raw('notifications',reminder.id,true)!.deletedAt,'revoked-scope reminder is not delivered');
    const membership=repo.all('memberships',state.workspaceId).find(m=>m.userId===identity.id&&!m.teamId)!;repo.update(owner,'memberships',membership.id,{role:'admin'});assert.equal(repo.actorForUser(identity.id,state.workspaceId).role,'member','trusted application role cannot be elevated by membership');assert.equal(repo.actorForUser(owner.userId,state.workspaceId).appId,undefined,'human identity never retains originating app');
    await client.apps.remove(application.id);const removed=repo.actorForUser(identity.id,state.workspaceId);assert.equal(removed.role,'none');assert.equal(repo.canRead(removed,'teams',other),false);assert.equal(repo.raw('users',identity.id)!.name,'Recipient service','historical attribution survives removal');
  }finally{await service.close();}
});
