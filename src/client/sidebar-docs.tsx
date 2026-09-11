import React,{useMemo,useState} from 'react';
import {Modal} from './components/ui';
import {parabolicDocumentationArticles} from './help-reference-data';
export {parabolicDocumentationArticles} from './help-reference-data';
export function SidebarDocs({onClose}:{onClose:()=>void}){
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(parabolicDocumentationArticles[0]);
 const shown=useMemo(()=>parabolicDocumentationArticles.filter(article=>(article.title+' '+article.body).toLowerCase().includes(query.toLowerCase())),[query]);
 const move=(from:HTMLElement,direction:1|-1)=>{const buttons=[...from.closest('nav')!.querySelectorAll<HTMLButtonElement>('button')],index=Math.max(0,buttons.indexOf(from as HTMLButtonElement));buttons[(index+direction+buttons.length)%buttons.length]?.focus();};
 return <Modal title="Parabolic Documentation" wide onClose={onClose}><div className="sidebar-docs"><nav><input autoFocus aria-label="Search documentation" placeholder="Search documentation…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='ArrowDown'&&shown.length){event.preventDefault();event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('button')?.focus();}}}/>{shown.map(article=><button className={selected.title===article.title?'active':''} key={article.title} onClick={()=>setSelected(article)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();move(event.currentTarget,event.key==='ArrowDown'?1:-1);}}}>{article.title}</button>)}{!shown.length&&<p className="muted">No documentation found</p>}</nav><article><h2>{selected.title}</h2><p>{selected.body}</p></article></div></Modal>;
}
