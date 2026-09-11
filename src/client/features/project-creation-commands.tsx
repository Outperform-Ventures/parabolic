import React, {lazy, Suspense, useEffect, useState} from 'react';
import {Modal, TextInput} from '../components/ui';
import {useAppStore} from '../store';
import {RequestEditor} from './customers';
import {FormDialog, live, type Row} from './shared';
import {DocumentForm} from './document-form';
import {ProjectDependencyEditor} from './project-dependencies';
const ProjectForm=lazy(()=>import('./projects').then(module=>({default:module.ProjectForm})));

// Creation takes a snapshot of the command target, so subsequent store updates
// cannot redirect an open draft to a different focused project.
export function ProjectCreationCommands({ids,focusedId}:{ids:string[];focusedId:string|null}) {
  const store=useAppStore();
  const [customerPicker,setCustomerPicker]=useState<{projectId?:string}|null>(null);
  const [request,setRequest]=useState<{customerId:string;projectId?:string}|null>(null);
  const [milestone,setMilestone]=useState<Row|null>(null);
  const [editing,setEditing]=useState<Row|null>(null);
  const [documentProject,setDocumentProject]=useState<string|null>(null);
  const [dependencyProject,setDependencyProject]=useState<string|null>(null);
  const [query,setQuery]=useState('');
  useEffect(()=>{
    const listener=(event:Event)=>{
      if(event.defaultPrevented||document.querySelector('.issue-view[data-selected-ids]'))return;
      const command=(event as CustomEvent).detail?.command;
      if(!['new-customer-request','new-project-milestone','edit-selected-project','new-project-document','edit-project-dependencies'].includes(command))return;
      const selected=ids.length?ids:focusedId?[focusedId]:[];
      const projects=selected.map(id=>store.data.projects.find(project=>project.id===id&&!project.deletedAt&&!project.archivedAt)).filter((project):project is Row=>!!project);
      if(!projects.length)return;
      event.preventDefault();
      if(command==='new-customer-request') {setQuery('');setCustomerPicker({projectId:projects.length===1?projects[0].id:undefined})}
      else if(projects.length===1){if(command==='edit-selected-project')setEditing(projects[0]);else if(command==='new-project-document')setDocumentProject(projects[0].id);else if(command==='edit-project-dependencies')setDependencyProject(projects[0].id);else setMilestone(projects[0]);}
    };
    window.addEventListener('workspace-command',listener);
    return()=>window.removeEventListener('workspace-command',listener);
  },[ids.join(','),focusedId,store.data.projects]);
  const customers=live(store.data.customers).filter(customer=>(customer.name+' '+(customer.email||'')+' '+(customer.domain||'')).toLowerCase().includes(query.toLowerCase()));
  const chooseCustomer=(customerId:string)=>{setRequest({customerId,...customerPicker});setCustomerPicker(null)};
  return <>
    {dependencyProject&&<ProjectDependencyEditor projectId={dependencyProject} onClose={()=>setDependencyProject(null)}/>}
    {documentProject&&<DocumentForm initialProjectId={documentProject} onClose={()=>setDocumentProject(null)}/>}
    {editing&&<Suspense fallback={<Modal title="Edit project" onClose={()=>setEditing(null)}><div className="modal-body" role="status">Loading…</div></Modal>}><ProjectForm project={editing} onClose={()=>setEditing(null)}/></Suspense>}
    {customerPicker&&<Modal title="Select customer" onClose={()=>setCustomerPicker(null)}><div className="modal-body"><TextInput autoFocus aria-label="Search customers" placeholder="Select customer…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&customers.length===1){event.preventDefault();chooseCustomer(customers[0].id)}}}/><div className="selection-list" style={{maxHeight:330,overflowY:'auto',marginTop:10}}>{customers.map(customer=><button type="button" className="menu-item" key={customer.id} onClick={()=>chooseCustomer(customer.id)}>{customer.name}</button>)}{!customers.length&&<div className="menu-empty">No matching customers</div>}</div></div></Modal>}
    {request&&<RequestEditor customerId={request.customerId} projectId={request.projectId} onClose={()=>setRequest(null)}/>}
    {milestone&&<FormDialog title="New milestone" fields={[{key:'name',label:'Milestone name',required:true}]} submit="Create project milestone" onClose={()=>setMilestone(null)} onSave={async values=>{
      const name=String(values.name||'').trim();if(!name)throw Error('Enter a milestone name.');
      const current=store.data.projects.find(project=>project.id===milestone.id&&!project.deletedAt&&!project.archivedAt);if(!current)throw Error('This project is no longer available.');
      const positions=live(store.data.milestones).filter(item=>item.projectId===milestone.id).map(item=>item.position??item.sortOrder??0);
      return store.create('milestones',{projectId:milestone.id,name,position:positions.reduce((max,value)=>Math.max(max,value),-1)+1});
    }}/>}
  </>;
}
