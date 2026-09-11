import React,{useLayoutEffect,useRef,useState} from 'react';
import type {Entity} from '../shared/types';
import {useAppStore} from './store';
import {MenuItem} from './components/ui';
import {openReminder,pendingReminder,type ReminderKind} from './reminders';
import {parseReminderTime,reminderChoiceLabel,reminderPresets} from './reminder-time';
import {issueMenuItems,markIssueMenuActive,navigateIssueMenu,hoverIssueMenu} from './issue-menu-keyboard';
export function EntityReminderMenu({entity,kind}:{entity:Entity;kind:ReminderKind}){
 const store=useAppStore(),[query,setQuery]=useState(''),root=useRef<HTMLDivElement>(null),saving=useRef(false);
 const parsed=parseReminderTime(query),existing=pendingReminder(store.data.notifications,kind,entity.id,store.user?.id);
 useLayoutEffect(()=>{if(root.current)markIssueMenuActive(root.current,issueMenuItems(root.current)[0]);},[query]);
 const save=async(date:Date)=>{if(saving.current)return;saving.current=true;try{const data={userId:store.user?.id,type:'reminder',entityKind:kind,entityId:entity.id,remindAt:date.toISOString()};if(existing)await store.update('notifications',existing.id,data);else await store.create('notifications',data);store.toast('Reminder scheduled');}catch(error){store.toast(error instanceof Error?error.message:'Unable to schedule reminder');}finally{saving.current=false;}};
 const hint=(date:Date)=>date.toLocaleDateString('en-US',{weekday:'short'})+', '+date.getDate()+' '+date.toLocaleDateString('en-US',{month:'short'})+', '+date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
 return <div ref={root} className="issue-action-filter" onPointerMove={hoverIssueMenu} onFocusCapture={e=>{const item=(e.target as HTMLElement).closest<HTMLElement>('[role=menuitem]');if(item&&root.current)markIssueMenuActive(root.current,item);}} onKeyDown={e=>{if(navigateIssueMenu(e))return;if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.nativeEvent.isComposing&&(e.key.length===1||e.key==='Backspace')&&!(e.target as HTMLElement).closest('input')){e.preventDefault();e.stopPropagation();setQuery(current=>e.key==='Backspace'?current.slice(0,-1):current+e.key);root.current?.querySelector('input')?.focus();}}}>
 <span className="native-visually-hidden" role="status">Showing all items</span><input autoFocus type="search" aria-label="Reminder date and time" placeholder="Try: 4 pm, 2 days, in 5 weeks…" value={query} data-keep-open onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();issueMenuItems(root.current!)[0]?.click();}}}/>
 {query?parsed?<MenuItem icon="Clock" onClick={()=>void save(parsed)}>{reminderChoiceLabel(query,parsed)}</MenuItem>:<div className="menu-empty">Enter a complete future date or interval.</div>:<>{reminderPresets().map(choice=><MenuItem key={choice.label} icon="Clock" onClick={()=>void save(choice.date)}><span className="issue-action-date-label">{choice.label}</span><small className="issue-action-date-hint muted">{hint(choice.date)}</small></MenuItem>)}<MenuItem icon="Calendar" onClick={()=>openReminder(kind,entity.id)}>Custom…</MenuItem>{existing&&<MenuItem icon="X" onClick={()=>void store.remove('notifications',existing.id).then(()=>store.toast('Reminder canceled')).catch(error=>store.toast(error.message))}>Cancel reminder</MenuItem>}</>}
 </div>;
}
export function IssueReminderMenu({issue}:{issue:Entity}){return <EntityReminderMenu entity={issue} kind="issues"/>;}
