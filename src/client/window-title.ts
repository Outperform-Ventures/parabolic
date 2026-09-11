import type {WorkspaceData} from '../shared/types';
import {myIssueTab} from './my-issues-state';
import {displayNameFor} from './display-name';

/** Page breadcrumbs used by the desktop Window menu and browser tab title. */
export function workspaceWindowTitle(savedRoute:string,data:WorkspaceData,fallback:string):string {
  const url=new URL(savedRoute,'http://workspace.local'),parts=url.pathname.split('/');
  const capitalize=(value:string)=>value ? value[0].toUpperCase()+value.slice(1) : '';
  const directoryTitle=({issues:'Issues',projects:'Projects',initiatives:'Initiatives',dashboards:'Dashboards'} as Record<string,string>)[url.searchParams.get('type')||'issues']||'Issues';
  if(parts[1]==='my-issues')return `My issues › ${myIssueTab(url.search)}`;
  if(parts[1]==='profiles')return `${displayNameFor(data.users.find(user=>user.id===parts[2]),data,'Member unavailable')} › ${parts[3]==='created'?'Created':'Assigned'}`;
  if(parts[1]==='views')return url.searchParams.get('new')==='1'?'New view':directoryTitle;
  if(parts[1]==='initiatives')return `Initiatives › ${url.searchParams.get('tab')||'Active'}`;
  if(parts[1]==='project'){
    const project=data.projects.find(item=>item.id===parts[2]);
    if(project){const labels:Record<string,string>={issues:'Issues',updates:'Updates',activity:'Activity','customer-requests':'Customer requests'};return `${project.name} › ${labels[parts[3]]||'Overview'}`;}
  }
  if(parts[1]==='team'){
    const team=data.teams.find(item=>item.id===parts[2]);
    const labels:Record<string,string>={overview:'Overview',all:'All issues',active:'Active issues',backlog:'Backlog',archive:'Archived issues',archived:'Archived issues',triage:'Triage',cycles:'Cycles',projects:'Projects',initiatives:'Initiatives',views:directoryTitle};
    if(team)return `${team.name} › ${labels[parts[3]]||capitalize(parts[3]||'overview')}`;
  }
  if(parts[1]==='settings'){
    const labels:Record<string,string>={preferences:'Preferences',profile:'Profile',notifications:'Notifications','account-security':'Security & access','connected-accounts':'Connected accounts',security:'Security & access',workspace:'Workspace',teams:'Teams',members:'Members',labels:'Labels','project-labels':'Labels','initiative-labels':'Labels',templates:'Issue templates','project-templates':'Project template',workflows:'Workflows', 'project-statuses':'Statuses','project-updates':'Updates','initiative-updates':'Initiative updates',slas:'SLAs',asks:'Asks',customers:'Customer requests',emojis:'Emojis',integrations:'Integrations'};
    const section=parts[2]||'preferences';
    if(section.startsWith('team-'))return data.teams.find(item=>item.id===section.slice(5))?.name||'Team settings';
    return labels[section]||fallback;
  }
  return fallback;
}
