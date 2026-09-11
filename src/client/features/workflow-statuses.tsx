import React,{useRef,useState} from 'react';
import {Dropdown,Icon,MenuItem,StatusIcon} from '../components/ui';
import {orderedWorkflowStatuses,workflowCategories,workflowCategoryName,workflowDefaultStatus} from '../issue-workflow';
import {Action,AddButton,Blank,Confirm,FormDialog,useActions,type Row} from './shared';
import './workflow-statuses.css';

export function WorkflowStatuses({teamId}:{teamId:string}){
  const {data,create,update,remove,batch,act,toast}=useActions();
  const team=data.teams.find(team=>team.id===teamId),statuses=orderedWorkflowStatuses(data,teamId),defaultStatus=workflowDefaultStatus(data,teamId);
  const [editing,setEditing]=useState<Row|true|null>(null),[creatingType,setCreatingType]=useState('unstarted'),[deleting,setDeleting]=useState<Row|null>(null),[over,setOver]=useState<{id:string;after:boolean}|null>(null),drag=useRef<string|null>(null);
  const existing=editing&&typeof editing==='object'?editing:null;
  const categories=workflowCategories.filter(category=>category!=='duplicate'&&(category!=='triage'||team?.triageEnabled!==false));
  const openCreate=(type='unstarted')=>{setCreatingType(type);setEditing(true)};
  const move=async(source:Row,target:Row,after=false)=>{
    if(source.id===target.id)return;
    if(source.type!==target.type||source.type==='duplicate'){toast('Statuses can only be reordered within their category.');return}
    const group=statuses.filter(status=>status.type===target.type&&status.id!==source.id),index=group.findIndex(status=>status.id===target.id);group.splice(index+(after?1:0),0,source);
    await act(()=>batch(group.map((status,index)=>({kind:'statuses',id:status.id,data:{position:index*1024}}))));
  };
  const dropped=(event:React.DragEvent,status:Row)=>{event.preventDefault();event.stopPropagation();const id=drag.current||event.dataTransfer.getData('application/x-parabolic-workflow-status'),source=statuses.find(item=>item.id===id);drag.current=null;setOver(null);if(source)void move(source,status,event.clientY>event.currentTarget.getBoundingClientRect().top+event.currentTarget.getBoundingClientRect().height/2)};
  return <>
    <div className="feature-setting-title"><div><h1>Workflow statuses</h1><p>Define the stages issues move through. Drag statuses to reorder them within a category.</p></div><AddButton onClick={()=>openCreate()}>New workflow status</AddButton></div>
    {workflowCategories.map(category=>{
      const group=statuses.filter(status=>status.type===category);if(!group.length&&category!=='duplicate'&&(!categories.includes(category)||category==='triage'))return null;
      return <section className="feature-setting-section workflow-status-group" data-workflow-category={category} key={category} aria-label={workflowCategoryName(category)+' statuses'}>
        <div className="feature-between"><h3>{workflowCategoryName(category)}</h3>{categories.includes(category)&&<button className="feature-icon-button" type="button" aria-label={'Add '+workflowCategoryName(category)+' status'} onClick={()=>openCreate(category)}><Icon name="Plus" size={14}/></button>}</div>
        <div className="feature-settings-card">{group.map((status,index)=>{
          const system=category==='duplicate',isDefault=status.id===defaultStatus?.id,canDefault=['backlog','unstarted'].includes(category),used=data.issues.some(issue=>!issue.deletedAt&&issue.statusId===status.id),canDelete=!system&&group.length>1&&!used;
          const earlier=()=>index>0&&void move(status,group[index-1]),later=()=>index<group.length-1&&void move(status,group[index+1],true);
          return <div className={'feature-settings-row workflow-status-row '+(over?.id===status.id?'workflow-drop-'+(over.after?'after':'before'):'')} key={status.id} data-workflow-status-id={status.id} draggable={!system} tabIndex={system?undefined:0} aria-keyshortcuts={system?undefined:'Alt+ArrowUp Alt+ArrowDown'}
            onKeyDown={event=>{if(event.target!==event.currentTarget||!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.key==='ArrowUp')earlier();else later()}}
            onDragStart={event=>{drag.current=status.id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-parabolic-workflow-status',status.id)}} onDragEnd={()=>{drag.current=null;setOver(null)}}
            onDragOver={event=>{if(!event.dataTransfer.types.includes('application/x-parabolic-workflow-status'))return;event.preventDefault();const source=statuses.find(item=>item.id===drag.current);event.dataTransfer.dropEffect=source?.type===category&&!system?'move':'none';if(source?.type===category&&!system)setOver({id:status.id,after:event.clientY>event.currentTarget.getBoundingClientRect().top+event.currentTarget.getBoundingClientRect().height/2})}}
            onDragLeave={()=>setOver(null)} onDrop={event=>dropped(event,status)}>
            <StatusIcon status={status}/><div className="workflow-status-name"><strong>{status.name}</strong>{status.description&&<p>{status.description}</p>}</div>
            {isDefault&&<span className="workflow-default-label">Default</span>}
            {system?<span className="muted">System managed</span>:<>
              {canDefault&&!isDefault&&<Action className="workflow-default-action" onClick={()=>act(()=>update('teams',teamId,{defaultStatusId:status.id}))}>Make default</Action>}
              <Action onClick={()=>setEditing(status)}>Edit</Action>
              <Dropdown align="right" trigger={<button type="button" className="feature-icon-button" aria-label={'Workflow status actions: '+status.name}><Icon name="MoreHorizontal" size={16}/></button>}>
                <MenuItem onClick={()=>setEditing(status)}>Edit status</MenuItem>
                <MenuItem disabled={index===0} onClick={earlier}>Move up</MenuItem><MenuItem disabled={index===group.length-1} onClick={later}>Move down</MenuItem>
                {canDefault&&<MenuItem disabled={isDefault} onClick={()=>act(()=>update('teams',teamId,{defaultStatusId:status.id}))}>Make default</MenuItem>}
                {isDefault&&team?.defaultStatusId&&<MenuItem onClick={()=>act(()=>update('teams',teamId,{defaultStatusId:null}))}>Use first Backlog status</MenuItem>}
                <MenuItem danger disabled={!canDelete} onClick={()=>setDeleting(status)}>{group.length<2?'Keep one status in this category':used?'Status is used by issues':'Delete status'}</MenuItem>
              </Dropdown>
            </>}
          </div>
        })}{!group.length&&(category==='duplicate'?<div className="feature-settings-row workflow-status-row" data-system-workflow-status="duplicate"><span className="status-icon status-duplicate" style={{width:16,height:16,color:'#858699'}}><span/></span><div className="workflow-status-name"><strong>Duplicate</strong></div><span className="muted">System managed</span></div>:<p className="muted" style={{padding:16}}>No statuses in this category.</p>)}</div>
      </section>
    })}
    {!statuses.length&&<Blank title="No workflow statuses yet"/>}
    {editing&&<FormDialog title={existing?'Edit workflow status':'New workflow status'} fields={[
      {key:'name',label:'Name',required:true},
      ...(!existing?[{key:'type',label:'Category',required:true,type:'select' as const,options:categories.map(value=>({value,label:workflowCategoryName(value)}))}]:[]),
      {key:'color',label:'Color'},{key:'description',label:'Description',type:'textarea'},
    ]} initial={existing||{type:creatingType,color:'#858699'}} submit={existing?'Save changes':'Create status'} onClose={()=>setEditing(null)} onSave={values=>{
      const properties={name:values.name,color:values.color,description:values.description||''};
      return act(()=>existing?update('statuses',existing.id,properties):create('statuses',{...properties,teamId,type:values.type,position:Math.max(-1024,...statuses.filter(status=>status.type===values.type).map(status=>Number(status.position)||0))+1024}));
    }}>{existing&&<label className="feature-field"><span>Category</span><input className="input" aria-label="Category" value={workflowCategoryName(existing.type)} readOnly/><small className="muted">A status stays in the category selected when it was created.</small></label>}</FormDialog>}
    {deleting&&<Confirm title={'Delete '+deleting.name+'?'} description="This removes the unused status from the team workflow." onClose={()=>setDeleting(null)} onConfirm={()=>act(()=>remove('statuses',deleting.id))}/>}
  </>;
}
