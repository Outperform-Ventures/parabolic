import {CollaborationAuthorship,type AuthorshipRange} from './collaboration-authorship.ts';
import type { Server, IncomingMessage } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as sync from 'y-protocols/sync';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { Auth } from './auth.ts';
import type { Actor, Repository, Change, RecordEntity } from './repository.ts';
import { importDocumentHtml, documentHtml, normalizedDocumentHtml, isEditorInitializationHtml } from './collaboration-schema.ts';
import { collaborationFields, collaborationRoomKey, resolveCollaborationTarget, type CollaborationTarget, type CollaborationKind } from '../shared/collaboration.ts';

type Connection={socket:WebSocket;request:IncomingMessage;actor:Actor;clients:Set<number>;alive:boolean};
type Room={key:string;id:string;kind:CollaborationKind;field:string;workspaceId:string;doc:Y.Doc;awareness:Awareness;connections:Set<Connection>;html:string;normalizedHtml:string;updates:number;purged?:boolean;lastActor?:Actor;projectTimer?:ReturnType<typeof setTimeout>;cleanupTimer?:ReturnType<typeof setTimeout>};
export interface CollaborationOptions {server:Server;repo:Repository;auth:Auth;db:DatabaseSync;allowedOrigins?:string[];publicUrl?:string;logger?:(message:string,error?:unknown)=>void}
const send=(socket:WebSocket,bytes:Uint8Array)=>{if(socket.readyState===WebSocket.OPEN)socket.send(bytes);};
const meta=(socket:WebSocket,value:Record<string,unknown>)=>{const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,4);encoding.writeVarString(encoder,JSON.stringify(value));send(socket,encoding.toUint8Array(encoder));};
export function createCollaboration({server,repo,auth,db,allowedOrigins=[],publicUrl,logger}:CollaborationOptions) {
  db.exec(`CREATE TABLE IF NOT EXISTS collaboration_documents(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,state BLOB NOT NULL,projection TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS collaboration_updates(seq INTEGER PRIMARY KEY AUTOINCREMENT,document_id TEXT NOT NULL,update_data BLOB NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS collaboration_updates_document ON collaboration_updates(document_id,seq);
    CREATE TABLE IF NOT EXISTS collaboration_rooms(room_key TEXT PRIMARY KEY,kind TEXT NOT NULL,entity_id TEXT NOT NULL,field TEXT NOT NULL,workspace_id TEXT NOT NULL,state BLOB NOT NULL,projection TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS collaboration_room_updates(seq INTEGER PRIMARY KEY AUTOINCREMENT,room_key TEXT NOT NULL,update_data BLOB NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS collaboration_room_updates_key ON collaboration_room_updates(room_key,seq);`);
  repo.transaction(()=>{
    db.exec(`INSERT INTO collaboration_room_updates(room_key,update_data,created_at) SELECT json_array('documents',document_id,'content'),update_data,created_at FROM collaboration_updates WHERE NOT EXISTS(SELECT 1 FROM collaboration_rooms WHERE room_key=json_array('documents',document_id,'content'));
      INSERT OR IGNORE INTO collaboration_rooms(room_key,kind,entity_id,field,workspace_id,state,projection,updated_at) SELECT json_array('documents',id,'content'),'documents',id,'content',workspace_id,state,projection,updated_at FROM collaboration_documents;`);
  });
  const authorship=new CollaborationAuthorship(db);
  const rooms=new Map<string,Room>(),wss=new WebSocketServer({noServer:true,maxPayload:512*1024,perMessageDeflate:false});let closed=false;
  function access(connection:Connection,room:Room,write=false) {const actor=auth.resolve(connection.request);if(!actor)throw Error('Session expired');const entity=repo.get(actor,room.kind,room.id);repo.access(actor,room.kind,entity,write);connection.actor=actor;return actor;}
  function publishAuthorship(room:Room,ranges:AuthorshipRange[]){if(!ranges.length)return;for(const connection of room.connections){try{access(connection,room);meta(connection.socket,{authorship:ranges})}catch{connection.socket.close(4403,'Document access was removed')}}}
  function snapshot(room:Room){if(room.purged)return;const state=Y.encodeStateAsUpdate(room.doc);db.prepare('INSERT INTO collaboration_rooms(room_key,kind,entity_id,field,workspace_id,state,projection,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(room_key) DO UPDATE SET state=excluded.state,projection=excluded.projection,updated_at=excluded.updated_at').run(room.key,room.kind,room.id,room.field,room.workspaceId,state,room.html,new Date().toISOString());db.prepare('DELETE FROM collaboration_room_updates WHERE room_key=?').run(room.key);room.updates=0;}
  function project(room:Room){if(room.purged)return;clearTimeout(room.projectTimer);room.projectTimer=undefined;try{const html=documentHtml(room.doc);const empty=(value:string)=>value.replace(/<\/?(?:p|div)>|<br\s*\/?>|&nbsp;|&#160;|\s/gi,'')==='';if(html===room.html||isEditorInitializationHtml(html,room.normalizedHtml)||empty(html)&&empty(room.html))return;const actor=room.lastActor;if(!actor)return;const current=repo.raw(room.kind,room.id);if(!current)return;const role=repo.role(actor.userId,actor.workspaceId);actor.role=actor.appId&&role!=='none'?'member':role;if(actor.tokenId&&!db.prepare('SELECT id FROM api_tokens WHERE id=? AND (expires_at IS NULL OR expires_at>?)').get(actor.tokenId,new Date().toISOString()))throw Error('Credential expired');repo.access(actor,room.kind,current,true);const before=room.html,beforeNormalized=room.normalizedHtml;room.html=html;room.normalizedHtml=html;try{repo.update(actor,room.kind,room.id,{[room.field]:html});}catch(error){room.html=before;room.normalizedHtml=beforeNormalized;throw error;}}catch(error){logger?.('Collaborative content projection failed',error);}}
  function revalidate(room:Room){for(const connection of room.connections){try{access(connection,room);}catch{connection.socket.close(4403,'Document access was removed');}}}
  function getRoom(target:CollaborationTarget,actor:Actor,eventEntity?:RecordEntity):Room {
    const {id,kind}=target,key=collaborationRoomKey(target),field=collaborationFields[kind];
    const existing=rooms.get(key);if(existing){clearTimeout(existing.cleanupTimer);return existing;}
    const authorized=repo.get(actor,kind,id),entity=eventEntity||authorized,doc=new Y.Doc(),stored=db.prepare('SELECT state,projection FROM collaboration_rooms WHERE room_key=?').get(key) as {state:Uint8Array;projection:string}|undefined;
    if(stored){Y.applyUpdate(doc,new Uint8Array(stored.state));for(const row of db.prepare('SELECT update_data FROM collaboration_room_updates WHERE room_key=? ORDER BY seq').all(key) as {update_data:Uint8Array}[])Y.applyUpdate(doc,new Uint8Array(row.update_data));}
    else {const prior=entity.version>1?entity.history?.at(-1)?.content:undefined;importDocumentHtml(doc,prior??entity[field]??'','bootstrap');}
    authorship.record(key,Y.encodeStateAsUpdate(doc),!stored&&(entity.version===1||entity.version===2&&entity.history?.length===1)?(entity.creatorId||null):null);
    // API writes made while no room was active replace the saved projection on the next opening.
    if(stored?stored.projection!==(entity[field]??''):entity.version>1&&typeof entity.history?.at(-1)?.content==='string'){const vector=Y.encodeStateVector(doc);importDocumentHtml(doc,entity[field]??'','bootstrap');authorship.record(key,Y.encodeStateAsUpdate(doc,vector),entity.lastEditedBy||null);}
    const awareness=new Awareness(doc);awareness.setLocalState(null);
    const room:Room={key,id,kind,field,workspaceId:entity.workspaceId,doc,awareness,connections:new Set(),html:entity[field]??'',normalizedHtml:normalizedDocumentHtml(entity[field]??''),updates:0,lastActor:actor};rooms.set(key,room);snapshot(room);
    if(stored){room.projectTimer=setTimeout(()=>project(room),700);room.projectTimer.unref();}
    doc.on('update',(update:Uint8Array,origin:unknown)=>{
      if(closed||room.purged)return;
      db.prepare('INSERT INTO collaboration_room_updates(room_key,update_data,created_at) VALUES(?,?,?)').run(key,update,new Date().toISOString());room.updates++;
      const source=origin&&typeof origin==='object'&&'socket'in origin?origin as Connection:undefined;
      if(source){room.lastActor=source.actor;clearTimeout(room.projectTimer);room.projectTimer=setTimeout(()=>project(room),700);meta(source.socket,{saved:true});}
      const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,0);sync.writeUpdate(encoder,update);const packet=encoding.toUint8Array(encoder);
      for(const connection of room.connections)if(connection!==source){try{access(connection,room);send(connection.socket,packet);}catch{connection.socket.close(4403,'Document access was removed');}}
      if(room.updates>=128)repo.transaction(()=>snapshot(room));
    });
    awareness.on('update',({added,updated,removed}:{added:number[];updated:number[];removed:number[]},origin:unknown)=>{
      const source=origin&&typeof origin==='object'&&'socket'in origin?origin as Connection:undefined;
      if(source){added.forEach(id=>source.clients.add(id));removed.forEach(id=>source.clients.delete(id));}
      const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,1);encoding.writeVarUint8Array(encoder,encodeAwarenessUpdate(awareness,[...added,...updated,...removed]));const packet=encoding.toUint8Array(encoder);
      for(const connection of room.connections)if(connection!==source)send(connection.socket,packet);
    });
    return room;
  }
  const upgrade=(request:IncomingMessage,socket:any,head:Buffer)=>{
    const url=new URL(request.url??'/',`http://${request.headers.host}`),path=url.pathname;if(!path.startsWith('/collaboration/'))return;
    try{
      if(closed)throw Error('Closing');const match=path.match(/^\/collaboration\/([^/]+)\/([^/]+)$/);if(!match)throw Error('Unknown editor room');
      const origin=request.headers.origin,expected=`${(request.socket as any).encrypted?'https':'http'}://${request.headers.host}`;
      if(origin&&origin!==expected&&origin!==(publicUrl?new URL(publicUrl).origin:undefined)&&!allowedOrigins.includes(origin))throw Error('Origin is not allowed');
      const actor=auth.resolve(request);if(!actor)throw Error('Authentication required');const target=resolveCollaborationTarget(match[1],decodeURIComponent(match[2]),url.searchParams.get('field'));if(!target)throw Error('Unsupported collaborative field');repo.get(actor,target.kind,target.id);
      const room=getRoom(target,actor);wss.handleUpgrade(request,socket,head,ws=>connect(ws,request,actor,room));
    }catch{socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();}
  };
  function connect(socket:WebSocket,request:IncomingMessage,actor:Actor,room:Room){
    const connection:Connection={socket,request,actor,clients:new Set(),alive:true};room.connections.add(connection);let writable=true;try{access(connection,room,true);}catch{writable=false;}
    meta(socket,{readOnly:!writable,authorship:authorship.read(room.key),authorshipReset:true});
    const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,0);sync.writeSyncStep2(encoder,room.doc);send(socket,encoding.toUint8Array(encoder));
    if(writable){const step=encoding.createEncoder();encoding.writeVarUint(step,0);sync.writeSyncStep1(step,room.doc);send(socket,encoding.toUint8Array(step));}
    const ids=[...room.awareness.getStates().keys()];if(ids.length){const awareness=encoding.createEncoder();encoding.writeVarUint(awareness,1);encoding.writeVarUint8Array(awareness,encodeAwarenessUpdate(room.awareness,ids));send(socket,encoding.toUint8Array(awareness));}
    socket.on('pong',()=>{connection.alive=true;});
    socket.on('message',(raw,isBinary)=>{
      try{
        if(!isBinary)throw Error('Binary messages required');access(connection,room);const bytes=new Uint8Array(raw as Buffer),decoder=decoding.createDecoder(bytes),type=decoding.readVarUint(decoder);
        if(type===0){const probe=decoding.createDecoder(bytes);decoding.readVarUint(probe);const syncType=decoding.readVarUint(probe);if(syncType!==sync.messageYjsSyncStep1)access(connection,room,true);const reply=encoding.createEncoder();encoding.writeVarUint(reply,0);let additions:AuthorshipRange[]=[];repo.transaction(()=>{if(syncType===sync.messageYjsSyncStep2||syncType===sync.messageYjsUpdate)additions=authorship.record(room.key,decoding.readVarUint8Array(probe),connection.actor.userId);sync.readSyncMessage(decoder,reply,room.doc,connection)});publishAuthorship(room,additions);if(encoding.length(reply)>1)send(socket,encoding.toUint8Array(reply));}
        else if(type===1){const update=decoding.readVarUint8Array(decoder);if(update.length>64*1024)throw Error('Awareness update too large');const input=decoding.createDecoder(update),count=decoding.readVarUint(input);if(count>4)throw Error('Too many awareness states');const output=encoding.createEncoder();encoding.writeVarUint(output,count);const user=repo.raw('users',connection.actor.userId);for(let i=0;i<count;i++){const id=decoding.readVarUint(input),clock=decoding.readVarUint(input),state=JSON.parse(decoding.readVarString(input));if([...room.connections].some(other=>other!==connection&&other.clients.has(id)))throw Error('Awareness state belongs to another connection');encoding.writeVarUint(output,id);encoding.writeVarUint(output,clock);encoding.writeVarString(output,JSON.stringify(state===null?null:{cursor:state.cursor,user:{id:connection.actor.userId,name:user?.name??'Member',color:/^#[0-9a-f]{6}$/i.test(user?.avatarColor??'')?user!.avatarColor:'#7c7fe0'}}));}applyAwarenessUpdate(room.awareness,encoding.toUint8Array(output),connection);}
        else throw Error('Unknown collaboration message');
      }catch(error){socket.close(4403,'Invalid update or document access denied');logger?.('Collaborative update rejected',error);}
    });
    socket.on('error',()=>{});
    socket.on('close',()=>{if(closed||room.purged)return;room.connections.delete(connection);removeAwarenessStates(room.awareness,[...connection.clients],connection);project(room);if(!room.connections.size){room.cleanupTimer=setTimeout(()=>{if(!room.connections.size){project(room);repo.transaction(()=>snapshot(room));rooms.delete(room.key);room.awareness.destroy();room.doc.destroy();}},30000);room.cleanupTimer.unref();}});
  }
  server.on('upgrade',upgrade);
  const heartbeat=setInterval(()=>{for(const room of rooms.values()){revalidate(room);for(const connection of room.connections){if(!connection.alive){connection.socket.terminate();continue;}connection.alive=false;connection.socket.ping();}}},15000);heartbeat.unref();
  return {
    handleChanges(changes:Change[]){
      for(const room of rooms.values())revalidate(room);
      for(const change of changes){
        const target=resolveCollaborationTarget(change.kind,change.id);if(!target)continue;const key=collaborationRoomKey(target);let room=rooms.get(key);
        if(change.action==='purge'||change.entity.permanentlyDeleted){authorship.remove(key);if(room){room.purged=true;clearTimeout(room.projectTimer);clearTimeout(room.cleanupTimer);rooms.delete(key);for(const connection of room.connections)connection.socket.close(4403,'Content was permanently deleted');room.connections.clear();room.awareness.destroy();room.doc.destroy()}continue}
        if(change.entity.deletedAt){if(room)for(const connection of room.connections)connection.socket.close(4403,'Content was deleted');continue}
        if(!room){
          if(change.kind!=='documents'&&change.kind!=='projects')continue;const actor=repo.actorForUser(change.actorId,change.workspaceId);if(actor.role==='none')continue;
          room=getRoom(target,actor,change.entity);const idle=room;idle.cleanupTimer=setTimeout(()=>{if(!idle.connections.size&&!idle.purged){project(idle);repo.transaction(()=>snapshot(idle));rooms.delete(idle.key);idle.awareness.destroy();idle.doc.destroy()}},30000);idle.cleanupTimer.unref();
        }
        const html=change.entity[room.field]??'';if(html===room.html)continue;
        clearTimeout(room.projectTimer);room.html=html;room.normalizedHtml=normalizedDocumentHtml(html);
        try{const vector=Y.encodeStateVector(room.doc);importDocumentHtml(room.doc,html,'api');const updated=room;let additions:AuthorshipRange[]=[];repo.transaction(()=>{additions=authorship.record(updated.key,Y.encodeStateAsUpdate(updated.doc,vector),change.actorId||null);snapshot(updated)});publishAuthorship(updated,additions)}
        catch(error){logger?.('Unable to synchronize content API update',error);for(const connection of room.connections)connection.socket.close(1011,'Content changed; reconnect')}
      }
    },
    close(){closed=true;server.off('upgrade',upgrade);clearInterval(heartbeat);for(const room of rooms.values()){clearTimeout(room.cleanupTimer);project(room);repo.transaction(()=>snapshot(room));for(const connection of room.connections)connection.socket.terminate();room.awareness.destroy();room.doc.destroy();}rooms.clear();wss.close();},
  };
}
