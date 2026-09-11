import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../src/server/app';
import type {Actor} from '../../src/server/repository';

async function fixture(){
 const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();
 const call=async(path:string,method='GET',data?:any,cookie='')=>{const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});return{status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0]||'',body:await response.json()}};
 const owner=await call('/auth/setup','POST',{name:'Upload owner',email:'upload-owner@example.test',password:'upload-owner-password'}),actor:Actor={userId:owner.body.user.id,workspaceId:owner.body.workspaceId,role:'owner',scopes:['read','write','admin']},team=app.repo.all('teams',actor.workspaceId)[0];
 const invitation=await call('/api/v1/invitations','POST',{email:'upload-member@example.test',role:'member'},owner.cookie),member=await call('/auth/join','POST',{token:invitation.body.token,name:'Member',email:'upload-member@example.test',password:'upload-member-password'});
 const upload=async(filename='evidence.txt',cookie=owner.cookie,extra={})=>{const result=await call('/api/v1/attachments','POST',{filename,mimeType:'text/plain',content:Buffer.from('actual upload bytes\n').toString('base64'),...extra},cookie);assert.equal(result.status,201);return result.body};
 return{app,url,call,owner,member,actor,team,upload};
}
test('template file fields validate real uploads, preserve bytes and copy reused files without rebinding originals',async()=>{
 const f=await fixture();try{const{app,actor,team,upload}=f,template=app.repo.create(actor,'templates',{name:'Upload form',type:'issue',title:'Upload request',formFields:[{id:'evidence',type:'file',label:'Evidence',required:true}]}),file=await upload('<evidence>.txt');
 for(const value of [undefined,[],[{}],['https://example.test/file'],['missing'],[file.id,file.id]]){assert.throws(()=>app.repo.create(actor,'issues',{teamId:team.id,templateId:template.id,templateAnswers:{evidence:value}}));assert.equal(app.repo.all('issues',actor.workspaceId).length,0)}
 const issue=app.repo.create(actor,'issues',{teamId:team.id,templateId:template.id,templateAnswers:{evidence:[file.id]}});assert.match(issue.description,/&lt;evidence&gt;\.txt/);assert.match(issue.description,new RegExp('/attachments/'+file.id));assert.equal((app.db.prepare('SELECT entity_id FROM attachments WHERE id=?').get(file.id) as any).entity_id,issue.id);
 const download=await fetch(f.url+file.url,{headers:{Cookie:f.owner.cookie}});assert.equal(await download.text(),'actual upload bytes\n');
 const second=app.repo.create(actor,'issues',{teamId:team.id,templateId:template.id,templateAnswers:{evidence:[file.id]}}),copyId=second.templateAnswers.evidence[0];assert.notEqual(copyId,file.id);assert.equal((app.db.prepare('SELECT entity_id FROM attachments WHERE id=?').get(file.id) as any).entity_id,issue.id);const copy=app.db.prepare('SELECT * FROM attachments WHERE id=?').get(copyId) as any;assert.equal(copy.entity_id,second.id);assert.equal(Buffer.from(copy.content).toString(),'actual upload bytes\n');
 assert.throws(()=>app.repo.create(actor,'templates',{name:'Invalid',type:'issue',formFields:[{id:'f',type:'file',property:'title'}]}),/cannot set issue properties/);
 }finally{await f.app.close()}
});
test('template upload metadata and submission enforce uploader, workspace and private-source access',async()=>{
 const f=await fixture();try{const{app,actor,team,upload,call,owner,member}=f,template=app.repo.create(actor,'templates',{name:'Files',type:'issue',title:'Files',formFields:[{id:'file',type:'file',label:'File',required:true}]}),file=await upload(),payload={teamId:team.id,templateId:template.id,templateAnswers:{file:[file.id]}};
 assert.equal((await call(file.url+'/metadata','GET',undefined,owner.cookie)).body.filename,'evidence.txt');assert.equal((await call(file.url+'/metadata','GET',undefined,member.cookie)).status,404);assert.equal((await call('/api/v1/issues','POST',payload,member.cookie)).status,422);
 const hidden=app.repo.create(actor,'teams',{name:'Private',key:'PVT',private:true,memberIds:[actor.userId]}),source=app.repo.create(actor,'issues',{title:'Hidden source',teamId:hidden.id}),bound=await upload('private.txt',owner.cookie,{issueId:source.id});assert.equal((await call(bound.url+'/metadata','GET',undefined,member.cookie)).status,404);assert.equal((await call('/api/v1/issues','POST',{...payload,templateAnswers:{file:[bound.id]}},member.cookie)).status,404);
 const other=app.auth.createWorkspace(actor.userId,'Other workspace'),foreignActor={...actor,workspaceId:other.workspaceId},foreignTeam=app.repo.all('teams',other.workspaceId)[0],foreignTemplate=app.repo.create(foreignActor,'templates',{name:'Foreign',type:'issue',title:'Foreign',formFields:[{id:'file',type:'file'}]});assert.throws(()=>app.repo.create(foreignActor,'issues',{teamId:foreignTeam.id,templateId:foreignTemplate.id,templateAnswers:{file:[file.id]}}),/unavailable/);
 }finally{await f.app.close()}
});
test('failed template children roll back attachment binding and copies, and invalid calendar dates fail before writes',async()=>{
 const f=await fixture();try{const{app,actor,team,upload}=f,file=await upload(),template=app.repo.create(actor,'templates',{name:'Atomic uploads',type:'issue',title:'Parent',formFields:[{id:'f',type:'file',required:true},{id:'d',type:'date'}],subIssues:[{title:'Valid'},{title:''}]});
 const count=()=>Number((app.db.prepare('SELECT COUNT(*) AS n FROM attachments').get() as any).n);
 assert.throws(()=>app.repo.create(actor,'issues',{teamId:team.id,templateId:template.id,templateAnswers:{f:[file.id],d:'2027-02-29'}}),/Date answer/);assert.equal(app.repo.all('issues',actor.workspaceId).length,0);
 assert.throws(()=>app.repo.create(actor,'issues',{teamId:team.id,templateId:template.id,templateAnswers:{f:[file.id],d:'2028-02-29'}}),/Title is required/);assert.equal((app.db.prepare('SELECT entity_id FROM attachments WHERE id=?').get(file.id) as any).entity_id,null);
 const source=app.repo.create(actor,'issues',{teamId:team.id,title:'Source',description:`<a href="${file.url}">File</a>`}),before=count();assert.throws(()=>app.repo.create(actor,'issues',{teamId:team.id,templateId:template.id,templateAnswers:{f:[file.id]}}),/Title is required/);assert.equal(count(),before);assert.equal((app.db.prepare('SELECT entity_id FROM attachments WHERE id=?').get(file.id) as any).entity_id,source.id);
 }finally{await f.app.close()}
});
test('Asks page upload submission records canonical attachments and retries create no extra work',async()=>{
 const f=await fixture();try{const{app,actor,team,upload,call,owner}=f,file=await upload(),template=app.repo.create(actor,'templates',{name:'Evidence request',type:'issue',teamId:team.id,title:'Evidence',formFields:[{id:'evidence',type:'file',required:true}]}),page=app.repo.create(actor,'asksPages',{name:'Support',slug:'support',templateIds:[template.id]}),body={templateId:template.id,submissionKey:randomUUID(),templateAnswers:{evidence:[file.id]}};
 const result=await call('/api/v1/asks-site/'+page.slug,'POST',body,owner.cookie);assert.equal(result.status,201,JSON.stringify(result));const request=app.repo.raw('requests',result.body.id)!;assert.deepEqual(request.answers,{evidence:[file.id]});assert.match(app.repo.raw('issues',request.issueId)!.description,new RegExp(file.id));const retry=await call('/api/v1/asks-site/'+page.slug,'POST',body,owner.cookie);assert.equal(retry.body.replayed,true);assert.equal(app.repo.all('requests',actor.workspaceId).length,1);assert.equal(Number((app.db.prepare('SELECT COUNT(*) AS n FROM attachments').get() as any).n),1);
 }finally{await f.app.close()}
});

test('a form field accepts more than 100 valid files without a billing count cap',async()=>{
 const f=await fixture();try{const {app,actor,team}=f,template=app.repo.create(actor,'templates',{name:'Many files',type:'issue',title:'Many files',formFields:[{id:'files',type:'file',required:true}]}),ids=Array.from({length:101},()=>randomUUID());
 for(const id of ids)app.db.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,actor.workspaceId,actor.userId,id+'.txt','text/plain',1,null,null,Buffer.from('x'),new Date().toISOString());
 const issue=app.repo.create(actor,'issues',{teamId:team.id,templateId:template.id,templateAnswers:{files:ids}});assert.deepEqual(issue.templateAnswers.files,ids);assert.equal(Number((app.db.prepare('SELECT count(*) AS n FROM attachments WHERE entity_id=?').get(issue.id) as any).n),101);
 }finally{await f.app.close()}
});
