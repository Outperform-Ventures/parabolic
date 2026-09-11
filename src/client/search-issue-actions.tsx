import {issueName} from './issues';
import React from 'react';
import type {Entity} from '../shared/types';
import {useAppStore} from './store';
import {Icon} from './components/ui';
import {IssueCopyIcon} from './components/issue-copy-icon';
/** Personal favorite state is shared with the full issue and sidebar. */
export function SearchIssueFavorite({issue}:{issue:Entity}){
 const store=useAppStore(),favorite=store.data.favorites.find(row=>!row.deletedAt&&row.entityId===issue.id&&row.userId===store.user?.id);
 const toggle=async()=>{try{if(favorite)await store.remove('favorites',favorite.id);else await store.create('favorites',{userId:store.user?.id,type:'issue',entityId:issue.id,label:[issueName(issue),issue.title].filter(Boolean).join(' '),route:'/issues/'+issue.id})}catch(error){store.toast((error as Error).message)}};
 return <button className="icon-button" role="switch" aria-checked={!!favorite} aria-label={favorite?'Remove from favorites':'Add to favorites'} onClick={()=>void toggle()}><Icon name="Star" size={14} style={favorite?{fill:'currentColor'}:undefined}/></button>;
}
/** Coding-tool/branch controls are outside the retained product scope. */
export function SearchIssueCopyActions({issue,url}:{issue:Entity;url:string}){
 const store=useAppStore();
 const copy=async(value:string,label:string)=>{try{await navigator.clipboard.writeText(value);store.toast(label+' copied')}catch(error){store.toast((error as Error).message)}};
 return <div role="group" aria-label="Issue copy actions" className="search-issue-copy-actions"><button className="icon-button" aria-label="Copy issue URL" onClick={()=>void copy(url,'Issue link')}><IssueCopyIcon kind="url"/></button><button className="icon-button" aria-label="Copy issue ID" onClick={()=>void copy(issueName(issue),'Issue ID')}><IssueCopyIcon kind="id"/></button></div>;
}
