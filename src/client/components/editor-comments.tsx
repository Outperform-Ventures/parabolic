import {displayNameFor} from '../display-name';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Extension,type Editor} from '@tiptap/core';
import {Plugin,PluginKey,type EditorState} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import {absolutePositionToRelativePosition,relativePositionToAbsolutePosition,ySyncPluginKey} from '@tiptap/y-tiptap';
import {createRelativePositionFromJSON,relativePositionToJSON} from 'yjs';
import {Check,MessageSquare,X} from 'lucide-react';
import {useAppStore} from '../store';
import type {Entity} from '../../shared/types';
import {RichEditor} from './ui';
import {hasCommentContent} from '../comment-drafts';

export type CommentAnchor={kind:'yjs';from:Record<string,any>;to:Record<string,any>;quote:string};
const key=new PluginKey<{comments:Entity[];active?:string}>('inline-comment-anchors');
export function resolveCommentAnchor(state:EditorState,anchor?:CommentAnchor){
  if(anchor?.kind!=='yjs')return null;
  try{const binding=ySyncPluginKey.getState(state)?.binding;if(!binding)return null;const from=relativePositionToAbsolutePosition(binding.doc,binding.type,createRelativePositionFromJSON(anchor.from),binding.mapping);const to=relativePositionToAbsolutePosition(binding.doc,binding.type,createRelativePositionFromJSON(anchor.to),binding.mapping);if(from==null||to==null||from<0||to>state.doc.content.size||from>=to)return null;return{from,to}}catch{return null}
}
export const InlineCommentAnchors=Extension.create({name:'inlineCommentAnchors',addProseMirrorPlugins(){return[new Plugin({key,state:{init:()=>({comments:[]}),apply:(transaction,value)=>transaction.getMeta(key)||value},props:{decorations(state){const value=key.getState(state);if(!value?.comments.length)return null;const decorations:Decoration[]=[];for(const comment of value.comments){if(comment.deletedAt||comment.resolved&&comment.id!==value.active)continue;const anchor=resolveCommentAnchor(state,comment.anchor);if(anchor)decorations.push(Decoration.inline(anchor.from,anchor.to,{'data-inline-comment-id':comment.id,class:`editor-comment-anchor ${comment.id===value.active?'active':''}`,title:'Open comment'}))}return DecorationSet.create(state.doc,decorations)}}})]}});
export function useInlineComments(editor:Editor|null,target?:{kind:'documents'|'projects'|'issues';id:string}){
  const entityId=target?.id,parentField=target?.kind==='issues'?'issueId':target?.kind==='projects'?'projectId':'documentId';
  const {data,user,create,update,toast}=useAppStore();
  const [active,setActive]=useState<string|null>(null),[draft,setDraft]=useState<CommentAnchor|null>(null),[drafts,setDrafts]=useState<Record<string,string>>({}),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0}),[busy,setBusy]=useState(false);
  const comments=useMemo(()=>entityId?data.comments.filter(c=>c[parentField]===entityId&&!c.deletedAt):[],[data.comments,entityId,parentField]);
  const body=drafts[active||'new']||'';const setBody=(value:string)=>setDrafts(current=>({...current,[active||'new']:value}));
  const current=comments.find(c=>c.id===active),thread=current?[current,...comments.filter(c=>c.parentId===current.id)]:[];const anchor=current?.anchor||draft;
  const latest=useRef({current,draft,body,open});latest.current={current,draft,body,open};
  useEffect(()=>{if(!editor)return;editor.view.dispatch(editor.state.tr.setMeta(key,{comments:entityId?comments:[],active:entityId&&open?active||undefined:undefined}))},[editor,entityId,comments,active,open]);
  const locate=(range?:{from:number;to:number}|null)=>{if(!editor)return;try{const rect=editor.view.coordsAtPos(range?.to||editor.state.selection.to);setPosition({left:Math.max(8,Math.min(rect.right+15,window.innerWidth-372)),top:Math.max(8,Math.min(rect.bottom+10,window.innerHeight-430))})}catch{setPosition({left:Math.max(8,window.innerWidth-380),top:100})}};
  const begin=()=>{if(!editor||!entityId||!editor.isEditable||editor.state.selection.empty)return false;if(latest.current.draft&&hasCommentContent(drafts.new||'')){setActive(null);locate(resolveCommentAnchor(editor.state,latest.current.draft));setOpen(true);return true}try{const binding=ySyncPluginKey.getState(editor.state)?.binding;if(!binding)return false;const {from,to}=editor.state.selection;const next:CommentAnchor={kind:'yjs',from:relativePositionToJSON(absolutePositionToRelativePosition(from,binding.type,binding.mapping)),to:relativePositionToJSON(absolutePositionToRelativePosition(to,binding.type,binding.mapping)),quote:editor.state.doc.textBetween(from,to,' ').slice(0,1000)};setDraft(next);setActive(null);setDrafts(current=>({...current,new:''}));locate({from,to});setOpen(true);return true}catch{toast('Select some text to attach a comment.');return false}};
  const openThread=(id:string)=>{const comment=comments.find(c=>c.id===id);if(!comment||!editor)return;setActive(comment.parentId||id);locate(resolveCommentAnchor(editor.state,comment.anchor));setOpen(true)};
  const openThreadRef=useRef(openThread);openThreadRef.current=openThread;
  useEffect(()=>{if(!entityId)return;const show=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.[parentField]===entityId)openThreadRef.current(detail.commentId)};window.addEventListener('open-inline-comment',show);return()=>window.removeEventListener('open-inline-comment',show)},[entityId,parentField]);
  const close=()=>{setOpen(false);editor?.commands.focus()};
  const cancel=()=>{setBody('');if(!current)setDraft(null);close()};
  const submit=async()=>{if(!entityId||!hasCommentContent(body)||busy)return;setBusy(true);try{const saved=await create('comments',{[parentField]:entityId,body,userId:user?.id,parentId:current?.id||null,...(!current&&draft?{anchor:draft}:{})});setBody('');if(!current)setDraft(null);setActive(current?.id||saved.id)}catch(error){toast(error instanceof Error?error.message:'Unable to save comment.')}finally{setBusy(false)}};
  const preference=(data.users.find(member=>member.id===user?.id)||user)?.preferences?.commentSubmit;
  const orphaned=!!anchor&&!!editor&&!resolveCommentAnchor(editor.state,anchor);
  const panel=open&&entityId&&editor?createPortal(<div role="dialog" aria-label={current?(target?.kind==='issues'?'Issue comment thread':target?.kind==='projects'?'Project comment thread':'Document comment thread'):'New inline comment'} className="editor-inline-comment-panel" style={{position:'fixed',...position}} onClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close()}}}>
    <header><span><MessageSquare size={14}/>{current?'Comment':'New comment'}</span><div>{current&&editor.isEditable&&<button type="button" aria-label={current.resolved?'Reopen thread':'Resolve thread'} title={current.resolved?'Reopen thread':'Resolve thread'} onClick={async()=>{try{await update('comments',current.id,{resolved:!current.resolved});close()}catch(error){toast(error instanceof Error?error.message:'Unable to update thread.')}}}><Check size={16}/></button>}<button type="button" aria-label="Close comment" onClick={close}><X size={16}/></button></div></header>
    <blockquote>{anchor?.quote||'Comment'}{orphaned&&<small>This text is no longer present in {target?.kind==='documents'?'the document':'the description'}.</small>}</blockquote>
    <div className="editor-inline-comment-thread">{thread.map(comment=><article key={comment.id}><strong>{displayNameFor(data.users.find(member=>member.id===(comment.userId||comment.creatorId)),data,'Member')}<time>{new Date(comment.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></strong><RichEditor value={comment.body||''} onChange={()=>{}} readOnly/>{comment.resolved&&<small>Resolved</small>}</article>)}</div>
    {editor.isEditable&&<div className="editor-inline-comment-compose" onKeyDownCapture={e=>{if(e.key!=='Enter'||e.shiftKey||e.nativeEvent.isComposing||!(e.target as HTMLElement).isContentEditable||e.currentTarget.querySelector('.slash-menu,[role=dialog]'))return;const match=preference==='Command + Enter'?e.metaKey||e.ctrlKey:!e.metaKey&&!e.ctrlKey;if(match&&hasCommentContent(body)){e.preventDefault();e.stopPropagation();void submit()}}}><RichEditor attachmentContext={{[parentField]:entityId}} value={body} onChange={setBody} placeholder={current?'Reply to thread…':'Comment on selected text…'}/><footer><button type="button" className="button ghost" onClick={cancel}>Cancel</button><button type="button" className="button primary" disabled={!hasCommentContent(body)||busy} onClick={submit}>{busy?'Saving…':current?'Reply':'Comment'}</button></footer></div>}
  </div>,document.body):null;
  return{begin,openThread,panel,enabled:!!entityId};
}
