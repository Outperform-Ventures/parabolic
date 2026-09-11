import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RestartRenderer} from '../../src/desktop/restart-renderer';
function deferred(){let resolve!:()=>void;let reject!:(error:Error)=>void;const promise=new Promise<void>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('Restart renderer freezes once and stays frozen after saving until its own cancellation',async()=>{
  let frozen=false,saves=0;const replies:unknown[]=[];
  const renderer=new RestartRenderer(()=>{frozen=true;return()=>{frozen=false;};},async()=>{saves++;},result=>replies.push(result));
  renderer.prepare('one');renderer.prepare('one');assert.equal(frozen,true);await settle();
  assert.equal(saves,1);assert.deepEqual(replies,[{requestId:'one',ok:true}]);assert.equal(frozen,true);
  renderer.cancel('old');assert.equal(frozen,true);renderer.cancel('one');assert.equal(frozen,false);
});
test('Restart renderer rejects overlapping attempts and ignores cancelled asynchronous completion',async()=>{
  const first=deferred();let frozen=false,saves=0;const replies:unknown[]=[];
  const renderer=new RestartRenderer(()=>{frozen=true;return()=>{frozen=false;};},()=>{saves++;return saves===1?first.promise:Promise.resolve();},reply=>replies.push(reply));
  renderer.prepare('one');await settle();renderer.prepare('two');
  assert.deepEqual(replies,[{requestId:'two',ok:false,error:'Another restart is being prepared.'}]);
  renderer.cancel('one');renderer.prepare('three');await settle();first.resolve();await settle();
  assert.deepEqual(replies.at(-1),{requestId:'three',ok:true});assert.equal(replies.length,2);assert.equal(frozen,true);renderer.dispose();assert.equal(frozen,false);
});
test('Restart renderer releases input on save failure and permits retry',async()=>{
  let failing=true,frozen=false;const replies:{ok:boolean;error?:string}[]=[];
  const renderer=new RestartRenderer(()=>{frozen=true;return()=>{frozen=false;};},async()=>{if(failing)throw Error('Disk full');},reply=>replies.push(reply));
  renderer.prepare('one');await settle();assert.equal(frozen,false);assert.deepEqual(replies[0],{requestId:'one',ok:false,error:'Disk full'});
  failing=false;renderer.prepare('two');await settle();assert.equal(replies[1].ok,true);renderer.dispose();
});
test('Restart renderer validates IDs and disposal cancels a not-yet-started save',async()=>{
  let saves=0,replies=0;const renderer=new RestartRenderer(()=>()=>{},async()=>{saves++;},()=>{replies++;});
  for(const invalid of [null,{},'',42,'a'.repeat(101),'bad\nid'])renderer.prepare(invalid);
  assert.equal(replies,0);renderer.prepare('valid-id');renderer.dispose();await settle();assert.equal(saves,0);assert.equal(replies,0);
});
