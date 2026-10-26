import React,{useState,useRef,useLayoutEffect} from 'react';
import {issueMenuItems,markIssueMenuActive,navigateIssueMenu,hoverIssueMenu} from './issue-menu-keyboard';
import {MenuItem} from './components/ui';
import {DueDateIcon} from './components/due-date-icon';
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function issueDuePresets(now=new Date()){const add=(days:number)=>{const d=new Date(now);d.setDate(d.getDate()+days);return iso(d)};return [{label:'Tomorrow',date:add(1)},{label:'End of this week',date:add((5-now.getDay()+7)%7)},{label:'In one week',date:add(7)}];}
export function parseIssueDue(text:string,now=new Date()){const q=text.trim().toLowerCase();const numeric=q.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(numeric){const d=new Date(Number(numeric[3]),Number(numeric[1])-1,Number(numeric[2]),12);return d.getFullYear()===Number(numeric[3])&&d.getMonth()===Number(numeric[1])-1&&d.getDate()===Number(numeric[2])?iso(d):null;}if(q==='today')return iso(now);const preset=issueDuePresets(now).find(p=>p.label.toLowerCase()===q);if(preset)return preset.date;const relative=q.match(/^(?:in\s+)?(\d+)\s*(h|hours?|d|days?|w|weeks?)$/);if(relative){const d=new Date(now),n=Number(relative[1]);if(n>10000)return null;if(relative[2].startsWith('h'))d.setHours(d.getHours()+n);else d.setDate(d.getDate()+n*(relative[2].startsWith('w')?7:1));return iso(d);}const named=q.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/);if(named){const months=['january','february','march','april','may','june','july','august','september','october','november','december'],month=months.findIndex(m=>m===named[1]||m.slice(0,3)===named[1]);if(month<0)return null;const day=Number(named[2]);let year=Number(named[3]||now.getFullYear());if(!named[3]&&(month<now.getMonth()||month===now.getMonth()&&day<now.getDate()))year++;const candidate=new Date(year,month,day,12);return candidate.getFullYear()===year&&candidate.getMonth()===month&&candidate.getDate()===day?iso(candidate):null;}if(/^\d{4}-\d{2}-\d{2}$/.test(q)){const d=new Date(q+'T12:00:00');return Number.isFinite(+d)&&iso(d)===q?q:null;}return null;}
const dueDateLabel=(value:string)=>{const d=new Date(value+'T12:00:00');return d.toLocaleDateString('en-US',{weekday:'short'})+', '+d.getDate()+' '+d.toLocaleDateString('en-US',{month:'short'})+', '+d.getFullYear();};
export function IssueDueMenu({onCustom,onSelect,command=false,value,onRemove,inline=false}:{command?:boolean;onCustom:()=>void;onSelect:(date:string)=>void;value?:string;onRemove?:()=>void;inline?:boolean}) {
 const [query,setQuery]=useState(''),root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(root.current)markIssueMenuActive(root.current,issueMenuItems(root.current)[0]);},[query]);
 const parsed=parseIssueDue(query),presets=issueDuePresets();
 const icon=inline?<DueDateIcon/>:null;
 const hint=(date:string)=>{const d=new Date(date.slice(0,10)+'T12:00:00');return d.toLocaleDateString('en-US',{weekday:'short'})+', '+d.getDate()+' '+d.toLocaleDateString('en-US',{month:'short'});};
 const item=(label:string,action:()=>void,date?:string,remove=false)=><MenuItem icon={inline?undefined:'Calendar'} onClick={action}>{inline&&(remove?<svg className="issue-due-date-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 6V4A2.5 2.5 0 0 0 11 1.5H4A2.5 2.5 0 0 0 1.5 4v7A2.5 2.5 0 0 0 4 13.5h2M2 5h11" stroke="currentColor" strokeWidth="1.5"/><circle cx="11" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 9v2l1.5 1" stroke="currentColor" strokeWidth="1.5"/></svg>:icon)}<span className="issue-action-date-label">{label}</span>{date&&<small className="issue-action-date-hint muted">{hint(date)}</small>}</MenuItem>;
 return <div ref={root} className="issue-action-filter" onPointerMove={hoverIssueMenu} onFocusCapture={e=>{const item=(e.target as HTMLElement).closest<HTMLElement>('[role=menuitem]');if(item&&root.current)markIssueMenuActive(root.current,item);}} onKeyDown={e=>{
  if(navigateIssueMenu(e))return;
  if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.nativeEvent.isComposing&&(e.key.length===1||e.key==='Backspace')&&!(e.target as HTMLElement).closest('input')){e.preventDefault();e.stopPropagation();setQuery(current=>e.key==='Backspace'?current.slice(0,-1):current+e.key);root.current?.querySelector('input')?.focus();}
 }}>
  <input autoFocus type="search" aria-label="Due date" placeholder="Try: 24h, 7 days, Feb 9" value={query} data-keep-open onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(parsed||!query)){e.preventDefault();e.stopPropagation();const root=e.currentTarget.parentElement; (root?.querySelector<HTMLButtonElement>('[role=menuitem][data-action-active="true"]')??root?.querySelector<HTMLButtonElement>('[role=menuitem]'))?.click();}}}/>
  {inline&&<span className="due-menu-shortcut" aria-hidden="true"><kbd>⇧</kbd><kbd>D</kbd></span>}
  {query ? parsed ? item(dueDateLabel(parsed),()=>onSelect(parsed)) : <div className="menu-empty">Enter a date or duration</div> : <>
   {value&&onRemove&&item('Remove due date',onRemove,value,true)}
   {item('Custom…',onCustom)}
   {presets.map(p=><React.Fragment key={p.label}>{item(p.label,()=>onSelect(p.date),p.date)}</React.Fragment>)}
  </>}
 </div>;
}
