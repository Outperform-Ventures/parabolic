import React,{useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Modal,TextInput,Button} from '../components/ui';
import {getAppSnapshot} from '../store';
import {live,useActions,type Row} from './shared';
import {dependencyProblem} from './timeline-data';

export function ProjectDependencyEditor({projectId,onClose}:{projectId:string;onClose:()=>void}) {
  const {data,update}=useActions(),[direction,setDirection]=useState<'blockedBy'|'blocking'>('blockedBy'),[query,setQuery]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),saving=useRef(false);
  const [pending,setPending]=useState<{id:string;direction:'blockedBy'|'blocking';checked:boolean}|null>(null);
  const projects=live(data.projects),project=projects.find(project=>project.id===projectId);
  const selected=(other:Row)=>pending?.id===other.id&&pending.direction===direction?pending.checked:direction==='blockedBy'?(project?.dependencyIds||[]).includes(other.id):(other.dependencyIds||[]).includes(projectId);
  const toggle=async(otherId:string)=>{
    if(saving.current)return;saving.current=true;setBusy(true);setError('');
    try {
      const current=live(getAppSnapshot().data.projects),blockerId=direction==='blockedBy'?otherId:projectId,blockedId=direction==='blockedBy'?projectId:otherId;
      const blocked=current.find(project=>project.id===blockedId),blocker=current.find(project=>project.id===blockerId);
      if(!blocked||!blocker)throw Error('This project is unavailable.');
      const ids:string[]=blocked.dependencyIds||[],remove=ids.includes(blockerId);
      if(!remove){const problem=dependencyProblem(blockerId,blockedId,current);if(problem)throw Error(problem)}
      setPending({id:otherId,direction,checked:!remove});
      await update('projects',blockedId,{dependencyIds:remove?ids.filter(id=>id!==blockerId):[...ids,blockerId]});
    }catch(error){setError(error instanceof Error?error.message:'Unable to change dependency.')}finally{saving.current=false;setBusy(false);setPending(null)}
  };
  const matches=projects.filter(other=>other.id!==projectId&&other.name.toLowerCase().includes(query.toLowerCase()));
  return <Modal title="Project dependencies" onClose={onClose}><div className="modal-body"><p>{project?.name||'Project unavailable'}</p><div className="feature-inline" role="group" aria-label="Dependency direction"><Button onClick={()=>{setDirection('blockedBy');setError('')}} aria-pressed={direction==='blockedBy'}>Blocked by…</Button><Button onClick={()=>{setDirection('blocking');setError('')}} aria-pressed={direction==='blocking'}>Blocking…</Button></div><TextInput autoFocus aria-label="Search dependency projects" value={query} placeholder="Search projects…" onChange={event=>setQuery(event.target.value)}/><div className="selection-list" style={{maxHeight:330,overflowY:'auto',marginTop:10}}>{matches.map(other=><label className="menu-item" key={other.id}><input type="checkbox" disabled={busy||!project} checked={selected(other)} onChange={()=>void toggle(other.id)}/><span>{other.name}</span></label>)}{!matches.length&&<div className="menu-empty">No matching projects</div>}</div>{error&&<p role="alert" className="error-text">{error}</p>}</div><div className="modal-footer"><Button onClick={onClose}>Done</Button></div></Modal>;
}

export function ProjectDependencies({project,compact=false}:{project:Row;compact?:boolean}) {
  const {data}=useActions(),[editing,setEditing]=useState(false),projects=live(data.projects);
  const incoming=projects.filter(other=>(project.dependencyIds||[]).includes(other.id)),outgoing=projects.filter(other=>(other.dependencyIds||[]).includes(project.id));
  if(compact&&!incoming.length&&!outgoing.length)return <div className="project-sidebar-dependency-empty"><button type="button" className="text-button" onClick={()=>setEditing(true)}>Add dependency</button>{editing&&<ProjectDependencyEditor projectId={project.id} onClose={()=>setEditing(false)}/>}</div>;
  return <section className="feature-section project-dependencies" aria-label={compact?'Project sidebar dependencies':'Project overview dependencies'}><h3>Dependencies</h3>{[['Blocked by',incoming],['Blocking',outgoing]].map(([title,rows])=><div key={title as string}><h4>{title as string}</h4>{(rows as Row[]).length?(rows as Row[]).map(other=><Link className="feature-dependency" to={'/project/'+other.id} key={other.id}>{other.name}</Link>):<span className="muted">None</span>}</div>)}<button type="button" className="text-button" onClick={()=>setEditing(true)}>Change dependencies…</button>{editing&&<ProjectDependencyEditor projectId={project.id} onClose={()=>setEditing(false)}/>}</section>;
}
