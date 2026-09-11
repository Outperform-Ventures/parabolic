import {useEffect,useLayoutEffect,useRef,type Dispatch,type SetStateAction} from 'react';

import {rememberClosedTabs,type WorkspaceTab} from './tab-model';
export {normalizeTabs,type WorkspaceTab} from './tab-model';
export const tabCleanupOptions=[
  {value:'never',label:'Never'}, {value:'sixHours',label:'6 hours'},
  {value:'twelveHours',label:'12 hours'}, {value:'twentyFourHours',label:'24 hours'},
  {value:'threeDays',label:'3 days'}, {value:'sevenDays',label:'7 days'},
] as const;
const durations:Record<string,number>={sixHours:6*3600000,twelveHours:12*3600000,twentyFourHours:24*3600000,threeDays:3*86400000,sevenDays:7*86400000};
export function tabCleanupDuration(value:unknown):number|null{return typeof value==='string'?durations[value]??null:null;}
export function staleTabIds<T extends Pick<WorkspaceTab,'id'|'route'|'pinned'|'lastActiveAt'>>(tabs:T[],activeId:string,interval:unknown,now:number,hasUnsaved:(tab:T)=>boolean=()=>false):string[]{
  const duration=tabCleanupDuration(interval);if(duration===null)return [];
  return tabs.filter(tab=>tab.id!==activeId&&!tab.pinned&&Number.isFinite(tab.lastActiveAt)&&now-tab.lastActiveAt>=duration&&!hasUnsaved(tab)).map(tab=>tab.id);
}
export function issueTabHasJournal(tab:Pick<WorkspaceTab,'id'|'route'|'lastActiveAt'>,userId:string,storage:Pick<Storage,'getItem'>):boolean{
  const match=/^\/issues\/([^/?#]+)/.exec(tab.route);if(!match)return false;
  try{const fields=JSON.parse(storage.getItem(`issue-edit:${userId}:${match[1]}`)??'null');return !!fields&&typeof fields==='object'&&Object.keys(fields).length>0;}catch{return true;}
}
/** Active tabs, unresolved edits and pins never become cleanup candidates. */
export function useTabCleanup({tabs,activeId,interval,blocked,userId,workspaceId,setTabs}:{tabs:WorkspaceTab[];activeId:string;interval:unknown;blocked:boolean;userId:string;workspaceId:string;setTabs:Dispatch<SetStateAction<WorkspaceTab[]>>}){
  const previousActive=useRef(activeId),latest=useRef({tabs,activeId,interval,blocked,userId,workspaceId});latest.current={tabs,activeId,interval,blocked,userId,workspaceId};
  useLayoutEffect(()=>{
    const previous=previousActive.current;previousActive.current=activeId;
    setTabs(current=>current.map(tab=>tab.id===activeId||tab.id===previous?{...tab,lastActiveAt:Date.now()}:tab));
  },[activeId,setTabs]);
  useEffect(()=>{
    if(blocked||tabCleanupDuration(interval)===null)return;
    const clean=()=>{
      const state=latest.current;
      if(state.blocked||tabCleanupDuration(state.interval)===null)return;
      setTabs(current=>{
        const ids=new Set(staleTabIds(current,state.activeId,state.interval,Date.now(),tab=>issueTabHasJournal(tab,state.userId,localStorage)));
        if(!ids.size)return current;
        try{rememberClosedTabs(localStorage,state.workspaceId,state.userId,current,ids,Date.now(),true);}catch{return current;}
        return current.filter(tab=>!ids.has(tab.id));
      });
    };
    clean();const timer=setInterval(clean,60000);
    window.addEventListener('focus',clean);document.addEventListener('visibilitychange',clean);
    return()=>{clearInterval(timer);window.removeEventListener('focus',clean);document.removeEventListener('visibilitychange',clean);};
  },[interval,blocked,activeId,userId,workspaceId,setTabs]);
}
