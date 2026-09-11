import {ProjectDependencyEditor} from './project-dependencies';
import {DocumentForm} from './document-form';
import {openReminder} from '../reminders';
import React,{useLayoutEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {MoreHorizontal} from 'lucide-react';
import {Dropdown,MenuItem} from '../components/ui';
import {apiRequest} from '../store';
import {dispatchWorkspaceCommand} from '../shortcut-actions';
import {Confirm,FormDialog,MultipleProperty,live,optionList,type Row,useActions} from './shared';
export function ProjectActions({project,onEdit,onDeleted,onRemoveFromTimeline,onShowHistory,showAuthors=false,onToggleAuthors,position,triggerLabel='More actions'}:{project:Row;onEdit?:()=>void;onDeleted?:()=>void;onRemoveFromTimeline?:()=>void;onShowHistory?:()=>void;showAuthors?:boolean;onToggleAuthors?:()=>void;position?:{x:number;y:number};triggerLabel?:string}){
 const {data,user,update,remove,reload,act,toast}=useActions(),nav=useNavigate();const commentsKey=`parabolic:project-comments-visible:${project.id}`;const[mode,setMode]=useState<'duplicate'|'teams'|'delete'|'document'|'dependencies'|null>(null),[teams,setTeams]=useState<string[]>(project.teamIds?.length?project.teamIds:project.teamId?[project.teamId]:[]),[commentsVisible,setCommentsVisible]=useState(()=>sessionStorage.getItem(commentsKey)!=='false');
 const mutationId=useRef(crypto.randomUUID());const issues=live(data.issues).filter(i=>i.projectId===project.id),documents=live(data.documents).filter(d=>d.projectId===project.id),milestones=live(data.milestones).filter(m=>m.projectId===project.id);
 const command=(command:string,field?:string)=>dispatchWorkspaceCommand({command,...(field?{field}:{})} as Parameters<typeof dispatchWorkspaceCommand>[0]);
 const favorite=live(data.favorites).some(item=>item.entityId===project.id&&item.userId===user?.id);
 const subscription=live(data.subscriptions).some(item=>item.userId===user?.id&&(item.entityId===project.id||item.projectId===project.id));
 const notifications=()=>requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-label="Setup project notifications"]')?.click());
 useLayoutEffect(()=>{document.querySelectorAll<HTMLElement>('#project-comments,.update-discussion').forEach(node=>node.hidden=!commentsVisible)},[commentsVisible,project.id]);
 const toggleComments=()=>{const visible=!commentsVisible;sessionStorage.setItem(commentsKey,String(visible));setCommentsVisible(visible)};
 const contextMenu=<>
  <MenuItem icon="Box" shortcut="›" onClick={()=>command('edit-property','status')}>Status</MenuItem>
  <MenuItem icon="BarChart3" shortcut="›" onClick={()=>command('edit-property','priority')}>Priority</MenuItem>
  <MenuItem icon="User" shortcut="›" onClick={()=>command('edit-property','leadId')}>Project lead</MenuItem>
  <MenuItem icon="Users" shortcut="›" onClick={()=>command('edit-property','memberIds')}>Members</MenuItem>
  <MenuItem icon="Calendar" onClick={()=>command('edit-property','startDate')}>Start date…</MenuItem>
  <MenuItem icon="Calendar" onClick={()=>command('edit-property','targetDate')}>Target date…</MenuItem>
  <MenuItem icon="Users" shortcut="›" onClick={()=>command('edit-property','teamIds')}>Teams</MenuItem>
  <MenuItem icon="Tag" shortcut="›" onClick={()=>command('edit-property','labelIds')}>Labels</MenuItem>
  <MenuItem icon="Layers" shortcut="›" onClick={()=>command('edit-selected-project')}>More properties</MenuItem>
  <div className="menu-separator"/>
  <MenuItem icon="Copy" shortcut="›" onClick={()=>command('copy-entity-url')}>Copy</MenuItem>
  <MenuItem icon="Move" shortcut="›" onClick={()=>command('edit-property','teamIds')}>Move</MenuItem>
  <MenuItem icon="ExternalLink" shortcut="›" onClick={()=>nav(`/project/${project.id}`)}>Open in</MenuItem>
  <div className="menu-separator"/>
  <MenuItem icon="Star" shortcut="⌥ F" onClick={()=>command('toggle-favorite')}>Favorite</MenuItem>
  <MenuItem icon="Bell" shortcut="›" onClick={()=>command('toggle-subscription')}>Subscribe</MenuItem>
  <MenuItem icon="Clock" shortcut="⇧ H" onClick={()=>openReminder('projects',project.id)}>Remind me</MenuItem>
  <div className="menu-separator"/>
  <MenuItem icon="MessageSquare" shortcut="N then C" onClick={()=>{nav(`/project/${project.id}`);setTimeout(()=>command('focus-comment'),0)}}>New comment…</MenuItem>
  <div className="menu-separator"/>
  <MenuItem icon="Trash2" danger onClick={()=>setMode('delete')}>Delete</MenuItem>
 </>;
 return <span className="project-actions" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><Dropdown position={position} align="right" menuClassName={position?'project-context-menu':''} onOpenChange={open=>{if(!open&&position)requestAnimationFrame(()=>{if(!document.querySelector('[role="dialog"],dialog[open]'))document.querySelector<HTMLElement>(`[data-project-row="${CSS.escape(project.id)}"]`)?.focus({preventScroll:true})})}} trigger={position?<span/>:<button className="feature-icon-button" aria-label={triggerLabel}><MoreHorizontal size={17}/></button>}>{position?contextMenu:<><MenuItem icon="Copy" shortcut="›" onClick={()=>command('copy-entity-url')}>Copy</MenuItem><MenuItem icon="Star" shortcut="⌥ F" onClick={()=>command('toggle-favorite')}>{favorite?'Unfavorite':'Favorite'}</MenuItem><MenuItem icon="Bell" shortcut="›" onClick={notifications}>{subscription?'Unsubscribe':'Subscribe'}</MenuItem><MenuItem icon="Clock" shortcut="⇧ H" onClick={()=>openReminder('projects',project.id)}>Remind me</MenuItem><div className="menu-separator"/><MenuItem icon="Clock" onClick={notifications}>Change update schedule…</MenuItem><div className="menu-separator"/>{onToggleAuthors&&<MenuItem icon="Users" shortcut="⇧ A" onClick={onToggleAuthors}>{showAuthors?'Hide author names':'Show author names'}</MenuItem>}{onShowHistory&&<MenuItem icon="History" onClick={onShowHistory}>Show description history</MenuItem>}<MenuItem icon="MessageSquare" shortcut="⌘ U" onClick={()=>nav(`/project/${project.id}/activity`)}>Show updates and activity</MenuItem><MenuItem icon="MessageSquare" onClick={toggleComments}>{commentsVisible?'Hide comments':'Show comments'}</MenuItem><div className="menu-separator"/><MenuItem icon="Trash2" danger onClick={()=>setMode('delete')}>Delete</MenuItem></>}</Dropdown>
 {mode==='dependencies'&&<ProjectDependencyEditor projectId={project.id} onClose={()=>setMode(null)}/>}
 {mode==='document'&&<DocumentForm initialProjectId={project.id} onClose={()=>setMode(null)}/>}
 {mode==='duplicate'&&<FormDialog title="Duplicate project" fields={[{key:'name',label:'Project name',required:true},{key:'startDate',label:'Start date',type:'date'},{key:'includeIssues',label:`Include issues (${issues.length})`,type:'checkbox'},{key:'includeMilestones',label:`Include milestones (${milestones.length})`,type:'checkbox'},{key:'includeDocuments',label:`Include documents (${documents.length})`,type:'checkbox'},{key:'includeDependencies',label:'Include external dependencies',type:'checkbox'}]} initial={{name:`${project.name} (copy)`,startDate:project.startDate||'',includeIssues:true,includeMilestones:true,includeDocuments:true,includeDependencies:false}} submit="Duplicate project" onClose={()=>setMode(null)} onSave={async values=>{const result=await apiRequest(`/api/v1/projects/${project.id}/duplicate`,{method:'POST',body:JSON.stringify({...values,...(teams.length?{teamIds:teams}:{}),startDate:values.startDate||undefined,clientMutationId:mutationId.current})});await reload();nav(`/project/${result.project.id}`);return result}}><MultipleProperty label="Teams" values={teams} options={optionList(data.teams)} onChange={setTeams}/><p className="muted">A new start date shifts the copied schedule by the same number of days. The duplicate starts with fresh update, comment and activity history.</p></FormDialog>}
 {mode==='teams'&&<FormDialog title="Move project to teams" fields={[]} submit="Save teams" onClose={()=>setMode(null)} onSave={async()=>{if(!teams.length)throw Error('Choose at least one team.');return act(()=>update('projects',project.id,{teamIds:teams,teamId:teams[0]}),'Project teams updated')}}><MultipleProperty label="Teams" values={teams} options={optionList(data.teams)} onChange={setTeams}/><p className="muted">Choose the teams whose project lists include this project. Its {issues.length} existing issues keep their current teams.</p></FormDialog>}
 {mode==='delete'&&<Confirm title={`Delete ${project.name}?`} description="The project will move to Recently deleted and can be restored." onClose={()=>setMode(null)} onConfirm={async()=>{const result=await act(()=>remove('projects',project.id));onDeleted?.();return result}}/>}</span>
}
