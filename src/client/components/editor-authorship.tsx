import React,{useEffect,useState} from 'react';
import type {Editor} from '@tiptap/core';
import {ySyncPluginKey} from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import {createAuthorshipReader,combineAuthorLabels,type AuthorLabel} from '../editor-authorship-model';
import type {CollaborationState} from '../collaboration';
import {useAppStore} from '../store';
import {displayNameFor} from '../display-name';
import './editor-authorship.css';

export function EditorAuthorship({editor,state}:{editor:Editor;state:CollaborationState}){
 const {data}=useAppStore(),[labels,setLabels]=useState<AuthorLabel[]>([]);
 useEffect(()=>{
  const root=editor.view.dom.closest<HTMLElement>('.rich-editor');if(!root)return;
  const owners=createAuthorshipReader(state.authorship);
  let frame=0,disposed=false;
  const measure=()=>{const binding=ySyncPluginKey.getState(editor.state)?.binding;if(!binding)return;const mapped=new Map<any,Y.XmlElement>();for(const [type,node] of binding.mapping)if(type instanceof Y.XmlElement)mapped.set(node,type);
   const bounds=root.getBoundingClientRect(),next:AuthorLabel[]=[];
   editor.state.doc.descendants((node,position)=>{if(!node.isTextblock||!node.content.size)return;const element=mapped.get(node),dom=editor.view.nodeDOM(position);if(!element||!(dom instanceof HTMLElement))return;for(let parent=dom.parentElement;parent&&parent!==root;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement&&!parent.open&&!parent.querySelector(':scope > summary')?.contains(dom))return;const rect=dom.getBoundingClientRect();if(!rect.height)return;const authors=owners(element);if(authors.length)next.push({position,top:rect.top-bounds.top,authors})});const probe=root.querySelector<HTMLElement>('.editor-author-name'),lineHeight=probe?parseFloat(getComputedStyle(probe).lineHeight):parseFloat(getComputedStyle(document.documentElement).fontSize)*.75*1.7;setLabels(combineAuthorLabels(next,lineHeight));
  };
  const schedule=()=>{if(disposed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(measure)};
  const resize=new ResizeObserver(schedule);resize.observe(root);editor.on('update',schedule);root.addEventListener('toggle',schedule,true);schedule();void document.fonts.ready.then(schedule);
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();editor.off('update',schedule);root.removeEventListener('toggle',schedule,true)};
 },[editor,state.doc,state.authorship]);
 return <div className="editor-authorship" aria-label="Document authors">{labels.map(label=>{const names=label.authors.map(id=>id?displayNameFor(data.users.find(user=>user.id===id),data,'Unknown author'):'Unknown author').join(', ');return <span key={label.position} className="editor-author-name" style={{top:label.top}} data-tooltip-label={names}>{names}</span>})}</div>;
}
