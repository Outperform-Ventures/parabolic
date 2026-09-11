import {isAttachmentUrl} from './attachment-url';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {NodeViewWrapper,NodeViewContent,ReactNodeViewRenderer,type NodeViewProps} from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet,type EditorView} from '@tiptap/pm/view';
import type {Node as ProseMirrorNode} from '@tiptap/pm/model';
import {Check,Copy,Download,File,Maximize2,Minus,Plus,WrapText,X,ChevronLeft,ChevronRight} from 'lucide-react';
import './editor-blocks.css';

let highlighter:typeof import('./editor-highlight').highlighter|null=null;
let highlighterModule:Promise<void>|undefined;
const languageNames:Record<string,string>={plaintext:'Plain text',javascript:'JavaScript',typescript:'TypeScript',python:'Python',bash:'Bash',shell:'Shell',c:'C',cpp:'C++',csharp:'C#',css:'CSS',diff:'Diff',go:'Go',graphql:'GraphQL',html:'HTML',xml:'HTML / XML',ini:'INI',java:'Java',json:'JSON',kotlin:'Kotlin',less:'Less',lua:'Lua',makefile:'Makefile',markdown:'Markdown',objectivec:'Objective-C',perl:'Perl',php:'PHP',r:'R',ruby:'Ruby',rust:'Rust',scss:'SCSS',sql:'SQL',swift:'Swift',yaml:'YAML'};
const languages=Object.keys(languageNames).sort((a,b)=>(languageNames[a]||a).localeCompare(languageNames[b]||b));
function CodeBlockView({node,editor,updateAttributes}:NodeViewProps){
  const [copied,setCopied]=useState(false),[wrap,setWrap]=useState(false),[error,setError]=useState('');const language=node.attrs.language||'plaintext';useEffect(()=>setCopied(false),[node.textContent]);
  return <NodeViewWrapper className={`editor-code-block ${wrap?'wrapped':''}`}><div className="editor-code-controls" contentEditable={false}>
    {editor.isEditable?<select aria-label="Code language" value={language} onChange={e=>updateAttributes({language:e.target.value})} onKeyDown={e=>e.stopPropagation()}><option value="plaintext">Plain text</option>{!languages.includes(language)&&<option value={language}>{language}</option>}{languages.filter(value=>value!=='plaintext').map(value=><option key={value} value={value}>{languageNames[value]||value}</option>)}</select>:<span>{languageNames[language]||language}</span>}
    <div><button type="button" aria-label="Wrap code lines" aria-pressed={wrap} title="Wrap code lines" onClick={()=>setWrap(!wrap)}><WrapText size={14}/></button><button type="button" aria-label="Copy code" title="Copy code" onClick={async()=>{try{await navigator.clipboard.writeText(node.textContent);setCopied(true);setError('')}catch{setError('Unable to copy. Select the code and copy it with your keyboard.')}}}>{copied?<Check size={14}/>:<Copy size={14}/>}</button></div>
  </div><pre><NodeViewContent<'code'> as="code" className={`language-${language}`} spellCheck={false}/></pre>{error&&<div role="alert" className="error-text">{error}</div>}</NodeViewWrapper>;
}
function syntaxDecorations(doc:ProseMirrorNode){
  if(!highlighter)return DecorationSet.empty;const decorations:Decoration[]=[];
  doc.descendants((node,pos)=>{if(node.type.name!=='codeBlock')return;const text=node.textContent;if(text.length>50_000)return false;const language=node.attrs.language||'plaintext';const result=highlighter!.registered(language)?highlighter!.highlight(language,text):highlighter!.highlightAuto(text);let from=pos+1;
    const walk=(nodes:any[],classes:string[]=[])=>{for(const child of nodes){const names=[...classes,...(child.properties?.className||[])];if(child.children)walk(child.children,names);else if(typeof child.value==='string'){if(names.length)decorations.push(Decoration.inline(from,from+child.value.length,{class:names.join(' ')}));from+=child.value.length}}};walk(result.children);return false;
  });return DecorationSet.create(doc,decorations);
}
const syntaxKey=new PluginKey('lazy-code-highlighting');
export const HighlightedCodeBlock=CodeBlockLowlight.extend({
  addNodeView(){return ReactNodeViewRenderer(CodeBlockView)},
  addProseMirrorPlugins(){return [new Plugin({key:syntaxKey,state:{init:(_,state)=>syntaxDecorations(state.doc),apply:(transaction,value)=>transaction.docChanged||transaction.getMeta(syntaxKey)?syntaxDecorations(transaction.doc):value.map(transaction.mapping,transaction.doc)},props:{decorations:state=>syntaxKey.getState(state)},view(view:EditorView){let destroyed=false,pending=false;const load=()=>{if(highlighter||pending)return;let found=false;view.state.doc.descendants(node=>{if(node.type.name==='codeBlock')found=true;return !found});if(!found)return;pending=true;highlighterModule??=import('./editor-highlight').then(module=>{highlighter=module.highlighter});void highlighterModule.then(()=>{if(!destroyed)view.dispatch(view.state.tr.setMeta(syntaxKey,true))}).catch(()=>{pending=false;highlighterModule=undefined})};load();return{update:load,destroy:()=>{destroyed=true}}}})]},
}).configure({defaultLanguage:'plaintext',enableTabIndentation:true,tabSize:2});
export const ResizableImage=Image.extend({
  addNodeView(){const parent=this.parent?.();if(!parent)return null;return props=>{const view=parent(props);const dom=view.dom as HTMLElement;dom.querySelectorAll<HTMLElement>('[data-resize-handle]').forEach(handle=>{handle.setAttribute('aria-label',`Resize image ${handle.dataset.resizeHandle}`);handle.setAttribute('title',`Resize image ${handle.dataset.resizeHandle}`)});return view}},
}).configure({allowBase64:false,resize:{enabled:true,directions:['bottom-left','bottom-right'],minWidth:32,minHeight:24,alwaysPreserveAspectRatio:true}});

