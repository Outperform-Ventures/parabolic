import {pendingSaves,type PendingSaves} from './pending-saves';

/** Unsaved form values are component state, not a durable draft. Keep the
 * window open until the user saves or explicitly closes that form. */
export class RestartForm {
  private dirty=false;
  private revision=0;
  private pending?:Promise<unknown>;
  constructor(private readonly title:()=>string,private readonly coordinator:PendingSaves=pendingSaves){}
  attach(){return this.coordinator.register(async()=>{
    await this.pending;
    if(this.dirty)throw Error(`Save or close “${this.title()}” before updating the application.`);
  });}
  changed(){this.dirty=true;this.revision++;this.coordinator.changed();}
  save<T>(operation:()=>Promise<T>):Promise<T>{
    if(this.pending)return this.pending as Promise<T>;
    const revision=this.revision;
    const work=this.coordinator.track(async()=>{
      const result=await operation();
      if(result!==null&&revision===this.revision){this.dirty=false;this.coordinator.changed();}
      return result;
    });
    const pending=work.finally(()=>{if(this.pending===pending)this.pending=undefined;});
    this.pending=pending;return pending;
  }
}
