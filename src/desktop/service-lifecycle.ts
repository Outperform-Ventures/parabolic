import type {EventEmitter} from 'node:events';
import {validServiceOptions,validServiceReady,type EmbeddedServiceOptions} from './service-protocol';
export interface ServiceChild extends EventEmitter{pid?:number;stdout:NodeJS.ReadableStream|null;stderr:NodeJS.ReadableStream|null;postMessage(message:unknown):void;kill():boolean}
export type EmbeddedService={url:string;port:number;pid:number;close:()=>Promise<void>};
type LifecycleOptions={startupMs?:number;shutdownMs?:number;killMs?:number;forceKill?:(pid:number)=>void;log?:(text:string)=>void;onUnexpectedExit?:(error:Error)=>void};

/** Own the utility child before accepting readiness, and release it on every failure path. */
export function superviseService(child:ServiceChild,config:EmbeddedServiceOptions,options:LifecycleOptions={}):Promise<EmbeddedService>{
 const {startupMs=15000,shutdownMs=8000,killMs=1000}=options;
 let exited=false,closing=false,settled=false,ready=false,exitCode:number|undefined,stopPromise:Promise<void>|undefined,tail='';
 let finishExit!:()=>void;const exitPromise=new Promise<void>(resolve=>{finishExit=resolve;});
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const sleep=(ms:number)=>new Promise<void>(resolve=>{const timer=setTimeout(()=>{timers.delete(timer);resolve();},ms);timers.add(timer);});
 const capture=(chunk:unknown)=>{const text=String(chunk);tail=(tail+text).slice(-4000);options.log?.(text);};
 child.stdout?.on('data',capture);child.stderr?.on('data',capture);
 const stop=()=>{if(stopPromise)return stopPromise;const pending=(async()=>{
  closing=true;if(exited)return;let forced=false;
  try{child.postMessage({type:'shutdown'});}catch{}
  await Promise.race([exitPromise,sleep(shutdownMs)]);
  if(!exited){forced=true;try{child.kill();}catch{}await Promise.race([exitPromise,sleep(killMs)]);}
  if(!exited&&child.pid){try{(options.forceKill??(pid=>process.kill(pid,'SIGKILL')))(child.pid);}catch{}await Promise.race([exitPromise,sleep(killMs)]);}
  for(const timer of timers)clearTimeout(timer);timers.clear();
  if(!exited)throw new Error('The workspace service could not be stopped.');
  if(forced||exitCode!==0)throw new Error('The workspace service did not shut down cleanly.');
 })();stopPromise=pending;void pending.catch(()=>{if(stopPromise===pending)stopPromise=undefined;});return pending;};
 return new Promise<EmbeddedService>((resolve,reject)=>{
  const fail=(error:Error)=>{if(settled)return;settled=true;clearTimeout(startup);void stop().then(()=>reject(error),stopError=>reject(new AggregateError([error,stopError],error.message+' Cleanup also failed: '+String(stopError))));};
  const startup=setTimeout(()=>fail(new Error('The workspace service did not become ready in time.')),startupMs);
  child.on('error',(type:unknown,location:unknown)=>{capture(`Workspace service error: ${String(type)} ${String(location??'')}\n`);if(!ready)fail(new Error('The workspace service could not start.'));});
  child.on('message',(message:unknown)=>{
   const data=message as {type?:string;message?:unknown};
   if(data?.type==='error'){const detail=typeof data.message==='string'?data.message.slice(0,2000):'Unknown service error';capture(detail+'\n');if(!ready)fail(new Error(detail));return;}
   if(data?.type!=='ready'||settled)return;
   if(!validServiceReady(data,config.port,child.pid)){fail(new Error('The workspace service returned an invalid listening address.'));return;}
   settled=true;ready=true;clearTimeout(startup);resolve({url:data.url,port:data.port,pid:data.pid,close:stop});
  });
  child.on('exit',(code:number)=>{
   exited=true;exitCode=code;finishExit();clearTimeout(startup);for(const timer of timers)clearTimeout(timer);timers.clear();
   if(!settled){settled=true;reject(new Error(`The workspace service exited before becoming ready (${code}).${tail?' '+tail.trim():''}`));}
   else if(ready&&!closing)options.onUnexpectedExit?.(new Error(`The workspace service stopped unexpectedly (${code}).`));
  });
  if(!validServiceOptions(config)){fail(new Error('Invalid embedded workspace service configuration.'));return;}
  try{child.postMessage({type:'start',config});}catch(error){fail(error instanceof Error?error:new Error(String(error)));}
 });
}
