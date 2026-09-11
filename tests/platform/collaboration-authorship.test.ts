import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import * as Y from 'yjs';
import {CollaborationAuthorship,type AuthorshipRange} from '../../src/server/collaboration-authorship.ts';
const author=(ranges:AuthorshipRange[],text:Y.Text,index:number)=>{const item=Y.createRelativePositionFromTypeIndex(text,index).item;assert(item);return ranges.find(range=>range.client===item.client&&item.clock>=range.clock&&item.clock<range.clock+range.length)?.userId};
test('provenance follows immutable character IDs through concurrent edits and cannot be reassigned by replay',()=>{
 const db=new DatabaseSync(':memory:'),ledger=new CollaborationAuthorship(db),alice=new Y.Doc(),bob=new Y.Doc();try{
 alice.getText('text').insert(0,'Original');const base=Y.encodeStateAsUpdate(alice);ledger.record('room',base,'alice');Y.applyUpdate(bob,base);const vector=Y.encodeStateVector(bob);bob.getText('text').insert(3,'Bob');const edit=Y.encodeStateAsUpdate(bob,vector);ledger.record('room',edit,'bob');Y.applyUpdate(alice,edit);
 ledger.record('room',Y.encodeStateAsUpdate(alice),'mallory');const ranges=ledger.read('room');assert.equal(author(ranges,alice.getText('text'),0),'alice');assert.equal(author(ranges,alice.getText('text'),3),'bob');assert.equal(author(ranges,alice.getText('text'),6),'alice');assert.equal(ranges.some(range=>range.userId==='mallory'),false);
 bob.getText('text').delete(0,2);ledger.record('room',Y.encodeStateAsUpdate(bob),'mallory');assert.equal(author(ledger.read('room'),bob.getText('text'),1),'bob');
 }finally{alice.destroy();bob.destroy();db.close()}
});
test('out-of-order causal updates retain the authenticated sender of each accepted interval',()=>{
 const db=new DatabaseSync(':memory:'),ledger=new CollaborationAuthorship(db),writer=new Y.Doc(),replica=new Y.Doc();try{
 const packets:Uint8Array[]=[];writer.on('update',update=>packets.push(update));writer.getText('text').insert(0,'A');writer.getText('text').insert(1,'B');ledger.record('room',packets[1],'second');Y.applyUpdate(replica,packets[1]);ledger.record('room',packets[0],'first');Y.applyUpdate(replica,packets[0]);assert.equal(replica.getText('text').toString(),'AB');assert.equal(author(ledger.read('room'),replica.getText('text'),0),'first');assert.equal(author(ledger.read('room'),replica.getText('text'),1),'second');
 }finally{writer.destroy();replica.destroy();db.close()}
});
test('legacy unknown authors stay unknown, malformed messages add nothing, and room cleanup is isolated',()=>{
 const db=new DatabaseSync(':memory:'),ledger=new CollaborationAuthorship(db),doc=new Y.Doc();try{
 doc.getText('text').insert(0,'Legacy');const update=Y.encodeStateAsUpdate(doc);ledger.record('legacy',update,null);ledger.record('legacy',update,'viewer');assert.equal(author(ledger.read('legacy'),doc.getText('text'),0),null);ledger.record('other',update,'owner');assert.throws(()=>ledger.record('broken',new Uint8Array([255]),'viewer'));assert.equal(ledger.read('broken').length,0);ledger.remove('legacy');assert.equal(ledger.read('legacy').length,0);assert.equal(author(ledger.read('other'),doc.getText('text'),0),'owner');
 }finally{doc.destroy();db.close()}
});
