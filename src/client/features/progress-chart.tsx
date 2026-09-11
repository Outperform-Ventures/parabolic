import React,{useMemo,useState} from 'react';
import {useAppStore} from '../store';
import type {Entity} from '../../shared/types';
import {buildProgressHistory,projectGraphAvailable} from './progress-data';
import {projectStatusCategory} from './project-statuses';
import {coalesceProjectProgressPoints,type ProgressPlotPoint} from './progress-path';

/** A restrained Catmull–Rom conversion matching Parabolic's rounded project scope trace. */
export function smoothProgressPath(points:ProgressPlotPoint[]){
  if(!points.length)return '';
  if(points.length===1)return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  let value=`M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for(let index=0;index<points.length-1;index++){
    const before=points[Math.max(0,index-1)],start=points[index],end=points[index+1],after=points[Math.min(points.length-1,index+2)];
    const low=Math.min(start.y,end.y),high=Math.max(start.y,end.y),clamp=(value:number)=>Math.max(low,Math.min(high,value));
    const first={x:start.x+(end.x-before.x)/6,y:clamp(start.y+(end.y-before.y)/6)};
    const second={x:end.x-(after.x-start.x)/6,y:clamp(end.y-(after.y-start.y)/6)};
    value+=` C${first.x.toFixed(2)},${first.y.toFixed(2)} ${second.x.toFixed(2)},${second.y.toFixed(2)} ${end.x.toFixed(2)},${end.y.toFixed(2)}`;
  }
  return value;
}

export function ProgressGraph({item,kind,compact=false,showHeader=true}:{item:Entity,kind:'project'|'cycle',compact?:boolean;showHeader?:boolean}){
  const {data}=useAppStore();
  const team=data.teams.find(team=>team.id===item.teamId),timeZone=team?.timezone||data.workspaces.find(workspace=>workspace.id===data.workspaceId)?.timezone||'UTC';
  const [unit,setUnit]=useState<'points'|'issues'>(team?.estimateScale==='None'?'issues':'points'),[hover,setHover]=useState<number|null>(null);
  const history=useMemo(()=>buildProgressHistory({collection:item,kind,issues:data.issues,activities:data.activities,statuses:data.statuses,teams:data.teams,workspaces:data.workspaces,unit,timeZone}),[item,data.issues,data.activities,data.statuses,data.teams,data.workspaces,kind,unit,timeZone]);
  const W=640,H=250,L=25,R=12,T=12,B=30,max=Math.max(1,...history.points.map(point=>point.scope),history.scope)*1.1;
  const x=(time:number)=>L+(time-history.start)/(history.end-history.start)*(W-L-R),y=(value:number)=>H-B-value/max*(H-T-B);
  const path=(field:'scope'|'started'|'completed')=>history.points.filter(point=>point.time>=history.start).map((point,index)=>`${index?'L':'M'}${x(point.time).toFixed(2)},${y(field==='started'?point.started+point.completed:point[field]).toFixed(2)}`).join(' ');
  const currentTime=Math.max(history.start,Math.min(history.now,history.end)),currentX=x(currentTime),baseY=y(0),startedY=y(history.started+history.completed),completedY=y(history.completed);
  const projectScopePoints=coalesceProjectProgressPoints(history.points.filter(point=>point.time>=history.start&&point.time<=currentTime).map(point=>({x:x(point.time),y:y(point.scope)})));
  if(!projectScopePoints.length||projectScopePoints.at(-1)!.x<currentX)projectScopePoints.push({x:currentX,y:y(history.scope)});
  const projectScopePath=smoothProgressPath(projectScopePoints)+(currentTime<history.end?` L${x(history.end).toFixed(2)},${y(history.scope).toFixed(2)}`:'');
  const projectStartedPath=`M${x(history.start).toFixed(2)},${baseY.toFixed(2)} L${currentX.toFixed(2)},${startedY.toFixed(2)}`;
  const projectCompletedPath=`M${x(history.start).toFixed(2)},${baseY.toFixed(2)} L${currentX.toFixed(2)},${completedY.toFixed(2)}`;
  const projectCompletedFill=`M${x(history.start).toFixed(2)},${baseY.toFixed(2)} L${currentX.toFixed(2)},${completedY.toFixed(2)} L${currentX.toFixed(2)},${baseY.toFixed(2)} Z`;
  const point=hover!==null?history.points.reduce((best,value)=>Math.abs(value.time-hover)<Math.abs(best.time-hover)?value:best,history.points[0]):null;
  const labelDate=(time:number)=>new Date(time).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone});
  const noHistory=Date.now()<history.start||(kind==='project'&&!projectGraphAvailable(item,data.activities,status=>projectStatusCategory(status,data)));
  const fillId=`project-progress-fill-${item.id.replace(/[^a-zA-Z0-9_-]/g,'')}`;

  return <div className={`feature-progress-graph ${compact?'compact':''} ${kind==='project'?'project-progress-graph':''}`}>
    {showHeader&&<div className="feature-between"><h3>Progress</h3><select aria-label="Progress units" value={unit} onChange={event=>setUnit(event.target.value as 'points'|'issues')}><option value="points">Estimate points</option><option value="issues">Issue count</option></select></div>}
    <div className="feature-graph-legend"><span><i style={{background:'#686871'}}/>Scope <strong>{history.scope}</strong></span><span><i style={{background:'#e2bd17'}}/>Started <strong>{history.started}</strong></span><span><i style={{background:'#6f67dc'}}/>Completed <strong>{history.completed}</strong></span></div>
    {noHistory?<p className="muted">Progress appears when this {kind} starts.</p>:<div className="feature-graph-canvas" onMouseLeave={()=>setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${kind} progress over time. Current scope ${history.scope}, started ${history.started}, completed ${history.completed} ${unit}.`} onMouseMove={event=>{const rect=event.currentTarget.getBoundingClientRect(),proportion=Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*W-L)/(W-L-R)));setHover(history.start+proportion*(history.end-history.start))}}>
        {kind==='project'?<>
          <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6f67dc" stopOpacity=".34"/><stop offset="1" stopColor="#6f67dc" stopOpacity=".025"/></linearGradient></defs>
          <path data-progress-fill="completed" d={projectCompletedFill} fill={`url(#${fillId})`}/>
          <line data-progress-current="true" x1={currentX} x2={currentX} y1={T} y2={baseY} stroke="var(--muted)" strokeOpacity=".18" strokeWidth="1"/>
          <path data-progress-series="scope" d={projectScopePath} fill="none" stroke="#77777f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path data-progress-series="started" d={projectStartedPath} fill="none" stroke="#e2bd17" strokeWidth="1.5" strokeLinecap="round"/>
          <path data-progress-series="completed" d={projectCompletedPath} fill="none" stroke="#6f67dc" strokeWidth="1.5" strokeLinecap="round"/>
          <circle data-progress-endpoint="started" cx={currentX} cy={startedY} r="3.5" fill="#e2bd17"/>
          <circle data-progress-endpoint="completed" cx={currentX} cy={completedY} r="3.5" fill="#6f67dc"/>
          <line data-progress-now-tail="true" x1={currentX} x2={currentX} y1={Math.min(baseY,completedY+30)} y2={baseY} stroke="#6f67dc" strokeWidth="4"/>
        </>:<>
          {[0,.5,1].map(ratio=><g key={ratio}><line x1={L} x2={W-R} y1={y(max*ratio)} y2={y(max*ratio)} stroke="var(--border)" strokeWidth="1"/><text x={L-6} y={y(max*ratio)+4} fontSize="10" textAnchor="end" fill="var(--muted)">{Math.round(max*ratio)}</text></g>)}
          {history.points.filter(value=>value.time>=history.start&&value.completed>0).map((value,index)=><line key={index} x1={x(value.time)} x2={x(value.time)} y1={y(0)} y2={y(value.completed)} stroke="#7775df" strokeOpacity=".12" strokeWidth="9"/>)}
          <path d={path('scope')} fill="none" stroke="#686871" strokeWidth="2"/><path d={path('started')} fill="none" stroke="#c3a445" strokeWidth="2"/><path d={path('completed')} fill="none" stroke="#8077df" strokeWidth="2.5"/>
        </>}
        {history.target.length>1&&<path d={history.target.map((value,index)=>`${index?'L':'M'}${x(value.time)},${y(value.value)}`).join(' ')} stroke="#7775df" strokeWidth="1.5" strokeDasharray="4 5" fill="none"/>}
        {!noHistory&&history.prediction&&<>{[history.prediction.optimistic,history.prediction.date,history.prediction.pessimistic].map((time,index)=><line key={time} x1={x(history.now)} y1={y(history.completed)} x2={x(time)} y2={y(history.scope)} stroke="#9a83dc" strokeOpacity={index===1?.9:.35} strokeWidth="1.5" strokeDasharray="3 4"/>)}</>}
        {item.targetDate&&Date.parse(item.targetDate)>=history.start&&Date.parse(item.targetDate)<=history.end&&<line x1={x(Date.parse(item.targetDate))} x2={x(Date.parse(item.targetDate))} y1={T} y2={H-B} stroke="#b25b62" strokeWidth="1" strokeDasharray="3 4"/>}
        <text x={L} y={H-5} fontSize="11" fill="var(--muted)">{labelDate(history.start)}</text><text x={W-R} y={H-5} fontSize="11" textAnchor="end" fill="var(--muted)">{labelDate(history.end)}</text>
        {point&&<><line x1={x(point.time)} x2={x(point.time)} y1={T} y2={H-B} stroke="var(--muted)" strokeDasharray="3 4"/><circle cx={x(point.time)} cy={y(point.completed)} r="4" fill="#8077df"/></>}
      </svg>
      {point&&<div className="feature-graph-tooltip"><strong>{labelDate(point.time)}</strong><span>Scope {point.scope}</span><span>Started {point.started}</span><span>Completed {point.completed}</span></div>}
    </div>}
    {!noHistory&&history.prediction&&<div className="feature-graph-prediction"><span>Estimated completion</span><strong>{labelDate(history.prediction.date)}</strong><small>{labelDate(history.prediction.optimistic)} – {labelDate(history.prediction.pessimistic)} · {history.prediction.weeklyVelocity.toFixed(1)} {history.unit}/week</small></div>}
    {kind==='project'&&!noHistory&&!history.prediction&&history.scope>history.completed&&<p className="feature-graph-note">{history.predictionState==='stale'?'A completion estimate appears when progress resumes.':'A completion estimate appears after progress has been recorded.'}</p>}
  </div>;
}
