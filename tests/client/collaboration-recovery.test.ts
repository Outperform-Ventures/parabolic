import {test} from 'node:test';import assert from 'node:assert/strict';import * as Y from 'yjs';
import {CollaborationRecovery} from '../../src/client/collaboration-recovery';
test('reload recovery retains uncommitted updates until the newest IndexedDB write barrier completes',()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}};
 const transactions:{oncomplete?:()=>void}[]=[],db={transaction:()=>{const tx={};transactions.push(tx);return tx}} as unknown as IDBDatabase;
 const original=new Y.Doc(),reloaded=new Y.Doc(),journal=new CollaborationRecovery(storage,'room');
 try{
  let vector=Y.encodeStateVector(original);original.getText('text').insert(0,'First');journal.record(Y.encodeStateAsUpdate(original,vector),db);
  vector=Y.encodeStateVector(original);original.getText('text').insert(5,' second');journal.record(Y.encodeStateAsUpdate(original,vector),db);
  transactions[0].oncomplete!();assert(journal.read());const freshJournal=new CollaborationRecovery(storage,'room');Y.applyUpdate(reloaded,freshJournal.read()!);assert.equal(reloaded.getText('text').toString(),'First second');
  transactions[1].oncomplete!();assert.equal(journal.read(),null);
  journal.record(Y.encodeStateAsUpdate(original),db);journal.clear();transactions[2].oncomplete!();assert.equal(journal.read(),null);
  assert.equal(new CollaborationRecovery(storage,'another-room').read(),null);
 }finally{original.destroy();reloaded.destroy()}
});
