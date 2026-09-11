import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {Button,Modal} from './components/ui';
import {CalendarInput} from './components/calendar';
import './recurring-issues.css';
import {useAppStore} from './store';
import type {Entity} from '../shared/types';

const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function initialRecurrenceDueDate(issue:Partial<Entity>,now=new Date()):string{
 if(issue.recurrence)return (issue.recurrenceDueDate||issue.dueDate||issue.recurrence.startDate||'').slice(0,10);
 const date=issue.dueDate?new Date(issue.dueDate.slice(0,10)+'T12:00:00'):new Date(now.getFullYear(),now.getMonth(),now.getDate()+(issue.id?0:7),12);
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 while(date<today)date.setDate(date.getDate()+7);
 return localDate(date);
}
export function RecurrenceDialog({issue,onClose,onSave}:{issue:Partial<Entity>;onClose:()=>void;onSave:(patch:Record<string,any>)=>Promise<unknown>|void}){
 const [initialDueDate]=useState(()=>initialRecurrenceDueDate(issue));
 const [dueDate,setDueDate]=useState(initialDueDate),[frequency,setFrequency]=useState(issue.recurrence?.frequency||'weekly'),[interval,setInterval]=useState(issue.recurrence?.interval||1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const editing=!!issue.recurrence,today=localDate(new Date()),dateLabel=editing?'Next due':'First due';
 const save=async(patch:Record<string,any>)=>{setBusy(true);setError('');try{await onSave(patch);onClose()}catch(e){setError(e instanceof Error?e.message:'Could not save recurrence');setBusy(false)}};
 return <Modal title={editing?'Edit recurrence':'Make recurring'} onClose={onClose}><form onSubmit={e=>{e.preventDefault();void save({...(editing&&dueDate===initialDueDate?{}:{dueDate}),recurrence:{...issue.recurrence,frequency,interval,...(editing&&dueDate===initialDueDate?{}:{startDate:dueDate})}})}}><div className="modal-body"><div className="recurrence-controls"><span>{dateLabel}</span><CalendarInput compact label={dateLabel+' date'} value={dueDate} onChange={setDueDate} min={today} allowedPastValue={editing?initialDueDate:undefined} required clearable={false}/><span>repeats every</span><select className="input recurrence-interval" aria-label="Repeat interval" value={interval} onChange={e=>setInterval(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map(value=><option key={value} value={value}>{value}</option>)}{interval>12&&<option value={interval}>{interval}</option>}</select><select className="input recurrence-unit" aria-label="Repeat" value={frequency} onChange={e=>setFrequency(e.target.value)}>{Object.entries({daily:'day',weekly:'week',monthly:'month',yearly:'year'}).map(([value,label])=><option key={value} value={value}>{label}{interval===1?'':'s'}</option>)}</select></div>{error&&<p role="alert">{error}</p>}</div><div className="modal-footer">{editing&&<Button type="button" disabled={busy} onClick={()=>void save({recurrence:null})}>Stop repeating</Button>}<Button type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={busy||!dueDate||(dueDate<today&&!(editing&&dueDate===initialDueDate))||!Number.isInteger(interval)||interval<1||interval>365}>{busy?'Saving…':'Set recurrence'}</Button></div></form></Modal>;
}

export function RecurringIssueSettings({teamId}:{teamId:string}){
 const store=useAppStore(),[editing,setEditing]=useState<Entity|null>(null);
 const issues=store.data.issues.filter(issue=>issue.teamId===teamId&&!issue.deletedAt&&issue.recurrence);
 return <section><div className="feature-section-header"><h2>Recurring issues</h2><Button onClick={()=>window.dispatchEvent(new CustomEvent('create-issue',{detail:{teamId,__recurring:true}}))}>Create recurring issue</Button></div><div className="feature-settings-card">{issues.map(issue=><div className="feature-settings-row" key={issue.id}><Link to={'/issues/'+issue.id}>{issue.identifier} {issue.title}</Link><span>{issue.recurrence.frequency} · every {issue.recurrence.interval||1}</span><Button onClick={()=>setEditing(issue)}>Edit recurrence</Button></div>)}{!issues.length&&<p>No recurring issues</p>}</div>{editing&&<RecurrenceDialog issue={editing} onClose={()=>setEditing(null)} onSave={patch=>store.update('issues',editing.id,patch)}/>}</section>;
}
