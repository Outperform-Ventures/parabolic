import React,{useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Dropdown,Icon,MenuItem} from '../components/ui';
import {EntityIcon} from './entity-icon';
import {ViewForm} from './view-builder';
import {Confirm,live,useActions,type Row} from './shared';

export function ProjectIssueViewTabs({project,active,onBuiltin}:{project:Row;active:string;onBuiltin:(tab:string)=>void}){
 const {data,remove,act}=useActions(),navigate=useNavigate(),[editing,setEditing]=useState<Row|true|null>(null),[deleting,setDeleting]=useState<Row|null>(null);
 const views=live(data.views).filter(view=>view.entityType==='issues'&&view.projectId===project.id),builtins=['Overview','Activity','Issues',...(active==='Customers'?['Customers']:[])];
 const open=(view:Row)=>navigate(`/project/${project.id}/view-${view.id}`);
 return <>
  <nav className="feature-tabs project-issue-view-tabs" aria-label="Page views">
   {builtins.map(tab=><Link key={tab} className={active===tab?'active':''} aria-current={active===tab?'page':undefined} to={`/project/${project.id}/${tab==='Customers'?'requests':tab.toLowerCase()}`}>{tab}</Link>)}
   {views.map(view=><div className={'initiative-saved-tab '+(active==='view-'+view.id?'active':'')} key={view.id}><button onClick={()=>open(view)}><EntityIcon entity={view} fallback="Layers" size={12}/>{view.name}</button><Dropdown trigger={<button className="initiative-tab-menu" aria-label={'View actions: '+view.name}><Icon name="ChevronDown" size={11}/></button>}><MenuItem onClick={()=>setEditing(view)}>Edit view</MenuItem><MenuItem danger onClick={()=>setDeleting(view)}>Delete view</MenuItem></Dropdown></div>)}
   <button type="button" aria-label="Add new view" onClick={()=>setEditing(true)}><Icon name="Layers" size={14}/></button>
  </nav>
  {editing&&<ViewForm view={editing===true?undefined:editing} initialEntityType="issues" projectId={project.id} initialFilters={{match:'all',conditions:[]}} onClose={()=>setEditing(null)} onSaved={open}/>}
  {deleting&&<Confirm title={'Delete '+deleting.name+'?'} description="Delete this saved view and its tab. The issues remain unchanged." onClose={()=>setDeleting(null)} onConfirm={async()=>{const result=await act(()=>remove('views',deleting.id));if(active==='view-'+deleting.id)onBuiltin('Issues');return result}}/>}
 </>;
}
