import React,{createContext,useContext}from'react';import type{FilterSpec}from'./query';
const Depth=createContext(0);
export function FilterGroups({value,onChange,render}:{value:FilterSpec;onChange:(value:FilterSpec)=>void;render:(group:FilterSpec,onChange:(group:FilterSpec)=>void)=>React.ReactNode}){
 const depth=useContext(Depth),groups=value.groups??[];
 return <div className="filter-groups">{groups.map((group,index)=><fieldset className="filter-group" aria-label={`Filter group ${index+1}`} key={index}><legend>Group {index+1}</legend><button type="button" className="text-button filter-group-remove" aria-label={`Remove filter group ${index+1}`} onClick={()=>onChange({...value,groups:groups.filter((_,i)=>i!==index)})}>Remove group</button><Depth.Provider value={depth+1}>{render(group,next=>onChange({...value,groups:groups.map((current,i)=>i===index?next:current)}))}</Depth.Provider></fieldset>)}<button type="button" className="text-button" disabled={depth>=16||groups.length>=100} onClick={()=>onChange({...value,groups:[...groups,{conditions:[],match:'all'}]})}>Add filter group</button></div>;
}
