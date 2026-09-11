import type {Entity} from '../shared/types';

/** Compare inert HTML serialization without throwing away formatting or links. */
export function equivalentDescription(before:unknown,after:unknown){
 if(before===after)return true;
 if(typeof before!=='string'||typeof after!=='string')return false;
 const template=document.createElement('template');
 template.innerHTML=before;const canonical=template.innerHTML;
 template.innerHTML=after;return canonical===template.innerHTML;
}

/** Legacy editor normalization records remain stored, but are not user edits. */
export function formattingOnlyIssueActivity(event:Entity){
 const change=event.changes?.description;
 if(event.action!=='update'||event.message||event.description||!change||!Object.hasOwn(change,'from')||!Object.hasOwn(change,'to')||!equivalentDescription(change.from,change.to))return false;
 return Object.keys(event.changes).every(key=>['description','startedAt','subscribers','subscriberIds'].includes(key));
}

export function historyDayLabel(at:string,now=Date.now()){
 const date=new Date(at),today=new Date(now);
 if(date.toDateString()===today.toDateString())return 'Today';
 const days=Math.max(1,Math.round((now-date.getTime())/86400000));
 return days===1?'Yesterday':`${days} days ago`;
}

const has=(o:any,k:string)=>o!=null&&Object.prototype.hasOwnProperty.call(o,k);
export function descriptionVersions(issue:Entity,activities:Entity[]){
 const changes=activities.filter(a=>!a.deletedAt&&a.entityId===issue.id&&(a.field==='description'||has(a.changes,'description')||has(a.before,'description'))&&!(has(a.changes?.description,'from')&&has(a.changes?.description,'to')&&equivalentDescription(a.changes.description.from,a.changes.description.to))).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
 const creation=activities.find(a=>!a.deletedAt&&a.entityId===issue.id&&a.action==='create');
 const previous=(a:Entity)=>a.before?.description??a.changes?.description?.from??a.oldValue??'';
 return [{id:'initial',description:changes.length?previous(changes[0]):issue.description??'',at:issue.createdAt,authorId:creation?.actorId??issue.creatorId},...changes.map((a,i)=>({id:a.id,description:i===changes.length-1?issue.description??'':previous(changes[i+1]),at:a.createdAt,authorId:a.actorId}))].map((v,i,all)=>({...v,current:i===all.length-1})).reverse();
}
