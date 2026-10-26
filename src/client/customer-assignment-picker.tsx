import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import type {Entity} from '../shared/types';
import {customerAssignments, directCustomerIds} from '../shared/customer-assignments';
import {useAppStore} from './store';
import {Icon} from './components/ui';
import {CustomerEditor} from './customer-editor';
import {useInlineMenuPosition} from './use-inline-menu-position';
import './customer-assignment-picker.css';
import './inline-issue-properties.css';

export function CustomerPicker({entity, kind, onChange, className='', label, disabled=false}: {
  entity: Partial<Entity>; kind:'issues'|'projects'; onChange:(patch:Record<string,any>)=>unknown|Promise<unknown>;
  className?:string; label?:string; disabled?:boolean;
}) {
  const {data}=useAppStore();
  const [open,setOpen]=useState(false), [query,setQuery]=useState(''), [creating,setCreating]=useState(false);
  const [active,setActive]=useState(0), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const trigger=useRef<HTMLButtonElement>(null), popup=useRef<HTMLDivElement>(null), saving=useRef(false);
  const listId=useId();
  useInlineMenuPosition(open&&!creating,trigger,popup);
  const assignment=customerAssignments(entity,data.projects,data.customers);
  const names=assignment.effectiveCustomerIds.map(id=>data.customers.find(c=>c.id===id)?.name).filter(Boolean);
  const selectedId=assignment.effectiveCustomerIds.length===1?assignment.effectiveCustomerIds[0]:null;
  const close=()=>{if(!saving.current){setOpen(false);trigger.current?.focus()}};
  useEffect(()=>{
    if(!open||creating)return;
    const outside=(event:PointerEvent)=>{if(!popup.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close()};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true)};
  },[open,creating]);
  const choose=async(id:string|null)=>{
    if(saving.current)return;
    saving.current=true;setBusy(true);setError('');
    try{
      // An explicit single selection overrides inheritance; clearing must not
      // immediately repopulate the issue from its project's customer list.
      await onChange({directCustomerIds:id?[id]:[],customerId:null,...(kind==='issues'?{inheritProjectCustomers:false}:{})});
      setOpen(false);trigger.current?.focus();
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not change customer.');}
    finally{saving.current=false;setBusy(false)}
  };
  const search=query.trim().toLowerCase();
  const choices=data.customers.filter(c=>!c.deletedAt&&(!c.archivedAt||assignment.effectiveCustomerIds.includes(c.id))&&String(c.name).toLowerCase().includes(search)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const options=[...(!search||'no customer'.includes(search)?[{id:null as string|null,name:'No customer'}]:[]),...choices.map(c=>({id:c.id as string|null,name:String(c.name)+(c.archivedAt?' (archived)':'')}))];
  const createOnly=!!search&&!options.length;
  const actionCount=options.length+(!createOnly&&selectedId?1:0)+1;
  const activeIndex=Math.min(active,actionCount-1);
  const actionProps=(index:number)=>({id:`${listId}-${index}`,'data-customer-action':index,tabIndex:-1,onMouseEnter:()=>setActive(index),onFocus:()=>setActive(index),className:`menu-item ${activeIndex===index?'selected':''}`});
  return <span className="customer-assignment-control" data-keep-open data-property="customers" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    <button ref={trigger} type="button" className={'customer-assignment-trigger '+className} disabled={disabled} aria-label={label||'Change customers'} aria-haspopup="dialog" aria-expanded={open} onClick={e=>{e.preventDefault();setQuery('');setActive(0);setError('');setOpen(!open)}}>
      <Icon name="Building2" size={14}/><span>{label||names.join(', ')||'Add customer'}</span>
    </button>
    {open&&!creating&&createPortal(<div ref={popup} role="dialog" aria-label="Assign customers" aria-busy={busy}
      className="menu property-menu issue-detail-property-menu inline-issue-property-menu customer-assignment-menu" data-property-menu="customers"
      onClick={e=>e.stopPropagation()} onKeyDown={e=>{
        e.stopPropagation();
        if(busy||e.nativeEvent.isComposing)return;
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          e.preventDefault();const next=(activeIndex+(e.key==='ArrowDown'?1:-1)+actionCount)%actionCount;setActive(next);
          const row=popup.current?.querySelector<HTMLElement>(`[data-customer-action="${next}"]`);row?.scrollIntoView({block:'nearest'});
          if(e.target!==popup.current?.querySelector('input'))row?.focus();
        }else if(e.key==='Enter'&&e.target===popup.current?.querySelector('input')){
          e.preventDefault();popup.current?.querySelector<HTMLElement>(`[data-customer-action="${activeIndex}"]`)?.click();
        }
      }}>
      <input autoFocus role="combobox" aria-label="Search customers" aria-expanded="true" aria-autocomplete="list" aria-controls={listId} aria-activedescendant={`${listId}-${activeIndex}`}
        placeholder="Assign customer…" value={query} onChange={e=>{setQuery(e.target.value);setActive(0)}} disabled={busy}/>
      <div className="menu-scroll" role="listbox" aria-label="Customers" aria-multiselectable="false" id={listId}>
        {options.map((customer,index)=><React.Fragment key={customer.id||'none'}>
          {customer.id&&options.slice(0,index).every(option=>option.id===null)&&<div className="property-menu-group" role="group" aria-label="Customers">Customers</div>}
          <button type="button" role="option" aria-label={customer.name} aria-selected={customer.id?selectedId===customer.id:assignment.effectiveCustomerIds.length===0} disabled={busy}
            {...actionProps(index)} onClick={()=>void choose(customer.id)}>
            <Icon name="Building2" size={16}/><span>{customer.name}</span>
            {(customer.id?selectedId===customer.id:assignment.effectiveCustomerIds.length===0)&&<Icon name="Check" size={14}/>}
          </button>
        </React.Fragment>)}
        {!createOnly&&selectedId&&<Link {...actionProps(options.length)} to={'/customer/'+selectedId} onClick={e=>{if(busy){e.preventDefault();return;}setOpen(false)}}><Icon name="ArrowUpRight" size={16}/><span>Open customer</span></Link>}
        {!createOnly&&<div className="property-menu-group" role="group" aria-label="New customer">New customer</div>}
        <button type="button" {...actionProps(actionCount-1)} disabled={busy} onClick={()=>setCreating(true)}>{createOnly?<><Icon name="Plus" size={16}/><span>Create {query.trim()}</span></>:'Create new customer…'}</button>
      </div>
      {error&&<p role="alert" className="error-text">{error}</p>}
    </div>,document.body)}
    {creating&&<CustomerEditor initialName={query.trim()} onClose={()=>setCreating(false)} onSaved={customer=>{setCreating(false);void choose(customer.id)}}/>}
  </span>;
}

