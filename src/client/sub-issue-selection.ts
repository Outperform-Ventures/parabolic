import type {Editor} from '@tiptap/core';
import {DOMSerializer, Fragment} from '@tiptap/pm/model';
import {getAppSnapshot,getIssueSelectionHistory} from './store';

const selectionEditors = new WeakMap<Element, Editor>();
type ConversionHistory={sourceDoc:Editor['state']['doc'];pending:boolean};
const conversions=new WeakMap<Editor,ConversionHistory>();
const historyPending=new WeakSet<Editor>();
function conversionBoundaryHTML(html:string){
  const root=document.createElement('div');root.innerHTML=html;
  // Persistence removes Tiptap's default nofollow token. That normalization
  // does not make the saved conversion a newer user edit.
  for(const link of root.querySelectorAll('a[rel]')){
    const rel=(link.getAttribute('rel')??'').split(/\s+/).filter(token=>token&&token!=='nofollow').sort().join(' ');
    if(rel)link.setAttribute('rel',rel);else link.removeAttribute('rel');
  }
  return root.innerHTML;
}

export function handleSelectionConversionHistory(element:Element,event:KeyboardEvent){
  const editor=selectionEditors.get(element);if(!editor)return false;
  if(!(event.metaKey||event.ctrlKey)||event.altKey)return false;
  const redo=event.key.toLowerCase()==='z'&&event.shiftKey||event.key.toLowerCase()==='y'&&!event.metaKey;
  if(event.key.toLowerCase()!=='z'&&!redo)return false;
  if(historyPending.has(editor)){event.preventDefault();event.stopPropagation();return true;}
  const issueId=element.closest<HTMLElement>('.issue-detail-view[data-issue-id]')?.dataset.issueId;
  if(!issueId||!element.closest('.issue-article > .rich-editor'))return false;
  const record=getIssueSelectionHistory(issueId,redo?'redo':'undo');if(!record||conversions.get(editor)?.pending)return false;
  const store=getAppSnapshot(),html=conversionBoundaryHTML(editor.getHTML());
  // Let the editor undo newer text edits first. Only route the exact conversion
  // boundary to workspace history, which owns both parent and child changes.
  if(redo?html!==conversionBoundaryHTML(record.before)||!store.canRedo:html!==conversionBoundaryHTML(record.after)||!store.canUndo)return false;
  event.preventDefault();event.stopPropagation();
  historyPending.add(editor);void(redo?store.redo():store.undo()).catch(error=>store.toast(error instanceof Error?error.message:'Unable to undo conversion')).finally(()=>{historyPending.delete(editor);});
  return true;
}
export function registerSelectionEditor(editor:Editor) {
  const element=editor.view.dom; selectionEditors.set(element,editor);
  return ()=>{selectionEditors.delete(element);};
}

/** Build the replacement without dispatching an editor update. The parent and
 * children are persisted together; collaboration receives that same update. */
export function prepareIssueSelection(issueId:string) {
  const selection=getSelection(); if(!selection?.rangeCount||selection.isCollapsed)return null;
  const range=selection.getRangeAt(0);
  const element=range.commonAncestorContainer instanceof Element?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
  const root=element?.closest('.tiptap');
  if(!root?.closest('.issue-article > .rich-editor')||root.closest<HTMLElement>('.issue-detail-view[data-issue-id]')?.dataset.issueId!==issueId)return null;
  const editor=selectionEditors.get(root); if(!editor?.isEditable||editor.isDestroyed)return null;
  const previous=conversions.get(editor);
  if(previous&&(previous.pending||previous.sourceDoc===editor.state.doc))return {pending:true as const};
  const titles=selectedIssueTitles(issueId); if(!titles.length)return null;
  const from=editor.view.posAtDOM(range.startContainer,range.startOffset),to=editor.view.posAtDOM(range.endContainer,range.endOffset);
  if(from>=to)return null;
  const children=titles.map(title=>({id:crypto.randomUUID(),title}));
  const {schema}=editor.state;
  const nodes=children.flatMap((child,index)=>[
    ...(index?[schema.nodes.hardBreak.create()]:[]),
    schema.text(child.title,[schema.marks.link.create({href:`/issues/${child.id}`})]),
  ]);
  const transaction=editor.state.tr.replaceWith(from,to,Fragment.fromArray(nodes));
  const container=document.createElement('div');
  container.append(DOMSerializer.fromSchema(schema).serializeFragment(transaction.doc.content));
  const record:ConversionHistory={sourceDoc:editor.state.doc,pending:true};
  conversions.set(editor,record);
  return {pending:false as const,children,description:container.innerHTML,
    completed(){record.pending=false;},
    failed(){if(conversions.get(editor)===record)conversions.delete(editor);},
  };
}

/** Preserve order and user-entered titles while removing pasted list markers. */
export function pastedIssueTitles(text:string):string[]{
  return text.split(/\r?\n/).map(line=>line.replace(/^\s*(?:(?:[-*+•]\s+)(?:\[[ xX]\]\s*)?|\d+[.)]\s+|\[[ xX]\]\s*)/,'').trim()).filter(Boolean);
}

/** Read only a selection inside this issue, never unrelated selected page text. */
export function selectedIssueTitles(issueId:string):string[]{
  const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return [];
  const range=selection.getRangeAt(0),element=range.commonAncestorContainer instanceof Element?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
  if(element?.closest<HTMLElement>('.issue-detail-view[data-issue-id]')?.dataset.issueId!==issueId)return [];
  const fragment=range.cloneContents(),items=[...fragment.querySelectorAll('li')];
  if(items.length)return items.map(item=>{const copy=item.cloneNode(true) as Element;copy.querySelectorAll('ul,ol,input').forEach(node=>node.remove());return copy.textContent?.trim()??'';}).filter(Boolean);
  const text=selection.toString().replace(/\s+/g,' ').trim();return text?[text]:[];
}
