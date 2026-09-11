import React,{useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Dropdown,Icon,MenuItem} from '../components/ui';
import {EntityIcon} from './entity-icon';
import {ViewForm} from './view-builder';
import {initiativeTabFilters} from './initiative-collection';
import {Confirm,live,useActions,type Row} from './shared';

export function InitiativeViewTabs({active,builtins,scopeId,teamId,onBuiltin,builtinHref}:{active:string;builtins:string[];scopeId?:string;teamId?:string;onBuiltin:(tab:string)=>void;builtinHref?:(tab:string)=>string}){
 const {data,remove,act}=useActions(),navigate=useNavigate(),[editing,setEditing]=useState<Row|true|null>(null),[deleting,setDeleting]=useState<Row|null>(null);
 const views=live(data.views).filter(view=>view.entityType==='initiatives'&&(scopeId?view.initiativeId===scopeId:!view.initiativeId)&&(!teamId||view.teamId===teamId));
 const open=(view:Row)=>navigate(view.initiativeId?`/initiative/${view.initiativeId}/view-${view.id}`:`/view/${view.id}`);
 return <><nav className="feature-tabs initiative-view-tabs" aria-label="Initiative views">{builtins.map(tab=>builtinHref?<Link key={tab} className={active===tab?'active':''} to={builtinHref(tab)}>{tab}</Link>:<button key={tab} className={active===tab?'active':''} onClick={()=>onBuiltin(tab)}>{tab}</button>)}{views.map(view=><div className={'initiative-saved-tab '+(active==='view-'+view.id?'active':'')} key={view.id}><button onClick={()=>open(view)}><EntityIcon entity={view} fallback="Layers" size={12}/>{view.name}</button><Dropdown trigger={<button className="initiative-tab-menu" aria-label={'View actions: '+view.name}><Icon name="ChevronDown" size={11}/></button>}><MenuItem onClick={()=>setEditing(view)}>Edit view</MenuItem><MenuItem danger onClick={()=>setDeleting(view)}>Delete view</MenuItem></Dropdown></div>)}<Dropdown trigger={<button aria-label={scopeId?'Add new view':'More initiative views'}><Icon name={scopeId?'Layers':'MoreHorizontal'} size={14}/></button>}><MenuItem onClick={()=>setEditing(true)}>{scopeId?'Add new view':'Add initiative view'}</MenuItem><MenuItem onClick={()=>onBuiltin("Completed")}>Completed</MenuItem></Dropdown></nav>
  {editing&&<ViewForm view={editing===true?undefined:editing} initialEntityType="initiatives" initialFilters={initiativeTabFilters(active)} initiativeId={scopeId} teamId={teamId} onClose={()=>setEditing(null)} onSaved={open}/>}
  {deleting&&<Confirm title={'Delete '+deleting.name+'?'} description="Delete this saved view and its tab. The initiatives remain unchanged." onClose={()=>setDeleting(null)} onConfirm={async()=>{const result=await act(()=>remove('views',deleting.id));if(active==='view-'+deleting.id)onBuiltin(builtins[0]);return result}}/>}
 </>;
}
