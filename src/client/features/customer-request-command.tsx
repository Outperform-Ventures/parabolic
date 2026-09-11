import React,{lazy,Suspense,useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {useAppStore} from '../store';
const RequestEditor=lazy(()=>import('./customers').then(module=>({default:module.RequestEditor})));
/** Entity views handle their own request drafts; this fills the workspace-wide command context. */
export function CustomerRequestCommand(){
 const location=useLocation(),store=useAppStore();
 const [draft,setDraft]=useState<{customerId?:string,issueId?:string}|null>(null);
 useEffect(()=>{
  const listener=(event:Event)=>{
   if(event.defaultPrevented||(event as CustomEvent).detail?.command!=='new-customer-request')return;
   if(document.querySelector('.issue-detail-view[data-issue-id]')||/^\/project\/[^/]+/.test(location.pathname))return;
   const projectList=document.querySelector<HTMLElement>('.project-collection[data-selected-project-ids]');
   if(projectList&&(projectList.dataset.selectedProjectIds||projectList.dataset.focusedProjectId))return;
   const list=document.querySelector<HTMLElement>('.issue-view[data-selected-ids]'),ids=list?.dataset.selectedIds?.split(',').filter(Boolean)||[];
   const issueId=ids.length===1?ids[0]:ids.length?undefined:list?.dataset.focusedId;
   const customerMatch=/^\/customer\/([^/]+)/.exec(location.pathname);
   event.preventDefault();
   setDraft({issueId:store.data.issues.some(issue=>issue.id===issueId&&!issue.deletedAt&&!issue.archivedAt)?issueId:undefined,customerId:customerMatch?.[1]});
  };
  window.addEventListener('workspace-command',listener);return()=>window.removeEventListener('workspace-command',listener);
 },[location.pathname,store.data.issues]);
 return draft?<Suspense fallback={<div role="status">Loading request editor…</div>}><RequestEditor {...draft} onClose={()=>setDraft(null)}/></Suspense>:null;
}
