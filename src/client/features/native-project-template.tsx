import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Button, Icon, RichEditor, TextInput} from '../components/ui';
import {useAppStore} from '../store';
import {FeaturePropertyPicker} from './property-picker';
import {projectStatusOptions} from './project-statuses';
import {emptyProjectPlan, ProjectPlanItem, ProjectTemplatePlan, ProjectTemplatePlanEditor} from './project-template-plan';
import {optionList} from './shared';

type Properties=Record<string,any>;
type Props={
  properties:Properties;
  onPropertiesChange:(value:Properties)=>void;
  description:string;
  onDescriptionChange:(value:string)=>void;
  plan?:ProjectTemplatePlan;
  onPlanChange:(value:ProjectTemplatePlan)=>void;
  teamId?:string;
};

const priorities=['No priority','Urgent','High','Medium','Low'].map((label,value)=>({label,value:String(value)}));

function Chip({label,icon,display,values,options,multiple=false,onChange}:{label:string;icon:string;display:string;values:string[];options:{value:string;label:string}[];multiple?:boolean;onChange:(values:string[])=>unknown}){
  return <FeaturePropertyPicker label={label} values={values} options={options} multiple={multiple} onChange={onChange} triggerLabel={label} triggerClassName="native-project-chip" triggerContent={<><Icon name={icon as any} size={13}/><span>{display}</span></>}/>;
}

function ProjectProperties({value,onChange}:{value:Properties;onChange:(value:Properties)=>void}){
  const {data}=useAppStore(),set=(key:string,next:any)=>onChange({...value,[key]:next});
  const statuses=projectStatusOptions(data),status=value.status||'backlog',statusLabel=statuses.find(option=>option.value===status)?.label||'Backlog';
  const labels=optionList(data.labels.filter(label=>!label.deletedAt&&!label.archivedAt&&label.entityType==='projects')).filter(option=>option.value);
  return <div className="native-project-properties" aria-label="Project properties">
    <Chip label="Change project status" icon="CircleDashed" display={statusLabel} values={[status]} options={statuses} onChange={values=>set('status',values[0]||'planned')}/>
    <Chip label="Change project priority" icon="MoreHorizontal" display={priorities[Number(value.priority)||0].label} values={[String(value.priority||0)]} options={priorities} onChange={values=>set('priority',Number(values[0]||0))}/>
    <Chip label="Set project lead" icon="Contact" display={value.leadId?data.users.find(user=>user.id===value.leadId)?.name||'Lead':'Lead'} values={value.leadId?[value.leadId]:[]} options={optionList(data.users,'No lead')} onChange={values=>set('leadId',values[0]||null)}/>
    <Chip label="Change project members" icon="Users" display={value.memberIds?.length?`${value.memberIds.length} members`:'Members'} values={value.memberIds||[]} options={optionList(data.users).filter(option=>option.value)} multiple onChange={values=>set('memberIds',values)}/>
    <Chip label="Change project teams" icon="PanelLeft" display={value.teamIds?.length?`${value.teamIds.length} teams`:'Team'} values={value.teamIds||[]} options={optionList(data.teams).filter(option=>option.value)} multiple onChange={values=>set('teamIds',values)}/>
    <Chip label="Change labels" icon="Tag" display={value.labelIds?.length?`${value.labelIds.length} labels`:'Labels'} values={value.labelIds||[]} options={labels} multiple onChange={values=>set('labelIds',values)}/>
    <Chip label="Add dependencies" icon="AlignLeft" display={(value.dependencyIds?.length||value.blockingProjectIds?.length)?`${(value.dependencyIds?.length||0)+(value.blockingProjectIds?.length||0)} dependencies`:'Dependencies'} values={value.dependencyIds||[]} options={optionList(data.projects).filter(option=>option.value)} multiple onChange={values=>set('dependencyIds',values)}/>
  </div>;
}

