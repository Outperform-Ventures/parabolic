import React,{useState} from 'react';
import {Modal,Button} from './components/ui';
import type {Condition} from './query';
export function TextFilterDialog({condition,onChange,onClose}:{condition:Condition;onChange:(condition:Condition)=>void;onClose:()=>void}){
 const [text,setText]=useState(String(condition.value??''));const milestone=condition.field==='milestoneName';
 return <Modal title={milestone?'Milestone name contains…':'Filter by content…'} onClose={onClose}><form onSubmit={e=>{e.preventDefault();if(!text.trim())return;onChange({...condition,value:text.trim()});onClose()}}><div className="modal-body"><input className="input" aria-label={milestone?'Milestone name':'Content'} autoFocus onFocus={e=>e.currentTarget.select()} value={text} onChange={e=>setText(e.target.value)}/></div><div className="modal-footer"><Button onClick={onClose}>Cancel</Button><button className="button primary" type="submit" disabled={!text.trim()}>Apply</button></div></form></Modal>;
}
export function TextFilterValue({condition,onChange}:{condition:Condition;onChange:(condition:Condition)=>void}){
 const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>{String(condition.value??'')}</button>{open&&<TextFilterDialog condition={condition} onChange={onChange} onClose={()=>setOpen(false)}/>}</>;
}
