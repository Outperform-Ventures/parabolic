import React,{useState} from 'react';
import {parseStatusDuration,statusDurationName} from '../shared/issue-status-time';
export function StatusDurationValue({value,onChange}:{value:unknown;onChange:(value:string)=>void}){
 const [text,setText]=useState(()=>statusDurationName(value));
 return <input className="input" aria-label="Time in current status duration" placeholder="Try: 2 days, 3 weeks…" value={text} aria-invalid={!parseStatusDuration(text)} onChange={e=>{setText(e.target.value);const duration=parseStatusDuration(e.target.value);if(duration)onChange('-'+duration.id);}}/>;
}
