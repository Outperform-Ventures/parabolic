import type {Entity} from './types';

/** Stable causal order where recorded; legacy ties use revision before ID. */
export function compareActivities(a:Entity,b:Entity):number {
  if(Number.isFinite(a.sequence)&&Number.isFinite(b.sequence))return a.sequence-b.sequence;
  const time=Date.parse(a.createdAt)-Date.parse(b.createdAt);
  return time||(a.entityKind===b.entityKind&&a.entityId===b.entityId&&Number.isFinite(a.entityVersion)&&Number.isFinite(b.entityVersion)?a.entityVersion-b.entityVersion:0)||a.id.localeCompare(b.id);
}
const category=(value:unknown):string|undefined=>typeof value==='string'?value.toLowerCase():undefined;
const timestamp=(event:Entity)=>Date.parse(event.createdAt);
const laterThan=(event:Entity,boundary:Entity,side:'before'|'after'='after')=>Number.isFinite(event.sequence)&&Number.isFinite(boundary.sequence)?side==='before'?event.sequence>=boundary.sequence:event.sequence>boundary.sequence:timestamp(event)>timestamp(boundary);

export function buildStatusHistory(statuses:Entity[],activities:Entity[]) {
  const current=new Map(statuses.map(status=>[status.id,category(status.type)])),history=new Map<string,Entity[]>();
  for(const event of activities)if(event.entityKind==='statuses'&&Number.isFinite(timestamp(event))&&(event.changes?.type||event.action==='create')){const rows=history.get(event.entityId)||[];rows.push(event);history.set(event.entityId,rows);}
  for(const rows of history.values())rows.sort(compareActivities);
  function categoryAt(statusId:string,time:number,boundary?:Entity):string|undefined {
    const events=history.get(statusId)||[];let type=current.get(statusId);
    if(type===undefined){const latest=[...events].reverse().find(event=>event.changes?.type?.to!=null||event.initialType!=null);type=category(latest?.changes?.type?.to??latest?.initialType);}
    for(let i=events.length-1;i>=0;i--){const event=events[i],later=boundary?laterThan(event,boundary):timestamp(event)>time;if(!later)continue;if(event.changes?.type)type=category(event.changes.type.from);else if(event.action==='create')type=undefined;}
    return type;
  }
  function eventCategory(event:Entity,side:'before'|'after',statusIdFallback?:string):string|undefined {
    const key=side==='before'?'statusTypeBefore':'statusTypeAfter';if(Object.hasOwn(event,key))return category(event[key]);
    if(side==='after'&&event.action==='create'&&Object.hasOwn(event,'initialStatusType'))return category(event.initialStatusType);
    const id=event.changes?.statusId?.[side==='before'?'from':'to']??(side==='after'?event.initialStatusId:undefined)??statusIdFallback;
    return id?categoryAt(id,timestamp(event),event):undefined;
  }
  const orderedIssues=new WeakMap<Entity[],Entity[]>();
  function stateCategory(statusId:string,time:number,issueEvents:Entity[],fallback?:string):string|undefined {
    let ordered=orderedIssues.get(issueEvents);if(!ordered){ordered=issueEvents.slice().sort(compareActivities);orderedIssues.set(issueEvents,ordered);}
    let hint:Entity|undefined,side:'before'|'after'='after';
    for(const event of ordered)if(timestamp(event)<=time&&(Object.hasOwn(event,'statusTypeAfter')||Object.hasOwn(event,'initialStatusType')||event.changes?.statusId))hint=event;
    if(!hint){hint=ordered.find(event=>timestamp(event)>time&&(Object.hasOwn(event,'statusTypeBefore')||event.changes?.statusId));side='before';}
    if(!hint)return categoryAt(statusId,time)??category(fallback);
    let type=eventCategory(hint,side,statusId);
    const definitions=history.get(statusId)||[];
    if(timestamp(hint)<=time){for(const event of definitions)if(laterThan(event,hint,side)&&timestamp(event)<=time){if(event.changes?.type)type=category(event.changes.type.to);else if(event.action==='create')type=category(event.initialType);}}
    else for(let i=definitions.length-1;i>=0;i--){const event=definitions[i];if(!laterThan(event,hint,side)&&timestamp(event)>time){if(event.changes?.type)type=category(event.changes.type.from);else if(event.action==='create')type=undefined;}}
    return type;
  }
  return {categoryAt,eventCategory,stateCategory};
}
