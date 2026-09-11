import React,{useEffect,useRef,useState}from'react';
import{Modal,Icon}from'./components/ui';
import{FormDialog}from'./features/shared';
import{apiRequest,useAppStore}from'./store';
import{matchesIssueAction}from'./issue-menu-keyboard';
import type{Entity}from'../shared/types';
export function CustomerMergePicker({customer,onClose}:{customer:Entity;onClose:()=>void}){
 const store=useAppStore(),[query,setQuery]=useState(''),[index,setIndex]=useState(0),[target,setTarget]=useState<Entity|null>(null),list=useRef<HTMLDivElement>(null);
 const options=store.data.customers.filter(c=>c.id!==customer.id&&!c.deletedAt&&!c.archivedAt&&matchesIssueAction(c.name,query)).sort((a,b)=>a.name.localeCompare(b.name));
 useEffect(()=>{list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'})},[index,query]);
 if(target)return <FormDialog title={'Merge '+customer.name+' with '+target.name+'?'} fields={[]} submit="Merge customers" onClose={onClose} onSave={async()=>{await apiRequest('/api/v1/customers/'+customer.id+'/merge',{method:'POST',body:JSON.stringify({targetId:target.id})});await store.reload();onClose();return true;}}><p className="muted">Requests, linked work, favorites, and subscriptions will move to {target.name}. Its attributes will be kept. {customer.name} will move to Recently deleted.</p><button type="button" className="text-button" onClick={()=>setTarget(null)}>Choose a different customer</button></FormDialog>;
 return <Modal ariaLabel="Merge customer" className="issue-request-customer-picker customer-merge-picker" onClose={onClose}><input autoFocus aria-label="Search for customer to merge with…" placeholder="Search for customer to merge with…" value={query} onChange={e=>{setQuery(e.target.value);setIndex(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setIndex(i=>options.length?(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length:0)}if(e.key==='Enter'&&options[index]){e.preventDefault();setTarget(options[index])}}}/><div ref={list} role="listbox" aria-label="Merge targets">{options.map((c,i)=><button key={c.id} role="option" aria-selected={index===i} onMouseMove={()=>setIndex(i)} onClick={()=>setTarget(c)}>{c.logoUrl?<img className="request-customer-image" src={c.logoUrl} width="16" height="16" alt=""/>:<Icon name="Building2" size={16}/>}<span>{c.name}</span>{c.domain&&<small>{c.domain}</small>}</button>)}{!options.length&&<div role="status" className="menu-empty">No customers found</div>}</div></Modal>;
}
