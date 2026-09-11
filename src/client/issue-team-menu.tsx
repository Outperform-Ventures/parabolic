import React from 'react';
import type {Entity} from '../shared/types';
import {useAppStore} from './store';
import {IssueActionFilter} from './issue-action-filter';
import {EntityIcon} from './features/entity-icon';
import {Icon} from './components/ui';
export function IssueTeamMenu({issue}:{issue:Entity}){
 const store=useAppStore();const teams=store.data.teams.filter(team=>!team.deletedAt&&!team.archivedAt).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 return <IssueActionFilter placeholder="Move to team…" initialSelection={issue.teamId}>{teams.map(team=><button key={team.id} role="menuitem" className="menu-item" data-action-value={team.id} onClick={()=>{if(team.id!==issue.teamId)void store.update('issues',issue.id,{teamId:team.id}).catch(error=>store.toast(error.message));}}><EntityIcon entity={team} fallback="Users" size={16}/><span>{team.name} <small className="muted">{team.key??team.identifier}</small></span>{team.id===issue.teamId&&<Icon name="Check" size={14}/>}</button>)}</IssueActionFilter>;
}
