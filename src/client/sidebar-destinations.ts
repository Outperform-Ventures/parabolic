import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useAppStore} from './store';
export function sidebarDestinationGroup(path:string):string|null{
 const parts=path.split('/');
 if(parts[1]==='team'&&parts[2]){
  const section=parts[3];
  if(['all','active','backlog','view'].includes(section))return `/team/${parts[2]}/all`;
  if(section==='cycle')return `/team/${parts[2]}/cycles`;
  if(['overview','projects','cycles','views','triage'].includes(section))return `/team/${parts[2]}/${section}`;
  return null;
 }
 return ['/inbox','/my-issues','/initiatives','/projects','/teams','/views','/members','/customers','/drafts'].find(p=>path===p||path.startsWith(p+'/'))||null;
}

// Remember pages, not one-time creation commands. Sanitize on read as well so
// destinations stored by older versions cannot reopen a creation dialog.
function sidebarPageDestination(path:string):string{
 const url=new URL(path,'http://parabolic.local');
 if(url.searchParams.get('new')!=='1')return path;
 url.searchParams.delete('new');
 if(/^\/(?:team\/[^/]+\/)?projects(?:\/|$)/.test(url.pathname))url.searchParams.delete('initiativeId');
 return url.pathname+url.search+url.hash;
}
export function useSidebarDestinations(){
 const location=useLocation(),store=useAppStore(),key=`sidebar-destinations:${store.user?.id}:${store.data.workspaceId}`,current=sidebarPageDestination(location.pathname+location.search+location.hash),group=sidebarDestinationGroup(location.pathname);
 useEffect(()=>{if(!location.pathname.startsWith('/settings')){try{sessionStorage.setItem(key+':return',current);}catch{}}if(!group)return;try{const saved=JSON.parse(localStorage.getItem(key)||'{}');saved[group]=current;localStorage.setItem(key,JSON.stringify(saved));}catch{}},[key,group,current]);
 return {active:(base:string)=>group===base,destination:(base:string)=>{if(group===base)return current;try{const candidate=JSON.parse(localStorage.getItem(key)||'{}')[base];if(typeof candidate==='string'&&candidate.startsWith('/')&&!candidate.startsWith('//')&&sidebarDestinationGroup(candidate.split(/[?#]/)[0])===base)return sidebarPageDestination(candidate);}catch{}return base;}};
}

export function useSidebarReturnDestination(){const store=useAppStore();try{const path=sessionStorage.getItem(`sidebar-destinations:${store.user?.id}:${store.data.workspaceId}:return`);if(path?.startsWith('/')&&!path.startsWith('//')&&!path.startsWith('/settings'))return sidebarPageDestination(path);}catch{}return '/my-issues';}
