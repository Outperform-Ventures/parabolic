import type {Entity} from './types';
import {issueEffort} from './estimates';
export function progressPercentage(value:number){const rounded=Math.round(value);return rounded===100&&value!==100?99:rounded;}
function collectionStatistics(issues:Entity[],statuses:Entity[],teams:Entity[],field:'milestoneId'|'projectId'){
 const result=new Map<string,{count:number;allCount:number;scope:number;completed:number;started:number;progress:number}>(),types=new Map(statuses.map(s=>[s.id,s.type])),teamMap=new Map(teams.map(t=>[t.id,t]));
 const counts=new Map<string,{completed:number;started:number;open:boolean}>();
 for(const issue of issues){
  if(issue.deletedAt||issue.archivedAt||issue.isClone||!issue[field])continue;
  const values=result.get(issue[field])||{count:0,allCount:0,scope:0,completed:0,started:0,progress:0},count=counts.get(issue[field])||{completed:0,started:0,open:false};
  values.allCount++;const type=types.get(issue.statusId);
  if(!['canceled','cancelled','duplicate','triage'].includes(type)){
   const weight=issueEffort(issue,teamMap.get(issue.teamId));values.count++;values.scope+=weight;
   if(type==='completed'){values.completed+=weight;count.completed++;}else{count.open=true;if(type==='started'){values.started+=weight;count.started++;}}
  }
  const fraction=values.scope?(values.completed+values.started*.25)/values.scope:values.count?(count.completed+count.started*.25)/values.count:0;
  values.progress=(fraction===1&&count.open ? .999 : Math.min(1,fraction))*100;
  result.set(issue[field],values);counts.set(issue[field],count);
 }
 return result;
}

export const milestoneStatistics=(issues:Entity[],statuses:Entity[],teams:Entity[])=>collectionStatistics(issues,statuses,teams,'milestoneId');
export const projectStatistics=(issues:Entity[],statuses:Entity[],teams:Entity[])=>collectionStatistics(issues,statuses,teams,'projectId');
