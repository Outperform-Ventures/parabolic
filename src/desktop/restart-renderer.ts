type Reply = {requestId:string;ok:boolean;error?:string};
/** A successful save keeps input frozen until the main process quits or
 * cancels. Cancelled asynchronous saves cannot acknowledge a newer attempt. */
export class RestartRenderer {
  private active?:{id:string;release:()=>void};
  constructor(private readonly freeze:()=>()=>void,private readonly save:()=>Promise<void>,private readonly reply:(result:Reply)=>void){}
  prepare(requestId:unknown){
    if(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(requestId))return;
    if(this.active){
      if(this.active.id!==requestId)this.reply({requestId,ok:false,error:'Another restart is being prepared.'});
      return;
    }
    let release:()=>void;
    try{release=this.freeze();}catch(error){this.failure(requestId,error);return;}
    const active={id:requestId,release};this.active=active;
    void Promise.resolve().then(()=>this.active===active?this.save():undefined).then(()=>{
      if(this.active===active)this.reply({requestId,ok:true});
    }).catch(error=>{if(this.active===active){this.cancel(requestId);this.failure(requestId,error);}});
  }
  cancel(requestId:unknown){
    if(!this.active||this.active.id!==requestId)return;
    const active=this.active;this.active=undefined;active.release();
  }
  dispose(){if(this.active)this.cancel(this.active.id);}
  private failure(requestId:string,error:unknown){this.reply({requestId,ok:false,error:String(error instanceof Error?error.message:error).slice(0,1000)});}
}
