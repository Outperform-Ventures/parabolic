import {registerTemplateHistoryHandler} from './template-history-events';
import {useContext,useEffect,useRef,useState} from 'react';
import {UNSAFE_NavigationContext} from 'react-router-dom';
/** Protect drafts without adding or replacing browser history entries. */
export function useTemplateNavigationGuard(dirty:boolean){
 const {navigator}=useContext(UNSAFE_NavigationContext),active=useRef(dirty),[pending,setPending]=useState<null|(()=>void)>(null);active.current=dirty;
 useEffect(()=>{
  const target=navigator as any,originals=new Map<string,Function>();let currentIndex:number|undefined=window.history.state?.idx,restoring:null|{index:number;delta:number}=null,allowedTraversal=false;
  for(const key of ['push','replace','go']){const original=target[key];if(typeof original!=='function')continue;originals.set(key,original);target[key]=(...args:any[])=>{const run=()=>{if(key==='go')allowedTraversal=true;original.apply(target,args);if(key!=='go')currentIndex=window.history.state?.idx};if(active.current)setPending(()=>run);else run()}}
  const pop=(event:PopStateEvent)=>{
   const nextIndex=event.state?.idx;
   if(restoring){
    // The first traversal was hidden from React Router. Keep the editor mounted
    // until the browser has returned to its original entry, then show the prompt.
    event.stopImmediatePropagation();
    if(nextIndex!==restoring.index){if(typeof nextIndex==='number')window.history.go(restoring.index-nextIndex);return}
    const delta=restoring.delta;restoring=null;
    setPending(()=>()=>{allowedTraversal=true;window.history.go(delta)});return;
   }
   if(allowedTraversal){allowedTraversal=false;currentIndex=nextIndex;return}
   if(active.current&&typeof currentIndex==='number'&&typeof nextIndex==='number'&&nextIndex!==currentIndex){
    event.stopImmediatePropagation();const delta=nextIndex-currentIndex;restoring={index:currentIndex,delta};window.history.go(-delta);return;
   }
   currentIndex=nextIndex;
  };
  // The dispatcher is installed before BrowserRouter, including in Chromium.
  const unregisterPop=registerTemplateHistoryHandler(pop);
  const unload=(event:BeforeUnloadEvent)=>{if(active.current){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',unload);
  return()=>{for(const[key,original]of originals)target[key]=original;unregisterPop();window.removeEventListener('beforeunload',unload)};
 },[navigator]);
 return {pending,cancel:()=>setPending(null),confirm:()=>{active.current=false;const run=pending;setPending(null);run?.()},allow:()=>{active.current=false},request:(run:()=>void)=>{if(active.current)setPending(()=>run);else run()}};
}
