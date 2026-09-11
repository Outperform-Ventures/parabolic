import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DurableDraftStorage} from '../../src/client/durable-draft-storage';
import {PendingSaves} from '../../src/client/pending-saves';

test('Issue draft fallback survives storage failure and blocks restart until the latest revision is persisted',async()=>{
  const coordinator=new PendingSaves(),values=new Map<string,string>();let full=true;
  const drafts=new DurableDraftStorage(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(full)throw Error('Disk full');values.set(key,value);}}),coordinator);
  assert.equal(drafts.set('workspace:author','first'),false);assert.equal(drafts.set('workspace:author','newest'),false);
  assert.equal(drafts.get('workspace:author'),'newest');await assert.rejects(coordinator.flush(),AggregateError);
  assert.equal(drafts.get('workspace:author'),'newest');full=false;await coordinator.flush();assert.equal(values.get('workspace:author'),'newest');
  assert.equal(drafts.set('workspace:author','after retry'),true);await coordinator.flush();assert.equal(values.get('workspace:author'),'after retry');
});

test('Draft fallback isolates accounts and preserves removal across storage failures',async()=>{
  const coordinator=new PendingSaves(),values=new Map<string,string>();let full=false;
  const drafts=new DurableDraftStorage(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(full)throw Error('Quota exceeded');values.set(key,value);}}),coordinator);
  drafts.set('alice','[{"id":"draft"}]');drafts.set('bob','[{"id":"other"}]');full=true;
  assert.equal(drafts.set('alice','[]'),false);assert.equal(drafts.get('alice'),'[]');assert.equal(drafts.get('bob'),'[{"id":"other"}]');
  full=false;await coordinator.flush();assert.equal(values.get('alice'),'[]');assert.equal(values.get('bob'),'[{"id":"other"}]');
});

test('Draft retry retains remaining entries after a partial storage failure',async()=>{
  const coordinator=new PendingSaves(),values=new Map<string,string>();let available='none';
  const drafts=new DurableDraftStorage(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(available!=='all'&&available!==key)throw Error('Storage unavailable');values.set(key,value);}}),coordinator);
  drafts.set('one','one value');drafts.set('two','two value');available='one';await assert.rejects(coordinator.flush(),AggregateError);
  assert.equal(values.get('one'),'one value');assert.equal(drafts.get('two'),'two value');available='all';await coordinator.flush();assert.equal(values.get('two'),'two value');
});

test('Draft recovery applies failed edits to the latest collection without dropping another window drafts',async()=>{
  const coordinator=new PendingSaves(),values=new Map<string,string>();let full=false;
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(full)throw Error('Quota exceeded');values.set(key,value);}};
  const first=new DurableDraftStorage(()=>storage,coordinator),second=new DurableDraftStorage(()=>storage,new PendingSaves());
  const put=(id:string,title:string)=>(current:string|null)=>JSON.stringify([...JSON.parse(current??'[]').filter((row:any)=>row.id!==id),{id,title}]);
  first.update('drafts',put('one','Original'),'one');full=true;
  assert.equal(first.update('drafts',put('one','Pending edit'),'one'),false);
  full=false;second.update('drafts',put('two','Other window'),'two');
  assert.deepEqual(JSON.parse(first.get('drafts')!).map((row:any)=>row.id).sort(),['one','two']);
  await coordinator.flush();const rows=JSON.parse(values.get('drafts')!);
  assert.deepEqual(rows.find((row:any)=>row.id==='one'),{id:'one',title:'Pending edit'});assert.deepEqual(rows.find((row:any)=>row.id==='two'),{id:'two',title:'Other window'});
});

test('Draft deletion recovery preserves new unrelated drafts and compacts repeated edits to one draft',async()=>{
  const coordinator=new PendingSaves(),values=new Map([['drafts','[{"id":"old"}]']]);let full=true,calls=0;
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(full)throw Error('Quota exceeded');values.set(key,value);}};
  const drafts=new DurableDraftStorage(()=>storage,coordinator);
  drafts.update('drafts',value=>JSON.stringify(JSON.parse(value??'[]').filter((row:any)=>row.id!=='old')),'old');
  for(let index=0;index<100;index++)drafts.update('drafts',value=>{calls++;return JSON.stringify([...JSON.parse(value??'[]').filter((row:any)=>row.id!=='new'),{id:'new',title:String(index)}]);},'new');
  values.set('drafts','[{"id":"old"},{"id":"other"}]');calls=0;full=false;await coordinator.flush();
  assert.equal(calls,1);assert.deepEqual(JSON.parse(values.get('drafts')!),[{id:'other'},{id:'new',title:'99'}]);
});

test('Draft intent survives temporarily unreadable storage without replacing unseen existing drafts',async()=>{
  const coordinator=new PendingSaves();let readable=false,value='[{"id":"existing"}]';
  const drafts=new DurableDraftStorage(()=>({getItem:()=>{if(!readable)throw Error('Storage unavailable');return value;},setItem:(_key,next)=>{value=next;}}),coordinator);
  const append=(current:string|null)=>JSON.stringify([...JSON.parse(current??'[]'),{id:'new'}]);
  assert.equal(drafts.update('drafts',append,'new'),false);assert.deepEqual(JSON.parse(drafts.get('drafts')!),[{id:'new'}]);
  await assert.rejects(coordinator.flush(),AggregateError);readable=true;await coordinator.flush();assert.deepEqual(JSON.parse(value),[{id:'existing'},{id:'new'}]);
});

test('Draft fallback shows the newest edit if reads fail after an earlier write failure',async()=>{
  const coordinator=new PendingSaves();let readable=true,writable=false,value='[{"id":"other"}]';
  const drafts=new DurableDraftStorage(()=>({getItem:()=>{if(!readable)throw Error('Read unavailable');return value;},setItem:(_key,next)=>{if(!writable)throw Error('Write unavailable');value=next;}}),coordinator);
  const put=(title:string)=>(base:string|null)=>JSON.stringify([...JSON.parse(base??'[]').filter((row:any)=>row.id!=='mine'),{id:'mine',title}]);
  drafts.update('drafts',put('first'),'mine');readable=false;drafts.update('drafts',put('latest'),'mine');
  assert.deepEqual(JSON.parse(drafts.get('drafts')!),[{id:'other'},{id:'mine',title:'latest'}]);
  readable=true;writable=true;await coordinator.flush();assert.deepEqual(JSON.parse(value),[{id:'other'},{id:'mine',title:'latest'}]);
});
