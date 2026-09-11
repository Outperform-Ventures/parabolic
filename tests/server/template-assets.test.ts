import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../src/server/app';
import type {Actor} from '../../src/server/repository';

async function fixture(){
 const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();
 const call=async(path:string,method='GET',body?:any,cookie='')=>{const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0]||'',body:r.status===204?null:await r.json()}};
 const owner=await call('/auth/setup','POST',{name:'Owner',email:'assets-owner@example.test',password:'assets-owner-password'}),actor:Actor={userId:owner.body.user.id,workspaceId:owner.body.workspaceId,role:'owner',scopes:['read','write','admin']};
 const invite=await call('/api/v1/invitations','POST',{email:'assets-member@example.test',role:'member'},owner.cookie),member=await call('/auth/join','POST',{token:invite.body.token,name:'Member',email:'assets-member@example.test',password:'assets-member-password'}),memberActor:Actor={userId:member.body.user.id,workspaceId:actor.workspaceId,role:'member',scopes:['read','write']};
 const upload=async(cookie=owner.cookie)=>{const r=await call('/api/v1/attachments','POST',{filename:'guide.txt',mimeType:'text/plain',content:Buffer.from('Template guide bytes').toString('base64')},cookie);assert.equal(r.status,201);return r.body};
 const files=()=>app.db.prepare('SELECT * FROM attachments ORDER BY id').all() as any[];
 return {app,repo:app.repo,url,call,owner,member,actor,memberActor,upload,files,team:app.repo.all('teams',actor.workspaceId)[0]};
}
const html=(id:string)=>`<p><a href="/api/v1/attachments/${id}">Guide</a></p>`;
const ids=(body:string)=>[...body.matchAll(/\/api\/v1\/attachments\/([A-Za-z0-9_-]+)/g)].map(m=>m[1]);

test('template embedded assets bind under writer permission and copy for each destination without rebinding sources',async()=>{
 const f=await fixture();try{
  const {repo,actor,team,upload,files,memberActor}=f,file=await upload(),template=repo.create(actor,'templates',{name:'Guide',title:'Task',description:html(file.id),formFields:[{id:'guide',type:'instructions',label:html(file.id)}],subIssues:[{title:'Child',description:html(file.id)}]});
  assert.equal(files()[0].entity_id,template.id);assert.equal(files()[0].entity_kind,'templates');
  assert.equal((await fetch(f.url+file.url,{headers:{Cookie:f.member.cookie}})).status,200);
  const issue=repo.create(memberActor,'issues',{teamId:team.id,templateId:template.id}),rootIds=ids(issue.description),child=repo.all('issues',actor.workspaceId).find(i=>i.parentId===issue.id)!;
  assert.equal(rootIds.length,2);assert.equal(new Set(rootIds).size,1);assert.notEqual(rootIds[0],file.id);assert.notEqual(ids(child.description)[0],rootIds[0]);assert.equal(files().length,3);
  for(const entity of [issue,child]){const copy=files().find(row=>row.id===ids(entity.description)[0]);assert.equal(copy.entity_id,entity.id);assert.equal(copy.creator_id,memberActor.userId);assert.equal(Buffer.from(copy.content).toString(),'Template guide bytes')}
  assert.equal(files().find(row=>row.id===file.id).entity_id,template.id);
  const second=repo.create(actor,'templates',{name:'Other template',description:html(file.id)});assert.notEqual(ids(second.description)[0],file.id);assert.equal(files().find(row=>row.id===file.id).entity_id,template.id);
 }finally{await f.app.close()}
});

test('template asset writes reject guessed files and roll back binding, copies and created work on validation failures',async()=>{
 const f=await fixture();try{
  const {repo,actor,memberActor,team,upload,files}=f,file=await upload();
  assert.throws(()=>repo.create(memberActor,'templates',{name:'Guessed',description:html(file.id)}),/attachment is unavailable/);assert.equal(files()[0].entity_id,null);
  assert.throws(()=>repo.create(actor,'templates',{name:'Invalid',description:html(file.id),formFields:[{id:'bad',type:'unsupported'}]}));assert.equal(files()[0].entity_id,null);
  const privateTeam=repo.create(actor,'teams',{name:'Secret',key:'SEC',private:true,memberIds:[actor.userId]}),secret=repo.create(actor,'issues',{teamId:privateTeam.id,title:'Secret',description:html(file.id)});
  assert.throws(()=>repo.create(memberActor,'templates',{name:'Guessed private',description:html(file.id)}),/attachment is unavailable/);assert.equal(files()[0].entity_id,secret.id);
  const template=repo.create(actor,'templates',{name:'Failure',title:'Parent',description:html(file.id),subIssues:[{title:'First',description:html(file.id)},{title:''}]});const before=files(),count=repo.all('issues',actor.workspaceId).length;
  assert.throws(()=>repo.create(actor,'issues',{teamId:team.id,templateId:template.id}),/Title is required/);assert.deepEqual(files(),before);assert.equal(repo.all('issues',actor.workspaceId).length,count);
  const projectTemplate=repo.create(actor,'templates',{name:'Project failure',type:'project',description:html(file.id),projectPlan:{issues:[{title:'First',description:html(file.id),parentKey:'missing'}]}}),beforeProject=files();assert.throws(()=>repo.create(actor,'projects',{name:'Invalid project',teamIds:[team.id],templateId:projectTemplate.id}),/unknown template parent/);assert.deepEqual(files(),beforeProject);
 }finally{await f.app.close()}
});