function IssueComposer({onCancel,onAdd,teamId}:{onCancel:()=>void;onAdd:(value:ProjectPlanItem,keepCreating:boolean)=>void;teamId?:string}){
  const {data}=useAppStore(),ref=useRef<HTMLElement>(null),[draft,setDraft]=useState<Record<string,any>>({title:'',description:'',priority:0,teamId:teamId||''}),[createMore,setCreateMore]=useState(false),set=(key:string,value:any)=>setDraft(current=>({...current,[key]:value}));
  useEffect(()=>{const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>ref.current?.closest('.native-project-template-page')?.querySelector('.native-project-template-footer')?.scrollIntoView({block:'nearest'})));return()=>cancelAnimationFrame(frame)},[]);
  const issueLabels=optionList(data.labels.filter(label=>!label.deletedAt&&!label.archivedAt&&label.entityType!=='projects')).filter(option=>option.value);
  return <section ref={ref} className="native-template-composer native-issue-composer" aria-label="Create issue">
    <span className="native-composer-kicker">Create issue</span>
    <TextInput autoFocus aria-label="Issue title" placeholder="Issue title" value={draft.title} onChange={event=>set('title',event.target.value)}/>
    <textarea className="native-composer-description" aria-label="Issue description" placeholder="Add description…" value={draft.description} onChange={event=>set('description',event.target.value)}/>
    <div className="native-composer-footer"><div className="native-composer-chips">
      <Chip label="Set team" icon="PanelLeft" display={draft.teamId?data.teams.find(team=>team.id===draft.teamId)?.name||'Team':'Team'} values={draft.teamId?[draft.teamId]:[]} options={optionList(data.teams,'Team')} onChange={values=>set('teamId',values[0]||'')}/>
      <Chip label="Change priority. No priority is selected" icon="MoreHorizontal" display={draft.priority?priorities[draft.priority].label:'Priority'} values={[String(draft.priority||0)]} options={priorities} onChange={values=>set('priority',Number(values[0]||0))}/>
      <Chip label="Change assignee. Currently no one is assigned." icon="Contact" display={draft.assigneeId?data.users.find(user=>user.id===draft.assigneeId)?.name||'Assignee':'Assignee'} values={draft.assigneeId?[draft.assigneeId]:[]} options={optionList(data.users,'Assignee')} onChange={values=>set('assigneeId',values[0]||null)}/>
      <Chip label="Change estimate. No estimate is selected" icon="Triangle" display={draft.estimate?String(draft.estimate):'Estimate'} values={draft.estimate?[String(draft.estimate)]:[]} options={['1','2','3','5','8'].map(value=>({value,label:value}))} onChange={values=>set('estimate',values[0]?Number(values[0]):null)}/>
      <Chip label="Change labels" icon="Tag" display={draft.labelIds?.length?`${draft.labelIds.length} labels`:'Labels'} values={draft.labelIds||[]} options={issueLabels} multiple onChange={values=>set('labelIds',values)}/>
    </div><div className="native-composer-bottom"><button type="button" className="native-attachment-button" aria-label="Attach images, files, or videos"><Icon name="Paperclip" size={14}/></button><div className="native-composer-actions"><label className="native-create-more"><input type="checkbox" checked={createMore} onChange={event=>setCreateMore(event.target.checked)}/>Create more</label><Button onClick={onCancel}>Cancel</Button><Button variant="primary" disabled={!draft.title.trim()} onClick={()=>{onAdd({...draft,id:crypto.randomUUID()},createMore);if(createMore)setDraft(current=>({...current,title:'',description:''}))}}>Add issue</Button></div></div></div>
  </section>;
}

function MilestoneComposer({onCancel,onAdd}:{onCancel:()=>void;onAdd:(value:ProjectPlanItem)=>void}){
  const ref=useRef<HTMLElement>(null),[draft,setDraft]=useState({name:'',description:''});
  useEffect(()=>{const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>ref.current?.closest('.native-project-template-page')?.querySelector('.native-project-template-footer')?.scrollIntoView({block:'nearest'})));return()=>cancelAnimationFrame(frame)},[]);
  return <section ref={ref} className="native-template-composer native-milestone-composer" aria-label="Create milestone"><span className="native-composer-kicker">Create milestone</span><div className="native-milestone-fields"><Icon name="Diamond" size={14}/><TextInput autoFocus aria-label="Milestone name" placeholder="Milestone name" value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/><textarea aria-label="Milestone description template" placeholder="Add a description template…" value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></div><div className="native-composer-actions"><Button onClick={onCancel}>Cancel</Button><Button variant="primary" disabled={!draft.name.trim()} onClick={()=>onAdd({...draft,id:crypto.randomUUID(),targetOffsetDays:0})}>Add milestone</Button></div></section>;
}

function MilestoneRow({item,index,onChange,onRemove}:{item:ProjectPlanItem;index:number;onChange:(value:ProjectPlanItem)=>void;onRemove:()=>void}){
  const [open,setOpen]=useState(false);
  return <div className={`native-plan-row-wrap ${open?'is-open':''}`}><div className="native-plan-row"><button type="button" className="native-plan-row-main" aria-label={item.name||`Milestone ${index+1}`} onClick={()=>setOpen(value=>!value)}><Icon name="Diamond" size={13}/><span>{item.name}</span></button><button aria-label="Remove milestone" onClick={onRemove}><Icon name="X" size={13}/></button></div>{open&&<div className="native-row-details"><TextInput aria-label={`Milestone ${index+1} name`} value={item.name||''} onChange={event=>onChange({...item,name:event.target.value})}/><textarea aria-label={`Milestone ${index+1} description`} value={item.description||''} onChange={event=>onChange({...item,description:event.target.value})}/><label><span>Target date</span><input className="input" type="number" min="-36500" max="36500" aria-label={`Milestone ${index+1} target days`} value={item.targetOffsetDays??''} onChange={event=>onChange({...item,targetOffsetDays:event.target.value===''?null:Number(event.target.value)})}/></label></div>}</div>;
}

