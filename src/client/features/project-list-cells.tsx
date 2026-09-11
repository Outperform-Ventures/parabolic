import React from 'react';
import {projectStatistics,progressPercentage} from '../../shared/milestone-progress';
import {Link} from 'react-router-dom';
import {Avatar,PriorityIcon,StatusIcon} from '../components/ui';
import {NativeControlIcon} from '../components/sidebar-icons';
import {displayNameFor} from '../display-name';
import {buildProgressHistory,type ProgressPoint} from './progress-data';
import {type Row} from './shared';
import {projectStatusCategory,type ProjectStatus} from './project-statuses';

export function projectListHistories(projects:Row[],data:any){
 const byIssue=new Map<string,Row>(),byProject=new Map<string,Map<string,Row>>(),events=new Map<string,Row[]>(),statusEvents:Row[]=[];
 for(const issue of data.issues as Row[]){byIssue.set(issue.id,issue);if(issue.projectId){const set=byProject.get(issue.projectId)||new Map<string,Row>();set.set(issue.id,issue);byProject.set(issue.projectId,set)}}
 for(const event of data.activities as Row[]){if(event.entityKind==='statuses'){statusEvents.push(event);continue}if(event.entityKind!=='issues')continue;const list=events.get(event.entityId)||[];list.push(event);events.set(event.entityId,list);const issue=byIssue.get(event.entityId);if(!issue)continue;for(const id of [event.changes?.projectId?.from,event.changes?.projectId?.to])if(id){const set=byProject.get(id)||new Map<string,Row>();set.set(issue.id,issue);byProject.set(id,set)}}
 const statistics=projectStatistics(data.issues,data.statuses,data.teams);
 const result=new Map<string,{percentage:number;points:ProgressPoint[]}>();
 for(const project of projects){const issues=[...(byProject.get(project.id)?.values()||[])],activities=[...statusEvents,...issues.flatMap(issue=>events.get(issue.id)||[])];const history=buildProgressHistory({collection:project,kind:'project',issues,activities,statuses:data.statuses,teams:data.teams,workspaces:data.workspaces});const stats=statistics.get(project.id);result.set(project.id,{percentage:stats?.allCount?progressPercentage(stats.progress):projectStatusCategory(project.status,data)==='completed'?100:0,points:history.points})}
 return result;
}
export function ProjectListHealth({project,update}:{project:Row;update?:Row}){const health=project.updateHealthStatus==='missing'?'Missing':update?.health;return <Link className={'project-cell-health '+(health?'has-health':'')} to={'/project/'+project.id+'/updates'} title={health||'No updates. Click to write update.'} onClick={event=>event.stopPropagation()}><span className={'project-health-symbol '+String(health||'none').toLowerCase().replaceAll(' ','-')}/><span>{health||'No updates'}</span></Link>}
export function ProjectListPriority({value}:{value:number}){return <span className="project-cell-priority" title={['No priority','Urgent','High','Medium','Low'][value]||'No priority'}>{!value?<NativeControlIcon name="No Priority" size={16}/>:<PriorityIcon priority={value}/>}</span>}
export function ProjectListLead({user,data}:{user?:Row;data:any}){return <span className={'project-cell-lead '+(!user?'empty':'')} title={displayNameFor(user,data,'No lead')}>{user?<><Avatar user={user} size={16}/><span>{displayNameFor(user,data)}</span></>:<NativeControlIcon name="No lead" size={16}/>}</span>}
export function ProjectListStatus({project,status,history}:{project:Row;status?:ProjectStatus;history?:{percentage:number;points:ProgressPoint[]}}){const points=history?.points||[],start=points[0]?.time??0,end=points.at(-1)?.time??start+1;const path=points.map((point,index)=>`${index?'L':'M'}${(1+(point.time-start)/Math.max(1,end-start)*30).toFixed(2)},${(15-(point.scope?point.completed/point.scope:0)*13).toFixed(2)}`).join(' ');return <span className="project-cell-status" title={(status?.name||project.status||'Planned')+' · '+(history?.percentage||0)+'% complete'}><span className="project-cell-status-value"><StatusIcon size={16} status={{...status,type:status?.type==='planned'?'unstarted':status?.type} as any}/><span>{history?.percentage||0}%</span></span>{points.length>0&&<svg className="project-cell-sparkline" viewBox="0 0 32 16" width="32" height="16" role="img" aria-label="Project completion history"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</span>}
