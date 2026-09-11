import {hasRelativeTimestampFilter} from '../shared/relative-date-filter';
import React,{useEffect,useState} from 'react';
import {Icon} from './components/ui';
import {dueDatePresentation} from './due-date-data';
/** Calendar views wake at midnight; visible moving timestamp filters refresh each second. */
export function useCalendarDay(filter?:unknown){
 const moving=hasRelativeTimestampFilter(filter);
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const update=()=>{
   clearTimeout(timer);
   if(document.visibilityState==='hidden')return;
   const current=new Date();setNow(current);
   const next=moving?Math.floor(current.getTime()/1000)*1000+1000:new Date(current.getFullYear(),current.getMonth(),current.getDate()+1).getTime();
   timer=setTimeout(update,Math.max(1,next-current.getTime()+1));
  };
  update();window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
  return()=>{clearTimeout(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)};
 },[moving]);
 return now;
}
export function DueDateIndicator({value,now}:{value:string;now:Date}){
 const result=dueDatePresentation(value,now);if(!result)return null;
 const tooltip=`${result.date.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · ${result.relative}`;
 return <span className="issue-due-date" data-due-tone={result.tone} data-tooltip={tooltip} aria-label={tooltip} tabIndex={0} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:'0.6875rem',color:result.tone==='urgent'?'var(--danger)':result.tone==='soon'?'#e59961':'var(--muted)'}}><Icon name="Calendar" size={12}/><time dateTime={value}>{result.date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></span>;
}
