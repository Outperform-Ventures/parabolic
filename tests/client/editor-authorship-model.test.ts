import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import * as Y from 'yjs';
import {createAuthorshipReader,combineAuthorLabels} from '../../src/client/editor-authorship-model';
import {CollaborationAuthorship} from '../../src/server/collaboration-authorship';
import {importDocumentHtml} from '../../src/server/collaboration-schema';

test('authorship includes inline atoms while excluding deleted text and formatting-only authors',()=>{
 const db=new DatabaseSync(':memory:'),ledger=new CollaborationAuthorship(db),doc=new Y.Doc();
 try{
  importDocumentHtml(doc,'<p>Original</p><p><span data-date="2026-09-06">Sep 6</span></p><p><span data-mention-id="user" data-mention-kind="user" data-mention-label="Reader">@Reader</span></p>');ledger.record('room',Y.encodeStateAsUpdate(doc),'owner');const root=doc.getXmlFragment('default');
  let owners=createAuthorshipReader(ledger.read('room'));assert.deepEqual(owners(root.get(1) as Y.XmlElement),['owner']);assert.deepEqual(owners(root.get(2) as Y.XmlElement),['owner']);
  const text=(root.get(0) as Y.XmlElement).get(0) as Y.XmlText;let vector=Y.encodeStateVector(doc);text.insert(0,'Added ');ledger.record('room',Y.encodeStateAsUpdate(doc,vector),'colleague');owners=createAuthorshipReader(ledger.read('room'));assert.deepEqual(owners(root.get(0) as Y.XmlElement),['colleague','owner']);
  vector=Y.encodeStateVector(doc);text.format(0,text.length,{bold:{}});ledger.record('room',Y.encodeStateAsUpdate(doc,vector),'formatter');assert.deepEqual(createAuthorshipReader(ledger.read('room'))(root.get(0) as Y.XmlElement),['colleague','owner']);
  text.delete(0,6);assert.deepEqual(createAuthorshipReader(ledger.read('room'))(root.get(0) as Y.XmlElement),['owner']);assert.deepEqual(createAuthorshipReader([])(root.get(1) as Y.XmlElement),[null]);
 }finally{doc.destroy();db.close()}
});

test('gutter labels combine intersecting table cells without dropping authors or mutating input',()=>{
 const input=[{position:9,top:100,authors:['second']},{position:1,top:100,authors:['first']},{position:20,top:110,authors:['first',null]},{position:30,top:121,authors:['third']}];
 assert.deepEqual(combineAuthorLabels(input,20),[{position:1,top:100,authors:['first','second',null]},{position:30,top:121,authors:['third']}]);assert.deepEqual(input[1].authors,['first']);
 assert.equal(combineAuthorLabels([{position:1,top:0,authors:['first']},{position:2,top:20,authors:['first']}],20).length,2);
});