test('project template embedded assets copy into the project, planned issues and documents',async()=>{
 const f=await fixture();try{
  const {repo,actor,team,upload,files}=f,file=await upload(),template=repo.create(actor,'templates',{name:'Plan',type:'project',description:html(file.id),projectPlan:{issues:[{title:'Planned',description:html(file.id)}],documents:[{title:'Guide',content:html(file.id)}]}}),project=repo.create(actor,'projects',{name:'Project',teamIds:[team.id],templateId:template.id});
  const issue=repo.all('issues',actor.workspaceId).find(i=>i.projectId===project.id)!,doc=repo.all('documents',actor.workspaceId).find(d=>d.projectId===project.id)!;
  for(const entity of [project,issue,doc]){const id=ids(entity.description||entity.content)[0],copy=files().find(row=>row.id===id);assert.notEqual(id,file.id);assert.equal(copy.entity_id,entity.id);assert.equal(Buffer.from(copy.content).toString(),'Template guide bytes')}
  assert.equal(files().length,4);
 }finally{await f.app.close()}
});

test('published template assets authorize current publication and copy requester submissions with receipt retry isolation',async()=>{
 const f=await fixture();try{
  const {repo,actor,team,upload,files,call,owner}=f,file=await upload(),internal=await upload(),template=repo.create(actor,'templates',{name:'Published',title:'Request',teamId:team.id,description:html(file.id),formFields:[{id:'guide',type:'instructions',content:html(file.id)}],subIssues:[{title:'Internal',description:html(internal.id)}]}),page=repo.create(actor,'asksPages',{name:'Support',slug:'support',templateIds:[template.id]});
  const invite=await call('/api/v1/asks-requesters','POST',{email:'assets-requester@example.test',name:'Requester'},owner.cookie),joined=await call('/asks-api/'+actor.workspaceId+'/auth/join','POST',{token:invite.body.token,password:'requester-password'}),cookie=joined.cookie,base='/asks-api/'+actor.workspaceId;
  const site=await call(base+'/site','GET',undefined,cookie),form=site.body.pages[0].forms[0],assetUrl=String(form.defaults.description).match(/href="([^"]+)"/)![1];assert.match(assetUrl,/template-assets/);assert.match(form.fields[0].content,/template-assets/);
  const read=async(path=assetUrl,c=cookie)=>fetch(f.url+path,{headers:{Cookie:c}});
  const download=await read();assert.equal(download.status,200);assert.equal(await download.text(),'Template guide bytes');assert.equal(download.headers.get('cache-control'),'no-store');assert.match(download.headers.get('content-disposition')!,/^attachment/);
  assert.equal((await read(assetUrl,'')).status,401);assert.equal((await read(assetUrl,owner.cookie)).status,401);assert.equal((await read(assetUrl.replace(file.id,internal.id))).status,404);assert.equal((await read(file.url)).status,401);
  const body={templateId:template.id,submissionKey:randomUUID(),description:form.defaults.description},result=await call(base+'/site/support','POST',body,cookie);assert.equal(result.status,201,JSON.stringify(result));const issue=repo.raw('issues',result.body.issueId)!,copyIds=ids(issue.description);assert.equal(new Set(copyIds).size,1);assert.notEqual(copyIds[0],file.id);assert.equal(files().find(row=>row.id===copyIds[0]).entity_id,issue.id);const count=files().length;assert.equal((await call(base+'/site/support','POST',body,cookie)).body.replayed,true);assert.equal(files().length,count);
  assert.equal((await call(base+'/site/support','POST',{...body,submissionKey:randomUUID(),description:html(internal.id)},cookie)).status,422);
  repo.update(actor,'asksPages',page.id,{enabled:false});assert.equal((await read()).status,404);repo.update(actor,'asksPages',page.id,{enabled:true});repo.update(actor,'templates',template.id,{description:'Removed',formFields:[]});assert.equal((await read()).status,404);repo.update(actor,'templates',template.id,{description:html(file.id)});assert.equal((await read()).status,200);await call('/api/v1/asks-requesters/'+joined.body.requester.id,'DELETE',undefined,owner.cookie);assert.equal((await read()).status,401);
 }finally{await f.app.close()}
});

test('legacy template links remain unexposed until an authorized uploader repairs them',async()=>{
 const f=await fixture();try{
  const {repo,actor,memberActor,upload,files,team,call,owner}=f,file=await upload(),template=repo.create(actor,'templates',{name:'Legacy',title:'Legacy request',teamId:team.id});
  // Simulate an existing pre-binding record, without going through the new save path.
  repo.db.prepare("UPDATE entities SET data=json_set(data,'$.description',?) WHERE kind='templates' AND id=?").run(html(file.id),template.id);
  repo.update(memberActor,'templates',template.id,{name:'Renamed legacy'});assert.equal(files()[0].entity_id,null);
  repo.create(actor,'asksPages',{name:'Legacy',slug:'legacy',templateIds:[template.id]});const invitation=await call('/api/v1/asks-requesters','POST',{email:'legacy@example.test'},owner.cookie),joined=await call('/asks-api/'+actor.workspaceId+'/auth/join','POST',{token:invitation.body.token,password:'legacy-password'}),asset='/asks-api/'+actor.workspaceId+'/template-assets/'+template.id+'/'+file.id+'?pageSlug=legacy';
  assert.equal((await fetch(f.url+asset,{headers:{Cookie:joined.cookie}})).status,404);
  repo.update(actor,'templates',template.id,{name:'Repaired legacy'});assert.equal(files()[0].entity_id,template.id);assert.equal((await fetch(f.url+asset,{headers:{Cookie:joined.cookie}})).status,200);
 }finally{await f.app.close()}
});
