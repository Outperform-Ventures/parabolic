import React,{useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import type {Editor} from '@tiptap/core';
import {Icon} from './ui';

type Heading={id:string;label:string;top:number;left:number;height:number};
export function EditorHeadingLinks({editor,documentId}:{editor:Editor;documentId:string}){
 const location=useLocation();
 const [headings,setHeadings]=useState<Heading[]>([]),[hovered,setHovered]=useState(''),[copied,setCopied]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  const root=editor.view.dom.closest<HTMLElement>('.rich-editor');if(!root)return;
  let frame=0,lastHash='',disposed=false;
  const measure=()=>{
   const hash=window.location.hash.slice(1);if(hash&&hash!==lastHash){const target=Array.from(editor.view.dom.querySelectorAll<HTMLElement>('[data-heading-id]')).find(el=>el.id===hash);if(target){for(let parent=target.parentElement;parent&&parent!==root;parent=parent.parentElement)if(parent.matches('details'))parent.dispatchEvent(new Event('parabolic-reveal-details'));target.scrollIntoView({block:'start'});lastHash=hash}}
   const bounds=root.getBoundingClientRect();setHeadings(Array.from(editor.view.dom.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')).filter(el=>{for(let parent=el.parentElement;parent&&parent!==root;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement&&!parent.open)return false;return el.getClientRects().length>0&&el.getBoundingClientRect().height>0}).map(el=>{const r=el.getBoundingClientRect();return {id:el.id,label:el.textContent||'Untitled heading',top:r.top-bounds.top,left:r.left-bounds.left,height:r.height}}));
  };
  const schedule=()=>{if(disposed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(measure)};
  const move=(event:MouseEvent)=>{const target=(event.target as Element).closest<HTMLElement>('h1,h2,h3,h4,h5,h6');if(target&&root.contains(target))setHovered(target.id);else if(!(event.target as Element).closest('.editor-heading-link'))setHovered('')};
  const leave=()=>setHovered('');const hashChange=()=>{lastHash='';schedule()};
  const resize=new ResizeObserver(schedule);resize.observe(root);editor.on('update',schedule);root.addEventListener('toggle',schedule,true);root.addEventListener('mousemove',move);root.addEventListener('mouseleave',leave);window.addEventListener('hashchange',hashChange);schedule();void document.fonts.ready.then(schedule);
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();editor.off('update',schedule);root.removeEventListener('toggle',schedule,true);root.removeEventListener('mousemove',move);root.removeEventListener('mouseleave',leave);window.removeEventListener('hashchange',hashChange)};
 },[editor,documentId,location.hash]);
 return <>{headings.map(heading=><button key={heading.id} type="button" className={`icon-button editor-heading-link ${hovered===heading.id?'visible':''}`} style={{top:heading.top+Math.max(0,(heading.height-24)/2),left:heading.left-28}} aria-label={`Copy link to ${heading.label}`} title={copied===heading.id?'Copied':'Copy link'} onMouseDown={event=>event.preventDefault()} onClick={async()=>{try{const url=new URL(`/document/${documentId}`,window.location.origin);url.hash=heading.id;await navigator.clipboard.writeText(url.href);setCopied(heading.id);setError('')}catch{setError('Unable to copy heading link.')}}}><Icon name={copied===heading.id?'Check':'Link'} size={14}/></button>)}{error&&<span role="alert" className="error-text">{error}</span>}</>;
}
