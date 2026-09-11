import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../../src/server/app';
import {uploadMaxBytes,defaultUploadMaxBytes} from '../../src/server/upload-limits';

test('upload resource guard is configurable and independent of billing',()=>{
 assert.equal(uploadMaxBytes(''),defaultUploadMaxBytes);assert.equal(uploadMaxBytes('12345678'),12345678);
 for(const value of [0,-1,1.2,'no',Infinity])assert.throws(()=>uploadMaxBytes(value));
});

test('member and requester uploads share configured boundary across raw, multipart and base64 with no writes on rejection',async()=>{
 const app=createApp({databasePath:':memory:',port:0,uploadMaxBytes:64}),{url}=await app.start();
 const call=async(path:string,data?:any,cookie='')=>fetch(url+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:data===undefined?undefined:JSON.stringify(data)});
 try{
  const setup=await call('/auth/setup',{name:'Upload owner',email:'limits@example.test',password:'upload-limits-password'}),cookie=setup.headers.get('set-cookie')!.split(';')[0],owner=await setup.json();
  const actor={userId:owner.user.id,workspaceId:owner.workspaceId,role:'owner',scopes:['read','write','admin']},team=app.repo.all('teams',actor.workspaceId)[0];
  const template=app.repo.create(actor,'templates',{name:'File intake',teamId:team.id,title:'Evidence',formFields:[{id:'file',type:'file'}]});app.repo.create(actor,'asksPages',{name:'Support',slug:'support',templateIds:[template.id]});
  const invited=await(await call('/api/v1/asks-requesters',{name:'Requester',email:'limits-requester@example.test'},cookie)).json();const join=await call('/asks-api/'+actor.workspaceId+'/auth/join',{token:invited.token,password:'requester-limits-password'}),requesterCookie=join.headers.get('set-cookie')!.split(';')[0];await join.json();
  const requesterBase='/asks-api/'+actor.workspaceId+'/files';
  assert.equal((await call('/api/v1/attachments/limits')).status,401);assert.deepEqual(await(await call('/api/v1/attachments/limits',undefined,cookie)).json(),{maxBytes:64,source:'server'});assert.equal((await call(requesterBase+'/limits')).status,401);assert.deepEqual(await(await call(requesterBase+'/limits',undefined,requesterCookie)).json(),{maxBytes:64,source:'server'});
  const count=()=>Number((app.db.prepare('SELECT count(*) AS n FROM attachments').get() as any).n);
  for(const [base,session,encodings]of [['/api/v1/attachments',cookie,['raw','multipart','base64']],[requesterBase+'?pageSlug=support&templateId='+template.id+'&fieldId=file',requesterCookie,['multipart','base64']]] as const){
   for(const encoding of encodings){for(const size of [64,65]){const previous=count(),content=Buffer.alloc(size,65);let response:Response;
    if(encoding==='base64')response=await call(base,{filename:'evidence.txt',mimeType:'text/plain',content:content.toString('base64')},session);
    else if(encoding==='multipart'){const form=new FormData();form.append('file',new File([content],'evidence.txt',{type:'text/plain'}));response=await fetch(url+base,{method:'POST',headers:{Cookie:session},body:form});}
    else response=await fetch(url+base,{method:'POST',headers:{Cookie:session,'Content-Type':'text/plain','X-Filename':'evidence.txt'},body:content});
    assert.equal(response.status,size===64?201:413,await response.text());assert.equal(count(),previous+(size===64?1:0));
   }}
  }
 }finally{await app.close()}
});

test('default deployment accepts files above the former 15 MB product cap',async()=>{
 const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();try{
  const setup=await fetch(url+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Large upload',email:'large-upload@example.test',password:'large-upload-password'})}),cookie=setup.headers.get('set-cookie')!.split(';')[0];await setup.json();
  const response=await fetch(url+'/api/v1/attachments',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/octet-stream','X-Filename':'large.bin'},body:Buffer.alloc(16_000_000,1)});assert.equal(response.status,201);const value=await response.json();assert.equal(value.size,16_000_000);assert.equal((app.db.prepare('SELECT size FROM attachments WHERE id=?').get(value.id) as any).size,16_000_000);
 }finally{await app.close()}
});
