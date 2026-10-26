import React, {useEffect, useMemo, useRef, useState} from 'react';
import {CalendarDays, ChevronLeft, ChevronRight, GanttChart, ExternalLink} from 'lucide-react';
import type {Entity} from '../../shared/types';
import {guestCapabilities} from '../../shared/guest-capabilities';
import {useAppStore} from '../store';
import {useCalendarDay} from '../due-date';
import {FormDialog} from './shared';
import {calendarDays, calendarDrop, dateDay, dayDate, dayMs, moveSchedule, scheduleDependencies, scheduleRange, shiftPeriod, todayDate, weekStart, type ScheduleOptions} from './schedule-data';
import './schedule-view.css';

type Gesture = {id:string; x:number; mode:'move'|'start'|'end'; item:Entity; delta:number};
const dateLabel = (day:number, options:Intl.DateTimeFormatOptions) => new Date(day*dayMs).toLocaleDateString(undefined,{...options,timeZone:'UTC'});

/** The same records back List, Board, Calendar and Timeline; no shadow tasks. */
export function ScheduleView({items, kind='issues', layout, options, onOptions, onOpen}: {
  items:Entity[]; kind?:'issues'|'projects'; layout:'calendar'|'timeline'; options:ScheduleOptions;
  onOptions:(patch:ScheduleOptions)=>void; onOpen:(item:Entity)=>void;
}) {
  const store=useAppStore(), capabilities=guestCapabilities(store.data,store.user?.id);
  useCalendarDay();
  const endField=kind==='issues'?'dueDate':'targetDate';
  const field=options.calendarDateField==='startDate'?'startDate':endField;
  const today=todayDate(), anchor=dateDay(options.scheduleAnchor)!==null?options.scheduleAnchor!:today;
  const mode=options.calendarMode==='week'?'week':'month', scale=options.timelineScale||'month';
  const days=calendarDays(anchor,mode), showUnscheduled=options.showUnscheduled!==false;
  const [editing,setEditing]=useState<Entity|null>(null), [busy,setBusy]=useState<string|null>(null), [error,setError]=useState(''), [announcement,setAnnouncement]=useState('');
  const [preview,setPreview]=useState<{id:string;patch:Record<string,string>}|null>(null);
  const gesture=useRef<Gesture|null>(null), suppressClick=useRef(false), scroll=useRef<HTMLDivElement>(null);
  const title=(item:Entity)=>item.title||item.name||'Untitled';
  const editable=(item:Entity)=>!item.archivedAt&&!item.deletedAt&&!store.data.teams.some(t=>(t.id===item.teamId||item.teamIds?.includes(t.id))&&(t.archivedAt||t.retiredAt))&&capabilities.canEntity(item);
  const color=(item:Entity)=>kind==='issues'?store.data.statuses.find(s=>s.id===item.statusId)?.color||'#7775df':item.color||'#7775df';
  const save=async(item:Entity,patch:Record<string,any>)=>{
    if(!editable(item))throw Error('You do not have permission to change this schedule.');
    setBusy(item.id);setError('');
    try { await store.update(kind,item.id,patch);setAnnouncement(`${title(item)} schedule saved.`); }
    catch(e){const message=e instanceof Error?e.message:'Could not save schedule';setError(message);throw e;}
    finally {setBusy(null);}
  };
  const commit=(item:Entity,patch:Record<string,any>)=>void save(item,patch).catch(()=>{});
  const byDay=useMemo(()=>{const map=new Map<number,Entity[]>();for(const item of items){const day=dateDay(item[field]);if(day!==null)map.set(day,[...(map.get(day)||[]),item]);}return map;},[items,field]);
  const unscheduled=items.filter(item=>layout==='calendar'?dateDay(item[field])===null:!scheduleRange(item,endField));
  const scheduled=items.filter(item=>scheduleRange(item,endField));
  const start=weekStart(dateDay(anchor)!), count=scale==='week'?14:scale==='quarter'?98:42, cell=scale==='week'?64:scale==='quarter'?22:36, width=count*cell;
  const rows=scheduled.map(item=>({item,range:scheduleRange(preview?.id===item.id?{...item,...preview.patch}:item,endField)!}));
  const positions=new Map(rows.map(({item,range},i)=>[item.id,{x:(range.start-start)*cell,end:(range.end-start+1)*cell,y:i*44+22}]));
  const edges=options.showDependencies===false?[]:scheduleDependencies(scheduled);
  const cancel=()=>{gesture.current=null;setPreview(null);};
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();suppressClick.current=true;cancel();}};window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);},[]);
  useEffect(()=>{cancel();if(scroll.current)scroll.current.scrollLeft=0;},[layout,anchor,scale]);
  const patchGesture=(drag:Gesture,delta:number)=>{
    const range=scheduleRange(drag.item,endField)!;
    return drag.mode==='move'?moveSchedule(drag.item,endField,delta):drag.mode==='start'?{startDate:dayDate(Math.min(range.end,range.start+delta))}:{[endField]:dayDate(Math.max(range.start,range.end+delta))};
  };
  const startGesture=(event:React.PointerEvent,item:Entity,dragMode:Gesture['mode'])=>{
    if(event.button!==0||!editable(item)||busy)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current=false;gesture.current={id:item.id,item,x:event.clientX,mode:dragMode,delta:0};
  };
  const moveGesture=(event:React.PointerEvent)=>{const drag=gesture.current;if(!drag)return;const delta=Math.round((event.clientX-drag.x)/cell);drag.delta=delta;if(Math.abs(event.clientX-drag.x)>4)suppressClick.current=true;setPreview({id:drag.id,patch:patchGesture(drag,delta)});};
  const endGesture=()=>{const drag=gesture.current;cancel();if(drag?.delta)commit(drag.item,patchGesture(drag,drag.delta));};
  const card=(item:Entity)=><button type="button" key={item.id} className="schedule-card" style={{'--schedule-color':color(item)} as React.CSSProperties}
    draggable={editable(item)&&!busy} onDragStart={e=>{e.dataTransfer.setData('application/x-parabolic-schedule',item.id);e.dataTransfer.effectAllowed='move';}}
    onClick={()=>setEditing(item)} aria-label={`Schedule ${title(item)}`}><i/><span>{item.identifier&&<small>{item.identifier} </small>}{title(item)}</span></button>;
  const drop=(event:React.DragEvent,day:number)=>{event.preventDefault();const item=items.find(i=>i.id===event.dataTransfer.getData('application/x-parabolic-schedule'));if(item&&editable(item)&&!busy)commit(item,layout==='calendar'?calendarDrop(item,field,day,endField):{startDate:dayDate(day),[endField]:dayDate(day)});};
  const dragOver=(event:React.DragEvent)=>{if(!busy&&event.dataTransfer.types.includes('application/x-parabolic-schedule')){event.preventDefault();event.dataTransfer.dropEffect='move';}};
  return <section className="schedule-view" aria-label={layout==='calendar'?'Calendar view':'Timeline / Gantt view'}>
    <div className="schedule-toolbar">
      <div className="schedule-period"><button aria-label="Previous period" onClick={()=>onOptions({scheduleAnchor:shiftPeriod(anchor,-1,layout==='calendar'?mode:scale)})}><ChevronLeft size={16}/></button><button onClick={()=>onOptions({scheduleAnchor:today})}>Today</button><button aria-label="Next period" onClick={()=>onOptions({scheduleAnchor:shiftPeriod(anchor,1,layout==='calendar'?mode:scale)})}><ChevronRight size={16}/></button><h3>{dateLabel(dateDay(anchor)!,{month:'long',year:'numeric'})}</h3></div>
      <div className="schedule-settings">
        <input type="date" aria-label="Go to date" value={anchor} onChange={e=>{if(dateDay(e.target.value)!==null)onOptions({scheduleAnchor:e.target.value});}}/>
        {layout==='calendar'?<><label>Date<select aria-label="Calendar date field" value={field} onChange={e=>onOptions({calendarDateField:e.target.value as ScheduleOptions['calendarDateField']})}><option value={endField}>{kind==='issues'?'Due date':'Target date'}</option><option value="startDate">Start date</option></select></label><select aria-label="Calendar range" value={mode} onChange={e=>onOptions({calendarMode:e.target.value as 'week'|'month'})}><option value="month">Month</option><option value="week">Week</option></select></>:<><button disabled={!scheduled.length} onClick={()=>onOptions({scheduleAnchor:dayDate(Math.min(...scheduled.map(i=>scheduleRange(i,endField)!.start)))})}>First scheduled</button><select aria-label="Issue timeline scale" value={scale} onChange={e=>onOptions({timelineScale:e.target.value as ScheduleOptions['timelineScale']})}><option value="week">Weeks</option><option value="month">Month</option><option value="quarter">Quarter</option></select><label><input type="checkbox" checked={options.showDependencies!==false} onChange={e=>onOptions({showDependencies:e.target.checked})}/>Dependencies</label></>}
        <button aria-pressed={showUnscheduled} onClick={()=>onOptions({showUnscheduled:!showUnscheduled})}>Unscheduled ({unscheduled.length})</button>
      </div>
    </div>
    {error&&<p role="alert" className="schedule-error">{error} <button onClick={()=>setError('')}>Dismiss</button></p>}
    <span className="native-visually-hidden" role="status">{busy?'Saving schedule…':announcement}</span>
    <div className="schedule-body">
      {layout==='calendar'?<div className="schedule-calendar-scroll"><div className={`schedule-calendar ${mode}`}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} className="schedule-weekday">{d}</div>)}
        {days.map(day=><div key={day} className={`schedule-day${dayDate(day).slice(0,7)!==anchor.slice(0,7)?' outside':''}${dayDate(day)===today?' today':''}`} data-date={dayDate(day)} aria-label={dayDate(day)} onDragOver={dragOver} onDrop={e=>drop(e,day)}><time dateTime={dayDate(day)}>{dateLabel(day,{day:'numeric'})}</time>{(byDay.get(day)||[]).map(card)}</div>)}
      </div></div>:<div ref={scroll} className="schedule-gantt-scroll">
        <div className="schedule-gantt" style={{width:260+width}}>
          <div className="schedule-gantt-head"><strong>Issue · start → due date</strong><div className="schedule-gantt-dates" style={{width}}>{Array.from({length:count},(_,i)=><span key={i} style={{width:cell}} className={dayDate(start+i)===today?'today':''}>{dateLabel(start+i,{day:'numeric',...(cell>30?{month:'short'}:{})})}</span>)}</div></div>
          <div className="schedule-gantt-rows">
            {!rows.length&&<div className="schedule-gantt-row"><div className="schedule-gantt-label">Schedule an issue</div><div className="schedule-gantt-track" style={{width,backgroundSize:`${cell}px 100%`}} onDragOver={dragOver} onDrop={e=>drop(e,start+Math.max(0,Math.min(count-1,Math.floor((e.clientX-e.currentTarget.getBoundingClientRect().left)/cell))))}/></div>}
            {rows.map(({item,range})=>{const left=Math.max(0,(range.start-start)*cell),right=Math.min(width,(range.end-start+1)*cell),visible=right>left;return <div key={item.id} className="schedule-gantt-row" data-schedule-id={item.id}>
              <button className="schedule-gantt-label" onClick={()=>setEditing(item)}><span>{item.identifier} {title(item)}</span><small>{dayDate(range.start)} → {dayDate(range.end)}</small></button>
              <div className="schedule-gantt-track" style={{width,backgroundSize:`${cell}px 100%`}} onDragOver={dragOver} onDrop={e=>drop(e,start+Math.max(0,Math.min(count-1,Math.floor((e.clientX-e.currentTarget.getBoundingClientRect().left)/cell))))}>
                {visible&&<div className="schedule-gantt-bar" style={{left,width:right-left,'--schedule-color':color(item)} as React.CSSProperties}>
                  {(['start','move','end'] as const).map(dragMode=><button key={dragMode} className={dragMode==='move'?'schedule-bar-title':'schedule-resize'} aria-label={`${dragMode==='move'?'Move':dragMode==='start'?'Resize start of':'Resize end of'} ${title(item)}`} disabled={!editable(item)||!!busy}
                    onPointerDown={e=>startGesture(e,item,dragMode)} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}}
                    onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}setEditing(item);}}
                    onKeyDown={e=>{if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();commit(item,patchGesture({id:item.id,item,x:0,mode:dragMode,delta:0},e.key==='ArrowLeft'?-1:1));}}}>{dragMode==='move'?title(item):'⋮'}</button>)}
                </div>}
              </div>
            </div>})}
            {rows.length>0&&<svg className="schedule-dependencies" aria-label={`${edges.length} dependencies`} style={{left:260,width,height:rows.length*44}}>
              <defs><marker id="schedule-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="currentColor"/></marker></defs>
              {edges.map(edge=>{const a=positions.get(edge.from)!,b=positions.get(edge.to)!;if(a.end<0||a.end>width||b.x<0||b.x>width)return null;const mid=Math.max(a.end+10,(a.end+b.x)/2);return <path key={edge.from+edge.to} d={`M${a.end},${a.y} H${mid} V${b.y} H${b.x}`} markerEnd="url(#schedule-arrow)"/>;})}
            </svg>}
          </div>
        </div>
        {!rows.length&&<div className="schedule-empty"><GanttChart size={28}/><h3>No scheduled issues</h3><p>Choose an unscheduled issue to add its start and due dates.</p></div>}
      </div>}
      {showUnscheduled&&<aside className="schedule-unscheduled" aria-label="Unscheduled items"><h3>Unscheduled <small>{unscheduled.length}</small></h3><p>Drag onto {layout==='calendar'?'a date':'the timeline'}, or click to set dates.</p>{unscheduled.map(card)}{!unscheduled.length&&<p>Everything in this view has a date.</p>}</aside>}
    </div>
    <footer className="schedule-hint">{layout==='calendar'?<CalendarDays size={14}/>:<GanttChart size={14}/>} {layout==='calendar'?'Drag to reschedule. Existing date ranges move together.':'Drag bars to move; drag their ends to resize. Keyboard: focus a bar or edge, then Option/Alt + ← / →. Dependencies are shown; other issues are not automatically rescheduled.'}</footer>
    {editing&&<FormDialog title={`Schedule ${title(editing)}`} fields={[
      {key:'startDate',label:'Start date',type:'date'}, {key:endField,label:kind==='issues'?'Due date':'Target date',type:'date'}
    ]} initial={{startDate:editing.startDate?.slice(0,10)||'',[endField]:editing[endField]?.slice(0,10)||''}} submit="Save dates" submitDisabled={!editable(editing)||!!busy} onClose={()=>setEditing(null)} onSave={async values=>{
      if(values.startDate&&values[endField]&&values.startDate>values[endField])throw Error('The end date must be on or after the start date.');
      await save(editing,{startDate:values.startDate||null,[endField]:values[endField]||null});
    }}><p className="muted">Leave a date blank to remove it. Changes update the original {kind==='issues'?'issue':'project'}.</p><button type="button" className="button" onClick={()=>{onOpen(editing);setEditing(null);}}><ExternalLink size={14}/>Open {kind==='issues'?'issue':'project'}</button></FormDialog>}
  </section>;
}
