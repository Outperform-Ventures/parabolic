import React from 'react';
import {Link} from 'react-router-dom';
import {Avatar} from './components/ui';
import {EntityIcon} from './features/entity-icon';
import {useAppStore} from './store';
import {displayNameFor} from './display-name';
import {joinedSidebarTeams} from './sidebar-teams';
import {memberJoinedLabel} from './member-joined';
import type {Entity} from '../shared/types';

export function MemberQuickLook({user,onNavigate}:{user:Entity;onNavigate:()=>void}){
 const {data}=useAppStore();
 const memberships=data.memberships.filter(row=>!row.deletedAt&&row.userId===user.id);
 const teams=joinedSidebarTeams(data.teams,data.memberships,user.id);
 const projects=data.projects.filter(project=>!project.deletedAt&&!project.archivedAt&&(project.memberIds?.includes(user.id)||project.leadId===user.id));
 const joined=memberJoinedLabel(user,memberships.find(row=>!row.teamId));
 let localTime:string|undefined;
 try{if(user.timezone)localTime=new Intl.DateTimeFormat(undefined,{timeZone:user.timezone,hour:'numeric',minute:'2-digit'}).format(new Date());}catch{}
 return <aside className="member-quick-look" aria-label="Member details">
  <header><Avatar user={user} size={54}/><div><strong>{displayNameFor(user,data)}</strong>{user.username&&<span className="muted">{user.username}</span>}</div></header>
  <dl>{user.email&&<><dt>Email</dt><dd>{user.email}</dd></>}{localTime&&<><dt>Local time</dt><dd>{localTime}</dd></>}{joined&&<><dt>Joined</dt><dd>{joined}</dd></>}</dl>
  <section><span className="muted">Teams</span><div>{teams.map(team=><Link onClick={onNavigate} key={team.id} to={'/team/'+team.id+'/overview'}><EntityIcon entity={team} size={14}/>{team.name}</Link>)}</div></section>
  <section><span className="muted">Projects</span><div>{projects.map(project=><Link onClick={onNavigate} key={project.id} to={'/project/'+project.id+'/overview'}><EntityIcon entity={project} size={14}/>{project.name}</Link>)}</div></section>
 </aside>;
}
