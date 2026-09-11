import {useCallback,useMemo,useRef,type SetStateAction} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {parseRouteFilter} from './route-filter';
import type {FilterSpec} from './query';
const emptyFilter:FilterSpec={conditions:[],match:'all'};
/** URL changes are temporary overrides. Saved defaults and parent scope remain separate. */
export function useRouteFilter(defaultFilter:FilterSpec=emptyFilter){
 const location=useLocation(),navigate=useNavigate();
 const defaultIsEmpty=defaultFilter.match==='all'&&!defaultFilter.conditions.length&&!defaultFilter.groups?.length;
 const serialized=new URLSearchParams(location.search).get('filter');
 const override=useMemo(()=>parseRouteFilter(serialized),[serialized]);
 const value=override??defaultFilter,current=useRef(value);current.current=value;
 const setValue=useCallback((action:SetStateAction<FilterSpec>)=>{
  const next=typeof action==='function'?action(current.current):action;
  current.current=next;const params=new URLSearchParams(location.search);
  const nextIsEmpty=next.match==='all'&&!next.conditions.length&&!next.groups?.length;
  // Saved views need an explicit empty override; ordinary empty-default lists do not.
  if(nextIsEmpty&&defaultIsEmpty)params.delete('filter');else params.set('filter',JSON.stringify(next));
  navigate({pathname:location.pathname,search:'?'+params.toString(),hash:location.hash},{replace:true});
 },[location.pathname,location.search,location.hash,navigate,defaultIsEmpty]);
 return [value,setValue] as const;
}
