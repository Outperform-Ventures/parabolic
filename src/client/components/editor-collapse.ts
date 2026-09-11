import type {Editor} from '@tiptap/react';
import {Fragment} from '@tiptap/pm/model';
import {TextSelection} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';

/** Enter splits the section heading into a new first body paragraph. */
export function enterEditorCollapse(editor:Editor):boolean {
 // At a node-view boundary Chromium can move the DOM caret before ProseMirror
 // receives selectionchange. A custom key handler must use that visible caret.
 const domSelection=editor.view.dom.ownerDocument.getSelection();
 if(domSelection?.anchorNode&&domSelection.focusNode){
  const element=(node:globalThis.Node)=>node.nodeType===1?node as Element:node.parentElement;
  const heading=element(domSelection.anchorNode)?.closest('summary');
  if(heading&&editor.view.dom.contains(heading)&&heading.contains(domSelection.focusNode)){
   const anchor=editor.view.posAtDOM(domSelection.anchorNode,domSelection.anchorOffset);
   const head=editor.view.posAtDOM(domSelection.focusNode,domSelection.focusOffset);
   if(anchor!==editor.state.selection.anchor||head!==editor.state.selection.head)
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc,anchor,head)));
  }
 }
 const {state}=editor,{$from,$to}=state.selection;
 if($from.parent.type.name!=='detailsSummary'||!$from.sameParent($to))return false;
 const depth=$from.depth-1,details=$from.node(depth);
 if(details.type.name!=='details')return false;
 const summary=$from.parent,body=details.lastChild!,start=$from.before(depth);
 if(state.selection.empty&&$from.parentOffset===0){
  const paragraph=state.schema.nodes.paragraph.create();
  const tr=closeHistory(state.tr).insert(start,paragraph);
  tr.setSelection(TextSelection.create(tr.doc,$from.pos+paragraph.nodeSize));
  editor.view.dispatch(tr.scrollIntoView());return true;
 }
 const heading=summary.copy(summary.content.cut(0,$from.parentOffset));
 const paragraph=state.schema.nodes.paragraph.create(null,summary.content.cut($to.parentOffset));
 const children=[paragraph];
 body.forEach(child=>{if(body.childCount===1&&child.type.name==='paragraph'&&!child.content.size)return;children.push(child)});
 const replacement=details.type.create({...details.attrs,open:true},[heading,body.copy(Fragment.fromArray(children))]);
 const tr=closeHistory(state.tr).replaceWith(start,start+details.nodeSize,replacement);
 tr.setSelection(TextSelection.create(tr.doc,start+heading.nodeSize+3));
 editor.view.dispatch(tr.scrollIntoView());return true;
}

/** Convert selected blocks without replacing their text with template content. */
export function toggleEditorCollapse(editor:Editor):boolean {
 const {state}=editor,{$from,$to}=state.selection,{schema}=state;
 for(let depth=$from.depth;depth>0;depth--){
  const node=$from.node(depth);
  if(node.type.name!=='details')continue;
  const start=$from.before(depth);
  if($to.pos>start+node.nodeSize)return false;
  const summary=node.firstChild!,body=node.lastChild!;
  const blocks=[];
  if(summary.content.size)blocks.push(schema.nodes.paragraph.create(null,summary.content));
  body.forEach(child=>blocks.push(child));
  if(!blocks.length)blocks.push(schema.nodes.paragraph.create());
  const tr=state.tr.replaceWith(start,start+node.nodeSize,Fragment.fromArray(blocks));
  tr.setSelection(TextSelection.near(tr.doc.resolve(start+1)));
  editor.view.dispatch(tr.scrollIntoView());editor.view.focus();return true;
 }
 const range=$from.blockRange($to);if(!range)return false;
 const content=state.doc.slice(range.start,range.end).content;
 const single=content.childCount===1&&content.firstChild?.isTextblock;
 const summary=schema.nodes.detailsSummary.create(null,single?content.firstChild!.content:undefined);
 const body=schema.nodes.detailsContent.create(null,single?schema.nodes.paragraph.create():content);
 const details=schema.nodes.details.create({open:true},[summary,body]);
 if(!range.parent.canReplaceWith(range.startIndex,range.endIndex,details.type))return false;
 const tr=state.tr.replaceWith(range.start,range.end,details);
 tr.setSelection(TextSelection.near(tr.doc.resolve(range.start+2)));
 editor.view.dispatch(tr.scrollIntoView());editor.view.focus();return true;
}
