import {hasRelativeTimestampFilter} from '../shared/relative-date-filter';
import React,{useEffect,useState} from 'react';
import {DueDateIcon} from './components/due-date-icon';
import {dueDatePresentation} from './due-date-data';
import './due-date.css';
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
export function DueDateIndicator({value,now,onClick,expanded,buttonRef}:{value:string;now:Date;onClick?:()=>void;expanded?:boolean;buttonRef?:React.Ref<HTMLButtonElement>}){
 const result=dueDatePresentation(value,now);if(!result)return null;
 const tooltip=`${result.date.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · ${result.relative}`;
 const content=<><DueDateIcon/><time dateTime={value}>{result.date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></>;
 if(onClick)return <button ref={buttonRef} type="button" className="issue-due-date" data-due-tone={result.tone} data-tooltip={expanded?undefined:tooltip} aria-label="Change due date" aria-haspopup="menu" aria-expanded={expanded} onClick={e=>{e.stopPropagation();onClick();}} onKeyDown={e=>e.stopPropagation()}>{content}</button>;
 return <span className="issue-due-date" data-due-tone={result.tone} data-tooltip={tooltip} aria-label={tooltip} tabIndex={0}>{content}</span>;
}
