import {pendingSaves} from './pending-saves';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import * as sync from 'y-protocols/sync';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { IndexeddbPersistence } from 'y-indexeddb';
import {cacheCollaborationMetadata,readCollaborationMetadata} from './collaboration-cache';
import {CollaborationRecovery} from './collaboration-recovery';
import { useAppStore } from './store';
import { collaborationFields, type CollaborationTarget, type AuthorshipRange } from '../shared/collaboration';
export type { CollaborationTarget } from '../shared/collaboration';

export interface CollaborationState {authorship:readonly AuthorshipRange[];doc:Y.Doc;provider:DocumentProvider;ready:boolean;status:'connecting'|'connected'|'offline'|'denied';readOnly:boolean;error:string;user:{id:string;name:string;color:string}}
/** A provider for the Yjs sync and awareness protocols, with authenticated same-origin sockets. */
export class DocumentProvider {
  readonly doc=new Y.Doc();readonly awareness=new Awareness(this.doc);readonly persistence:IndexeddbPersistence;private recovery:CollaborationRecovery;
  authorship:readonly AuthorshipRange[]=[];
  ready=false;status:CollaborationState['status']='connecting';readOnly=false;error='';
  private socket?:WebSocket;private stopped=false;private hydrated=false;private retry=0;private reconnect?:ReturnType<typeof setTimeout>;
  private listeners=new Set<()=>void>();
  private saveRevision=0;private savedRevision=0;private unregisterSave?:()=>void;private persistenceClosed=false;
  constructor(readonly target:CollaborationTarget,readonly user:CollaborationState['user'],readonly workspaceId:string){
    const key=target.kind==='documents'?target.id:JSON.stringify([target.kind,target.id,collaborationFields[target.kind]]);
    this.persistence=new IndexeddbPersistence(`parabolic:collaboration:${location.origin}:${workspaceId}:${user.id}:${key}`,this.doc);
    this.recovery=new CollaborationRecovery(sessionStorage,this.persistence.name+':pending');
    this.unregisterSave=pendingSaves.register(()=>this.flushForRestart());
    this.awareness.setLocalStateField('user',user);
    this.doc.on('update',this.onUpdate);this.awareness.on('update',this.onAwareness);
    // Cached CRDT state is hydrated before a socket starts exchanging state vectors.
    void this.persistence.whenSynced.then(async()=>{
      if(this.stopped)return;
      try{const pending=this.recovery.read();if(pending){Y.applyUpdate(this.doc,pending,'recovery');this.recovery.record(pending,this.persistence.db!);}}catch{this.error='Unable to recover unsaved editor changes on this device';}
      try{const cached=await readCollaborationMetadata(this.persistence.db!);if(this.stopped)return;this.authorship=cached.authorship;if(typeof cached.readOnly==='boolean')this.readOnly=cached.readOnly;}catch{/* Text remains usable if optional metadata cannot be read. */}
      if(this.stopped)return;this.hydrated=true;if(this.doc.getXmlFragment('default').length){this.ready=true;this.emit();}this.connect();
    });
    window.addEventListener('online',this.onOnline);window.addEventListener('offline',this.onOffline);
  }
  subscribe(callback:()=>void){this.listeners.add(callback);return()=>{this.listeners.delete(callback);};}
  snapshot():CollaborationState{return {authorship:this.authorship,doc:this.doc,provider:this,ready:this.ready,status:this.status,readOnly:this.readOnly,error:this.error,user:this.user};}
  private emit(){for(const callback of this.listeners)callback();}
  private send(bytes:Uint8Array){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(new Uint8Array(bytes).buffer);}
  private onUpdate=(update:Uint8Array,origin:unknown)=>{if(origin===this||origin===this.persistence||origin==='recovery'||this.readOnly)return;this.saveRevision++;pendingSaves.changed();try{if(this.persistence.db)this.recovery.record(update,this.persistence.db)}catch{this.error='Unable to save editor changes on this device';this.emit();}const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,0);sync.writeUpdate(encoder,update);this.send(encoding.toUint8Array(encoder));};
  private onAwareness=({added,updated,removed}:{added:number[];updated:number[];removed:number[]},origin:unknown)=>{if(origin===this)return;const changed=[...added,...updated,...removed].filter(id=>id===this.doc.clientID);if(!changed.length)return;const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,1);encoding.writeVarUint8Array(encoder,encodeAwarenessUpdate(this.awareness,changed));this.send(encoding.toUint8Array(encoder));};
  private onOnline=()=>{if(this.status!=='denied'&&!this.stopped){clearTimeout(this.reconnect);this.connect();}};
  private onOffline=()=>{this.status='offline';this.emit();};
  private connect(){
    if(this.stopped||!this.hydrated||this.socket?.readyState===WebSocket.OPEN||this.socket?.readyState===WebSocket.CONNECTING)return;
    this.status=navigator.onLine?'connecting':'offline';this.emit();
    const url=new URL(`/collaboration/${this.target.kind}/${encodeURIComponent(this.target.id)}`,location.origin);url.searchParams.set('field',collaborationFields[this.target.kind]);url.protocol=url.protocol==='https:'?'wss:':'ws:';
    const socket=new WebSocket(url);this.socket=socket;socket.binaryType='arraybuffer';
    socket.onopen=()=>{
      if(this.stopped)return;this.retry=0;this.status='connected';this.error='';this.emit();
      const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,0);sync.writeSyncStep1(encoder,this.doc);this.send(encoding.toUint8Array(encoder));
      this.onAwareness({added:[this.doc.clientID],updated:[],removed:[]},null);
    };
    socket.onmessage=event=>{
      try{const decoder=decoding.createDecoder(new Uint8Array(event.data)),type=decoding.readVarUint(decoder);
        if(type===0){const encoder=encoding.createEncoder();encoding.writeVarUint(encoder,0);const syncType=sync.readSyncMessage(decoder,encoder,this.doc,this);if(encoding.length(encoder)>1&&!this.readOnly)this.send(encoding.toUint8Array(encoder));if(syncType===sync.messageYjsSyncStep2){this.ready=true;this.emit();}}
        else if(type===1)applyAwarenessUpdate(this.awareness,decoding.readVarUint8Array(decoder),this);
        else if(type===4){const meta=JSON.parse(decoding.readVarString(decoder));let changed=false;if(typeof meta.readOnly==='boolean'){this.readOnly=meta.readOnly;changed=true;}if(Array.isArray(meta.authorship)){this.authorship=meta.authorshipReset?meta.authorship:[...this.authorship,...meta.authorship];changed=true;}if(changed){if(this.persistence.db)void cacheCollaborationMetadata(this.persistence.db,meta).catch(()=>{});this.emit();}}
      }catch{this.error='Editor synchronization failed';this.emit();socket.close(1002,'Invalid collaboration data');}
    };
    socket.onerror=()=>{};
    socket.onclose=event=>{
      if(this.stopped)return;this.socket=undefined;removeAwarenessStates(this.awareness,[...this.awareness.getStates().keys()].filter(id=>id!==this.doc.clientID),this);
      if(event.code===4401||event.code===4403){this.status='denied';this.readOnly=true;this.authorship=[];this.error='Your access to this content changed. Reload to check your permissions.';this.recovery.clear();void this.persistence.clearData();}
      else{this.status='offline';this.error='';this.reconnect=setTimeout(()=>this.connect(),Math.min(10000,500*2**this.retry++));}
      this.emit();
    };
  }
  private accessDenied(){return this.status==='denied';}
  async flushForRestart(){
    if(this.persistenceClosed)return;
    if(!this.accessDenied()){
      await this.persistence.whenSynced;
      if(this.persistenceClosed)return;
      if(!this.accessDenied()){
        const database=this.persistence.db;if(!database)throw Error('Editor storage is not ready.');
        const revision=this.saveRevision,dirty=revision!==this.savedRevision;
        await new Promise<void>((resolve,reject)=>{
          const tx=database.transaction('updates',dirty?'readwrite':'readonly');
          tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??Error('Unable to save editor changes.'));tx.onabort=()=>reject(tx.error??Error('Editor save was interrupted.'));
          // A full state snapshot also repairs a previous failed incremental
          // write. Yjs merges duplicate updates without duplicating content.
          if(dirty)tx.objectStore('updates').add(Y.encodeStateAsUpdate(this.doc));
        });
        this.savedRevision=revision;
      }
    }
    if(this.stopped&&!this.persistenceClosed){
      this.persistenceClosed=true;this.unregisterSave?.();this.unregisterSave=undefined;
      await this.persistence.destroy();this.doc.destroy();
    }
  }

  destroy(){this.stopped=true;clearTimeout(this.reconnect);this.awareness.setLocalState(null);this.socket?.close(1000,'Editor closed');window.removeEventListener('online',this.onOnline);window.removeEventListener('offline',this.onOffline);this.doc.off('update',this.onUpdate);this.awareness.off('update',this.onAwareness);this.awareness.destroy();this.listeners.clear();void this.flushForRestart().catch(()=>{/* Retain the document and save registration for a later durability retry. */});}
}

export function useDocumentCollaboration(target?:CollaborationTarget):CollaborationState|null {
  const store=useAppStore();const [state,setState]=useState<CollaborationState|null>(null);
  const id=target?.id,kind=target?.kind,field=target?.field,userId=store.user?.id,workspaceId=store.data.workspaceId;
  useEffect(()=>{
    if(!id||!kind||!userId||!workspaceId){setState(null);return;}
    const current=store.data.users.find(user=>user.id===userId)??store.user!;
    const provider=new DocumentProvider({kind,id,field} as CollaborationTarget,{id:userId,name:current.name??'Member',color:/^#[0-9a-f]{6}$/i.test(current.avatarColor??'')?current.avatarColor:'#7c7fe0'},workspaceId);
    const update=()=>setState(provider.snapshot());update();const unsubscribe=provider.subscribe(update);
    return()=>{unsubscribe();provider.destroy();};
  },[id,kind,field,userId,workspaceId]);
  return state&&state.provider.target.id===id&&state.provider.target.kind===kind&&state.user.id===userId&&state.provider.workspaceId===workspaceId?state:null;
}
