import type {Entity} from './types';
/** Infer legacy attribution only from content-change evidence, never metadata edits. */
export function contentAttribution(entity:Entity,kind:'documents'|'projects',activities:Entity[]=[]):{userId:string|null;at:string|null}{
 if(entity.lastEditedBy)return {userId:entity.lastEditedBy,at:entity.lastEditedAt||null};
 const fields=kind==='documents'?['content','title']:['description','name'];
 const events=activities.filter(event=>!event.deletedAt&&event.entityKind===kind&&event.entityId===entity.id&&fields.some(field=>event.changes?.[field]&&JSON.stringify(event.changes[field].from)!==JSON.stringify(event.changes[field].to))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||(b.entityVersion||0)-(a.entityVersion||0));
 if(events.length)return {userId:events[0].actorId||null,at:events[0].createdAt};
 if(!entity.history?.length&&entity.version===1)return {userId:entity.creatorId||entity.userId||null,at:entity.createdAt||null};
 return {userId:null,at:null};
}
