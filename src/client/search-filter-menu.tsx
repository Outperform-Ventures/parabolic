import {projectStatuses} from './features/project-statuses';
import React,{useState,useCallback} from 'react';
import type {WorkspaceData} from '../shared/types';
import type {FilterSpec} from './query';
import {Dropdown,Icon} from './components/ui';
import {NativeControlIcon} from './components/sidebar-icons';
import {CalendarInput} from './components/calendar';
import {filterConditionCount} from '../shared/filter-groups';
import {isCompositionKey} from './composition-key';

export const searchFilterFields=[['teamId','Team','ContactRound'],['statusId','Status type','Circle'],['assigneeId','Assignee / Lead','UserCircle'],['creatorId','Creator','UserCircle'],['updatedAt','Updated date','Calendar'],['createdAt','Created date','Calendar']] as const;
export function SearchFilterMenu({data,value,onChange,onAdvanced}:{data:WorkspaceData;value:FilterSpec;onChange:(value:FilterSpec)=>void;onAdvanced:()=>void}){
 const [revision,setRevision]=useState(0);const advanced=()=>{setRevision(n=>n+1);onAdvanced()};
 const [field,setField]=useState(''),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const handleOpen=useCallback((open:boolean)=>{if(open){setField('');setQuery('');setActive(0)}},[]);
 const options=field==='teamId'?data.teams.filter(t=>!t.deletedAt).map(t=>({id:t.id,name:t.name})):field==='statusId'?Array.from(new Set([...data.statuses.filter(s=>!s.deletedAt),...projectStatuses(data)].map(s=>s.type))).map(type=>({id:type,name:String(type).replace(/^./,c=>c.toUpperCase())})):data.users.filter(u=>!u.deletedAt).map(u=>({id:u.id,name:u.name||u.email}));
 const date=field.endsWith('At');
 const fields=field==='assigneeId'?['assigneeId','leadId']:field==='teamId'?['teamId','teamIds']:field==='creatorId'?['creatorId','createdBy']:['statusId','status'];
 const group=value.groups?.find(g=>g.match==='any'&&g.conditions.length===fields.length&&fields.every(f=>g.conditions.some(c=>c.field===f)));
 const rawSelected=group?.conditions[0]?.value||[];
 const selected=field==='statusId'?Array.from(new Set([...data.statuses,...projectStatuses(data)].filter(s=>rawSelected.includes(s.id)).map(s=>s.type))):rawSelected;
 const toggle=(id:string)=>{
  const ids=selected.includes(id)?selected.filter((v:string)=>v!==id):[...selected,id];
  const statuses=[...data.statuses,...projectStatuses(data)].filter(s=>ids.includes(s.type)).map(s=>s.id);
  const next:FilterSpec={match:'any',conditions:fields.map(f=>({field:f,operator:'in',value:field==='statusId'?(f==='statusId'?statuses:[...statuses,...ids]):ids}))};
  onChange({...value,groups:[...(value.groups||[]).filter(g=>g!==group),...(ids.length?[next]:[])]});
 };
 const dateCondition=value.conditions.find(c=>c.field===field);
 const visibleFields=searchFilterFields.filter(([,label])=>label.toLowerCase().includes(query.toLowerCase()));
 return <Dropdown key={revision} align="right" sideOffset={4} menuClassName="search-native-filter-menu" onOpenChange={handleOpen} trigger={<button className="icon-button" aria-label="Add filter"><NativeControlIcon name="Add filter"/>{filterConditionCount(value)>0&&<span className="search-filter-count">{filterConditionCount(value)}</span>}</button>}>
 <div data-keep-open>
 <input className="search-native-filter-input" autoFocus aria-label={field?'Filter values':'Add Filter…'} placeholder={field?'Filter…':'Add Filter…'} value={query} onChange={e=>{setQuery(e.target.value);setActive(0)}} onKeyDown={e=>{if(isCompositionKey(e.nativeEvent))return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();setActive(i=>Math.max(0,Math.min(visibleFields.length,i+(e.key==='ArrowDown'?1:-1))))}if(e.key==='Enter'&&!field){e.preventDefault();e.stopPropagation();if(active===0)advanced();else{setField(visibleFields[active-1][0]);setQuery('');}}}}/>
 {!field?<div role="listbox" aria-label="Search filter fields"><button role="option" aria-selected={active===0} className="menu-item" onClick={advanced}><Icon name="ListFilter"/><span>Advanced filter</span></button><div className="menu-separator"/>{visibleFields.map(([key,label,icon],index)=><React.Fragment key={key}><button role="option" aria-selected={active===index+1} className="menu-item" onClick={()=>{setField(key);setQuery('')}}><Icon name={icon}/><span>{label}</span><Icon name="ChevronRight" size={12}/></button>{['statusId','creatorId'].includes(key)&&<div className="menu-separator"/>}</React.Fragment>)}</div>:<div className="search-native-filter-values"><button className="menu-item" onClick={()=>{setField('');setQuery('')}}><Icon name="ChevronLeft"/>{searchFilterFields.find(([key])=>key===field)?.[1]}</button>{date?<><select aria-label="Date comparison" value={dateCondition?.operator||'gte'} onChange={e=>onChange({...value,conditions:[...value.conditions.filter(c=>c.field!==field),{field,operator:e.target.value,value:dateCondition?.value||new Date().toISOString().slice(0,10)}]})}><option value="gte">On or after</option><option value="lte">On or before</option></select><CalendarInput label="Filter date" value={dateCondition?.value||''} onChange={date=>onChange({...value,conditions:[...value.conditions.filter(c=>c.field!==field),...(date?[{field,operator:dateCondition?.operator||'gte',value:date}]:[])]})}/></>:options.filter(o=>String(o.name).toLowerCase().includes(query.toLowerCase())).map(o=><label className="menu-item" key={o.id}><input type="checkbox" checked={field==='statusId'?!!group?.conditions[0]?.value?.some((id:string)=>[...data.statuses,...projectStatuses(data)].some(s=>s.id===id&&s.type===o.id)):selected.includes(o.id)} onChange={()=>toggle(o.id)}/>{o.name}</label>)}</div>}
 </div></Dropdown>
}
