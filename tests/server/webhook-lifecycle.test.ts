import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer as createHttpServer} from 'node:http';
import {createServer as createNetServer,type Server,type Socket} from 'node:net';
import {randomUUID,createHmac} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createApp} from '../../src/server/app.ts';
import {WebhookWorker} from '../../src/server/webhooks.ts';

function deferred<T=void>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function bounded<T>(promise:Promise<T>,ms=1500){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Operation did not finish within its bounded deadline')),ms);})]);}finally{clearTimeout(timer);}}
async function until(predicate:()=>boolean){await bounded((async()=>{while(!predicate())await delay(5);})());}
async function fixture(receiver:Server,options:ConstructorParameters<typeof WebhookWorker>[2]={}){
  const sockets=new Set<Socket>();receiver.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise<void>(resolve=>receiver.listen(0,'127.0.0.1',resolve));
  const app=createApp({databasePath:':memory:',port:0}),setup=await app.auth.setup({name:'Webhook lifecycle',email:'webhook-lifecycle@example.test',password:'isolated-hook-password'}),hookId=randomUUID(),at=new Date().toISOString(),secret='test-webhook-signature-secret';
  app.db.prepare('INSERT INTO webhooks(id,workspace_id,creator_id,url,secret,events,enabled,created_at) VALUES(?,?,?,?,?,?,?,?)').run(hookId,setup.workspaceId,setup.user.id,`http://127.0.0.1:${(receiver.address() as any).port}/hook`,secret,'["*"]',1,at);
  const worker=new WebhookWorker(app.db,true,options);
  return {app,worker,secret,sockets,job:()=>worker.test(hookId,setup.workspaceId,setup.user.id),record:(id:string)=>app.db.prepare('SELECT * FROM webhook_deliveries WHERE id=?').get(id) as any,close:async()=>{await worker.close();for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>receiver.close(()=>resolve()));await app.close();}};
}

test('webhook status acknowledgment releases endless response bodies and preserves success, failure and signatures',async()=>{
  const streams=new Set(),received:{body:string;signature:string;code:number}[]=[];
  const receiver=createHttpServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString(),code=received.length===0?200:503;received.push({body,signature:String(req.headers['parabolic-signature']),code});res.writeHead(code);res.write('accepted status, unused body');streams.add(res);const heartbeat=setInterval(()=>res.write('.'),10);res.once('close',()=>{clearInterval(heartbeat);streams.delete(res);});});
  const f=await fixture(receiver);try{
    const jobs=[f.job(),f.job()];await bounded(f.worker.tick());await bounded(f.worker.close());await until(()=>streams.size===0&&f.sockets.size===0);
    assert.equal(received.length,2);for(const item of received)assert.equal(item.signature,createHmac('sha256',f.secret).update(item.body).digest('hex'));
    const records=jobs.map(job=>f.record(job.id));assert.deepEqual(records.map(row=>row.status).sort(),['delivered','retrying']);assert.ok(records.every(row=>row.attempts===1));assert.equal(records.find(row=>row.status==='retrying').last_status,503);assert.match(records.find(row=>row.status==='retrying').last_error,/HTTP 503/);assert.ok(records.find(row=>row.status==='delivered').delivered_at);
  }finally{await f.close();}
});

test('closing a webhook worker aborts live requests without consuming retries and a new worker can deliver them',async()=>{
  const entered=deferred(),received:string[]=[];let acknowledge=false;
  const receiver=createHttpServer(async(req,res)=>{for await(const chunk of req){}received.push(String(req.headers['x-parabolic-delivery']));entered.resolve();if(acknowledge){res.writeHead(204);res.end();}});
  const f=await fixture(receiver);let restart:WebhookWorker|undefined;try{
    const job=f.job(),pending=f.worker.tick();await bounded(entered.promise);await bounded(f.worker.close());await bounded(pending);await until(()=>f.sockets.size===0);
    assert.equal(f.record(job.id).status,'pending');assert.equal(f.record(job.id).attempts,0);assert.equal(f.record(job.id).delivered_at,null);
    await f.worker.tick();assert.equal(received.length,1,'A closed worker cannot dispatch more work');
    acknowledge=true;restart=new WebhookWorker(f.app.db,true);await bounded(restart.tick());assert.equal(f.record(job.id).status,'delivered');assert.equal(f.record(job.id).attempts,1);assert.deepEqual(received,[job.id,job.id],'Retry keeps its stable delivery ID');
  }finally{await restart?.close();await f.close();}
});

test('shutdown races an OS-owned DNS lookup without permitting late requests or access to a closed database',async()=>{
  const lookup=deferred<{address:string;family:number}[]>(),entered=deferred();let requests=0;
  const receiver=createHttpServer((req,res)=>{requests++;res.end();});
  const f=await fixture(receiver,{resolveDestination:()=>{entered.resolve();return lookup.promise;}});try{
    const job=f.job(),pending=f.worker.tick();await entered.promise;await bounded(f.worker.close());await bounded(pending);assert.equal(f.record(job.id).status,'pending');assert.equal(f.record(job.id).attempts,0);
    await f.app.close();lookup.resolve([{address:'127.0.0.1',family:4}]);await delay(20);assert.equal(requests,0);assert.equal(f.sockets.size,0);
  }finally{lookup.resolve([{address:'127.0.0.1',family:4}]);await f.close();}
});

test('the total attempt deadline covers DNS and ignores late resolver rejection',async()=>{
  const lookup=deferred<{address:string;family:number}[]>();let requests=0;
  const f=await fixture(createHttpServer((req,res)=>{requests++;res.end();}),{resolveDestination:()=>lookup.promise,attemptTimeoutMs:50});try{
    const job=f.job();await bounded(f.worker.tick());const record=f.record(job.id);assert.equal(record.status,'retrying');assert.equal(record.attempts,1);assert.match(record.last_error,/timed out/);assert.equal(record.last_status,null);assert.ok(Date.parse(record.next_attempt_at)>Date.now());
    lookup.reject(new Error('Late operating-system lookup failure'));await delay(20);assert.equal(requests,0);assert.equal(f.sockets.size,0);
  }finally{lookup.resolve([{address:'127.0.0.1',family:4}]);await f.close();}
});

test('periodic bytes before complete response headers cannot extend the wall-clock attempt deadline',async()=>{
  let chunksSent=0;
  const receiver=createNetServer(socket=>{let started=false;socket.on('error',()=>{});socket.on('data',()=>{if(started)return;started=true;socket.write('HTTP/1.1 200 OK\r\nX-Streaming: ');const heartbeat=setInterval(()=>{chunksSent++;socket.write('.');},5);socket.once('close',()=>clearInterval(heartbeat));});});
  const f=await fixture(receiver,{attemptTimeoutMs:150});try{
    const job=f.job();await bounded(f.worker.tick());await until(()=>f.sockets.size===0);const record=f.record(job.id);assert.ok(chunksSent>2,'The peer sent ongoing traffic while withholding complete headers');assert.equal(record.status,'retrying');assert.equal(record.last_status,null);assert.equal(record.attempts,1);assert.match(record.last_error,/timed out/);
  }finally{await f.close();}
});
