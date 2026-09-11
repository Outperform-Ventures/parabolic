import type {Entity} from '../../shared/types';
import {buildStatusHistory,compareActivities} from '../../shared/activity-history';
/** Integrate dated workflow intervals, including re-entry, against the selected states. */
export function insightStateDuration(issue:Entity,events:Entity[],statuses:Entity[],activities:Entity[],now:number,types:string[],ids:string[]=[],definitionHistory?:ReturnType<typeof buildStatusHistory>):number|null{
 const created=Date.parse(issue.createdAt);if(!Number.isFinite(created)||created>now)return null;
 const history=definitionHistory??buildStatusHistory(statuses,activities),changes=events.filter(event=>event.changes?.statusId&&Number.isFinite(Date.parse(event.createdAt))).sort(compareActivities);
 let status=changes[0]?.changes.statusId.from??issue.statusId,cursor=created,total=0,matched=false;
 const include=(end:number)=>{const until=Math.max(cursor,Math.min(now,end));if(ids.includes(status)||types.includes(history.stateCategory(status,cursor,events,issue.status)||'')){total+=until-cursor;matched=true;}cursor=until;};
 for(const event of changes){const time=Date.parse(event.createdAt);if(time>now)break;include(time);status=event.changes.statusId.to;}
 include(now);return matched?total/86400000:null;
}
