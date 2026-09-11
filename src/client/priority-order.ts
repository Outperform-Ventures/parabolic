import type {Entity} from '../shared/types';
export function priorityPosition(item:Entity){return Number.isFinite(item.prioritySortOrder)?item.prioritySortOrder:Number.isFinite(item.sortOrder)?item.sortOrder:Date.parse(item.createdAt)||0;}
export function comparePriority(a:Entity,b:Entity,direction='asc'){const empty=Number(!a.priority)-Number(!b.priority);if(empty)return empty;const category=(a.priority||5)-(b.priority||5);return (direction==='desc'?-1:1)*(category||priorityPosition(a)-priorityPosition(b))||String(a.id??'').localeCompare(String(b.id??''));}
/** A priority-ordered drop adopts the adjacent priority and persists workspace-wide positions. */
export function priorityDropChanges(ordered:Entity[],moving:Entity[],beforeId?:string,direction='asc'){
 const selected=new Set(moving.map(item=>item.id)),rest=ordered.filter(item=>!selected.has(item.id));let index=beforeId?rest.findIndex(item=>item.id===beforeId):rest.length;if(index<0)index=rest.length;const next=rest[index],previous=rest[index-1],priority=next?.priority??previous?.priority??moving[0]?.priority??0;
 const step=direction==='desc'?-1024:1024;const samePrevious=previous?.priority===priority?previous:undefined,sameNext=next?.priority===priority?next:undefined,lower=samePrevious?priorityPosition(samePrevious):(sameNext?priorityPosition(sameNext):0)-step*(moving.length+1),upper=sameNext?priorityPosition(sameNext):lower+step*(moving.length+1);
 return moving.map((item,i)=>({id:item.id,data:{priority,prioritySortOrder:lower+(upper-lower)*(i+1)/(moving.length+1)}}));
}
