import * as Y from 'yjs';
import {toBase64,fromBase64} from 'lib0/buffer';

/** A synchronous write-ahead copy bridges page reloads before IndexedDB commits.
 * It contains only local uncommitted updates and is never an authorship claim.
 */
export class CollaborationRecovery {
 private pending:Uint8Array[]=[];private revision=0;
 constructor(private storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,private key:string){}
 read():Uint8Array|null{const value=this.storage.getItem(this.key);return value?fromBase64(value):null}
 record(update:Uint8Array,db:IDBDatabase){
  this.pending.push(update);const merged=Y.mergeUpdates(this.pending);this.pending=[merged];
  this.storage.setItem(this.key,toBase64(merged));const revision=++this.revision;
  // y-indexeddb registers its update listener first. A transaction on the same
  // store completes after its preceding writes, so only then can the copy go.
  const tx=db.transaction('updates','readonly');
  tx.oncomplete=()=>{if(revision===this.revision){this.pending=[];this.storage.removeItem(this.key)}};
 }
 clear(){this.revision++;this.pending=[];this.storage.removeItem(this.key)}
}
