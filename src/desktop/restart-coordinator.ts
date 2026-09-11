import {randomUUID} from 'node:crypto';

type Attempt = {id:string;windows:Set<number>;pending:Set<number>;ready:boolean;timer:ReturnType<typeof setTimeout>;resolve:()=>void;reject:(error:Error)=>void};
export type RestartLease = {assertReady():void;cancel():void};

/** An acknowledgement belongs to one live document and one restart attempt.
 * Call invalidate before a window closes or changes its main document. */
export class RestartCoordinator {
  private attempt?:Attempt;
  constructor(private readonly send:(windowId:number,channel:'desktop:prepare-restart'|'desktop:cancel-restart',requestId:string)=>void,private readonly timeout=30_000){}
  get busy(){return !!this.attempt;}
  async prepare(windowIds:number[]):Promise<RestartLease>{
    if(this.busy)throw Error('A restart is already being prepared.');
    const windows=new Set(windowIds);
    if(windows.size!==windowIds.length||windowIds.some(id=>!Number.isSafeInteger(id)||id<0))throw Error('Invalid restart window list.');
    const id=randomUUID();
    const waiting=new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>this.fail(id,new Error('A window did not finish saving. The application has not restarted.')),this.timeout);
      this.attempt={id,windows,pending:new Set(windows),ready:windows.size===0,timer,resolve,reject};
      if(!windows.size)resolve();
    });
    for(const windowId of windows){
      if(this.attempt?.id!==id)break;
      try{this.send(windowId,'desktop:prepare-restart',id);}catch(error){this.fail(id,error instanceof Error?error:Error(String(error)));}
    }
    await waiting;
    if(this.attempt?.id!==id)throw Error('The restart was cancelled.');
    clearTimeout(this.attempt.timer);
    return {
      assertReady:()=>{
        if(this.attempt?.id!==id||!this.attempt.ready)throw Error('The window state changed before restart.');
      },
      cancel:()=>this.fail(id,new Error('The restart was cancelled.')),
    };
  }
  acknowledge(windowId:number,result:unknown){
    const current=this.attempt;
    if(!current||!result||typeof result!=='object')return false;
    const value=result as Record<string,unknown>;
    if(value.requestId!==current.id||!current.pending.has(windowId)||typeof value.ok!=='boolean')return false;
    if(!value.ok){
      this.fail(current.id,Error(typeof value.error==='string'&&value.error.trim()?value.error.slice(0,1000):'A window could not save its changes.'));
      return true;
    }
    current.pending.delete(windowId);
    if(!current.pending.size){current.ready=true;clearTimeout(current.timer);current.resolve();}
    return true;
  }
  invalidate(windowId:number){if(this.attempt?.windows.has(windowId))this.fail(this.attempt.id,Error('A window changed while preparing to restart. Try again.'));}
  windowAdded(){if(this.attempt)this.fail(this.attempt.id,Error('A new window opened while preparing to restart. Try again.'));}
  cancel(){if(this.attempt)this.fail(this.attempt.id,Error('The restart was cancelled.'));}
  private fail(id:string,error:Error){
    const current=this.attempt;if(!current||current.id!==id)return;
    this.attempt=undefined;clearTimeout(current.timer);
    for(const windowId of current.windows){try{this.send(windowId,'desktop:cancel-restart',id);}catch{/* A destroyed renderer cannot be unfrozen. */}}
    current.reject(error);
  }
}
