import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {superviseService} from '../../src/desktop/service-lifecycle';
import {validServiceOptions} from '../../src/desktop/service-protocol';
const config={databasePath:'/tmp/parabolic-fixture/db.sqlite',staticDir:'/tmp/parabolic-fixture/dist',port:0};
class Child extends EventEmitter{pid:number|undefined=421;stdout=new PassThrough();stderr=new PassThrough();messages:any[]=[];kills=0;onPost?:(data:any)=>void;postMessage(data:unknown){this.messages.push(data);this.onPost?.(data);}kill(){this.kills++;return true;}exit(code=0){this.pid=undefined;this.emit('exit',code);}ready(port=4174){this.emit('message',{type:'ready',url:`http://127.0.0.1:${port}`,port,pid:this.pid});}}
test('Embedded service accepts only its child loopback readiness and gracefully stops exactly once',async()=>{
 const child=new Child(),unexpected:Error[]=[];const pending=superviseService(child,config,{onUnexpectedExit:error=>unexpected.push(error)});assert.deepEqual(child.messages,[{type:'start',config}]);child.ready();const service=await pending;assert.equal(service.url,'http://127.0.0.1:4174');assert.equal(service.pid,421);
 child.onPost=data=>{if(data.type==='shutdown')setTimeout(()=>child.exit(),1);};const first=service.close();assert.equal(first,service.close());await first;assert.equal(child.kills,0);assert.equal(child.messages.filter(row=>row.type==='shutdown').length,1);assert.equal(unexpected.length,0);
 assert.equal(validServiceOptions({...config,databasePath:'relative.sqlite'}),false);
});
test('Invalid service origins, fixed-port mismatch and startup errors reject and clean up their child',async()=>{
 for(const message of [{type:'ready',url:'https://outside.test',port:4174,pid:421},{type:'ready',url:'http://127.0.0.1:4175',port:4175,pid:421},{type:'error',message:'Address already in use'}]){
  const child=new Child();child.onPost=data=>{if(data.type==='shutdown')queueMicrotask(()=>child.exit(1));};const pending=superviseService(child,{...config,port:4174},{startupMs:30,shutdownMs:20,killMs:5});child.emit('message',message);await assert.rejects(pending,/invalid listening address|Address already in use/);assert.equal(child.pid,undefined);
 }
});
test('Startup exit and deadline are bounded; unresponsive children escalate termination',async()=>{
 const early=new Child(),start=superviseService(early,config);early.stderr.write('Unable to open database');early.exit(1);await assert.rejects(start,/exited before becoming ready.*Unable to open database/);
 const hung=new Child(),forced:number[]=[];await assert.rejects(superviseService(hung,config,{startupMs:5,shutdownMs:5,killMs:5,forceKill:pid=>{forced.push(pid);hung.exit(1);}}),/did not become ready/);assert.equal(hung.kills,1);assert.deepEqual(forced,[421]);
});
test('Unexpected service exit is reported once and closing an exited service is harmless',async()=>{
 const child=new Child(),errors:Error[]=[];const pending=superviseService(child,config,{onUnexpectedExit:error=>errors.push(error)});child.ready();const service=await pending;child.exit(9);await service.close();assert.equal(errors.length,1);assert.match(errors[0].message,/unexpectedly \(9\)/);assert.equal(child.messages.filter(row=>row.type==='shutdown').length,0);
});
test('An unconfirmed shutdown rejects and can retry without reporting success while the child lives',async()=>{
 const child=new Child();let forced=0;const start=superviseService(child,config,{shutdownMs:5,killMs:5,forceKill:()=>{forced++;}});child.ready();const service=await start;
 await assert.rejects(service.close(),/could not be stopped/);assert.equal(child.pid,421);assert.equal(forced,1);
 child.onPost=data=>{if(data.type==='shutdown')queueMicrotask(()=>child.exit());};await service.close();assert.equal(child.pid,undefined);
 assert.equal(child.messages.filter(message=>message.type==='shutdown').length,2);
});
test('Forced and abnormal shutdowns reject installation readiness but an exited child can be released on retry',async()=>{
 for(const force of [false,true]){
  const child=new Child(),start=superviseService(child,config,{shutdownMs:5,killMs:5,forceKill:()=>child.exit(9)});child.ready();const service=await start;
  if(!force)child.onPost=data=>{if(data.type==='shutdown')queueMicrotask(()=>child.exit(1));};
  await assert.rejects(service.close(),/did not shut down cleanly/);assert.equal(child.pid,undefined);await service.close();
 }
});
