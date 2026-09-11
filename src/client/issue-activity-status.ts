import type {Entity} from '../shared/types';

/** Use event-time values, never the issue's current status for a historical glyph. */
export function activityStatusChange(event:Entity,statuses:Entity[],teamId:string){
 const change=event.changes?.statusId;
 if(change){
  const before=statuses.find(status=>status.id===change.from),after=statuses.find(status=>status.id===change.to);
  return {before,status:after,message:before&&after?`moved from ${before.name} to ${after.name}`:undefined};
 }
 // Imported observations retain the rendered text rather than synthesized status history.
 if(event.sourceAnchor?.endsWith('-state-change')){
  const text=event.sourceObservedText||event.message||'';
  const matches=statuses.filter(status=>status.teamId===teamId&&text.endsWith(' to '+status.name));
  if(matches.length===1){
   const beforeMatches=statuses.filter(status=>status.teamId===teamId&&text===`moved from ${status.name} to ${matches[0].name}`);
   return {before:beforeMatches.length===1?beforeMatches[0]:undefined,status:matches[0],message:undefined};
  }
 }
 return undefined;
}

/** Group only a continuous, attributable status chain; keep every original event. */
export function groupActivityStatusChanges(events:Entity[],statuses:Entity[],teamId:string){
 const groups:Entity[][]=[];
 for(const event of events){
  const previous=groups.at(-1)?.at(-1),change=activityStatusChange(event,statuses,teamId);
  const previousChange=previous&&activityStatusChange(previous,statuses,teamId);
  const actor=event.actorId??event.userId;
  if(actor&&previous&&(previous.actorId??previous.userId)===actor&&change?.before&&change.status&&previousChange?.before&&previousChange.status?.id===change.before.id)groups.at(-1)!.push(event);
  else groups.push([event]);
 }
 return groups;
}
