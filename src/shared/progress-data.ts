import {issueEffort} from './estimates';
import type {Entity} from './types';
import {compareActivities,buildStatusHistory} from './activity-history';
import {projectCompletionPrediction,type ProjectPrediction} from './project-prediction';
const DAY=86_400_000;
export function projectGraphAvailable(collection:Entity,activities:Entity[],category:(status:string)=>string):boolean{
  if(['started','completed'].includes(category(collection.status)))return true;
  return activities.some(event=>event.entityKind==='projects'&&event.entityId===collection.id&&[event.changes?.status?.from,event.changes?.status?.to].some(status=>typeof status==='string'&&category(status)==='started'));
}
export type ProgressPoint={time:number;scope:number;started:number;completed:number};
export type ProgressHistory={provenance?:{source:'issue-timestamps-and-recorded-activity';missingPriorTransitions:boolean};points:ProgressPoint[];start:number;end:number;now:number;scope:number;started:number;completed:number;unit:'points'|'issues';target:{time:number,value:number}[];predictionState?:ProjectPrediction['type'];prediction?:{date:number,optimistic:number,pessimistic:number,weeklyVelocity:number}};
function stateAt(issue:Entity,events:Entity[],time:number){
  if(Date.parse(issue.createdAt)>time)return null;
  const state={...issue};
  for(const event of events){if(Date.parse(event.createdAt)<=time)continue;
    if(event.action==='delete')state.deletedAt=null;
    else if(event.action==='restore')state.deletedAt=event.createdAt;
    for(const [key,change] of Object.entries(event.changes||{}))state[key]=(change as {from:any}).from;
  }
  return state;
}
export function buildProgressHistory({collection,kind,issues,activities,statuses,teams,workspaces=[],now=Date.now(),unit='points',timeZone='UTC'}:{collection:Entity,kind:'project'|'cycle',issues:Entity[],activities:Entity[],statuses:Entity[],teams:Entity[],workspaces?:Entity[],now?:number,unit?:'points'|'issues',timeZone?:string}):ProgressHistory{
  const field=kind==='project'?'projectId':'cycleId';
  const eventsByIssue=new Map<string,Entity[]>();
  for(const event of activities){if(event.entityKind!=='issues')continue;const list=eventsByIssue.get(event.entityId)||[];list.push(event);eventsByIssue.set(event.entityId,list)}
  for(const events of eventsByIssue.values())events.sort((a,b)=>compareActivities(b,a));
  const candidates=issues.filter(issue=>issue[field]===collection.id||(eventsByIssue.get(issue.id)||[]).some(e=>e.changes?.[field]?.from===collection.id||e.changes?.[field]?.to===collection.id));
  const statusHistory=buildStatusHistory(statuses,activities);
  const teamMap=new Map(teams.map(t=>[t.id,t]));
  const weight=(issue:Entity)=>issueEffort(issue,teamMap.get(issue.teamId),unit);
  const recorded=kind==='cycle'?(collection.progressHistory||[]).filter((point:any)=>Number.isFinite(Date.parse(point.at))).sort((a:any,b:any)=>Date.parse(a.at)-Date.parse(b.at)):[];
  const snapshotPoint=(value:any,time:number):ProgressPoint=>({time,scope:Number(unit==='issues'?value.issueCount:value.scope)||0,started:Number(unit==='issues'?value.startedIssueCount:value.started)||0,completed:Number(unit==='issues'?value.completedIssueCount:value.completed)||0});
  const tally=(time:number):ProgressPoint=>{
    if(kind==='cycle'&&collection.completionSnapshot&&time>=Date.parse(collection.endDate))return snapshotPoint(collection.completionSnapshot,time);
    if(recorded.length){let lo=0,hi=recorded.length;while(lo<hi){const middle=(lo+hi)>>>1;if(Date.parse(recorded[middle].at)<=time)lo=middle+1;else hi=middle}if(lo)return snapshotPoint(recorded[lo-1],time)}
    let scope=0,started=0,completed=0;
    for(const issue of candidates){const state=stateAt(issue,eventsByIssue.get(issue.id)||[],time);if(!state||state[field]!==collection.id||state.deletedAt)continue;const events=eventsByIssue.get(issue.id)||[];const hasLaterStatus=events.some(event=>Date.parse(event.createdAt)>time&&(event.changes?.statusId||Object.hasOwn(event,'statusTypeBefore')||Object.hasOwn(event,'statusTypeAfter')));let status=(hasLaterStatus?statusHistory.stateCategory(state.statusId,time,events,state.status):statusHistory.categoryAt(state.statusId,time)??state.status?.toLowerCase())||'';
      // Imported records may have lifecycle timestamps without a captured transition.
      // Never project their current completed/started state backward before that timestamp.
      if(!hasLaterStatus&&['completed','done'].includes(status)&&Date.parse(issue.completedAt)>time)status=Date.parse(issue.startedAt)<=time?'started':'unstarted';
      if(!hasLaterStatus&&['started','in progress'].includes(status)&&Date.parse(issue.startedAt)>time)status='unstarted';if(['canceled','cancelled','duplicate','triage'].includes(status))continue;const points=weight(state);scope+=points;if(['completed','done'].includes(status))completed+=points;else if(['started','in progress'].includes(status))started+=points}
    return {time,scope,started,completed};
  };
  const current=tally(now);const earliest=candidates.length?Math.min(...candidates.map(i=>Date.parse(i.createdAt))):Date.parse(collection.createdAt);
  let start=Date.parse(collection.startDate||collection.createdAt);if(!Number.isFinite(start))start=earliest;if(kind==='project')start=Math.min(start,earliest);
  let end=kind==='cycle'?Date.parse(collection.endDate):now;if(!Number.isFinite(end))end=now;end=Math.max(end,start+DAY);
  const actualEnd=Math.min(now,end);const step=(kind==='cycle'?1:7)*DAY;const points:ProgressPoint[]=[];
  points.push(tally(start-1));for(let time=start;time<actualEnd;time+=Math.max(step,Math.ceil((actualEnd-start)/365/DAY)*DAY))points.push(tally(time));if(actualEnd>=start)points.push(tally(actualEnd));
  if(kind==='project'){
    // Keep the observed changes as steps; weekly endpoints alone fabricate a
    // multi-day ramp when all work was created or completed on a single day.
    const changes=new Set<number>();
    for(const issue of candidates){for(const value of [issue.createdAt,issue.startedAt,issue.completedAt,issue.deletedAt,...(eventsByIssue.get(issue.id)||[]).map(event=>event.createdAt)]){const time=Date.parse(value);if(Number.isFinite(time)&&time>=start&&time<=actualEnd){changes.add(time);if(time>start)changes.add(time-1)}}}
    for(const event of activities)if(event.entityKind==='statuses'&&event.changes?.type){const time=Date.parse(event.createdAt);if(time>=start&&time<=actualEnd){changes.add(time);if(time>start)changes.add(time-1)}}
    for(const time of changes)points.push(tally(time));points.sort((a,b)=>a.time-b.time);for(let index=points.length-1;index>0;index--)if(points[index].time===points[index-1].time)points.splice(index-1,1);
  }
  if(recorded.length){for(const value of recorded){const time=Math.min(Date.parse(value.at),actualEnd);if(time>=start)points.push(tally(time))}points.sort((a,b)=>a.time-b.time);for(let index=points.length-1;index>0;index--)if(points[index].time===points[index-1].time)points.splice(index-1,1)}
  let prediction:ProgressHistory['prediction'],predictionState:ProjectPrediction['type']|undefined;
  if(kind==='project'){
    const category=(status:string)=>workspaces.find(workspace=>workspace.id===collection.workspaceId)?.projectStatuses?.find((item:any)=>item.id===status)?.type||status;
    const samples:ProgressPoint[]=[];for(let time=start+7*DAY;time<=now;time+=7*DAY)samples.push(tally(time));
    const history=Array.isArray(collection.completedScopeHistory)?collection.completedScopeHistory.filter((value:unknown)=>typeof value==='number'&&Number.isFinite(value)):samples.map(point=>point.completed);
    const result=projectCompletionPrediction({started:!!collection.startedAt||['started','completed'].includes(category(collection.status))||activities.some(event=>event.entityKind==='projects'&&event.entityId===collection.id&&[event.changes?.status?.from,event.changes?.status?.to].some(status=>typeof status==='string'&&category(status)==='started')),completed:category(collection.status)==='completed',hasIssueHistory:Array.isArray(collection.issueCountHistory)?collection.issueCountHistory.length>0:samples.length>0,issueCount:issues.filter(issue=>issue.projectId===collection.id&&!issue.deletedAt).length,completedHistory:history,scope:current.scope,progress:current.completed+current.started*.25,now});
    predictionState=result.type;
    if(result.type==='prediction'){prediction={date:result.date!,optimistic:result.optimistic!,pessimistic:result.pessimistic!,weeklyVelocity:result.weeklyVelocity!};end=Math.max(end,prediction.pessimistic)}
  }
  if(kind==='project'&&collection.targetDate&&Number.isFinite(Date.parse(collection.targetDate)))end=Math.max(end,Date.parse(collection.targetDate));
  const target:{time:number,value:number}[]=[];const isWorkingDay=(time:number)=>!['Sat','Sun'].includes(new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short'}).format(new Date(time)));
  if(kind==='cycle'&&end>start){const futureStart=Math.max(start,Math.min(now,end));let workingDays=0;for(let t=futureStart+DAY;t<=end+DAY/2;t+=DAY){if(isWorkingDay(t))workingDays++}target.push({time:futureStart,value:current.completed});let count=0;for(let t=futureStart+DAY;t<=end+DAY/2;t+=DAY){if(isWorkingDay(t))count++;target.push({time:Math.min(t,end),value:current.completed+(current.scope-current.completed)*(workingDays?count/workingDays:1)})}}
  return{...(kind==='project'?{provenance:{source:'issue-timestamps-and-recorded-activity' as const,missingPriorTransitions:candidates.some(issue=>!(eventsByIssue.get(issue.id)||[]).some(event=>event.action==='create'))}}:{}),points,start,end,now,scope:current.scope,started:current.started,completed:current.completed,unit,target,prediction,predictionState};
}
