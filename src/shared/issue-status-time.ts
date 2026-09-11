import type {Entity} from './types';
export const statusTimeFields=['statusEnteredAt','statusTimeTotals','accumulatedStateUpdatedAt','statusTimeComplete'] as const;
export function statusTimeSnapshot(statusId:string,enteredAt:string,totals:Record<string,number>={}) {
 const entered=Date.parse(enteredAt),spent=totals[statusId]||0;
 return {statusEnteredAt:enteredAt,statusTimeTotals:totals,statusTimeComplete:true,accumulatedStateUpdatedAt:Number.isFinite(entered)?new Date(entered-spent).toISOString():null};
}
export function transitionStatusTime(previous:Entity,statusId:string,at:string){
 const totals={...(previous.statusTimeTotals||{})};
 const entered=Date.parse(previous.statusEnteredAt),now=Date.parse(at);
 if(previous.statusId&&Number.isFinite(entered)&&Number.isFinite(now))totals[previous.statusId]=(totals[previous.statusId]||0)+Math.max(0,now-entered);
 return statusTimeSnapshot(statusId,at,totals);
}
/** Reconstruct only when a creation event identifies the original state. */
export function statusTimeFromHistory(issue:Entity,activities:Entity[]){
 const history=activities.filter(a=>a.entityId===issue.id||a.issueId===issue.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const creation=history.find(a=>a.action==='create'&&a.initialStatusId);
 if(!creation)return null;
 let current={...issue,statusId:creation.initialStatusId,...statusTimeSnapshot(creation.initialStatusId,issue.createdAt)};
 for(const activity of history){const change=activity.changes?.statusId;if(!change?.to)continue;
  if(change.from!==current.statusId||Date.parse(activity.createdAt)<Date.parse(current.statusEnteredAt))return null;
  current={...current,statusId:change.to,...transitionStatusTime(current,change.to,activity.createdAt)};
 }
 return current.statusId===issue.statusId?statusTimeSnapshot(current.statusId,current.statusEnteredAt,current.statusTimeTotals):null;
}
const units={minute:['M','minute'],hour:['H','hour'],day:['D','day'],week:['W','week'],month:['M','month'],year:['Y','year']} as const;
export function parseStatusDuration(text:string){
 const match=/^\s*(\d+)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\s*$/i.exec(text);if(!match)return null;
 const count=Number(match[1]);if(!Number.isSafeInteger(count)||count<1||count>10000)return null;
 const word=match[2].toLowerCase(),unit=word.startsWith('min')?'minute':word.startsWith('h')?'hour':word.replace(/s$/,'') as keyof typeof units;
 const [code,name]=units[unit];return {id:`P${unit==='minute'||unit==='hour'?'T':''}${count}${code}`,name:`${count} ${name}${count===1?'':'s'}`};
}
export const statusDurationPresets=['1 day','1 week','2 weeks','1 month','3 months','6 months'].map(text=>parseStatusDuration(text)!);
export function statusDurationCondition(id:string){return {field:'accumulatedStateUpdatedAt',operator:'lte',value:'-'+id};}
export function statusDurationName(value:unknown){
 const match=/^-?P(T)?(\d+)([MHDWY])$/.exec(String(value));if(!match)return String(value??'');
 const unit=({M:match[1]?'minute':'month',H:'hour',D:'day',W:'week',Y:'year'} as Record<string,string>)[match[3]];
 return match[2]+' '+unit+(Number(match[2])===1?'':'s');
}
