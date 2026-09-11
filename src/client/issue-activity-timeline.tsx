import {useEffect,useState,type CSSProperties} from 'react';
import {Link,useLocation} from 'react-router-dom';
import type {Entity} from '../shared/types';
import {useAppStore} from './store';
import {EntityIcon} from './features/entity-icon';
import {Avatar,Icon,StatusIcon} from './components/ui';
import {attributedUser,displayNameFor} from './display-name';
import {relativeDate} from './query';
import {activityStatusChange,groupActivityStatusChanges} from './issue-activity-status';

export function activityDate(date:string,expanded=false){
 const short=relativeDate(date).replace(/^(\d+)m ago$/,'$1min ago');
 if(!expanded)return short;
 return short.replace(/^(\d+)(min|h|d) ago$/,(_,n,unit)=>`${n} ${{min:'minute',h:'hour',d:'day'}[unit as 'min'|'h'|'d']}${n==='1'?'':'s'} ago`);
}
const anchor=(event:Entity)=>event.sourceAnchor?.replace(/^#/,'')||'update-'+event.id;

export function IssueActivityTimeline({activity,teamId,issueId}:{activity:Entity[];teamId:string;issueId?:string}){
 const store=useAppStore(),{data}=store,location=useLocation();
 const [expanded,setExpanded]=useState<Set<string>>(new Set()),[,tick]=useState(0);
 const groups=groupActivityStatusChanges(activity,data.statuses,teamId);
 useEffect(()=>{
  const refresh=()=>{if(!document.hidden)tick(n=>n+1);};
  const timer=window.setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 useEffect(()=>{
  const target=location.hash.slice(1);
  const group=groups.find(events=>events.length>1&&events.some(event=>anchor(event)===target||'update-'+event.id===target));
  if(group)setExpanded(current=>current.has(group[0].id)?current:new Set([...current,group[0].id]));
 },[location.hash,activity.map(event=>event.id).join('|')]);
 useEffect(()=>{if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'center'});},[expanded,location.hash]);
 const row=(event:Entity,options:{first?:Entity;toggle?:()=>void;open?:boolean;child?:boolean}={})=>{
  const change=activityStatusChange(event,data.statuses,teamId),first=options.first&&activityStatusChange(options.first,data.statuses,teamId);
  const before=first?.before??change?.before;
  const user=attributedUser(data,event.actorId??event.userId,event.actorIdentity),member=data.users.find(u=>!u.deletedAt&&u.id===(event.actorId??event.userId));
  const name=displayNameFor(user,data,'Member'),avatar=<Avatar user={user} size={14}/>;
  const copy=<><strong>{member?<Link to={'/profiles/'+member.id} onClick={e=>e.stopPropagation()}>{name}</Link>:name}</strong>{' '}{before&&change?.status?<>moved from <strong>{before.name}</strong> to <strong>{change.status.name}</strong></>:event.message??event.description??change?.message??(event.action==='create'?'created the issue':event.action==='update'?'updated the issue':`${event.action??'updated'} ${event.field??'issue'}`)}</>;
  return <div className="activity-event" id={options.toggle?undefined:anchor(event)} key={event.id}>
   {!options.toggle&&anchor(event)!=='update-'+event.id&&<span id={'update-'+event.id}/>}
   <span className="activity-event-avatar">{options.toggle?<button className="activity-group-glyph" aria-label={options.open?'Collapse status changes':'Expand status changes'} aria-expanded={options.open} onClick={options.toggle}><Icon name={options.open?'ChevronDown':'ChevronRight'} size={8}/>{change?.status&&<StatusIcon status={change.status} size={14}/>}</button>:change?.status?<StatusIcon status={change.status} size={14}/>:(event.field==='estimate'||event.sourceAnchor?.endsWith('-estimate-change'))?<EntityIcon entity={{icon:'Estimate',color:'var(--muted)'}} size={14}/>:member?<Link aria-label={name} to={'/profiles/'+member.id}>{avatar}</Link>:avatar}</span>
   <span className="activity-event-copy">{options.toggle?<span role="button" tabIndex={0} aria-expanded={options.open} onClick={options.toggle} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();options.toggle?.();}}}>{copy}</span>:copy}<span className="activity-event-dot"> · </span><Link className="activity-event-permalink" to={(issueId?'/issues/'+issueId:location.pathname+location.search)+'#'+anchor(event)} title={new Date(event.createdAt).toLocaleString()} onClick={clickEvent=>{clickEvent.preventDefault();const href=(issueId?'/issues/'+issueId:location.pathname+location.search)+'#'+anchor(event);void navigator.clipboard.writeText(window.location.origin+href).then(()=>store.toast('Link to activity item copied to clipboard')).catch(error=>store.toast(String(error)));}}><time dateTime={event.createdAt}>{activityDate(event.createdAt,options.child)}</time></Link></span>
  </div>;
 };
 const tail=groups.at(-1),tailHeight=tail&&tail.length>1&&expanded.has(tail[0].id)?tail.length*28.796875:0;
 return <div className="issue-activity-timeline" style={{'--activity-tail-height':tailHeight+'px'} as CSSProperties}>{groups.map(events=>{
  if(events.length===1)return row(events[0]);
  const id=events[0].id,open=expanded.has(id),toggle=()=>setExpanded(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  return <div className="activity-status-group" key={id}>{row(events.at(-1)!,{first:events[0],toggle,open})}{open&&<div className="activity-status-children">{events.map(event=>row(event,{child:true}))}</div>}</div>;
 })}</div>;
}
