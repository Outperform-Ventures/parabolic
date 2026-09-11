import {MediaEmbed} from '../shared/media-embed';
import {TemplatePlaceholder} from "../shared/template-placeholder";
import {HeadingLinks} from '../shared/heading-links.ts';
import {CustomEmoji} from '../shared/custom-emoji.ts';
import { Node, getSchema, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { generateHTML, generateJSON } from '@tiptap/html/server';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import * as Y from 'yjs';

// This headless schema mirrors the renderer's persisted nodes, without interactive NodeViews.
const Mention=Node.create({name:'mention',group:'inline',inline:true,atom:true,selectable:false,addAttributes(){return {id:{default:null,parseHTML:el=>el.getAttribute('data-mention-id')},kind:{default:'user',parseHTML:el=>el.getAttribute('data-mention-kind')||'user'},label:{default:'',parseHTML:el=>el.getAttribute('data-mention-label')||el.textContent?.replace(/^@/,'')||''}}},parseHTML(){return [{tag:'span[data-mention-id]'}]},renderHTML({node}){return ['span',{'data-mention-id':node.attrs.id,'data-mention-kind':node.attrs.kind,'data-mention-label':node.attrs.label,class:'editor-mention',contenteditable:'false'},`@${node.attrs.label}`]}});
const DateMention=Node.create({name:'dateMention',group:'inline',inline:true,atom:true,selectable:false,addAttributes(){return {date:{default:'',parseHTML:el=>el.getAttribute('data-date')}}},parseHTML(){return [{tag:'span[data-date]'}]},renderHTML({node}){return ['span',{'data-type':'date','data-date':node.attrs.date,class:'editor-date',contenteditable:'false'},String(node.attrs.date)]}});
const Diagram=Node.create({name:'diagram',group:'block',atom:true,draggable:true,addAttributes(){return {code:{default:'',parseHTML:el=>el.textContent||''}}},parseHTML(){return [{tag:'pre[data-type="mermaid"]',priority:1100},{tag:'pre',priority:1100,getAttrs:el=>el.querySelector('code.language-mermaid')?{}:false}]},renderHTML({node}){return ['pre',{'data-type':'mermaid'},['code',String(node.attrs.code||'')]]}});
const Details=Node.create({name:'details',group:'block',content:'detailsSummary detailsContent',defining:true,addAttributes(){return {open:{default:true,parseHTML:el=>el.hasAttribute('open'),renderHTML:attrs=>attrs.open?{open:''}:{}}}},parseHTML(){return [{tag:'details'}]},renderHTML({HTMLAttributes}){return ['details',mergeAttributes(HTMLAttributes,{'data-type':'details'}),0]}});
const DetailsSummary=Node.create({name:'detailsSummary',content:'inline*',defining:true,parseHTML(){return [{tag:'summary'}]},renderHTML(){return ['summary',0]}});
const DetailsContent=Node.create({name:'detailsContent',content:'block+',defining:true,parseHTML(){return [{tag:'div[data-type="detailsContent"]'}]},renderHTML(){return ['div',{'data-type':'detailsContent'},0]}});
const dimension=(element:HTMLElement,name:string)=>{const value=Number(element.getAttribute(name));return Number.isFinite(value)&&value>0?value:null;};
const SizedImage=Image.extend({addAttributes(){return {...this.parent?.(),width:{default:null,parseHTML:element=>dimension(element,'width')},height:{default:null,parseHTML:element=>dimension(element,'height')}};}});
const extensions=[MediaEmbed,TemplatePlaceholder,HeadingLinks,StarterKit.configure({undoRedo:false}),TaskList,TaskItem.configure({nested:true}),Table,TableRow,TableCell,TableHeader,SizedImage.configure({allowBase64:false}),TextAlign.configure({types:['heading','paragraph']}),Mention,DateMention,CustomEmoji,Diagram,Details,DetailsSummary,DetailsContent];
const schema=getSchema(extensions);
export function structuredDocumentHtml(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value)||(value as any).type!=='doc')throw new Error('Body data must contain a ProseMirror doc');
  const pending=[{node:value as any,depth:0}];let count=0;
  while(pending.length){const {node,depth}=pending.pop()!;if(depth>64||++count>10000)throw new Error('Body data is too complex');
    if(!node||typeof node!=='object'||Array.isArray(node)||typeof node.type!=='string'||!Object.hasOwn(schema.nodes,node.type))throw new Error('Unsupported body node');
    if(Object.keys(node).some(key=>!['type','attrs','marks','content','text'].includes(key)))throw new Error('Unsupported body node fields');
    const nodeType=schema.nodes[node.type];
    if(node.attrs!=null&&(typeof node.attrs!=='object'||Array.isArray(node.attrs)||Object.keys(node.attrs).some(key=>!Object.hasOwn(nodeType.spec.attrs??{},key))))throw new Error('Unsupported body node attributes');
    if(node.marks!=null){if(!Array.isArray(node.marks))throw new Error('Invalid body marks');for(const mark of node.marks){if(!mark||!Object.hasOwn(schema.marks,mark.type)||Object.keys(mark).some(key=>!['type','attrs'].includes(key)))throw new Error('Unsupported body mark');const markType=schema.marks[mark.type];if(mark.attrs!=null&&(typeof mark.attrs!=='object'||Array.isArray(mark.attrs)||Object.keys(mark.attrs).some(key=>!Object.hasOwn(markType.spec.attrs??{},key))))throw new Error('Unsupported body mark attributes');}}
    if(node.content!=null){if(!Array.isArray(node.content))throw new Error('Invalid body content');for(const child of node.content)pending.push({node:child,depth:depth+1});}
  }
  const parsed=schema.nodeFromJSON(value);parsed.check();return generateHTML(parsed.toJSON(),extensions);
}
export function structuredDocumentJson(html:string){return generateJSON(html||'<p></p>',extensions);}
export function importDocumentHtml(doc:Y.Doc,html:string,origin:unknown='api') {
  const json=generateJSON(html||'<p></p>',extensions);
  doc.transact(()=>prosemirrorJSONToYXmlFragment(schema,json,doc.getXmlFragment('default')),origin);
}
export function documentHtml(doc:Y.Doc) {return generateHTML(yXmlFragmentToProsemirrorJSON(doc.getXmlFragment('default')),extensions);}

export function normalizedDocumentHtml(html:string){return generateHTML(generateJSON(html||'<p></p>',extensions),extensions);}

// StarterKit inserts one empty paragraph after a final non-paragraph block on
// the first editor transaction, including a selection-only transaction.
export function isEditorInitializationHtml(html:string,canonical:string){
 return html===canonical||!canonical.endsWith('</p>')&&html===canonical+'<p></p>';
}

/** Compare document meaning/formatting without editor identity or disclosure state. */
export function documentNotificationContent(html:string){
 const json=generateJSON(html||'<p></p>',extensions);
 const stripViewState=(node:any)=>{if(node.attrs){if(node.type==='heading')delete node.attrs.headingId;if(node.type==='details')delete node.attrs.open}for(const child of node.content||[])stripViewState(child)};
 stripViewState(json);
 const nodes=json.content||[],last=nodes.at(-1),prior=nodes.at(-2);
 // Match the editor's single automatic trailing paragraph, not arbitrary spacing edits.
 if(last?.type==='paragraph'&&!last.content?.length&&prior&&prior.type!=='paragraph')nodes.pop();
 return JSON.stringify(json);
}
