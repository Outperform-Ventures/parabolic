import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RestartCoordinator} from '../../src/desktop/restart-coordinator';

function fixture(timeout=1000){
  const messages:{windowId:number;channel:string;requestId:string}[]=[];
  const coordinator=new RestartCoordinator((windowId,channel,requestId)=>messages.push({windowId,channel,requestId}),timeout);
  const id=()=>messages.find(message=>message.channel==='desktop:prepare-restart')!.requestId;
  return {coordinator,messages,id};
}
test('Desktop restart requires every window and rejects foreign, stale and duplicate acknowledgements',async()=>{
  const f=fixture(),preparing=f.coordinator.prepare([11,12]);let ready=false;void preparing.then(()=>{ready=true;});
  assert.equal(f.coordinator.acknowledge(99,{requestId:f.id(),ok:true}),false);
  assert.equal(f.coordinator.acknowledge(11,{requestId:'stale',ok:true}),false);
  assert.equal(f.coordinator.acknowledge(11,{requestId:f.id(),ok:'true'}),false);
  assert.equal(f.coordinator.acknowledge(11,{requestId:f.id(),ok:true}),true);
  assert.equal(f.coordinator.acknowledge(11,{requestId:f.id(),ok:true}),false);
  await Promise.resolve();assert.equal(ready,false);
  await assert.rejects(f.coordinator.prepare([13]),/already being prepared/);
  f.coordinator.acknowledge(12,{requestId:f.id(),ok:true});const lease=await preparing;
  lease.assertReady();assert.equal(f.coordinator.busy,true);lease.cancel();assert.equal(f.coordinator.busy,false);
  assert.equal(f.messages.filter(message=>message.channel==='desktop:cancel-restart').length,2);
  assert.throws(()=>lease.assertReady(),/changed before restart/);
});
test('Desktop restart save failures restore every window and allow a fresh attempt',async()=>{
  const f=fixture(),preparing=f.coordinator.prepare([11,12]),old=f.id();
  f.coordinator.acknowledge(11,{requestId:old,ok:false,error:'Disk full'});
  await assert.rejects(preparing,/Disk full/);assert.equal(f.coordinator.busy,false);
  assert.deepEqual(f.messages.filter(message=>message.channel==='desktop:cancel-restart').map(message=>message.windowId),[11,12]);
  const retry=f.coordinator.prepare([11]),fresh=f.messages.at(-1)!.requestId;assert.notEqual(fresh,old);
  assert.equal(f.coordinator.acknowledge(11,{requestId:old,ok:true}),false);
  f.coordinator.acknowledge(11,{requestId:fresh,ok:true});(await retry).cancel();
});
test('Desktop restart timeout releases windows and ignores a late save completion',async()=>{
  const f=fixture(10),preparing=f.coordinator.prepare([11]),id=f.id();
  await assert.rejects(preparing,/did not finish saving/);assert.equal(f.coordinator.busy,false);
  assert.equal(f.messages.at(-1)?.channel,'desktop:cancel-restart');assert.equal(f.coordinator.acknowledge(11,{requestId:id,ok:true}),false);
});
test('Desktop restart leases are invalidated by navigation or new windows even after saves finish',async()=>{
  for(const change of ['navigate','new-window']){
    const f=fixture(),preparing=f.coordinator.prepare([11]);f.coordinator.acknowledge(11,{requestId:f.id(),ok:true});
    const lease=await preparing;if(change==='navigate')f.coordinator.invalidate(11);else f.coordinator.windowAdded();
    assert.throws(()=>lease.assertReady(),/changed before restart/);assert.equal(f.messages.at(-1)?.channel,'desktop:cancel-restart');
  }
});
test('Desktop restart handles closing windows, synchronous send failure and an empty application',async()=>{
  const f=fixture(),preparing=f.coordinator.prepare([11]);f.coordinator.invalidate(11);await assert.rejects(preparing,/window changed/);
  const broken=new RestartCoordinator(()=>{throw Error('Renderer destroyed');});await assert.rejects(broken.prepare([11,12]),/Renderer destroyed/);assert.equal(broken.busy,false);
  const empty=await f.coordinator.prepare([]);empty.assertReady();empty.cancel();
  await assert.rejects(f.coordinator.prepare([1,1]),/Invalid restart/);
});
