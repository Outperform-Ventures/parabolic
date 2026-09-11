import {EntityIcon} from './features/entity-icon';
import {IssueActions} from './issues';
import {displayNameFor} from './display-name';
import './issue-mark-as.css';
import React,{useEffect,useId,useRef,useState} from 'react';
import {Modal,Icon,StatusIcon,Avatar,RichEditor,PriorityIcon} from './components/ui';
import {apiRequest,useAppStore} from './store';
import type {Entity} from '../shared/types';
export const markIssueActions=[
 {type:'parentOf',label:'Parent of…',icon:'ArrowUp',action:'Set as parent'},
 {type:'childOf',label:'Sub-issue of…',icon:'ArrowDown',shortcut:'⌘ ⇧ P',action:'Set as sub-issue'},
 {type:'related',label:'Related to…',icon:'Link',shortcut:'M then R',action:'Relate issue'},
 {type:'blockedBy',label:'Blocked by…',icon:'Ban',shortcut:'M then B',action:'Set blocked by'},
 {type:'blocks',label:'Blocking…',icon:'ArrowRight',shortcut:'M then X',action:'Set blocking'},
 {type:'duplicate',label:'Duplicate of…',icon:'Copy',shortcut:'M then M',action:'Mark as duplicate'},
] as const;
export type MarkIssueType=typeof markIssueActions[number]['type'];
export function IssueMarkAs({issue,type,onClose}:{issue:Entity;type:MarkIssueType;onClose:()=>void}){
 const store=useAppStore(),[query,setQuery]=useState(''),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),listId=useId();
 const [preview,setPreview]=useState(false),searchRef=useRef<HTMLInputElement>(null);
 const [actionTarget,setActionTarget]=useState<string|null>(null);
 const saving=useRef(false);
 const spec=markIssueActions.find(a=>a.type===type)!;
 const rows=store.data.issues.filter(row=>!row.deletedAt&&!row.archivedAt&&row.id!==issue.id&&`${row.identifier??''} ${row.title}`.toLowerCase().includes(query.toLowerCase()));
 const chosen=rows[Math.min(index,rows.length-1)];
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const entered=Date.parse(chosen?.statusEnteredAt??'');
 const elapsed=Number.isFinite(entered)&&entered<=now?now-entered:null;
 const duration=elapsed===null?null:elapsed>=86400000?Math.floor(elapsed/86400000)+'d':elapsed>=3600000?Math.floor(elapsed/3600000)+'h':Math.floor(elapsed/60000)+'m';
 useEffect(()=>{if(chosen)document.getElementById(listId+'-'+chosen.id)?.scrollIntoView({block:'nearest'});},[chosen?.id,listId]);
 async function select(target:Entity){if(saving.current)return;saving.current=true;setBusy(true);setError('');try{
  if(type==='parentOf')await store.update('issues',target.id,{parentId:issue.id});
  else if(type==='childOf')await store.update('issues',issue.id,{parentId:target.id});
  else if(type==='duplicate'){await apiRequest(`/api/v1/issues/${issue.id}/merge`,{method:'POST',body:JSON.stringify({targetId:target.id})});await store.reload();}
  else {const latest=store.data.issues.find(row=>row.id===issue.id)??issue;await store.update('issues',issue.id,{relations:[...(latest.relations??[]).filter((r:{type:string;issueId:string})=>!(r.type===type&&r.issueId===target.id)),{type,issueId:target.id}]});}
  onClose();
 }catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false);saving.current=false;}}
 if(actionTarget){const target=store.data.issues.find(row=>row.id===actionTarget);return <Modal className="command-palette issue-mark-picker" onClose={onClose}><div className="command-input"><span>{target?.identifier} · {target?.title}</span></div>{target&&<IssueActions issue={target} inline/>}</Modal>;}
 return <Modal onClose={onClose} className="command-palette issue-mark-picker">
  <div className="command-input"><Icon name="Search" size={18}/><input ref={searchRef} autoFocus role="combobox" aria-label="Command menu" aria-expanded="true" aria-controls={listId} aria-activedescendant={chosen?listId+'-'+chosen.id:undefined} placeholder={`Search for issue — ${spec.label.replace('…','').toLowerCase()}…`} value={query} onChange={e=>{setQuery(e.target.value);setIndex(0)}} onKeyDown={e=>{if(e.key==='Enter'&&e.altKey){e.preventDefault();e.stopPropagation();if(chosen)setActionTarget(chosen.id);return;}if(e.key==='ArrowRight'&&chosen){e.preventDefault();setPreview(true);return;}if(e.key==='ArrowLeft'&&preview){e.preventDefault();setPreview(false);return;}if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='Enter'){if(chosen)void select(chosen);}else setIndex(i=>Math.max(0,Math.min(rows.length-1,i+(e.key==='ArrowDown'?1:-1))));}}}/><kbd>esc</kbd></div>
  <div className={'issue-mark-body '+(preview&&chosen?'with-preview':'')}><div id={listId} role="listbox" aria-label={spec.label} className="command-results">{rows.map((row,i)=><button key={row.id} id={listId+'-'+row.id} role="option" aria-selected={chosen?.id===row.id} disabled={busy} className={'menu-item '+(chosen?.id===row.id?'selected':'')} onMouseMove={()=>setIndex(i)} onClick={()=>void select(row)}><StatusIcon status={store.data.statuses.find(s=>s.id===row.statusId)}/><span className="muted">{row.identifier}</span><span>{row.title}</span></button>)}{!rows.length&&<div className="menu-empty">No matching issues</div>}</div>
  {preview&&chosen&&<aside className="issue-mark-preview" aria-label="Issue quick look"><span className="muted">{chosen.identifier}</span><h3>{chosen.title}</h3><div className="issue-mark-properties"><span><StatusIcon status={store.data.statuses.find(s=>s.id===chosen.statusId)}/>{store.data.statuses.find(s=>s.id===chosen.statusId)?.name}{duration!==null&&<span title={'In status since '+new Date(entered).toLocaleString()}> · {duration}</span>}</span><span><PriorityIcon priority={chosen.priority??0}/>{['No priority','Urgent','High','Medium','Low'][chosen.priority??0]}</span>{chosen.assigneeId&&<span><Avatar user={store.data.users.find(u=>u.id===chosen.assigneeId)} size={16}/>{displayNameFor(store.data.users.find(u=>u.id===chosen.assigneeId),store.data)}</span>}{chosen.projectId&&<span><EntityIcon entity={store.data.projects.find(p=>p.id===chosen.projectId)} fallback="Box" size={14}/>{store.data.projects.find(p=>p.id===chosen.projectId)?.name}</span>}{chosen.estimate!=null&&<span><EntityIcon entity={{icon:"Estimate"}} size={14}/>{chosen.estimate}</span>}</div><RichEditor readOnly value={chosen.description??''} onChange={()=>{}}/></aside>}</div>
  {error&&<p className="error-text" role="alert">{error}</p>}
  <div className="command-footer"><button className="text-button" disabled={busy||!chosen} onClick={()=>chosen&&void select(chosen)}><kbd>↵</kbd> {spec.action}</button><button className="text-button" disabled={!chosen||busy} onClick={()=>chosen&&setActionTarget(chosen.id)}><kbd>⌥ ↵</kbd> More actions</button><button className="text-button issue-mark-look" disabled={!chosen} onClick={()=>{setPreview(v=>!v);searchRef.current?.focus();}}>{preview?'Close':'Quick look'} <kbd>{preview?'←':'→'}</kbd></button></div>
 </Modal>;
}
