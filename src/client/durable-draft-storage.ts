import {pendingSaves,type PendingSaves} from './pending-saves';

/** Preserve the latest serialized draft when browser storage temporarily fails.
 * The restart barrier cannot complete until the fallback reaches disk. */
export class DurableDraftStorage {
  private unsaved=new Map<string,string>();
  private updates=new Map<string,Array<{key?:string;change:(current:string|null)=>string}>>();
  private bases=new Map<string,string|null>();
  private unregister?:()=>void;
  constructor(private readonly storage:()=>Pick<Storage,'getItem'|'setItem'>,private readonly coordinator:PendingSaves=pendingSaves){}
  get(key:string){
    if(this.updates.has(key)){
      try{const base=this.storage().getItem(key);this.bases.set(key,base);return this.apply(key,base);}catch{return this.apply(key,this.bases.get(key)??null);}
    }
    if(this.unsaved.has(key))return this.unsaved.get(key)!;
    try{return this.storage().getItem(key);}catch{return null;}
  }
  set(key:string,value:string){
    this.updates.delete(key);this.bases.delete(key);
    this.coordinator.changed();
    try{
      this.storage().setItem(key,value);this.unsaved.delete(key);this.clean();return true;
    }catch{
      this.unsaved.set(key,value);this.unregister??=this.coordinator.register(async()=>this.flush());return false;
    }
  }
  /** Retain mutation intent, not an obsolete whole-collection snapshot, while
   * storage is unavailable. A retry applies it to the latest disk collection. */
  update(key:string,change:(current:string|null)=>string,operationKey?:string){
    this.coordinator.changed();
    const updates=(this.updates.get(key)??[]).filter(entry=>operationKey===undefined||entry.key!==operationKey);updates.push({key:operationKey,change});this.updates.set(key,updates);
    try{
      const base=this.storage().getItem(key);this.bases.set(key,base);
      const value=this.apply(key,base);
      this.unsaved.set(key,value);this.storage().setItem(key,value);
      this.updates.delete(key);this.bases.delete(key);this.unsaved.delete(key);this.clean();return true;
    }catch{
      this.unregister??=this.coordinator.register(async()=>this.flush());return false;
    }
  }
  flush(){
    for(const key of new Set([...this.unsaved.keys(),...this.updates.keys()])){
      const value=this.updates.has(key)?this.apply(key,this.storage().getItem(key)):this.unsaved.get(key)!;
      this.storage().setItem(key,value);this.unsaved.delete(key);this.updates.delete(key);this.bases.delete(key);
    }
    this.clean();
  }
  private apply(key:string,current:string|null){return this.updates.get(key)!.reduce<string|null>((value,entry)=>entry.change(value),current)!;}
  private clean(){if(!this.unsaved.size&&!this.updates.size){this.unregister?.();this.unregister=undefined;}}
}
