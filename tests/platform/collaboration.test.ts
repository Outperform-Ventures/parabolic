import {DatabaseSync} from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as sync from 'y-protocols/sync';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { createApp } from '../../src/server/app.ts';
import { ParabolicClient } from '../../packages/sdk/src/client.ts';
import { documentHtml, importDocumentHtml, normalizedDocumentHtml } from '../../src/server/collaboration-schema.ts';
import { collaborationRoomKey, type CollaborationKind, type AuthorshipRange } from '../../src/shared/collaboration.ts';

const until=async(check:()=>boolean|Promise<boolean>)=>{const deadline=Date.now()+8000;while(!await check()){assert.ok(Date.now()<deadline,'Timed out waiting for collaboration');await new Promise(resolve=>setTimeout(resolve,20));}};
async function connect(url:string,id:string,headers:Record<string,string>,kind:CollaborationKind='documents',field?:string){
  const doc=new Y.Doc(),awareness=new Awareness(doc),socket=new WebSocket(`${url.replace('http:','ws:')}/collaboration/${kind}/${id}${field?`?field=${field}`:''}`,{headers});let paused=false,ready=false,readOnly=false;const queued:Uint8Array[]=[];let authorship:AuthorshipRange[]=[];
  const send=(bytes:Uint8Array)=>{if(socket.readyState===WebSocket.OPEN)socket.send(bytes);};
  doc.on('update',(update:Uint8Array,origin:unknown)=>{if(origin===socket)return;const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,0);sync.writeUpdate(encoder,update);const packet=encoding.toUint8Array(encoder);if(paused)queued.push(packet);else send(packet);});
  socket.on('message',data=>{const decoder=decoding.createDecoder(new Uint8Array(data as Buffer)),type=decoding.readVarUint(decoder);if(type===0){const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,0);const step=sync.readSyncMessage(decoder,encoder,doc,socket);if(encoding.length(encoder)>1&&!readOnly)send(encoding.toUint8Array(encoder));if(step===sync.messageYjsSyncStep2)ready=true;}else if(type===1)applyAwarenessUpdate(awareness,decoding.readVarUint8Array(decoder),socket);else if(type===4){const value=JSON.parse(decoding.readVarString(decoder));if(typeof value.readOnly==='boolean')readOnly=value.readOnly;if(Array.isArray(value.authorship))authorship=value.authorshipReset?value.authorship:[...authorship,...value.authorship];}});
  try{await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});await until(()=>ready);}catch(error){socket.terminate();awareness.destroy();doc.destroy();throw error;}
  return {doc,awareness,socket,get authorship(){return authorship;},get readOnly(){return readOnly;},pause(){paused=true;},resume(){paused=false;for(const packet of queued.splice(0))send(packet);},presence(name:string){awareness.setLocalState({user:{name},cursor:{anchor:{type:doc.clientID},head:{type:doc.clientID}}});const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,1);encoding.writeVarUint8Array(encoder,encodeAwarenessUpdate(awareness,[doc.clientID]));send(encoding.toUint8Array(encoder));},async close(){awareness.destroy();if(socket.readyState!==WebSocket.CLOSED){const done=new Promise<void>(resolve=>socket.once('close',()=>resolve()));socket.close();await done;}doc.destroy();}};
}
const firstText=(doc:Y.Doc)=>((doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText);

test('Yjs merges independent edits, shares presence, projects HTML, handles API replacement and survives restart',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'parabolic-crdt-'));let app=createApp({databasePath:join(directory,'workspace.sqlite'),port:0});let {url}=await app.start();let peers:Awaited<ReturnType<typeof connect>>[]=[];
  try{
    const setup=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Collaboration QA',email:'collaboration@example.test',password:'Collaboration-test-password'})});const cookie=setup.headers.get('set-cookie')!.split(';')[0];let client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});
    const document=await client.documents.create({title:'Concurrent document',content:'<p>Base</p>'});
    const alice=await connect(url,document.id,{Cookie:cookie}),bob=await connect(url,document.id,{Cookie:cookie});peers=[alice,bob];assert.equal(documentHtml(alice.doc),'<p>Base</p>');
    alice.pause();bob.pause();firstText(alice.doc).insert(0,'Alice ');firstText(bob.doc).insert(0,'Bob ');alice.resume();bob.resume();
    await until(()=>documentHtml(alice.doc)===documentHtml(bob.doc)&&documentHtml(alice.doc).includes('Alice')&&documentHtml(bob.doc).includes('Bob'));
    alice.presence('Untrusted name');await until(()=>[...bob.awareness.getStates().values()].some(value=>value.user?.name==='Collaboration QA'));
    await until(async()=>String((await client.documents.get(document.id)).content).includes('Alice')&&String((await client.documents.get(document.id)).content).includes('Bob'));
    const withHistory=await client.documents.get(document.id);assert.ok((withHistory.history as any[]).some(entry=>entry.content==='<p>Base</p>'));
    await client.documents.update(document.id,{content:'<h1>API replacement</h1><p>Restored version</p>'});await until(()=>documentHtml(alice.doc).includes('API replacement')&&documentHtml(bob.doc).includes('Restored version'));assert.equal(documentHtml(alice.doc).includes('Alice'),false);
    await Promise.all(peers.map(peer=>peer.close()));peers=[];await app.close();
    app=createApp({databasePath:join(directory,'workspace.sqlite'),port:0});({url}=await app.start());client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});
    const reopened=await connect(url,document.id,{Cookie:cookie});peers=[reopened];assert.equal(documentHtml(reopened.doc),normalizedDocumentHtml('<h1>API replacement</h1><p>Restored version</p>'));assert.ok(app.db.prepare('SELECT state FROM collaboration_rooms WHERE room_key=?').get(collaborationRoomKey({kind:'documents',id:document.id})));
  }finally{await Promise.all(peers.map(peer=>peer.close()));await app.close();await rm(directory,{recursive:true,force:true});}
});

