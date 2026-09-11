import React from 'react';
import {Dropdown,Icon,MenuItem} from './components/ui';
export function SidebarChoice({label,value,options,onChange,preview=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void;preview?:boolean}){
 return <Dropdown trigger={<button className="sidebar-choice" aria-label={label}>{preview&&(value==='dot'?<span className="sidebar-choice-dot"/>:<span className="sidebar-choice-count">1</span>)}{options.find(o=>o.value===value)?.label}<Icon name="ChevronDown" size={12}/></button>}><div className="sidebar-menu-content">{options.map(option=><MenuItem key={option.value} icon={option.value===value?'Check':undefined} onClick={()=>onChange(option.value)}>{option.label}</MenuItem>)}</div></Dropdown>;
}
