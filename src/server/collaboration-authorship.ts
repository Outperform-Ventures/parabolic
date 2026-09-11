import type {DatabaseSync} from 'node:sqlite';
import * as Y from 'yjs';

import type {AuthorshipRange} from '../shared/collaboration.ts';
export type {AuthorshipRange} from '../shared/collaboration.ts';
/** Ownership of immutable CRDT identifiers. Replays never transfer authorship. */
export class CollaborationAuthorship {
 constructor(private readonly db:DatabaseSync){db.exec(`CREATE TABLE IF NOT EXISTS collaboration_authorship(room_key TEXT NOT NULL,client_id INTEGER NOT NULL,clock INTEGER NOT NULL,length INTEGER NOT NULL,user_id TEXT,PRIMARY KEY(room_key,client_id,clock))`)}
 read(roomKey:string):AuthorshipRange[]{return this.db.prepare('SELECT client_id AS client,clock,length,user_id AS userId FROM collaboration_authorship WHERE room_key=? ORDER BY client_id,clock').all(roomKey) as unknown as AuthorshipRange[]}
 record(roomKey:string,update:Uint8Array,userId:string|null):AuthorshipRange[]{
  const additions:AuthorshipRange[]=[];
  // Decode the whole update before recording anything; malformed messages cannot
  // leave a partial provenance record. Adjacent structs share one range.
  const candidates:AuthorshipRange[]=[];
  for(const struct of Y.decodeUpdate(update).structs){const {client,clock}=struct.id,length=struct.length;if(!Number.isSafeInteger(client)||!Number.isSafeInteger(clock)||!Number.isSafeInteger(length)||clock<0||length<=0||!Number.isSafeInteger(clock+length))throw Error('Invalid CRDT identifier');const owner=struct instanceof Y.GC?null:userId,last=candidates.at(-1);if(last&&last.client===client&&last.userId===owner&&last.clock+last.length===clock)last.length+=length;else candidates.push({client,clock,length,userId:owner})}
  for(const candidate of candidates){let cursor=candidate.clock;const end=cursor+candidate.length;
   const existing=this.db.prepare('SELECT clock,length FROM collaboration_authorship WHERE room_key=? AND client_id=? AND clock<? AND clock+length>? ORDER BY clock').all(roomKey,candidate.client,end,cursor) as {clock:number;length:number}[];
   const insert=(start:number,finish:number)=>{if(finish<=start)return;const range={...candidate,clock:start,length:finish-start};this.db.prepare('INSERT INTO collaboration_authorship(room_key,client_id,clock,length,user_id) VALUES(?,?,?,?,?)').run(roomKey,range.client,range.clock,range.length,range.userId);additions.push(range)};
   for(const range of existing){insert(cursor,Math.min(end,range.clock));cursor=Math.max(cursor,range.clock+range.length);if(cursor>=end)break}insert(cursor,end);
  }
  return additions;
 }
 remove(roomKey:string){this.db.prepare('DELETE FROM collaboration_authorship WHERE room_key=?').run(roomKey)}
}