export function NativeProjectTemplateCanvas({properties,onPropertiesChange,description,onDescriptionChange,plan:source,onPlanChange,teamId}:Props){
  const {data}=useAppStore();
  const malformed=!!source&&(typeof source!=='object'||Array.isArray(source));
  const invalidKinds=(!malformed&&source?(['milestones','issues','documents'] as const).filter(kind=>source[kind]!=null&&!Array.isArray(source[kind])):[]);
  const plan=useMemo<ProjectTemplatePlan>(()=>({...emptyProjectPlan(),...(malformed?{}:source),milestones:Array.isArray(source?.milestones)?source!.milestones.map(item=>({...item,id:item.id||crypto.randomUUID()})):[],issues:Array.isArray(source?.issues)?source!.issues.map(item=>({...item,id:item.id||crypto.randomUUID()})):[],documents:Array.isArray(source?.documents)?source!.documents.map(item=>({...item,id:item.id||crypto.randomUUID()})):[]}),[source,malformed]);
  const [composer,setComposer]=useState<'issue'|'milestone'|null>(null),[issueParent,setIssueParent]=useState<string|null>(null),[issueMenu,setIssueMenu]=useState<string|null>(null);
  if(malformed||invalidKinds.length)return <ProjectTemplatePlanEditor value={source} onChange={onPlanChange} teamId={teamId}/>;
  const remove=(kind:'issues'|'milestones',id:string)=>onPlanChange({...plan,[kind]:plan[kind].filter(item=>item.id!==id)});
  return <>
    <div className="native-project-property-row"><ProjectProperties value={properties} onChange={onPropertiesChange}/><button type="button" className="native-project-issue-trigger" aria-label="Add issue" onClick={()=>setComposer('issue')}><Icon name="Copy" size={13}/><span>{plan.issues.length?`${plan.issues.length} issue${plan.issues.length===1?'':'s'}`:'Issues'}</span></button></div>
    <div className="native-project-divider"/>
    <div className="native-project-description"><RichEditor templateMode value={description} onChange={onDescriptionChange} placeholder="Write a description, a project brief, or collect ideas…"/></div>
    {composer==='milestone'?<MilestoneComposer onCancel={()=>setComposer(null)} onAdd={milestone=>{onPlanChange({...plan,milestones:[...plan.milestones,milestone]});setComposer(null)}}/>:plan.milestones.length?<section className="native-plan-section native-milestone-section" aria-label="Template milestones"><header><button type="button"><span>Milestones</span><small>{plan.milestones.length}</small><Icon name="ChevronDown" size={11}/></button></header><div className="native-plan-rows">{plan.milestones.map((milestone,index)=><MilestoneRow key={milestone.id} item={milestone} index={index} onChange={next=>onPlanChange({...plan,milestones:plan.milestones.map(item=>item.id===milestone.id?next:item)})} onRemove={()=>remove('milestones',milestone.id)}/>)}</div><footer><button type="button" aria-label="Add milestone" onClick={()=>setComposer('milestone')}><Icon name="Plus" size={12}/>Add milestone</button></footer></section>:<section className="native-project-milestones" aria-label="Milestones"><button type="button" aria-label="Milestones"><span>Milestones</span></button><button type="button" aria-label="Add" onClick={()=>setComposer('milestone')}><Icon name="Plus" size={14}/></button></section>}
    {composer==='issue'&&<IssueComposer teamId={teamId} onCancel={()=>{setComposer(null);setIssueParent(null)}} onAdd={(issue,keepCreating)=>{onPlanChange({...plan,issues:[...plan.issues,{...issue,parentKey:issueParent}]});if(!keepCreating){setComposer(null);setIssueParent(null)}}}/>}
    {!!plan.issues.length&&composer!=='issue'&&<section className="native-plan-section native-issue-section" aria-label="Template issues"><header><button type="button"><span>Issues</span><small>{plan.issues.length}</small><Icon name="ChevronDown" size={11}/></button></header><div className="native-plan-rows">{plan.issues.map(issue=><div className={`native-plan-row ${issue.parentKey?'is-sub-issue':''}`} key={issue.id}><span>{issue.title}</span><span className="native-row-team"><Icon name="PanelLeft" size={12}/>{data.teams.find(team=>team.id===(issue.teamId||teamId))?.name||'Team'}</span><div className="native-issue-row-menu"><button aria-label="Open sub-issue menu" onClick={()=>setIssueMenu(value=>value===issue.id?null:issue.id)}><Icon name="MoreHorizontal" size={14}/></button>{issueMenu===issue.id&&<div role="menu"><button role="menuitem" onClick={()=>{setIssueParent(issue.id);setComposer('issue');setIssueMenu(null)}}>Add sub-issue</button><button role="menuitem" onClick={()=>remove('issues',issue.id)}>Delete issue</button></div>}</div></div>)}</div><footer><button type="button" aria-label="Add issue" onClick={()=>setComposer('issue')}><Icon name="Plus" size={12}/>Add issue</button></footer></section>}
    {(plan.durationDays!=null||plan.documents.length>0)&&<details className="native-project-legacy"><summary>Additional saved template details</summary><ProjectTemplatePlanEditor value={plan} onChange={onPlanChange} teamId={teamId}/></details>}
  </>;
}
