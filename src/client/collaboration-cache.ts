import type {AuthorshipRange} from '../shared/collaboration';

const prefix='parabolic:authorship:v1:',permissionKey='parabolic:collaboration-permission:v1';
const rangeKeys=()=>IDBKeyRange.bound(prefix,prefix+'\uffff');
const validRange=(value:unknown):value is AuthorshipRange=>{
 if(!value||typeof value!=='object')return false;
 const r=value as AuthorshipRange;
 return Number.isSafeInteger(r.client)&&r.client>=0&&Number.isSafeInteger(r.clock)&&r.clock>=0&&Number.isSafeInteger(r.length)&&r.length>0&&Number.isSafeInteger(r.clock+r.length)&&(r.userId===null||typeof r.userId==='string');
};
/** Metadata shares the existing origin/workspace/user/room-scoped Yjs database.
 * Only server metadata is written here; cached attribution is never sent back
 * as an authorship claim. Individual rows keep writes proportional to updates.
 */
export function cacheCollaborationMetadata(db:IDBDatabase,meta:{authorship?:AuthorshipRange[];authorshipReset?:boolean;readOnly?:boolean}):Promise<void>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('custom','readwrite'),store=tx.objectStore('custom');
  if(meta.authorshipReset)store.delete(rangeKeys());
  for(const range of meta.authorship||[])if(validRange(range))store.put(range,prefix+range.client+':'+range.clock);
  if(typeof meta.readOnly==='boolean')store.put(meta.readOnly,permissionKey);
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('Unable to cache collaboration metadata'));tx.onerror=()=>{};
 });
}
export function readCollaborationMetadata(db:IDBDatabase):Promise<{authorship:AuthorshipRange[];readOnly?:boolean}>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('custom','readonly'),store=tx.objectStore('custom'),ranges=store.getAll(rangeKeys()),permission=store.get(permissionKey);
  tx.oncomplete=()=>resolve({authorship:(ranges.result as unknown[]).filter(validRange),...(typeof permission.result==='boolean'?{readOnly:permission.result}:{})});
  tx.onabort=()=>reject(tx.error||Error('Unable to load collaboration metadata'));tx.onerror=()=>{};
 });
}
