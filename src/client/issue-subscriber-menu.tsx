import {MemberQuickLook} from './member-quick-look';
import React,{useState,useEffect,useId,useRef} from 'react';
import {Avatar,Dropdown,Icon,Modal} from './components/ui';
import {useAppStore} from './store';
import {displayNameFor} from './display-name';
import {subscriberValues,subscriberSelectionChanges} from './subscriber-selection';
import type {Entity} from '../shared/types';

export function IssueSubscriberMenu({issue}:{issue:Entity}){
 const store=useAppStore(),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const listId=useId(),[activeIndex,setActiveIndex]=useState(0);
 const [keyboard,setKeyboard]=useState(false),[peek,setPeek]=useState(false),[pointerActive,setPointerActive]=useState(false);const searchRef=useRef<HTMLInputElement>(null),triggerRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const open=(event:Event)=>{if((event as CustomEvent).detail?.issueId===issue.id){if(triggerRef.current?.getAttribute("aria-expanded")==="true")triggerRef.current.click();setQuery("");setActiveIndex(0);setPeek(false);setError("");setKeyboard(true)}};window.addEventListener("open-issue-subscribers",open);return()=>window.removeEventListener("open-issue-subscribers",open)},[issue.id]);
 const selected=subscriberValues(issue),members=store.data.users.filter(user=>!user.deletedAt);
 const subscribers=members.filter(user=>selected.includes(user.id));
 const choices=members.filter(user=>displayNameFor(user,store.data).toLowerCase().includes(query.toLowerCase()));
 const activeUser=choices[Math.min(activeIndex,choices.length-1)];
 const toggle=async(id:string)=>{
  if(busy)return;setBusy(true);setError('');
  try{await store.batch(subscriberSelectionChanges([issue],selected.includes(id)?selected.filter(value=>value!==id):[...selected,id],[id]));}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const content=(searchable:boolean)=>(
  <div className="issue-subscriber-options" data-keep-open="true" onKeyDown={e=>{if(!searchable&&(e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopPropagation();window.dispatchEvent(new CustomEvent('open-issue-subscribers',{detail:{issueId:issue.id}}));return}if(searchable&&e.key==='ArrowRight'&&activeUser){e.preventDefault();setPeek(true);return}if(searchable&&e.key==='ArrowLeft'&&peek){e.preventDefault();setPeek(false);return}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setPointerActive(true);if(choices.length)setActiveIndex(i=>(i+(e.key==='ArrowDown'?1:choices.length-1))%choices.length);searchRef.current?.focus()}else if(e.key==='Enter'&&e.target instanceof HTMLInputElement){e.preventDefault();if(activeUser)void toggle(activeUser.id)}}}>
  {searchable?<input ref={searchRef} autoFocus type={searchable?'text':'search'} role={searchable?'combobox':undefined} aria-expanded={searchable?true:undefined} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={choices.length&&(searchable||pointerActive)?listId+'-'+activeUser.id:undefined} aria-label="Change subscribers…" placeholder="Change subscribers…" value={query} onChange={e=>{setQuery(e.target.value);setActiveIndex(0);setPointerActive(!!e.target.value)}}/>:<div className={'subscriber-pointer-search'+(query?' has-query':'')}><input ref={searchRef} autoFocus type={searchable?'text':'search'} role={searchable?'combobox':undefined} aria-expanded={searchable?true:undefined} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={choices.length&&(searchable||pointerActive)?listId+'-'+activeUser.id:undefined} aria-label="Change subscribers…" placeholder="Change subscribers…" value={query} onChange={e=>{setQuery(e.target.value);setActiveIndex(0);setPointerActive(!!e.target.value)}}/><span className="subscriber-search-shortcut" aria-hidden="true">⌘ ⇧ S</span></div>}
  <div className={searchable&&peek?"subscriber-results has-preview":"subscriber-results"}><div className="menu-scroll" id={listId} role="listbox" aria-multiselectable="true">{choices.map((user,index)=><button type="button" role="option" id={listId+"-"+user.id} aria-selected={selected.includes(user.id)} tabIndex={-1} aria-label={displayNameFor(user,store.data)} data-keep-open="true" className={"menu-item"+((searchable||pointerActive)&&index===activeIndex?" selected":"")} disabled={busy} onMouseEnter={()=>{setActiveIndex(index);setPointerActive(true)}} onMouseDown={e=>e.preventDefault()} key={user.id} onClick={()=>void toggle(user.id)}><span className="subscriber-check" aria-hidden="true">{selected.includes(user.id)&&(searchable?<Icon name="Check" size={12}/>:<svg className="subscriber-native-check" width="10" height="9" viewBox="0 0 10 8" aria-hidden="true"><path d="M3.46975 5.70757L1.88358 4.1225C1.65832 3.8974 1.29423 3.8974 1.06897 4.1225C0.843675 4.34765 0.843675 4.7116 1.06897 4.93674L3.0648 6.93117C3.29006 7.15628 3.65414 7.15628 3.8794 6.93117L8.93103 1.88306C9.15633 1.65792 9.15633 1.29397 8.93103 1.06883C8.70578 0.843736 8.34172 0.843724 8.11646 1.06879C8.11645 1.0688 8.11643 1.06882 8.11642 1.06883L3.46975 5.70757Z"/></svg>)}</span><span aria-hidden="true"><Avatar user={user} size={16}/></span><span>{displayNameFor(user,store.data)}</span>{user.id===issue.assigneeId&&<span className="muted">Assignee</span>}</button>)}</div>{searchable&&peek&&activeUser&&<MemberQuickLook user={activeUser} onNavigate={()=>setKeyboard(false)}/>}</div>
  {!choices.length&&<div className="menu-empty">No results</div>}{error&&<p role="alert" className="error-text">{error}</p>}
 {searchable&&<footer className="subscriber-picker-footer"><button className="text-button" disabled={!activeUser||busy} onClick={()=>activeUser&&void toggle(activeUser.id)}><kbd>↵</kbd>{activeUser&&selected.includes(activeUser.id)?"Remove":"Add"}</button><button className="text-button" disabled={!activeUser} onClick={()=>setPeek(value=>!value)}><kbd>{peek?"←":"→"}</kbd>{peek?"Close":"Quick look"}</button></footer>}
 </div>);
 return <><Dropdown snapToPixels className="issue-subscriber-menu" trigger={<button ref={triggerRef} className="icon-button issue-subscriber-trigger" aria-label="Change subscribers" onClick={()=>{setQuery('');setError('');setPointerActive(false);setActiveIndex(0)}}>{subscribers.length?subscribers.slice(0,3).map(user=><span key={user.id} aria-hidden="true"><Avatar user={user} size={16}/></span>):<Icon name="Users" size={16}/>}</button>}>
{content(false)}</Dropdown>{keyboard&&<Modal className="subscriber-keyboard-picker" onClose={()=>setKeyboard(false)}>{content(true)}</Modal>}</>;
}
