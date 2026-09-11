import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHmac} from 'node:crypto';
import {createApp} from '../../src/server/app.ts';
import type {Actor} from '../../src/server/repository.ts';

async function fixture(){
  const received:{payload:any;raw:string;signature:string}[]=[];
  const endpoint=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString();received.push({raw,payload:JSON.parse(raw),signature:String(req.headers['parabolic-signature'])});res.writeHead(204);res.end();});
  await new Promise<void>(resolve=>endpoint.listen(0,'127.0.0.1',resolve));
  const app=createApp({databasePath:':memory:',port:0,webhookAllowPrivateHosts:true}),{url}=await app.start();clearInterval(app.webhooks.timer);
  const setup=await fetch(url+'/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Owner',email:'hook@example.test',password:'webhook-password'})}),cookie=setup.headers.get('set-cookie')!.split(';')[0],account=await setup.json();
  const actor:Actor={userId:account.user.id,workspaceId:account.workspaceId,role:'owner',scopes:['admin']};
  const request=async(path:string,method='GET',data?:any)=>{const response=await fetch(url+path,{method,headers:{cookie,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,body:response.status===204?null:await response.json()};};
  return {app,actor,request,received,hookUrl:`http://127.0.0.1:${(endpoint.address() as any).port}/hook`,close:async()=>{await app.close();await new Promise<void>(resolve=>endpoint.close(()=>resolve()));}};
}

test('webhook team scopes inherit issue/project parents, preserve legacy workspace scope and redact public payloads',async()=>{
  const f=await fixture();try{const {repo,db}=f.app,actor=f.actor,team=repo.all('teams',actor.workspaceId)[0],privateTeam=repo.create(actor,'teams',{name:'Private',key:'PRIVATE',private:true}),childTeam=repo.create(actor,'teams',{name:'Restricted child',key:'CHILD',parentId:privateTeam.id,visibility:'restricted'}),mixed=repo.create(actor,'projects',{name:'Shared project',teamIds:[team.id,privateTeam.id]}),hiddenProject=repo.create(actor,'projects',{name:'Private project',teamIds:[privateTeam.id]});
    const hooks:any[]=[];for(const scope of [{teamId:team.id},{allPublicTeams:true},{}]){const result=await f.request('/api/v1/webhooks','POST',{url:f.hookUrl,events:['issues.create','comments.create','projects.update','activities.create','documents.create'],...scope});assert.equal(result.status,201,JSON.stringify(result.body));hooks.push(result.body);}
    assert.equal(hooks[0].teamId,team.id);assert.equal(hooks[1].allPublicTeams,true);assert.equal(hooks[2].teamId,null);assert.equal(hooks[2].allPublicTeams,false);
    for(const invalid of [{teamId:team.id,allPublicTeams:true},{allPublicTeams:'true'},{teamId:'missing'}])assert.ok((await f.request('/api/v1/webhooks','POST',{url:f.hookUrl,...invalid})).status>=400);
    const publicIssue=repo.create(actor,'issues',{title:'Public issue',teamId:team.id,projectId:mixed.id}),privateIssue=repo.create(actor,'issues',{title:'Private issue in mixed project',teamId:privateTeam.id,projectId:mixed.id}),childIssue=repo.create(actor,'issues',{title:'Private descendant',teamId:childTeam.id}),publicComment=repo.create(actor,'comments',{issueId:publicIssue.id,body:'Public thread'}),privateComment=repo.create(actor,'comments',{issueId:privateIssue.id,body:'Private thread'}),projectComment=repo.create(actor,'comments',{projectId:mixed.id,body:'Shared project thread'}),privateDocument=repo.create(actor,'documents',{title:'Personal document',projectId:mixed.id,visibility:'private',content:'Private'});
    repo.update(actor,'projects',mixed.id,{description:'Shared project update'});repo.update(actor,'projects',hiddenProject.id,{description:'Private project update'});
    const events=(hook:any)=>(db.prepare('SELECT payload FROM webhook_deliveries WHERE webhook_id=?').all(hook.id) as {payload:string}[]).map(row=>JSON.parse(row.payload));
    for(const hook of hooks.slice(0,2)){const queued=events(hook),ids=queued.map(event=>event.data.id);for(const id of [publicIssue.id,publicComment.id,projectComment.id,mixed.id])assert.ok(ids.includes(id),id+' expected');for(const id of [privateIssue.id,childIssue.id,privateComment.id,hiddenProject.id])assert.ok(!ids.includes(id),id+' excluded');assert.ok(!queued.some(event=>event.type==='activities'&&[privateIssue.id,privateComment.id,hiddenProject.id,childIssue.id].includes(event.data.entityId)));}
    assert.ok(events(hooks[0]).some(event=>event.data.id===privateDocument.id),'explicit team scope respects creator access to its private document');assert.ok(!events(hooks[1]).some(event=>event.data.id===privateDocument.id),'allPublic excludes private document content');assert.ok(events(hooks[2]).some(event=>event.data.id===privateIssue.id),'omitted scope preserves workspace-authorized events');
    const publicPayload=events(hooks[1]).find(event=>event.type==='projects'&&event.data.id===mixed.id);assert.deepEqual(publicPayload.data.teamIds,[team.id]);
    const listing=await f.request('/api/v1/webhooks');assert.equal(listing.status,200);assert.equal(listing.body.nodes.find((hook:any)=>hook.id===hooks[1].id).allPublicTeams,true);assert.ok(listing.body.nodes.every((hook:any)=>!hook.secret));
    const updated=await f.request('/api/v1/webhooks/'+hooks[0].id,'PATCH',{teamId:null,allPublicTeams:true});assert.equal(updated.status,200);assert.equal(updated.body.teamId,null);assert.equal(updated.body.allPublicTeams,true);
  }finally{await f.close();}
});

test('queued webhook delivery rechecks team visibility and changed scope before sending signed bytes',async()=>{
  const f=await fixture();try{const {repo,db}=f.app,actor=f.actor,team=repo.all('teams',actor.workspaceId)[0],other=repo.create(actor,'teams',{name:'Other',key:'OTHER'}),hook=(await f.request('/api/v1/webhooks','POST',{url:f.hookUrl,events:['issues.create'],allPublicTeams:true})).body;
    const issue=repo.create(actor,'issues',{title:'Queued while public',teamId:team.id});repo.update(actor,'teams',team.id,{visibility:'private'});await f.app.webhooks.tick();assert.equal(f.received.length,0);let row=db.prepare('SELECT * FROM webhook_deliveries WHERE webhook_id=?').get(hook.id) as any;assert.equal(row.status,'canceled');assert.match(row.last_error,/scope/);
    await f.request('/api/v1/webhooks/'+hook.id,'PATCH',{allPublicTeams:false,teamId:team.id});await f.request('/api/v1/webhook-deliveries/'+row.id+'/retry','POST');await f.app.webhooks.tick();assert.equal(f.received.length,1);assert.equal(f.received[0].payload.data.id,issue.id);assert.equal(f.received[0].signature,createHmac('sha256',hook.secret).update(f.received[0].raw).digest('hex'));
    const pending=repo.create(actor,'issues',{title:'Changed scope before dispatch',teamId:team.id});await f.request('/api/v1/webhooks/'+hook.id,'PATCH',{teamId:other.id});await f.app.webhooks.tick();assert.equal(f.received.length,1);row=(db.prepare('SELECT * FROM webhook_deliveries WHERE webhook_id=?').all(hook.id) as any[]).find(row=>JSON.parse(row.payload).data.id===pending.id);assert.equal(row.status,'canceled');
  }finally{await f.close();}
});

test('webhook dispatch rechecks scope and enablement after asynchronous destination resolution',async()=>{
  const f=await fixture();try{
    const {repo,db,webhooks}=f.app,actor=f.actor,team=repo.all('teams',actor.workspaceId)[0],hook=(await f.request('/api/v1/webhooks','POST',{url:f.hookUrl,events:['issues.create'],allPublicTeams:true})).body;
    repo.create(actor,'issues',{title:'Becomes private during DNS resolution',teamId:team.id});
    // tick reaches its DNS await before returning; a concurrent request can now revoke the scope.
    const pending=webhooks.tick();repo.update(actor,'teams',team.id,{visibility:'private'});await pending;
    assert.equal(f.received.length,0,'No private payload may leave after the team leaves the public scope');let delivery=db.prepare('SELECT * FROM webhook_deliveries WHERE webhook_id=?').get(hook.id) as any;assert.equal(delivery.status,'canceled');
    await f.request('/api/v1/webhooks/'+hook.id,'PATCH',{allPublicTeams:false});repo.create(actor,'issues',{title:'Disabled before dispatch',teamId:team.id});const disabled=webhooks.tick();db.prepare('UPDATE webhooks SET enabled=0 WHERE id=?').run(hook.id);await disabled;assert.equal(f.received.length,0);delivery=(db.prepare('SELECT * FROM webhook_deliveries WHERE webhook_id=?').all(hook.id) as any[]).find(row=>JSON.parse(row.payload).data.title==='Disabled before dispatch');assert.equal(delivery.status,'pending');assert.equal(delivery.attempts,0);
    db.prepare('UPDATE webhooks SET enabled=1 WHERE id=?').run(hook.id);await webhooks.tick();assert.equal(f.received.length,1);assert.equal(f.received[0].payload.data.title,'Disabled before dispatch');assert.equal(f.received[0].signature,createHmac('sha256',hook.secret).update(f.received[0].raw).digest('hex'));
  }finally{await f.close();}
});