test('Scoped entity rooms merge descriptions and comment bodies without allowing arbitrary fields',async()=>{
  const app=createApp({databasePath:':memory:',port:0});const {url}=await app.start();let peers:Awaited<ReturnType<typeof connect>>[]=[];
  try{
    const setup=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Entity Editor',email:'entity-editor@example.test',password:'Entity-editor-password'})});const cookie=setup.headers.get('set-cookie')!.split(';')[0];const client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});
    const team=(await client.teams.list()).nodes[0];const issue=await client.issues.create({title:'Concurrent issue',teamId:team.id,description:'<p>Base</p>'}),project=await client.projects.create({name:'Concurrent project',description:'<p>Base</p>'}),initiative=await client.initiatives.create({name:'Concurrent initiative',description:'<p>Base</p>'}),comment=await client.comments.create({issueId:issue.id,body:'<p>Base</p>'});
    const targets=[['issues',issue,'description'],['projects',project,'description'],['initiatives',initiative,'description'],['comments',comment,'body']] as const;
    for(const [kind,entity,field] of targets){
      const first=await connect(url,entity.id,{Cookie:cookie},kind,field),second=await connect(url,entity.id,{Cookie:cookie},kind);peers=[first,second];first.pause();second.pause();firstText(first.doc).insert(0,'One ');firstText(second.doc).insert(0,'Two ');first.resume();second.resume();
      await until(()=>documentHtml(first.doc)===documentHtml(second.doc)&&documentHtml(first.doc).includes('One')&&documentHtml(first.doc).includes('Two'));
      await until(async()=>String((await client.collection(kind).get(entity.id))[field]).includes('One')&&String((await client.collection(kind).get(entity.id))[field]).includes('Two'));
      await client.collection(kind).update(entity.id,{[field]:'<p>Explicit API replacement</p>'});await until(()=>documentHtml(first.doc)==='<p>Explicit API replacement</p>');
      await assert.rejects(connect(url,entity.id,{Cookie:cookie},kind,'title'));
      await Promise.all(peers.map(peer=>peer.close()));peers=[];
    }
    const invite=await client.invitations.create({email:'comment-reader@example.test',role:'member'});
    const joined=await fetch(`${url}/auth/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Comment Reader',email:'comment-reader@example.test',password:'Reader-editor-password',token:invite.token})});const readerCookie=joined.headers.get('set-cookie')!.split(';')[0];
    const reader=await connect(url,comment.id,{Cookie:readerCookie},'comments');peers=[reader];assert.equal(reader.readOnly,true);firstText(reader.doc).insert(0,'Unauthorized ');await until(()=>reader.socket.readyState===WebSocket.CLOSED);assert.equal((await client.comments.get(comment.id)).body,'<p>Explicit API replacement</p>');
  }finally{await Promise.all(peers.map(peer=>peer.close()));await app.close();}
});

test('Legacy document snapshots and pending updates migrate without losing unprojected edits',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'parabolic-crdt-migration-'));const databasePath=join(directory,'workspace.sqlite');let app=createApp({databasePath,port:0});let {url}=await app.start();let peer:Awaited<ReturnType<typeof connect>>|undefined;
  try{
    const setup=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Migration Editor',email:'migration-editor@example.test',password:'Migration-editor-password'})});const cookie=setup.headers.get('set-cookie')!.split(';')[0];let client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});const document=await client.documents.create({title:'Existing collaboration state',content:'<p>Before</p>'});
    const legacy=new Y.Doc();importDocumentHtml(legacy,document.content??'');const snapshot=Y.encodeStateAsUpdate(legacy),vector=Y.encodeStateVector(legacy);firstText(legacy).insert(0,'Unprojected ');const update=Y.encodeStateAsUpdate(legacy,vector);legacy.destroy();
    await app.close();const legacyDb=new DatabaseSync(databasePath),legacyKey=collaborationRoomKey({kind:'documents',id:document.id});legacyDb.prepare('DELETE FROM collaboration_rooms WHERE room_key=?').run(legacyKey);legacyDb.prepare('DELETE FROM collaboration_room_updates WHERE room_key=?').run(legacyKey);legacyDb.prepare('DELETE FROM collaboration_authorship WHERE room_key=?').run(legacyKey);legacyDb.prepare('INSERT INTO collaboration_documents VALUES(?,?,?,?,?)').run(document.id,document.workspaceId,snapshot,document.content??'',new Date().toISOString());legacyDb.prepare('INSERT INTO collaboration_updates(document_id,update_data,created_at) VALUES(?,?,?)').run(document.id,update,new Date().toISOString());legacyDb.close();
    app=createApp({databasePath,port:0});({url}=await app.start());client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});peer=await connect(url,document.id,{Cookie:cookie});assert.equal(documentHtml(peer.doc),'<p>Unprojected Before</p>');assert.equal((app.db.prepare('SELECT COUNT(*) AS count FROM collaboration_authorship WHERE room_key=? AND user_id IS NOT NULL').get(legacyKey) as any).count,0);await until(async()=>(await client.documents.get(document.id)).content==='<p>Unprojected Before</p>');
  }finally{await peer?.close();await app.close();await rm(directory,{recursive:true,force:true});}
});

test('Collaboration authenticates rooms and prevents read-only or revoked credentials from writing',async()=>{
  const app=createApp({databasePath:':memory:',port:0});const {url}=await app.start();let peer:Awaited<ReturnType<typeof connect>>|undefined;
  try{
    const setup=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Permission QA',email:'permission@example.test',password:'Permission-test-password'})});const cookie=setup.headers.get('set-cookie')!.split(';')[0],owner=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});
    const document=await owner.documents.create({title:'Authorized document',content:'<p>Protected</p>'});
    await assert.rejects(connect(url,document.id,{}));await assert.rejects(connect(url,document.id,{Cookie:cookie,Origin:'https://untrusted.test'}));
    const key=await owner.apiKeys.create({name:'Read documents',scopes:['documents:read']});peer=await connect(url,document.id,{Authorization:`Bearer ${key.token}`});assert.equal(peer.readOnly,true);
    firstText(peer.doc).insert(0,'Unauthorized ');await until(()=>peer!.socket.readyState===WebSocket.CLOSED);assert.equal((await owner.documents.get(document.id)).content,'<p>Protected</p>');await peer.close();peer=undefined;
    const writer=await owner.apiKeys.create({name:'Write documents',scopes:['documents:read','documents:write']});peer=await connect(url,document.id,{Authorization:`Bearer ${writer.token}`});await owner.apiKeys.revoke(writer.id);firstText(peer.doc).insert(0,'Revoked ');await until(()=>peer!.socket.readyState===WebSocket.CLOSED);assert.equal((await owner.documents.get(document.id)).content,'<p>Protected</p>');
  }finally{await peer?.close();await app.close();}
});

test('Collaborative HTML preserves custom mention/date/diagram/details nodes and standard rich blocks',()=>{
  const doc=new Y.Doc();try{const html='<h2>Heading</h2><p><strong>Bold</strong> <span data-mention-id="user" data-mention-kind="user" data-mention-label="Ada">@Ada</span> <span data-date="2026-09-06">Sep 6</span></p><pre data-type="mermaid"><code>graph TD\nA--&gt;B</code></pre><details open data-type="details"><summary>More</summary><div data-type="detailsContent"><p>Inside</p></div></details><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"></label><div><p>Done</p></div></li></ul>';importDocumentHtml(doc,html);const output=documentHtml(doc);for(const expected of ['<strong>Bold</strong>','data-mention-id="user"','data-date="2026-09-06"','data-type="mermaid"','A--&gt;B','<summary>More</summary>','data-type="taskList"'])assert.ok(output.includes(expected),`Missing ${expected}: ${output}`);const empty=new Y.Doc();importDocumentHtml(empty,'');assert.equal(documentHtml(empty),'<p></p>');empty.destroy();}finally{doc.destroy();}
});

test('Collaborative image dimensions and code language survive HTML and Yjs round trips',()=>{
  const doc=new Y.Doc();try{importDocumentHtml(doc,'<p>Reference</p><img src="/api/v1/attachments/image-id" alt="Diagram" width="320" height="180"><pre><code class="language-typescript">const count = 1;</code></pre>');const snapshot=Y.encodeStateAsUpdate(doc),copy=new Y.Doc();try{Y.applyUpdate(copy,snapshot);const html=documentHtml(copy);for(const expected of ['width="320"','height="180"','language-typescript','const count = 1;'])assert.ok(html.includes(expected),html);}finally{copy.destroy();}}finally{doc.destroy();}
});

test('Permanent deletion clears a live room without allowing shutdown or restart to resurrect snapshots',async()=>{
  const {purgeExpiredTrash}=await import('../../src/server/lifecycle.ts'),directory=await mkdtemp(join(tmpdir(),'parabolic-crdt-purge-')),databasePath=join(directory,'workspace.sqlite');let app=createApp({databasePath,port:0}),{url}=await app.start();let peer:Awaited<ReturnType<typeof connect>>|undefined;
  try{
    const setup=await fetch(`${url}/auth/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Purge editor',email:'purge-editor@example.test',password:'Purge-editor-password'})}),cookie=setup.headers.get('set-cookie')!.split(';')[0],client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}}),state=await client.state(),document=await client.documents.create({title:'Content that must disappear',content:'<p>Sensitive original</p>'});
    peer=await connect(url,document.id,{Cookie:cookie});firstText(peer.doc).insert(0,'Pending ');await until(()=>!!app.db.prepare('SELECT room_key FROM collaboration_room_updates WHERE room_key=?').get(collaborationRoomKey({kind:'documents',id:document.id})));
    const actor={userId:state.user!.id,workspaceId:state.workspaceId,role:'owner',scopes:['admin'],now:new Date('2026-01-01T00:00:00.000Z')};app.repo.remove(actor,'documents',document.id);purgeExpiredTrash(app.repo,{...actor,system:true},new Date(Date.now()+35*86400000));await until(()=>peer!.socket.readyState===WebSocket.CLOSED);
    const absent=()=>{assert.equal(app.db.prepare('SELECT room_key FROM collaboration_authorship WHERE room_key=?').get(collaborationRoomKey({kind:'documents',id:document.id})),undefined);assert.equal(app.repo.raw('documents',document.id,true),null);assert.equal(app.db.prepare('SELECT room_key FROM collaboration_rooms WHERE entity_id=?').get(document.id),undefined);assert.equal(app.db.prepare('SELECT room_key FROM collaboration_room_updates WHERE room_key=?').get(collaborationRoomKey({kind:'documents',id:document.id})),undefined);};absent();await peer.close();peer=undefined;await app.close();
    app=createApp({databasePath,port:0});({url}=await app.start());absent();await assert.rejects(connect(url,document.id,{Cookie:cookie}));
  }finally{await peer?.close();await app.close();await rm(directory,{recursive:true,force:true});}
});

test('Opening or closing an empty collaborative description does not create an edit or wake snoozed triage',async()=>{
 const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();let peer:Awaited<ReturnType<typeof connect>>|undefined;try{
  const setup=await fetch(url+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Empty editor',email:'empty-editor@example.test',password:'Empty-editor-password'})}),cookie=setup.headers.get('set-cookie')!.split(';')[0],client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}}),state=await client.state(),triage=state.statuses.find(status=>status.type==='triage')!;
  const issue=await client.issues.create({title:'Snoozed empty description',teamId:triage.teamId,statusId:triage.id,description:''}),snoozed=await client.triageIssue(issue.id,{action:'snooze',snoozedUntil:new Date(Date.now()+86400000).toISOString()});peer=await connect(url,issue.id,{Cookie:cookie},'issues');await peer.close();peer=undefined;const current=await client.issues.get(issue.id);assert.equal(current.version,snoozed.issue.version);assert.equal(current.description,'');assert.equal(current.snoozedUntil,snoozed.issue.snoozedUntil);
 }finally{await peer?.close();await app.close();}
});

test('Custom emoji remain inline atomic nodes across sanitized HTML and Yjs projection',async()=>{
 const {sanitizeEditorContent}=await import('../../src/server/content.ts'),doc=new Y.Doc();try{
  const html='<p>Before <img data-type="custom-emoji" data-emoji-id="emoji-id" data-emoji-name="party_blob" src="/api/v1/attachments/image-id" alt=":party_blob:"> after</p>';importDocumentHtml(doc,sanitizeEditorContent(html));const output=documentHtml(doc);assert.match(output,/<p>Before <img[^>]*data-type="custom-emoji"[^>]*> after<\/p>/);assert.match(output,/data-emoji-name="party_blob"/);assert.equal(doc.getXmlFragment('default').length,1);assert.equal((doc.getXmlFragment('default').get(0) as Y.XmlElement).get(1) instanceof Y.XmlElement,true);
  importDocumentHtml(doc,'<p><img data-type="custom-emoji" data-emoji-id="bad" data-emoji-name="unsafe" src="https://external.example/image.png"></p>');assert.equal(documentHtml(doc).includes('external.example'),false);assert.match(documentHtml(doc),/:unsafe:/);
 }finally{doc.destroy();}
});

test('Plain-text normalization creates no edit on open, close or API replacement, but real formatting is saved',async()=>{
 const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();let peer:Awaited<ReturnType<typeof connect>>|undefined;try{
 const setup=await fetch(url+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Plain editor',email:'plain-editor@example.test',password:'Plain-editor-password'})}),cookie=setup.headers.get('set-cookie')!.split(';')[0],client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});
 const document=await client.documents.create({title:'Plain document',content:'Plain original',visibility:'workspace'});peer=await connect(url,document.id,{Cookie:cookie});await peer.close();peer=undefined;let current=await client.documents.get(document.id);assert.equal(current.content,'Plain original');assert.equal(current.version,document.version);assert.equal(current.history,undefined);
 peer=await connect(url,document.id,{Cookie:cookie});const replaced=await client.documents.update(document.id,{content:'Plain replacement'});await until(()=>documentHtml(peer!.doc)==='<p>Plain replacement</p>');await peer.close();peer=undefined;current=await client.documents.get(document.id);assert.equal(current.content,'Plain replacement');assert.equal(current.version,replaced.version);assert.ok(Array.isArray(current.history));assert.equal(current.history.length,1);
 peer=await connect(url,document.id,{Cookie:cookie});importDocumentHtml(peer.doc,'<p><strong>Plain replacement</strong></p>','format');await until(async()=>Boolean((await client.documents.get(document.id)).content?.includes('<strong>')));await peer.close();peer=undefined;current=await client.documents.get(document.id);assert.ok(Array.isArray(current.history));assert.equal(current.history.length,2);assert.equal(current.history.at(-1).content,'Plain replacement');
 }finally{await peer?.close();await app.close()}
});

test('automatic trailing paragraph after a non-paragraph block creates no revision, while explicit paragraph additions and typing save',async()=>{
 const app=createApp({databasePath:':memory:',port:0}),{url}=await app.start();let peers:Awaited<ReturnType<typeof connect>>[]=[];
 try{
 const setup=await fetch(url+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Trailing editor',email:'trailing-editor@example.test',password:'Trailing-editor-password'})}),cookie=setup.headers.get('set-cookie')!.split(';')[0],client=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});
 for(const content of ['<h2>Final heading</h2>','<details><summary>Section</summary><div data-type="detailsContent"><p>Body</p></div></details>','<p>Final paragraph</p>']){
  const document=await client.documents.create({title:'Trailing paragraph',content,visibility:'workspace'}),writer=await connect(url,document.id,{Cookie:cookie}),observer=await connect(url,document.id,{Cookie:cookie});peers=[writer,observer];writer.doc.getXmlFragment('default').push([new Y.XmlElement('paragraph')]);await until(()=>documentHtml(observer.doc)===documentHtml(writer.doc));await Promise.all(peers.map(peer=>peer.close()));peers=[];
  const automatic=!content.endsWith('</p>');if(!automatic)await until(async()=>(await client.documents.get(document.id)).version>document.version);const current=await client.documents.get(document.id);assert.equal(current.version,document.version+(automatic?0:1));if(automatic){assert.equal(current.content,content);assert.equal(current.history,undefined)}else assert.ok(Array.isArray(current.history)&&current.history.length===1);
  if(automatic){const peer=await connect(url,document.id,{Cookie:cookie});peers=[peer];const fragment=peer.doc.getXmlFragment('default'),paragraph=fragment.get(fragment.length-1) as Y.XmlElement,text=new Y.XmlText();paragraph.push([text]);text.insert(0,'Real new content');await until(async()=>String((await client.documents.get(document.id)).content).includes('Real new content'));await peer.close();peers=[];const edited=await client.documents.get(document.id);assert.equal(edited.version,document.version+1);assert.ok(Array.isArray(edited.history)&&edited.history.length===1);assert.equal(edited.history[0].content,content)}
 }
 }finally{await Promise.all(peers.map(peer=>peer.close()));await app.close()}
});

test('authenticated authorship persists across collaborative edits, replay, closed-editor API writes and restart',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'parabolic-authorship-'));let app=createApp({databasePath:join(directory,'workspace.sqlite'),port:0}),{url}=await app.start();let peers:Awaited<ReturnType<typeof connect>>[]=[];
 try{
 const setup=await fetch(url+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Authorship owner',email:'authorship-owner@example.test',password:'Authorship-owner-password'})}),cookie=setup.headers.get('set-cookie')!.split(';')[0],ownerProfile=await setup.json();let owner=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});
 const invite=await owner.invitations.create({email:'authorship-member@example.test',role:'member'}),joined=await fetch(url+'/auth/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Authorship member',password:'Authorship-member-password',token:invite.token})}),memberCookie=joined.headers.get('set-cookie')!.split(';')[0],memberProfile=await joined.json();
 const document=await owner.documents.create({title:'Authorship document',content:'<p>Original</p>',visibility:'workspace'}),key=collaborationRoomKey({kind:'documents',id:document.id});
 const authorAt=(text:Y.XmlText,index:number)=>{const item=Y.createRelativePositionFromTypeIndex(text,index).item;assert(item);return (app.db.prepare('SELECT user_id FROM collaboration_authorship WHERE room_key=? AND client_id=? AND clock<=? AND clock+length>?').get(key,item.client,item.clock,item.clock) as {user_id:string|null}|undefined)?.user_id};
 const wireAuthor=(peer:Awaited<ReturnType<typeof connect>>,word:string)=>{const text=firstText(peer.doc),item=Y.createRelativePositionFromTypeIndex(text,text.toString().indexOf(word)).item;assert(item);return peer.authorship.find(r=>r.client===item.client&&r.clock<=item.clock&&r.clock+r.length>item.clock)?.userId};
 const alice=await connect(url,document.id,{Cookie:cookie}),bob=await connect(url,document.id,{Cookie:memberCookie});peers=[alice,bob];assert.equal(authorAt(firstText(alice.doc),0),ownerProfile.user.id);assert.equal(wireAuthor(alice,'Original'),ownerProfile.user.id);assert.equal(wireAuthor(bob,'Original'),ownerProfile.user.id);
 alice.pause();bob.pause();firstText(alice.doc).insert(0,'Owner ');firstText(bob.doc).insert(0,'Member ');alice.resume();bob.resume();await until(()=>documentHtml(alice.doc)===documentHtml(bob.doc)&&documentHtml(alice.doc).includes('Member ')&&documentHtml(alice.doc).includes('Owner '));
 await until(()=>[alice,bob].every(peer=>wireAuthor(peer,'Owner')===ownerProfile.user.id&&wireAuthor(peer,'Member')===memberProfile.user.id));
 let text=firstText(alice.doc),value=text.toString();assert.equal(authorAt(text,value.indexOf('Owner')),ownerProfile.user.id);assert.equal(authorAt(text,value.indexOf('Member')),memberProfile.user.id);assert.equal(authorAt(text,value.indexOf('Original')),ownerProfile.user.id);
 await Promise.all(peers.map(peer=>peer.close()));peers=[];await app.close();app=createApp({databasePath:join(directory,'workspace.sqlite'),port:0});({url}=await app.start());owner=new ParabolicClient({baseUrl:url,headers:{Cookie:cookie}});const member=new ParabolicClient({baseUrl:url,headers:{Cookie:memberCookie}}),existing=await owner.documents.get(document.id);await member.documents.update(document.id,{content:String(existing.content).replace('Original','Original API')});
 const reopened=await connect(url,document.id,{Cookie:cookie});peers=[reopened];assert.equal(wireAuthor(reopened,'API'),memberProfile.user.id);assert.equal(wireAuthor(reopened,'Original'),ownerProfile.user.id);text=firstText(reopened.doc);value=text.toString();assert.equal(authorAt(text,value.indexOf('Original')),ownerProfile.user.id);assert.equal(authorAt(text,value.indexOf('API')),memberProfile.user.id);assert.equal(authorAt(text,value.indexOf('Member')),memberProfile.user.id);await reopened.close();peers=[];
 }finally{await Promise.all(peers.map(peer=>peer.close()));await app.close();await rm(directory,{recursive:true,force:true})}
});
