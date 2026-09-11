import React from 'react';
import {Dropdown,MenuItem,Icon} from './components/ui';
import type {IssueSortRule} from './issue-sort-rules';
export function IssueSortColumns({fields,rules,onSort,onRemove,onMove}:{fields:readonly (readonly [string,string])[];rules:IssueSortRule[];onSort:(field:string,entire:boolean)=>void;onRemove:(field:string)=>void;onMove:(field:string,end:boolean)=>void}){
 return <div className="issue-sort-columns" role="toolbar" aria-label="Issue column sorting">{fields.map(([field,label])=>{const index=rules.findIndex(r=>r.field===field);return <Dropdown key={field} trigger={<button className="sort-column-heading" aria-label={`${label} column`}><span>{label}</span>{index>=0&&<><small>{index+1}</small><Icon name={rules[index].direction==='asc'?'ArrowUp':'ArrowDown'} size={12}/></>}</button>}><MenuItem onClick={()=>onSort(field,false)}>Sort</MenuItem><MenuItem onClick={()=>onSort(field,true)}>Sort entire column</MenuItem>{index>=0&&<><MenuItem onClick={()=>onRemove(field)}>Remove sorting</MenuItem><MenuItem onClick={()=>onMove(field,false)}>Move to start</MenuItem><MenuItem onClick={()=>onMove(field,true)}>Move to end</MenuItem></>}</Dropdown>})}</div>;
}
