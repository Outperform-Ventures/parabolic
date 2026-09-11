import {resolveRelativeTimestamp} from '../shared/relative-timestamp-filter';
import {resolveRelativeDate} from '../shared/relative-date-filter';
import React,{useEffect,useState} from 'react';
import {shiftCalendarDate} from '../shared/date-filter-range';
import type{Condition}from'./query';
const futurePresets=[['overdue','Overdue','lt','P0D'],['day','1 day from now','lte','P1D'],['three-days','3 days from now','lte','P3D'],['week','1 week from now','lte','P1W'],['month','1 month from now','lte','P1M'],['three-months','3 months from now','lte','P3M'],['six-months','6 months from now','lte','P6M'],['year','1 year from now','lte','P1Y'],['none','No date','empty','']] as const;

export function DateFilterValue({condition,onChange,onValidityChange,label='Date filter value'}:{condition:Condition;onChange:(patch:Partial<Condition>)=>void;label?:string;onValidityChange?:(valid:boolean)=>void}){
 const historical=['createdAt','updatedAt','completedAt','canceledAt','startedAt','archivedAt','autoClosedAt','triagedAt'].includes(condition.field);
 const presets:readonly (readonly [string,string,string,string])[]=historical?futurePresets.filter(p=>!['overdue','none'].includes(p[0])).map(([key,name,,value])=>[key,name.replace('from now','ago'),'gte','-'+value] as const):futurePresets;
 const [rangeDraft,setRangeDraft]=useState<[string,string]|null>(null);
 useEffect(()=>setRangeDraft(null),[condition.field,condition.operator,JSON.stringify(condition.value)]);
 const isRange=Array.isArray(condition.value);
 const clock={now:new Date()};
 const displayDate=(value:unknown)=>{if(historical){const instant=resolveRelativeTimestamp(value,clock)??(typeof value==='string'&&value.includes('T')?value:undefined);if(instant){const date=new Date(instant);if(Number.isFinite(+date))return [String(date.getFullYear()).padStart(4,'0'),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}}return resolveRelativeDate(value,clock)??(typeof value==='string'?value:'')};
 const preset=presets.find(([, ,operator,value])=>operator==='empty'?condition.operator==='empty':condition.operator!=='empty'&&condition.value===value);
 const relative=typeof condition.value==='string'&&/^[+-]?P/.test(condition.value);
 const mode=rangeDraft||isRange?'range':preset?.[0]??(relative?'relative':'custom');
 const range=rangeDraft??(isRange?[displayDate(condition.value[0]),shiftCalendarDate(displayDate(condition.value[1]),-1)??'']:['','']);
 useEffect(()=>{onValidityChange?.(mode==='range'?!!range[0]&&!!range[1]&&range[0]<=range[1]:condition.operator==='empty'||!!displayDate(condition.value));},[mode,range[0],range[1],condition.operator,condition.value,onValidityChange]);
 const editRange=(index:number,value:string)=>{const next:[string,string]=[range[0],range[1]];next[index]=value;setRangeDraft(next);const end=shiftCalendarDate(next[1],1);if(shiftCalendarDate(next[0],0)&&end&&next[0]<end){onChange({operator:isRange?condition.operator:'within',value:[next[0],end]});setRangeDraft(null)}};
 return <div style={{display:'flex',gap:6,minWidth:0,flex:1,flexWrap:'wrap'}}><select className="input" aria-label={label} value={mode} onChange={event=>{const selected=presets.find(p=>p[0]===event.target.value);if(event.target.value==='range'){setRangeDraft(['','']);return}setRangeDraft(null);if(selected)onChange({operator:selected[2],value:selected[3]});else onChange({operator:historical?'gte':'lte',value:''})}}>{presets.map(([value,name])=><option key={value} value={value}>{value==='none'&&condition.field==='dueDate'?'No due date':name}</option>)}{mode==='relative'&&<option value="relative">{relativeDateLabel(String(condition.value))}</option>}<option value="custom">Custom date…</option><option value="range">Custom timeframe…</option></select>{mode==='custom'&&<input className="input" type="date" aria-label={label+' custom date'} value={relative?'':displayDate(condition.value)} onChange={event=>onChange({value:event.target.value,...(condition.operator==='on'&&!event.target.value?{operator:historical?'gte':'lte'}:{})})}/>} {mode==='range'&&<><input className="input" type="date" aria-label={label+' start'} value={range[0]} onChange={event=>editRange(0,event.target.value)}/><input className="input" type="date" aria-label={label+' end'} min={range[0]||undefined} value={range[1]} onChange={event=>editRange(1,event.target.value)}/>{range[0]&&range[1]&&range[0]>range[1]&&<span role="alert">End date must be on or after start date.</span>}</>}</div>;
}
function relativeDateLabel(value:string){
 const match=/^([+-])?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);if(!match)return 'Custom relative date';
 const units=['year','month','week','day','hour','minute','second'];const parts=match.slice(2).flatMap((count,index)=>count&&Number(count)?[count+' '+units[index]+(Number(count)===1?'':'s')]:[]);return parts.length?parts.join(' ')+(match[1]==='-'?' ago':' from now'):'Today';
}