// Bulk add/remove operations still stage a set of customers before applying it
// across multiple records. Single-record pickers use the immediate menu above.
function CustomerBulkPicker({entity, kind, onChange, className='', label, disabled=false}: {
  entity: Partial<Entity>; kind:'issues'|'projects'; onChange:(patch:Record<string,any>)=>unknown|Promise<unknown>;
  className?:string; label?:string; disabled?:boolean;
}) {
  const {data}=useAppStore(), [open,setOpen]=useState(false), [query,setQuery]=useState(''), [creating,setCreating]=useState(false),
    [selected,setSelected]=useState<string[]>([]), [inherit,setInherit]=useState(true), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const trigger=useRef<HTMLButtonElement>(null), popup=useRef<HTMLDivElement>(null), saving=useRef(false);
  useInlineMenuPosition(open&&!creating,trigger,popup);
  const assignment=customerAssignments(entity,data.projects,data.customers);
  const names=assignment.effectiveCustomerIds.map(id=>data.customers.find(c=>c.id===id)?.name).filter(Boolean);
  const inherited=customerAssignments({...entity,directCustomerIds:[],customerId:null,inheritProjectCustomers:true},data.projects,data.customers).inheritedCustomerIds;
  const close=()=>{if(!saving.current){setOpen(false);trigger.current?.focus()}};
  useEffect(()=>{if(!open||creating)return;const outside=(event:PointerEvent)=>{if(!popup.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close()};const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true)}},[open,creating]);
  const save=async()=>{if(saving.current)return;saving.current=true;setBusy(true);setError('');try{await onChange({directCustomerIds:selected,customerId:null,...(kind==='issues'?{inheritProjectCustomers:inherit}:{})});setOpen(false);trigger.current?.focus()}catch(e){setError((e as Error).message)}finally{saving.current=false;setBusy(false)}};
  const choices=data.customers.filter(c=>!c.deletedAt&&(!c.archivedAt||selected.includes(c.id))&&String(c.name).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return <span className="customer-assignment-control" data-keep-open data-property="customers" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    <button ref={trigger} type="button" className={'customer-assignment-trigger '+className} disabled={disabled} aria-label={label||'Change customers'} aria-haspopup="dialog" aria-expanded={open} onClick={e=>{e.preventDefault();setSelected(directCustomerIds(entity));setInherit(entity.inheritProjectCustomers!==false);setError('');setQuery('');setOpen(!open)}}>
      <Icon name="Building2" size={14}/><span>{label||names.join(', ')||'Add customer'}</span>
    </button>
    {open&&!creating&&createPortal(<div ref={popup} role="dialog" aria-label="Assign customers" className="menu customer-bulk-menu" onClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='ArrowDown'||e.key==='ArrowUp'){const items=Array.from(popup.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled),a')||[]),at=items.indexOf(document.activeElement as HTMLElement);e.preventDefault();items[(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()}}}>
      <input autoFocus aria-label="Search customers" placeholder="Search customers…" value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/>
      {kind==='issues'&&entity.projectId&&<div className="customer-inheritance"><label><input type="checkbox" checked={inherit} disabled={busy} onChange={e=>setInherit(e.target.checked)}/>Inherit customers from project</label>{inherit&&inherited.map(id=><span key={id}>{data.customers.find(c=>c.id===id)?.name}<small>From project</small></span>)}</div>}
      <div className="customer-assignment-options">{choices.map(customer=><label key={customer.id} className="customer-assignment-option"><input type="checkbox" aria-label={'Assign '+customer.name} disabled={busy||!!customer.archivedAt&&!selected.includes(customer.id)} checked={selected.includes(customer.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,customer.id]:ids.filter(id=>id!==customer.id))}/><Icon name="Building2" size={14}/><span>{customer.name}{customer.archivedAt?' (archived)':''}</span>{inherit&&inherited.includes(customer.id)&&<small>From project</small>}</label>)}{!choices.length&&<p className="muted">No matching customers</p>}</div>
      <button type="button" className="menu-item" disabled={busy} onClick={()=>setCreating(true)}><Icon name="Plus" size={14}/>Create customer{query?' “'+query+'”':''}…</button>
      {assignment.effectiveCustomerIds.length===1&&<Link className="menu-item" to={'/customer/'+assignment.effectiveCustomerIds[0]} onClick={()=>setOpen(false)}>Open customer</Link>}
      {error&&<p role="alert" className="error-text">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="button" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Apply'}</button></footer>
    </div>,document.body)}
    {creating&&<CustomerEditor initialName={query} onClose={()=>setCreating(false)} onSaved={customer=>{setSelected(ids=>[...new Set([...ids,customer.id])]);setQuery('')}}/>}
  </span>;
}
export function CustomerAssignmentControl({entity,kind,...props}:{entity:Entity;kind:'issues'|'projects';className?:string;label?:string;disabled?:boolean}) {
  const store=useAppStore();return <CustomerPicker {...props} entity={entity} kind={kind} onChange={patch=>store.update(kind,entity.id,patch)}/>;
}
export function CustomerBulkControl({entities,kind}:{entities:Entity[];kind:'issues'|'projects'}) {
  const store=useAppStore(),[mode,setMode]=useState<'add'|'remove'|'replace'>('add');
  const change=(patch:Record<string,any>)=>store.batch(entities.map(entity=>{
    const ids=directCustomerIds(entity),chosen=patch.directCustomerIds as string[];
    return {kind,id:entity.id,action:'update' as const,data:{customerId:null,directCustomerIds:mode==='replace'?chosen:mode==='remove'?ids.filter(id=>!chosen.includes(id)):[...new Set([...ids,...chosen])]}};
  }));
  return <div className="customer-bulk-control" data-keep-open onClick={e=>e.stopPropagation()}>
    <select aria-label="Customer assignment operation" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="add">Add customers</option><option value="remove">Remove direct customers</option><option value="replace">Replace direct customers</option></select>
    <CustomerBulkPicker label="Choose customers…" entity={{}} kind="projects" onChange={change}/>
  </div>;
}