export type PreviewItem={src:string;name:string;image?:boolean};
export function AttachmentPreview({items,index,onClose,onIndex}:{items:PreviewItem[];index:number;onClose:()=>void;onIndex:(index:number)=>void}){
  const dialog=useRef<HTMLDialogElement>(null),[zoom,setZoom]=useState<number|null>(null),[naturalWidth,setNaturalWidth]=useState<number|null>(null),[data,setData]=useState<{url?:string;text?:string;type?:string;name?:string;size?:number}>({}),[error,setError]=useState(''),[loading,setLoading]=useState(false);const item=items[index];
  useEffect(()=>{const el=dialog.current!;el.showModal();return()=>el.close()},[]);
  useEffect(()=>{let active=true,url:string|undefined;const controller=new AbortController();setZoom(null);setNaturalWidth(null);setData({});setError('');
    if(!isAttachmentUrl(item?.src)){setLoading(false);return}
    setLoading(true);void(async()=>{try{const response=await fetch(item.src,{credentials:'include',signal:controller.signal});if(!response.ok)throw Error(response.status===404?'This attachment is no longer available.':'Unable to load this attachment.');let blob=await response.blob();const type=response.headers.get('x-attachment-content-type')||blob.type||'application/octet-stream';if(type!==blob.type)blob=new Blob([blob],{type});url=URL.createObjectURL(blob);const disposition=response.headers.get('content-disposition')||'';const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];const filename=encoded?decodeURIComponent(encoded):disposition.match(/filename="([^"]+)"/)?.[1]||item.name;const isText=/^(text\/|application\/(json|xml|javascript))/.test(type);const text=isText&&blob.size<=2_000_000?await blob.text():undefined;if(active)setData({url,text,type,name:filename,size:blob.size})}catch(cause){if(active&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Unable to load attachment.')}finally{if(active)setLoading(false)}})();return()=>{active=false;controller.abort();if(url)URL.revokeObjectURL(url)};
  },[item?.src]);
  if(!item)return null;
  const isImage=item.image||/^image\/(png|jpeg|gif|webp|avif)$/.test(data.type||''),name=data.name||item.name||'Attachment';const source=data.url||item.src;
  return createPortal(<dialog ref={dialog} className="editor-attachment-preview" aria-label={`Preview ${name}`} onCancel={e=>{e.preventDefault();onClose()}} onKeyDown={e=>{e.stopPropagation();if(e.key==='ArrowRight'&&index<items.length-1){e.preventDefault();onIndex(index+1)}if(e.key==='ArrowLeft'&&index>0){e.preventDefault();onIndex(index-1)}}} onDoubleClick={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)onClose()}}>
    <header><div><strong>{name}</strong><span>{items.length>1?`${index+1} of ${items.length}`:''}{data.size!=null?` · ${data.size<1024?data.size+' B':data.size<1_048_576?(data.size/1024).toFixed(1)+' KB':(data.size/1_048_576).toFixed(1)+' MB'}`:''}</span></div><div className="editor-preview-actions">{isImage&&<><button type="button" aria-label="Zoom out" disabled={zoom!==null&&zoom<=.25} onClick={()=>setZoom(Math.max(.25,(zoom||1)-.25))}><Minus size={16}/></button><button type="button" aria-label="Fit image" onClick={()=>setZoom(null)}>{zoom?`${Math.round(zoom*100)}%`:<Maximize2 size={16}/>}</button><button type="button" aria-label="Zoom in" disabled={zoom!==null&&zoom>=4} onClick={()=>setZoom(Math.min(4,(zoom||1)+.25))}><Plus size={16}/></button></>}<a aria-label="Download attachment" title="Download attachment" href={item.src} download={name}><Download size={17}/></a><button type="button" autoFocus aria-label="Close preview" onClick={onClose}><X size={18}/></button></div></header>
    <div className="editor-preview-body">{loading?<div role="status">Loading attachment…</div>:error?<div role="alert">{error}</div>:isImage?<img alt={name} src={source} style={zoom&&naturalWidth?{width:naturalWidth*zoom,maxWidth:'none',maxHeight:'none'}:{}} onLoad={e=>setNaturalWidth(e.currentTarget.naturalWidth)} onDoubleClick={()=>setZoom(zoom?null:2)}/>:data.text!==undefined?<pre>{data.text}</pre>:data.type==='application/pdf'?<object data={source} type="application/pdf" aria-label={name}><a href={item.src} target="_blank" rel="noreferrer">Open PDF</a></object>:<div className="editor-preview-unavailable"><File size={44}/><strong>{name}</strong><p>A preview is not available for this file type.</p><a href={item.src} download={name}>Download file</a></div>}</div>
    {items.length>1&&<><button className="editor-preview-previous" type="button" aria-label="Previous attachment" disabled={index===0} onClick={()=>onIndex(index-1)}><ChevronLeft size={24}/></button><button className="editor-preview-next" type="button" aria-label="Next attachment" disabled={index===items.length-1} onClick={()=>onIndex(index+1)}><ChevronRight size={24}/></button></>}
  </dialog>,document.body);
}
