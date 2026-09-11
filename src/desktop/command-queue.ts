export interface NativeCommand {command:string;[key:string]:unknown}

/** Keep startup/menu intents until the current document has installed its command listener. */
export class RendererCommandQueue {
  private readonly windows=new Map<number,{ready:boolean;pending:NativeCommand[]}>();
  constructor(private readonly limit=64){if(!Number.isInteger(limit)||limit<1)throw Error('Invalid command queue limit');}
  reset(id:number){const current=this.windows.get(id);this.windows.set(id,{ready:false,pending:current?.pending??[]});}
  remove(id:number){this.windows.delete(id);}
  enqueue(id:number,command:NativeCommand):NativeCommand[]{
    const current=this.windows.get(id)??{ready:false,pending:[]};this.windows.set(id,current);
    if(current.ready)return [command];
    current.pending.push(command);if(current.pending.length>this.limit)current.pending.shift();return [];
  }
  ready(id:number):NativeCommand[]{const current=this.windows.get(id)??{ready:false,pending:[]};this.windows.set(id,current);current.ready=true;return current.pending.splice(0);}
}
