import React from 'react';
import {FilterMenuCascade} from './filter-menu-cascade';
import {selectedValues,selectionOperatorName} from './issue-filter-selection';
import {matchesMenuSearch} from './filter-menu-search';
import type {Condition} from './query';

export function FilterOperatorMenu({condition,label,onChange,mode='selection',multiple:multipleOverride}:{condition:Condition;label:string;onChange:(condition:Condition)=>void;mode?:'selection'|'presence'|'text'|'labels';multiple?:boolean}) {
 const multiple=multipleOverride??selectedValues(condition).length>1;
 const choices=mode==='labels'?(multiple?[['all','include all of'],['in','include any of'],['none','exclude if any of'],['notAll','exclude if all']]:[['all','include'],['none','do not include']]):mode==='presence'?[['notEmpty','is'],['empty','is not']]:mode==='text'?[['contains','contains'],['notContains','does not contain']]:[['in',selectedValues(condition).length>1?'is any of':'is'],['none','is not']];
 const current=mode==='labels'&&!multiple?(['none','notAll','neq','isNot'].includes(condition.operator)?'do not include':'include'):mode==='selection'?(['none','neq','isNot'].includes(condition.operator)?'is not':multiple?'is any of':'is'):choices.find(([operator])=>operator===condition.operator)?.[1]||condition.operator;
 return <FilterMenuCascade initialField="" trigger={<button aria-label={label+' operator'}>{current}</button>}>
 {({search,setSearch,close})=>{const filtered=choices.filter(([,name])=>matchesMenuSearch(name,search));return <div className="issue-filter-menu issue-filter-operator-menu">
  <input aria-label={label+' operator search'} placeholder={current} value={search} onChange={e=>setSearch(e.target.value)}/>
  <div className="issue-filter-options">{filtered.map(([operator,name])=><button className="menu-item issue-filter-option" role="menuitem" key={operator} onClick={()=>{onChange({...condition,operator,value:mode==='selection'||mode==='labels'?selectedValues(condition):condition.value});close()}}>{name}</button>)}{!filtered.length&&<p className="filter-empty" role="status">No matching options</p>}</div>
 </div>}}</FilterMenuCascade>;
}
