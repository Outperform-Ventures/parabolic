import { createHmac, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import type { DatabaseSync } from 'node:sqlite';
import { assert, HttpError } from './errors.ts';
import { Repository } from './repository.ts';
import {webhookMatches,webhookEntity} from './webhook-scope.ts';

export function isPrivateAddress(address:string):boolean {
  const a=address.toLowerCase();
  if(a==='::'||a==='::1'||a.startsWith('fc')||a.startsWith('fd')||/^fe[89ab]/.test(a)||a.startsWith('ff'))return true;
  if(a.startsWith('::ffff:'))return isPrivateAddress(a.slice(7));
  if(isIP(a)===4){const [x,y]=a.split('.').map(Number);return x===0||x===10||x===127||x>=224||(x===169&&y===254)||(x===172&&y>=16&&y<=31)||(x===192&&y===168)||(x===100&&y>=64&&y<=127)||(x===198&&(y===18||y===19));}
  return !isIP(a);
}
export function validateWebhookUrl(raw:unknown,allowPrivate=false){
  assert(typeof raw==='string'&&raw.length<4096,422,'A valid webhook URL is required','VALIDATION_ERROR');let url:URL;
  try{url=new URL(raw);}catch{throw new HttpError(422,'Invalid webhook URL','VALIDATION_ERROR');}
  assert(url.protocol==='https:'||(allowPrivate&&url.protocol==='http:'),422,'Webhooks require HTTPS','INVALID_WEBHOOK_URL');
  assert(!url.username&&!url.password&&!url.hash,422,'Webhook URL must not include credentials or fragments','INVALID_WEBHOOK_URL');
  assert(allowPrivate||(!url.hostname.endsWith('.local')&&url.hostname!=='localhost'&&(!isIP(url.hostname)||!isPrivateAddress(url.hostname))),422,'Private-network webhook destinations are disabled','INVALID_WEBHOOK_URL');return url;
}
export class WebhookWorker {
  db:DatabaseSync; allowPrivate:boolean; timer?:ReturnType<typeof setInterval>; busy=false;repo:Repository;
  private closed=false;
  private active=new Set<Promise<void>>();
  private controllers=new Set<AbortController>();
  private resolveDestination:(hostname:string)=>Promise<LookupAddress[]>;
  private attemptTimeoutMs:number;
  constructor(db:DatabaseSync,allowPrivate=false,options:{resolveDestination?:(hostname:string)=>Promise<LookupAddress[]>;attemptTimeoutMs?:number}={}){
    this.db=db;this.allowPrivate=allowPrivate;this.repo=new Repository(db);
    this.resolveDestination=options.resolveDestination??(hostname=>lookup(hostname,{all:true}));
    this.attemptTimeoutMs=options.attemptTimeoutMs??5000;
    assert(Number.isFinite(this.attemptTimeoutMs)&&this.attemptTimeoutMs>0,500,'Webhook attempt deadline must be positive','INVALID_CONFIGURATION');
  }
  start(){if(this.closed||this.timer)return;this.timer=setInterval(()=>void this.tick(),1000);this.timer.unref();}
  async close(){
    this.closed=true;if(this.timer)clearInterval(this.timer);
    for(const controller of this.controllers)controller.abort(new Error('Webhook worker stopped'));
    await Promise.allSettled([...this.active]);
  }
  async tick(){if(this.closed||this.busy)return;this.busy=true;try{
    const jobs=this.db.prepare("SELECT d.*, w.url,w.secret,w.enabled,w.creator_id,w.workspace_id,w.team_id,w.all_public_teams FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id WHERE d.status IN ('pending','retrying') AND d.next_attempt_at<=? AND w.enabled=1 ORDER BY d.next_attempt_at LIMIT 10").all(new Date().toISOString()) as any[];
    await Promise.all(jobs.map(job=>this.deliver(job)));
  }finally{this.busy=false;}}
  private authorize(job:any,parsed:any){
    const actor=this.repo.actorForUser(job.creator_id,job.workspace_id),current=parsed.type==='test'?null:this.repo.cachedRaw(actor,parsed.type,parsed.data.id,true);
    if(actor.role==='none'||(parsed.type!=='test'&&(!current||!this.repo.canRead(actor,parsed.type,current)||!webhookMatches(this.repo,job,parsed.type,current)))){
      this.db.prepare("UPDATE webhook_deliveries SET status='canceled',last_error='Event is no longer in the authorized webhook scope' WHERE id=?").run(job.id);return null;
    }
    return {actor,current};
  }
  deliver(job:any):Promise<void>{
    if(this.closed)return Promise.resolve();
    const controller=new AbortController();this.controllers.add(controller);
    const pending=this.attempt(job,controller).finally(()=>{this.active.delete(pending);this.controllers.delete(controller);});
    this.active.add(pending);return pending;
  }
  private async attempt(job:any,controller:AbortController){
    let attempts=job.attempts+1;let status:number|null=null;let error:string|null=null;
    const signal=controller.signal;
    let rejectAbort!:(error:unknown)=>void;
    const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
    const onAbort=()=>rejectAbort(signal.reason);signal.addEventListener('abort',onAbort,{once:true});
    const deadline=setTimeout(()=>controller.abort(new Error('Webhook delivery timed out')),this.attemptTimeoutMs);
    try {
      const parsed=JSON.parse(job.payload);if(!this.authorize(job,parsed))return;
      const url=validateWebhookUrl(job.url,this.allowPrivate);
      // OS DNS lookup is not abortable, but its late result cannot resume this attempt.
      const addresses=await Promise.race([this.resolveDestination(url.hostname.replace(/^\[|\]$/g,'')),aborted]);
      signal.throwIfAborted();if(this.closed)return;
      assert(addresses.length&&addresses.every(a=>this.allowPrivate||!isPrivateAddress(a.address)),422,'Webhook resolved to a private network address','INVALID_WEBHOOK_URL');
      // DNS yields to concurrent API requests. Do not send using revoked access or stale hook settings.
      const latest=this.db.prepare('SELECT d.*,w.url,w.secret,w.enabled,w.creator_id,w.workspace_id,w.team_id,w.all_public_teams FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id WHERE d.id=?').get(job.id) as any;
      if(!latest||!latest.enabled||!['pending','retrying'].includes(latest.status)||latest.url!==job.url)return;
      job=latest;attempts=job.attempts+1;const authorized=this.authorize(job,parsed);if(!authorized)return;const {actor,current}=authorized;
      if(current)parsed.data=webhookEntity(this.repo,actor,job,parsed.type,parsed.data);const address=addresses[0];parsed.webhookTimestamp=Date.now();const payload=JSON.stringify(parsed);
      const signature=createHmac('sha256',job.secret).update(payload).digest('hex');
      status=await new Promise<number>((resolve,reject)=>{
        let requestError:unknown;
        const request=(url.protocol==='https:'?https:http).request(url,{method:'POST',signal,agent:false,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),'Parabolic-Signature':signature,'X-Parabolic-Signature':signature,'X-Parabolic-Delivery':job.id,'X-Parabolic-Event':`${parsed.type}.${parsed.action}`},lookup:((hostname:any,options:any,callback:any)=>{if(options?.all)callback(null,[address]);else callback(null,address.address,address.family);}) as any},response=>{
          // HTTP status is the acknowledgment. Response bodies are unused and can be endless.
          status=response.statusCode||0;response.destroy();
        });
        request.once('error',cause=>{requestError=cause;});
        request.once('close',()=>{if(status!==null)resolve(status);else reject(signal.reason??requestError??new Error('Webhook connection closed before a response'));});
        request.end(payload);
      });
      if(status<200||status>=300)error=`Endpoint returned HTTP ${status}`;
    } catch(cause){
      // Shutdown leaves an unacknowledged delivery available for the next worker.
      if(this.closed&&status===null)return;
      const failure=signal.aborted?signal.reason:cause;error=failure instanceof Error?failure.message:'Delivery failed';
    } finally {clearTimeout(deadline);signal.removeEventListener('abort',onAbort);}
    const delivered=!error;const failed=attempts>=8;
    this.db.prepare('UPDATE webhook_deliveries SET attempts=?,status=?,last_status=?,last_error=?,next_attempt_at=?,delivered_at=? WHERE id=?').run(attempts,delivered?'delivered':failed?'failed':'retrying',status,error,new Date(Date.now()+Math.min(3600000,1000*2**attempts)).toISOString(),delivered?new Date().toISOString():null,job.id);
  }
  test(webhookId:string,workspaceId:string,actorId:string){const id=randomUUID(),at=new Date().toISOString();this.db.prepare('INSERT INTO webhook_deliveries(id,webhook_id,event_id,payload,next_attempt_at,created_at) VALUES(?,?,?,?,?,?)').run(id,webhookId,0,JSON.stringify({id,type:'test',action:'ping',data:{message:'Webhook endpoint test'},organizationId:workspaceId,actorId,createdAt:at,webhookTimestamp:Date.now()}),at,at);return {id,status:'pending'};}
}
