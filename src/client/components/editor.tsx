import {isCompositionKey} from '../composition-key';
import {registerSelectionEditor,handleSelectionConversionHistory} from '../sub-issue-selection';
import {RenderedMediaEmbed} from './editor-media';
import {mediaEmbed} from '../../shared/media-embed';
import {TemplatePlaceholder} from "../../shared/template-placeholder";
import "./template-placeholder.css";
import {useFormChanged} from '../form-changes';
import {pendingSaves} from '../pending-saves';
import {isAttachmentUrl} from './attachment-url';
import {CustomEmoji,customEmojiUrl,emojiNodeAttributes,type CustomEmojiValue} from '../../shared/custom-emoji';
import {displayNameFor,viewerPreferences} from '../display-name';
import React,{useEffect,useLayoutEffect,useRef,useState,useId,createContext,useContext} from 'react';
import {createPortal} from 'react-dom';
import {useNavigate} from 'react-router-dom';
import {Icon} from './ui';
import {IssueToolbarGlyph} from './editor-toolbar-glyphs';
import {IssueTextFormatControls} from './editor-issue-toolbar';
import {toggleEditorCollapse,enterEditorCollapse} from './editor-collapse';
import {useAppStore,hasPendingFieldMutation} from '../store';
import type {WorkspaceData} from '../../shared/types';
const EditorDataContext=createContext<WorkspaceData|undefined>(undefined);
function useEditorData(){const {data}=useAppStore();return useContext(EditorDataContext)??data}
import {useEditor,EditorContent,Node,mergeAttributes,NodeViewWrapper,ReactNodeViewRenderer,type NodeViewProps,type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {HeadingLinks} from '../../shared/heading-links';
import {EditorAuthorship} from './editor-authorship';
import {EditorHeadingLinks} from './editor-heading-links';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import {Table,TableRow,TableCell,TableHeader} from '@tiptap/extension-table';
import {InlineCommentAnchors,useInlineComments} from './editor-comments';
import {HighlightedCodeBlock,ResizableImage,AttachmentPreview,type PreviewItem} from './editor-blocks';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import {useDocumentCollaboration,type CollaborationTarget,type CollaborationState} from '../collaboration';

const isoDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dateLabel=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',...(Number(value.slice(0,4))!==new Date().getFullYear()?{year:'numeric' as const}:{})});
const naturalDate=(query:string)=>{
  const text=query.trim().toLowerCase(),today=new Date();today.setHours(12,0,0,0);
  if(text==='today')return isoDate(today);
  if(text==='tomorrow'){today.setDate(today.getDate()+1);return isoDate(today)}
  if(text==='next week'){today.setDate(today.getDate()+7);return isoDate(today)}
  if(/^\d{4}-\d{2}-\d{2}$/.test(text)){const value=new Date(`${text}T12:00:00`);return Number.isNaN(+value)||isoDate(value)!==text?null:text}
  if(!/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?$/.test(text))return null;
  const date=new Date(`${text.replace(/(\d)(st|nd|rd|th)/,'$1')}${/\d{4}$/.test(text)?'':` ${today.getFullYear()}`} 12:00`);return Number.isNaN(+date)?null:isoDate(date);
};
const DateMention=Node.create({name:'dateMention',group:'inline',inline:true,atom:true,selectable:false,addAttributes(){return {date:{default:'',parseHTML:el=>el.getAttribute('data-date')}}},parseHTML(){return [{tag:'span[data-date]'}]},renderHTML({node}){return ['span',{'data-type':'date','data-date':node.attrs.date,class:'editor-date',contenteditable:'false'},dateLabel(node.attrs.date)]},renderText({node}){return node.attrs.date}});
const emojiEntries:[string,string][]=[['100','💯'],['+1','👍'],['thumbsup','👍'],['-1','👎'],['thumbsdown','👎'],['smile','😄'],['smiley','😃'],['grin','😁'],['laughing','😆'],['joy','😂'],['wink','😉'],['blush','😊'],['thinking','🤔'],['heart','❤️'],['heart_eyes','😍'],['eyes','👀'],['rocket','🚀'],['tada','🎉'],['fire','🔥'],['sparkles','✨'],['star','⭐'],['check','✅'],['white_check_mark','✅'],['x','❌'],['warning','⚠️'],['bug','🐛'],['construction','🚧'],['wrench','🔧'],['bulb','💡'],['memo','📝'],['calendar','📅'],['clock','🕐'],['hourglass','⏳'],['wave','👋'],['pray','🙏'],['muscle','💪'],['clap','👏'],['handshake','🤝'],['party','🥳'],['coffee','☕'],['sad','😞'],['cry','😢'],['sweat_smile','😅'],['sunglasses','😎'],['ok_hand','👌'],['raised_hands','🙌'],['pin','📌'],['link','🔗'],['lock','🔒'],['unlock','🔓'],['target','🎯'],['chart','📈'],['package','📦'],['ship','🚢']];
let mermaidModule:Promise<typeof import('mermaid')>|undefined;
function DiagramView({node,editor,updateAttributes,deleteNode}:NodeViewProps){
  const [editing,setEditing]=useState(!node.attrs.code),[draft,setDraft]=useState(String(node.attrs.code||'')),[svg,setSvg]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false);
  const renderId=`diagram${useId().replace(/[^a-zA-Z0-9]/g,'')}`;
  useEffect(()=>{setDraft(String(node.attrs.code||''))},[node.attrs.code]);
  useEffect(()=>{let current=true;setSvg('');setError('');const code=String(node.attrs.code||'');if(!code.trim())return;if(code.length>20000){setError('Diagram source is limited to 20,000 characters.');return}
    void(async()=>{try{mermaidModule??=import('mermaid');const {default:mermaid}=await mermaidModule;mermaid.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,maxTextSize:20000,theme:'dark',fontFamily:'Inter, sans-serif',flowchart:{htmlLabels:false},secure:['securityLevel','startOnLoad','maxTextSize','maxEdges','suppressErrorRendering','htmlLabels']});const result=await mermaid.render(renderId,code);if(current)setSvg(result.svg)}catch(cause){if(current)setError(cause instanceof Error?cause.message:'Unable to render diagram')}})();return()=>{current=false}},[node.attrs.code,renderId]);
  return <NodeViewWrapper className="editor-diagram" contentEditable={false}><div className="editor-diagram-heading"><span><Icon name="GitBranch" size={14}/>Diagram</span>{editor.isEditable&&<div><button type="button" className="button ghost" onClick={()=>setEditing(!editing)}>{editing?'Preview':'Edit'}</button><button type="button" className="icon-button" aria-label="Copy diagram source" onClick={async()=>{try{await navigator.clipboard.writeText(String(node.attrs.code||''));setCopied(true)}catch{setError('Unable to copy diagram source.')}}}><Icon name={copied?'Check':'Copy'} size={14}/></button><button type="button" className="icon-button" aria-label="Delete diagram" onClick={deleteNode}><Icon name="Trash2" size={14}/></button></div>}</div>{editing&&editor.isEditable?<div className="editor-diagram-source"><label>Mermaid source<textarea autoFocus aria-label="Mermaid source" spellCheck={false} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){setDraft(String(node.attrs.code||''));setEditing(false)}if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){updateAttributes({code:draft});setEditing(false)}}}/></label><div><button type="button" className="button" onClick={()=>{setDraft(String(node.attrs.code||''));setEditing(false)}}>Cancel</button><button type="button" className="button primary" disabled={!draft.trim()||draft.length>20000} onClick={()=>{updateAttributes({code:draft});setEditing(false)}}>Save diagram</button></div></div>:svg?<div className="editor-diagram-render" role="img" aria-label="Rendered Mermaid diagram" dangerouslySetInnerHTML={{__html:svg}}/>:<div className="editor-diagram-placeholder">{error?'Diagram could not be rendered':node.attrs.code?'Rendering diagram…':'Add Mermaid source to build a diagram.'}</div>}{error&&<div className="error-text" role="alert">{error}</div>}</NodeViewWrapper>;
}
const Diagram=Node.create({name:'diagram',group:'block',atom:true,draggable:true,priority:100,addAttributes(){return {code:{default:'',parseHTML:el=>el.textContent||''}}},parseHTML(){return [{tag:'pre[data-type="mermaid"]',priority:1100},{tag:'pre',priority:1100,getAttrs:el=>el.querySelector('code.language-mermaid')?{}:false}]},renderHTML({node}){return ['pre',{'data-type':'mermaid'},['code',String(node.attrs.code||'')]]},renderText({node}){return `\`\`\`mermaid\n${node.attrs.code}\n\`\`\``},addNodeView(){return ReactNodeViewRenderer(DiagramView)}});

function MentionView({node}:NodeViewProps){const data=useEditorData();const label=node.attrs.kind==='user'?displayNameFor(data.users.find(user=>user.id===node.attrs.id),data,node.attrs.label):node.attrs.label;return <NodeViewWrapper as="span" data-mention-id={node.attrs.id} data-mention-kind={node.attrs.kind} data-mention-label={label} className="editor-mention" contentEditable={false} data-tooltip-label={label}>@{label}</NodeViewWrapper>}
const Mention=Node.create({
  name:'mention',group:'inline',inline:true,atom:true,selectable:false,
  addAttributes(){return {id:{default:null,parseHTML:el=>el.getAttribute('data-mention-id')},kind:{default:'user',parseHTML:el=>el.getAttribute('data-mention-kind')||'user'},label:{default:'',parseHTML:el=>el.getAttribute('data-mention-label')||el.textContent?.replace(/^@/,'')||''}}},
  parseHTML(){return [{tag:'span[data-mention-id]'}]},
  renderHTML({node}){return ['span',{'data-mention-id':node.attrs.id,'data-mention-kind':node.attrs.kind,'data-mention-label':node.attrs.label,class:'editor-mention',contenteditable:'false',title:node.attrs.label},`@${node.attrs.label}`]},
  renderText({node}){return `@${node.attrs.label}`},addNodeView(){return ReactNodeViewRenderer(MentionView)},
});
const Details=Node.create({
  name:'details',group:'block',content:'detailsSummary detailsContent',defining:true,
  addAttributes(){return {open:{default:true,parseHTML:el=>el.hasAttribute('open'),renderHTML:attributes=>attributes.open?{open:''}:{}}}},
  parseHTML(){return [{tag:'details'}]},renderHTML({HTMLAttributes}){return ['details',mergeAttributes(HTMLAttributes,{'data-type':'details'}),0]},
  addNodeView(){return ({node,editor,getPos})=>{
    let current=node,revealed=false;const dom=document.createElement('details');dom.dataset.type='details';dom.open=!!node.attrs.open;
    // Following a section link changes this viewer's disclosure, not shared content.
    const reveal=()=>{revealed=true;dom.open=true};
    const toggle=()=>{if(dom.open===(!!current.attrs.open||revealed))return;revealed=false;if(dom.open===!!current.attrs.open||!editor.isEditable)return;const pos=getPos();if(typeof pos==='number')editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...current.attrs,open:dom.open}))};
    dom.addEventListener('toggle',toggle);dom.addEventListener('parabolic-reveal-details',reveal);
    return {dom,contentDOM:dom,update(next){if(next.type!==current.type)return false;const disclosureChanged=next.attrs.open!==current.attrs.open;current=next;if(disclosureChanged){const open=!!next.attrs.open||revealed;if(dom.open!==open)dom.open=open}return true},ignoreMutation(mutation){return mutation.type==='attributes'&&mutation.attributeName==='open'},destroy(){dom.removeEventListener('toggle',toggle);dom.removeEventListener('parabolic-reveal-details',reveal)}}
  }},
});
const DetailsSummary=Node.create({
  name:'detailsSummary',content:'inline*',defining:true,
  addOptions(){return {nativeDisclosure:false}},
  addKeyboardShortcuts(){return {Enter:()=>enterEditorCollapse(this.editor)}},
  parseHTML(){return [{tag:'summary'}]},renderHTML(){return ['summary',0]},
  addNodeView(){return ({editor,getPos})=>{
    const dom=document.createElement('summary');
    if(!this.options.nativeDisclosure)return {dom,contentDOM:dom};
    dom.className='editor-collapse-heading';
    const button=document.createElement('button'),contentDOM=document.createElement('span');
    button.type='button';button.contentEditable='false';button.tabIndex=-1;button.className='editor-collapse-toggle';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
    svg.setAttribute('width','16');svg.setAttribute('height','16');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');
    path.setAttribute('d','M5.60633 11.8224C5.1159 12.1084 4.5 11.7547 4.5 11.1869V4.73676C4.5 4.16898 5.1159 3.81524 5.60633 4.10132L11.135 7.32638C11.6217 7.61025 11.6217 8.31338 11.135 8.59726L5.60633 11.8224Z');
    svg.append(path);button.append(svg);dom.append(button,contentDOM);
    const sync=()=>{const details=dom.closest('details');const pos=getPos();const open=details?.open??(typeof pos==='number'?!!editor.state.doc.resolve(pos).parent.attrs.open:true);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Collapse section':'Expand section')};
    const click=(event:MouseEvent)=>{event.preventDefault();event.stopPropagation();const details=dom.closest('details');if(details){details.open=!details.open;sync()}};
    const preserveSelection=(event:MouseEvent)=>event.preventDefault();
    const editTitle=(event:MouseEvent)=>event.preventDefault();
    button.addEventListener('mousedown',preserveSelection);button.addEventListener('click',click);dom.addEventListener('click',editTitle);
    // Observe only the disclosure attribute; content remains owned by ProseMirror.
    const observer=new MutationObserver(sync);
    queueMicrotask(()=>{const details=dom.closest('details');if(details)observer.observe(details,{attributes:true,attributeFilter:['open']});sync()});
    return {dom,contentDOM,ignoreMutation(mutation){return mutation.type!=='selection'&&button.contains(mutation.target)},destroy(){observer.disconnect();button.removeEventListener('mousedown',preserveSelection);button.removeEventListener('click',click);dom.removeEventListener('click',editTitle)}};
  }},
});
const DetailsContent=Node.create({name:'detailsContent',content:'block+',defining:true,parseHTML(){return [{tag:'div[data-type="detailsContent"]'}]},renderHTML(){return ['div',{'data-type':'detailsContent'},0]}});

type BlockCommand={name:string;icon:string;key:string;level?:number;aliases?:string[];shortcut?:string};
const blockCommands:BlockCommand[]=[
  {name:'Heading 1',icon:'Heading1',key:'heading',level:1,shortcut:'⌘⌥1'},
  {name:'Heading 2',icon:'Heading1',key:'heading',level:2,shortcut:'⌘⌥2'},
  {name:'Heading 3',icon:'Heading1',key:'heading',level:3,shortcut:'⌘⌥3'},
  {name:'Bulleted list',icon:'List',key:'bulletList',shortcut:'⌘⇧8'},
  {name:'Numbered list',icon:'ListOrdered',key:'orderedList',shortcut:'⌘⇧9'},
  {name:'Checklist',icon:'ListChecks',key:'taskList',shortcut:'⌘⇧7'},
  {name:'Insert media…',icon:'ImageIcon',key:'attachment',aliases:['image','media','upload']},
  {name:'Insert gif…',icon:'ImageIcon',key:'attachment',aliases:['gif','media']},
  {name:'Attach files…',icon:'Paperclip',key:'attachment',aliases:['file','insert','upload'],shortcut:'⌘⇧U'},
  {name:'Code block',icon:'Code2',key:'codeBlock',shortcut:'⌘⇧\\'},
  {name:'Diagram',icon:'GitBranch',key:'diagram'},
  {name:'Collapsible section',icon:'ChevronRight',key:'details',shortcut:'⌘⇧6'},
  {name:'Blockquote',icon:'Quote',key:'blockquote',shortcut:'⌥⇧.'},
  {name:'Text',icon:'Type',key:'paragraph'},
  {name:'Heading 4',icon:'Heading1',key:'heading',level:4},
  {name:'Table',icon:'Table2',key:'table'},
  {name:'Date',icon:'Calendar',key:'date'},
  {name:'Divider',icon:'Minus',key:'horizontalRule'},
];
type Picker={kind:'block'|'mention'|'emoji';query:string;from:number;index:number};
type Suggestion={label:string;description?:string;icon:string;command?:BlockCommand;entity?:{id:string;kind:string;label:string};date?:string;emoji?:string;customEmoji?:CustomEmojiValue};
const safeLink=(value:string)=>{if(value.startsWith('/')&&!value.startsWith('//'))return value;try{const parsed=new URL(value);return ['http:','https:','mailto:','tel:'].includes(parsed.protocol)?value:null}catch{return null}};

type RichEditorProps={issueFormatting?:boolean;templateMode?:boolean;dataOverride?:WorkspaceData;uploadFile?:(file:File)=>Promise<{url:string}>;onUploadStatusChange?:(status:{pending:boolean;error:string})=>void;showAuthors?:boolean;showInlineComments?:boolean;blurOnEscape?:boolean;value:string;onChange:(html:string)=>void;placeholder?:string;ariaLabel?:string;readOnly?:boolean;collaboration?:CollaborationTarget;attachmentContext?:{issueId?:string;documentId?:string;projectId?:string;initiativeId?:string;commentId?:string};openLinkRequest?:number};
export function RichEditor(props:RichEditorProps){return <EditorDataContext.Provider value={props.dataOverride}><RichEditorInner {...props}/></EditorDataContext.Provider>}
function RichEditorInner(props:RichEditorProps){
  const data=useEditorData();const state=useDocumentCollaboration(props.collaboration);const [peers,setPeers]=useState<{id:string,name:string,color:string}[]>([]);
  const store=useAppStore(),localProjection=useRef<string|null>(null);
  const [localDraft,setLocalDraft]=useState<{id:string;html:string}|null>(null);
  const issueId=props.collaboration?.kind==='issues'?props.collaboration.id:null;
  const pendingDescription=!!issueId&&hasPendingFieldMutation('issues',issueId,'description');
  // A queued HTML replacement must be visible offline, but must not also be
  // inserted into Yjs: the server imports this same replacement when the batch
  // commits. Keep edits in the durable outbox until every replacement settles.
  localProjection.current=(pendingDescription||!!issueId&&localDraft?.id===issueId)&&(!store.online||localProjection.current===issueId)?issueId:null;
  const useLocalProjection=!!localProjection.current;
  const localValue=localDraft?.id===issueId?localDraft.html:data.issues.find(issue=>issue.id===issueId)?.description??props.value;
  const saveLocalDescription=(html:string)=>{
    props.onChange(html);if(!useLocalProjection||!issueId)return;
    const draft={id:issueId,html};setLocalDraft(draft);
    void store.batch([{kind:'issues',id:issueId,data:{description:html}}],{history:false})
      .then(()=>setLocalDraft(current=>current===draft?null:current))
      .catch(error=>store.toast(String(error)));
  };
  useEffect(()=>{if(!state?.provider)return;const awareness=state.provider.awareness;const update=()=>{const unique=new Map<string,{id:string,name:string,color:string}>();for(const value of awareness.getStates().values())if(value.user&&value.user.id!==state.user.id)unique.set(value.user.id,value.user);setPeers([...unique.values()])};update();awareness.on('change',update);return()=>awareness.off('change',update)},[state?.provider]);
  if(props.collaboration&&!state?.ready&&!useLocalProjection)return <div className="editor-collaboration-loading" role="status">{state?.error|| (state?.status==='offline'?'This content has not been cached yet. Connect to load it.':'Loading content…')}</div>;
  return <>{props.collaboration&&state&&(state.error||state.status!=='connected'||state.readOnly||peers.length>0)&&<div className="editor-collaboration-status" role="status" style={{display:'flex',alignItems:'center',gap:8,minHeight:25,marginBottom:6,color:'var(--muted)',fontSize:"0.6875rem"}}><span>{state.error|| (state.status==='connected'?(state.readOnly?'View only':''):state.status==='offline'?'Offline · Changes saved on this device':'Connecting…')}</span>{peers.map(peer=><span key={peer.id} title={displayNameFor(data.users.find(user=>user.id===peer.id),data,peer.name)+' is viewing this content'} style={{marginLeft:4,color:peer.color}}>{displayNameFor(data.users.find(user=>user.id===peer.id),data,peer.name)}</span>)}</div>}<EditorCore key={useLocalProjection?"local-description":"collaborative"} {...props} value={useLocalProjection?localValue:props.value} onChange={saveLocalDescription} readOnly={props.readOnly||state?.readOnly} collaborationState={useLocalProjection?null:state}/></>;
}
function EditorCore({issueFormatting=false,templateMode=false,uploadFile,onUploadStatusChange,showAuthors=false,showInlineComments=true,blurOnEscape=false,value,onChange,placeholder='Write a description…',ariaLabel,readOnly=false,collaboration,collaborationState,attachmentContext,openLinkRequest=0}:RichEditorProps & {collaborationState:CollaborationState|null}){
  const data=useEditorData();const dataRef=useRef(data);dataRef.current=data;const preferences=viewerPreferences(data);const preferencesRef=useRef(preferences);preferencesRef.current=preferences;const navigate=useNavigate();
  const [fullEmoji,setFullEmoji]=useState<typeof import('../features/emoji-data')|null>(null),[emojiError,setEmojiError]=useState('');const fullEmojiRef=useRef(fullEmoji);fullEmojiRef.current=fullEmoji;
  const [picker,setPicker]=useState<Picker|null>(null),[focused,setFocused]=useState(false),[uploadError,setUploadError]=useState(''),[uploading,setUploading]=useState(false),[linkOpen,setLinkOpen]=useState(false),[linkValue,setLinkValue]=useState(''),[linkError,setLinkError]=useState(''),[tableMenu,setTableMenu]=useState(false),[more,setMore]=useState(false),[preview,setPreview]=useState<{id:string;kind:string;label:string}|null>(null);
  const [dateOpen,setDateOpen]=useState(false),[dateValue,setDateValue]=useState(isoDate(new Date())),[dateQuery,setDateQuery]=useState(''),[dateError,setDateError]=useState('');const datePosition=useRef<number|null>(null);
  const [attachmentPreview,setAttachmentPreview]=useState<{items:PreviewItem[];index:number}|null>(null);
  const [formatDropdownOpen,setFormatDropdownOpen]=useState(false);
  const [toolbarPosition,setToolbarPosition]=useState({left:8,top:8,height:35,visible:false});
  const [pickerPosition,setPickerPosition]=useState({left:0,top:35,maxHeight:300});const [overlayPosition,setOverlayPosition]=useState({left:0,top:28});const openLinkRef=useRef<()=>void>(()=>{});const inlineCommentRef=useRef<()=>boolean>(()=>false);
  const formChanged=useFormChanged();const formChangedRef=useRef(formChanged);formChangedRef.current=formChanged;
  const onChangeRef=useRef(onChange);onChangeRef.current=onChange;const lastEmitted=useRef(value);
  const pendingMediaRef=useRef<string|null>(null);
  const blurOnEscapeRef=useRef(blurOnEscape);blurOnEscapeRef.current=blurOnEscape;
  const pickerRef=useRef(picker);pickerRef.current=picker;
  const suggestionsRef=useRef<Suggestion[]>([]),chooseRef=useRef<(suggestion:Suggestion)=>void>(()=>{});
  const upload=useRef<HTMLInputElement>(null),root=useRef<HTMLDivElement>(null),toolbar=useRef<HTMLDivElement>(null),toolbarMenu=useRef<HTMLDivElement>(null),blurTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{for(const caret of root.current?.querySelectorAll<HTMLElement>('.collaboration-carets__caret')||[]){const label=caret.querySelector('.collaboration-carets__label');if(label)label.textContent=displayNameFor(data.users.find(user=>user.id===caret.dataset.peerId),data,caret.dataset.peerName||'')}},[data.users,preferences.displayNames]);
  const updatePicker=(editor:Editor)=>{
    const {$from}=editor.state.selection;
    if(!editor.state.selection.empty||editor.isActive('codeBlock')||editor.isActive('diagram')){setPicker(null);return}
    const text=$from.parent.textContent.slice(0,$from.parentOffset);
    if(preferencesRef.current.convertEmoticons!==false&&!editor.view.composing){const match=text.match(/(?:^|\s)(:-?\)|:-?\(|;-?\)|:-?[dDpP]|<3|:-?\/|:-?[oO])([ \t])$/);if(match){const key=match[1].toLowerCase(),emoji=key==='<3'?'❤️':/[d]$/.test(key)?'😃':/[p]$/.test(key)?'😛':/[o]$/.test(key)?'😮':key.endsWith('/')?'😕':key.startsWith(';')?'😉':key.endsWith('(')?'🙁':'🙂';editor.chain().deleteRange({from:$from.pos-match[1].length-match[2].length,to:$from.pos}).insertContent(emoji+match[2]).run();return}}

    const emoji=text.match(/(?:^|\s):([\w+\-]+):$/);if(emoji){const workspace=dataRef.current.workspaces.find(workspace=>workspace.id===dataRef.current.workspaceId),custom=workspace?.customEmojis?.find((item:CustomEmojiValue)=>!item.deletedAt&&item.name.toLowerCase()===emoji[1].toLowerCase()&&customEmojiUrl(item.url));if(custom){editor.chain().deleteRange({from:$from.pos-emoji[1].length-2,to:$from.pos}).insertContent({type:'customEmoji',attrs:emojiNodeAttributes(custom)}).run();setPicker(null);return}const value=emojiEntries.find(([name])=>name===emoji[1])?.[1]||fullEmojiRef.current?.findEmoji(emoji[1])?.skins[0]?.native;if(value){editor.chain().deleteRange({from:$from.pos-emoji[1].length-2,to:$from.pos}).insertContent(value).run();setPicker(null);return}}
    const match=text.match(/(?:^|\s)([@/:])([^@/:]*)$/);
    if(!match||match[2].length>70){setPicker(null);return}
    const next={kind:match[1]==='@'?'mention':match[1]===':'?'emoji':'block',query:match[2],from:$from.pos-match[2].length-1,index:0} as Picker;
    setPicker(previous=>previous?.kind===next.kind&&previous.query===next.query?{...next,index:previous.index}:next);
  };
  const editor=useEditor({
    extensions:[RenderedMediaEmbed,TemplatePlaceholder,HeadingLinks.configure({assignNewIds:true}),StarterKit.configure({codeBlock:false,undoRedo:collaborationState?false:undefined,link:{openOnClick:false,autolink:true,defaultProtocol:'https'}}),Placeholder.configure({includeChildren:true,showOnlyCurrent:false,placeholder:({node})=>node.type.name==='detailsSummary'?'Add section title…':placeholder}),TaskList,TaskItem.configure({nested:true}),Table.configure({resizable:true}),TableRow,TableCell,TableHeader,ResizableImage,HighlightedCodeBlock,TextAlign.configure({types:['heading','paragraph']}),Mention,DateMention,CustomEmoji,Diagram,Details,DetailsSummary.configure({nativeDisclosure:issueFormatting}),DetailsContent,InlineCommentAnchors,...(collaborationState?[Collaboration.configure({document:collaborationState.doc,field:'default'}),CollaborationCaret.configure({provider:collaborationState.provider,user:collaborationState.user,render:user=>{const cursor=document.createElement('span'),label=document.createElement('div');cursor.className='collaboration-carets__caret';label.className='collaboration-carets__label';const color=typeof user.color==='string'&&CSS.supports('color',user.color)?user.color:'#5e6ad2';cursor.style.borderColor=color;label.style.backgroundColor=color;label.textContent=displayNameFor(dataRef.current.users.find(person=>person.id===user.id),dataRef.current,user.name);cursor.dataset.peerId=String(user.id||'');cursor.dataset.peerName=String(user.name||'');cursor.append(label);return cursor}})]:[])],
    ...(!collaborationState?{content:value??''}:{}),editable:!readOnly,immediatelyRender:false,shouldRerenderOnTransaction:true,
    onUpdate:({editor})=>{if(!collaborationState){const html=editor.getHTML();lastEmitted.current=html;formChangedRef.current?.();onChangeRef.current(html)}updatePicker(editor)},
    onSelectionUpdate:({editor})=>{if(pickerRef.current)updatePicker(editor)},
    onFocus:()=>{if(blurTimer.current)clearTimeout(blurTimer.current);setFocused(true)},
    onBlur:()=>{blurTimer.current=setTimeout(()=>{if(!root.current?.contains(document.activeElement)&&!toolbar.current?.contains(document.activeElement)&&!toolbarMenu.current?.contains(document.activeElement)){setFocused(false);setPicker(null)}},120)},
    editorProps:{attributes:{class:'rich-content','aria-label':ariaLabel||placeholder,role:'textbox','aria-multiline':'true'},handleKeyDown:(view,event)=>{
      if(handleSelectionConversionHistory(view.dom,event))return true;
      if(view.editable&&(event.metaKey||event.ctrlKey)&&event.shiftKey&&!event.altKey&&event.key.toLowerCase()==='u'){event.preventDefault();event.stopPropagation();upload.current?.click();return true}
      if((event.metaKey||event.ctrlKey)&&event.altKey&&event.key.toLowerCase()==='m'&&inlineCommentRef.current()){event.preventDefault();event.stopPropagation();return true}
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopPropagation();openLinkRef.current();return true}
      if(event.key==='Escape'&&pendingMediaRef.current){const id=pendingMediaRef.current;pendingMediaRef.current=null;let found=false;view.state.doc.descendants((node,pos)=>{if(node.type.name==='mediaEmbed'&&node.attrs.id===id){const text=view.state.schema.text(node.attrs.url,[view.state.schema.marks.link.create({href:node.attrs.url})]);view.dispatch(view.state.tr.replaceWith(pos,pos+node.nodeSize,view.state.schema.nodes.paragraph.create(null,text)));found=true;return false}});if(found){event.preventDefault();event.stopPropagation();return true}}
      if(!['Shift','Control','Alt','Meta'].includes(event.key))pendingMediaRef.current=null;
      const current=pickerRef.current;if(event.key==='Escape'&&!current&&blurOnEscapeRef.current){event.preventDefault();event.stopPropagation();view.dom.blur();return true}if(!current)return false;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPicker(null);return true}
      const count=suggestionsRef.current.length;if(!count)return false;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();setPicker({...current,index:(current.index+(event.key==='ArrowDown'?1:count-1))%count});return true}
      if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();event.stopPropagation();chooseRef.current(suggestionsRef.current[current.index%count]);return true}
      return false;
    }},
  },[collaborationState?.doc]);
  useEffect(()=>{if(picker?.kind!=='emoji'||fullEmoji||!editor)return;let cancelled=false;import('../features/emoji-data').then(module=>{if(cancelled)return;fullEmojiRef.current=module;setFullEmoji(module);setEmojiError('');if(!editor.isDestroyed)updatePicker(editor)}).catch(()=>{if(!cancelled)setEmojiError('More emoji could not load. Check your connection and try again.')});return()=>{cancelled=true}},[picker?.kind,fullEmoji,editor]);
  useEffect(()=>editor?registerSelectionEditor(editor):undefined,[editor]);
  const commentTarget=showInlineComments?collaborationState?.provider.target:undefined;
  const inlineComments=useInlineComments(editor,commentTarget&&(commentTarget.kind==='documents'||commentTarget.kind==='projects'||commentTarget.kind==='issues')?{kind:commentTarget.kind,id:commentTarget.id}:undefined);inlineCommentRef.current=inlineComments.begin;
  useEffect(()=>{if(collaborationState||!editor||value===editor.getHTML()||value===lastEmitted.current)return;const selection=editor.state.selection;editor.commands.setContent(value??'',{emitUpdate:false});lastEmitted.current=value;const size=editor.state.doc.content.size;editor.commands.setTextSelection({from:Math.min(selection.from,Math.max(1,size-1)),to:Math.min(selection.to,Math.max(1,size-1))});setPicker(null)},[value,editor,collaborationState]);
  // Changing editability does not change document content. Tiptap otherwise
  // emits an update here, marking untouched enclosing forms as unsaved.
  useEffect(()=>{editor?.setEditable(!readOnly,false)},[readOnly,editor]);
  useEffect(()=>{if(editor)editor.view.dom.spellcheck=preferences.spellcheck!==false},[editor,preferences.spellcheck]);
  useEffect(()=>()=>{if(blurTimer.current)clearTimeout(blurTimer.current)},[]);
  useEffect(()=>{if(!picker)return;root.current?.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView({block:'nearest'})},[picker?.index]);
  useEffect(()=>{if(!picker||!editor)return;const position=()=>{try{const rect=editor.view.coordsAtPos(Math.min(picker.from,editor.state.doc.content.size));const menuHeight=Math.min(300,suggestionsRef.current.length*32+36);const below=window.innerHeight-rect.bottom-12;setPickerPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-256)),top:below>=Math.min(160,menuHeight)?rect.bottom+5:Math.max(8,rect.top-menuHeight-5),maxHeight:below>=Math.min(160,menuHeight)?Math.min(300,below):Math.min(300,rect.top-13)})}catch{}};position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true)}},[picker?.from,picker?.query,editor]);
  useEffect(()=>{if(openLinkRequest>0&&editor&&!readOnly){editor.commands.focus();openLinkRef.current()}},[openLinkRequest,editor,readOnly]);
  useEffect(()=>{if(!preview&&!dateOpen&&!more&&!tableMenu)return;const close=(event:KeyboardEvent)=>{if(isCompositionKey(event))return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPreview(null);setDateOpen(false);setMore(false);setTableMenu(false);editor?.commands.focus()}};document.addEventListener('keydown',close,true);return()=>document.removeEventListener('keydown',close,true)},[preview,dateOpen,more,tableMenu,editor]);
  const contextualSelection=!!editor&&(!editor.state.selection.empty||editor.isActive('table')||editor.isActive('image'));
  const toolbarVisible=!readOnly&&((focused&&contextualSelection)||linkOpen||tableMenu||more||dateOpen||formatDropdownOpen);
  useLayoutEffect(()=>{
    if(!editor||!toolbarVisible)return;
    const measure=()=>{
      if(editor.isDestroyed||!toolbar.current)return;
      const bounds={left:8,right:window.innerWidth-8,top:8,bottom:window.innerHeight-8};
      for(let ancestor=editor.view.dom.parentElement;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){const style=getComputedStyle(ancestor),rect=ancestor.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowY)){bounds.top=Math.max(bounds.top,rect.top+4);bounds.bottom=Math.min(bounds.bottom,rect.bottom-4)}}
      try{
        const selection=editor.state.selection,from=editor.view.coordsAtPos(selection.from),to=editor.view.coordsAtPos(selection.to,-1);
        let anchor={left:Math.min(from.left,to.left),right:Math.max(from.right,to.right),top:Math.min(from.top,to.top),bottom:Math.max(from.bottom,to.bottom)};
        const domSelection=window.getSelection();
        if(!selection.empty&&domSelection?.rangeCount&&editor.view.dom.contains(domSelection.anchorNode)&&editor.view.dom.contains(domSelection.focusNode)){
          const visible=Array.from(domSelection.getRangeAt(0).getClientRects()).filter(rect=>rect.width>0&&rect.height>0&&rect.bottom>bounds.top&&rect.top<bounds.bottom);
          if(visible.length)anchor=visible[0];
        }
        const rect=toolbar.current.getBoundingClientRect(),width=rect.width,height=rect.height;
        const visible=anchor.bottom>bounds.top&&anchor.top<bounds.bottom&&bounds.bottom>bounds.top;
        const left=Math.max(bounds.left,Math.min((anchor.left+anchor.right-width)/2,bounds.right-width));
        const above=anchor.top-height-8,below=anchor.bottom+8;
        const top=Math.max(bounds.top,Math.min(above>=bounds.top?above:below,bounds.bottom-height));
        setToolbarPosition(previous=>previous.left===left&&previous.top===top&&previous.height===height&&previous.visible===visible?previous:{left,top,height,visible});
      }catch{setToolbarPosition(previous=>previous.visible?{...previous,visible:false}:previous)}
    };
    measure();
    editor.on('selectionUpdate',measure);editor.on('transaction',measure);
    window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
    const resize=new ResizeObserver(measure);if(toolbar.current)resize.observe(toolbar.current);resize.observe(editor.view.dom);
    return()=>{editor.off('selectionUpdate',measure);editor.off('transaction',measure);window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);resize.disconnect()};
  },[editor,toolbarVisible,contextualSelection]);
  if(!editor)return <div className="rich-editor-loading"/>;
  const mentionDate=picker?.kind==='mention'?naturalDate(picker.query):null;
  const customEmojiSuggestions:Suggestion[]=(data.workspaces.find(workspace=>workspace.id===data.workspaceId)?.customEmojis??[]).filter((item:CustomEmojiValue)=>!item.deletedAt&&customEmojiUrl(item.url)&&item.name.toLowerCase().includes(picker?.query.toLowerCase()??'')).slice(0,80).map((item:CustomEmojiValue)=>({label:`:${item.name}:`,description:'Custom',icon:'Smile',customEmoji:item}));
  const suggestions:Suggestion[]=picker?.kind==='emoji'?[...customEmojiSuggestions,...emojiSuggestions(picker.query,fullEmoji)]:picker?.kind==='mention'?[
    ...data.users.filter(u=>!u.deletedAt).map(u=>({label:displayNameFor(u,data),description:u.name||'Person',icon:'User',entity:{id:u.id,kind:'user',label:displayNameFor(u,data)}})),
    ...data.issues.filter(i=>!i.deletedAt&&!i.archivedAt).map(i=>({label:`${i.identifier||''} ${i.title}`.trim(),description:'Issue',icon:'Circle',entity:{id:i.id,kind:'issue',label:i.identifier||i.title}})),
    ...data.projects.filter(p=>!p.deletedAt&&!p.archivedAt).map(p=>({label:p.name,description:'Project',icon:'Box',entity:{id:p.id,kind:'project',label:p.name}})),
    ...data.documents.filter(d=>!d.deletedAt&&!d.archivedAt).map(d=>({label:d.title,description:'Document',icon:'FileText',entity:{id:d.id,kind:'document',label:d.title}})),
  ].filter(s=>(s.label+' '+(s.description||'')).toLowerCase().includes(picker.query.toLowerCase())).slice(0,20):blockCommands.filter(c=>[c.name,...(c.aliases??[])].some(label=>label.toLowerCase().includes(picker?.query.toLowerCase()??''))).map(command=>({label:command.name,description:command.shortcut,icon:command.icon,command}));
  if(mentionDate)suggestions.unshift({label:dateLabel(mentionDate),description:'Date',date:mentionDate,icon:'Calendar'});
  suggestionsRef.current=suggestions;
  const run=(command:BlockCommand)=>{
    const chain=editor.chain().focus();const current=pickerRef.current;
    if(current)chain.deleteRange({from:current.from,to:editor.state.selection.from});
    switch(command.key){
      case'paragraph':chain.setParagraph();break;
      case'heading':chain.toggleHeading({level:command.level as 1|2|3|4});break;
      case'table':chain.insertTable({rows:3,cols:3,withHeaderRow:true});break;
      case'horizontalRule':chain.setHorizontalRule();break;
      case'bulletList':chain.toggleBulletList();break;
      case'orderedList':chain.toggleOrderedList();break;
      case'taskList':chain.toggleTaskList();break;
      case'blockquote':chain.toggleBlockquote();break;
      case'codeBlock':chain.toggleCodeBlock();break;
      case'diagram':chain.insertContent([{type:'diagram',attrs:{code:''}},{type:'paragraph'}]);break;
      case'date':chain.run();positionOverlay(290,240);datePosition.current=null;setDateValue(isoDate(new Date()));setDateQuery('');setDateError('');setDateOpen(true);setPicker(null);setMore(false);return;
      case'details':chain.run();toggleEditorCollapse(editor);setPicker(null);setMore(false);return;
      case'attachment':chain.run();setPicker(null);upload.current?.click();return;
    }
    chain.run();setPicker(null);setMore(false);
  };
  const choose=(suggestion:Suggestion)=>{
    if(suggestion.command){run(suggestion.command);return}
    if(suggestion.customEmoji&&pickerRef.current){editor.chain().focus().deleteRange({from:pickerRef.current.from,to:editor.state.selection.from}).insertContent({type:'customEmoji',attrs:emojiNodeAttributes(suggestion.customEmoji)}).run();setPicker(null);return}
    if((suggestion.date||suggestion.emoji)&&pickerRef.current){editor.chain().focus().deleteRange({from:pickerRef.current.from,to:editor.state.selection.from}).insertContent(suggestion.emoji||[{type:'dateMention',attrs:{date:suggestion.date}},{type:'text',text:' '}]).run();setPicker(null);return}
    if(!suggestion.entity||!pickerRef.current)return;
    editor.chain().focus().deleteRange({from:pickerRef.current.from,to:editor.state.selection.from}).insertContent([{type:'mention',attrs:suggestion.entity},{type:'text',text:' '}]).run();setPicker(null);
  };
  chooseRef.current=choose;
  const applyDate=(value=dateValue)=>{if(!naturalDate(value)){setDateError('Choose a valid date.');return}const chain=editor.chain().focus();if(datePosition.current!==null)chain.setNodeSelection(datePosition.current).updateAttributes('dateMention',{date:value}).setTextSelection(datePosition.current+1);else chain.insertContent([{type:'dateMention',attrs:{date:value}},{type:'text',text:' '}]);chain.run();setDateOpen(false)};
  const pasteText=async(text:string)=>{
    const initialDoc=editor.state.doc,selection={from:editor.state.selection.from,to:editor.state.selection.to};
    const issue=data.issues.find(i=>!i.deletedAt&&i.identifier===text.trim());if(issue){editor.chain().focus().insertContent([{type:'mention',attrs:{id:issue.id,kind:'issue',label:issue.identifier}},{type:'text',text:' '}]).run();return}
    const fence=text.trim().match(/^```mermaid\s*\n([\s\S]*?)\n```$/i);if(fence){editor.chain().focus().insertContent([{type:'diagram',attrs:{code:fence[1]}},{type:'paragraph'}]).run();return}
    try{const {marked}=await import('marked');const html=await marked.parse(text,{gfm:true,breaks:false});const parsed=new DOMParser().parseFromString(html,'text/html');parsed.querySelectorAll('script,iframe,object,embed,style,link,meta').forEach(el=>el.remove());parsed.querySelectorAll('*').forEach(el=>{for(const attribute of Array.from(el.attributes))if(attribute.name.startsWith('on'))el.removeAttribute(attribute.name);if(el.hasAttribute('href')&&!safeLink(el.getAttribute('href')||''))el.removeAttribute('href')});parsed.querySelectorAll('pre>code.language-mermaid').forEach(code=>code.parentElement?.setAttribute('data-type','mermaid'));parsed.querySelectorAll('li>input[type="checkbox"]').forEach(input=>{const li=input.parentElement!;li.setAttribute('data-type','taskItem');li.setAttribute('data-checked',String(input.hasAttribute('checked')));li.parentElement?.setAttribute('data-type','taskList');input.remove()});const chain=editor.chain().focus();if(editor.state.doc===initialDoc)chain.setTextSelection(selection);chain.insertContent(parsed.body.innerHTML).run()}catch{editor.chain().focus().insertContent({type:'text',text}).run()}
  };
  const uploadFiles=async(files:File[])=>{
    if(!files.length)return;setUploading(true);setUploadError('');let failure='';onUploadStatusChange?.({pending:true,error:''});
    try{await pendingSaves.track(async()=>{for(const file of files){const body=new FormData();body.append('file',file);const context={...attachmentContext};if(collaborationState){const target=collaborationState.provider.target;context[({documents:'documentId',issues:'issueId',projects:'projectId',initiatives:'initiativeId',comments:'commentId'} as const)[target.kind]]=target.id}for(const [key,id] of Object.entries(context))if(id){const kind=({documentId:'documents',issueId:'issues',projectId:'projects',initiativeId:'initiatives',commentId:'comments'} as const)[key as keyof typeof context];if(kind){body.set('entityKind',kind);body.set('entityId',id)}}const attachment=uploadFile?await uploadFile(file):await(async()=>{const response=await fetch('/api/v1/attachments',{method:'POST',body,credentials:'include'});const result=await response.json();if(!response.ok)throw new Error(result.error?.message||'Upload failed');return result})();const selection=editor.state.selection;const block=selection.$from.parent.type.name==='codeBlock';const selectedNode='node' in selection&&(selection as any).node?.isBlock;const insertion=block?selection.$from.after():selection.to;const image=/^image\/(png|jpeg|gif|webp|avif)$/.test(file.type);const content=image?{type:'image',attrs:{src:attachment.url,alt:file.name}}:{type:'paragraph',content:[{type:'text',text:file.name,marks:[{type:'link',attrs:{href:attachment.url}}]},{type:'text',text:' '}]};if(block||selectedNode){editor.chain().focus().insertContentAt(insertion,[content,{type:'paragraph'}]).setTextSelection(insertion+(image?1:file.name.length+3)+1).run()}else if(image)editor.chain().focus().insertContent([content,{type:'paragraph'}]).run();else editor.chain().focus().insertContent((content as any).content).run()}})}
    catch(error){failure=error instanceof Error?error.message:'Upload failed';setUploadError(failure)}finally{setUploading(false);onUploadStatusChange?.({pending:false,error:failure})}
  };
  const positionOverlay=(width=330,height=240)=>{const rect=editor.view.coordsAtPos(editor.state.selection.from);setOverlayPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:Math.max(8,Math.min(rect.bottom+7,window.innerHeight-height-8))})};
  const openLink=()=>{positionOverlay();setLinkValue(editor.getAttributes('link').href||'');setLinkError('');setLinkOpen(true);setTableMenu(false);setMore(false)};openLinkRef.current=openLink;
  const applyLink=()=>{if(!linkValue.trim()){editor.chain().focus().extendMarkRange('link').unsetLink().run();setLinkOpen(false);return}const href=safeLink(linkValue.trim());if(!href){setLinkError('Enter a valid web, email, telephone, or internal URL.');return}if(editor.state.selection.empty&&!editor.isActive('link'))editor.chain().focus().insertContent({type:'text',text:href,marks:[{type:'link',attrs:{href}}]}).run();else editor.chain().focus().extendMarkRange('link').setLink({href}).run();setLinkOpen(false)};
  const openAttachment=(src:string,name:string,image=false)=>{const items:PreviewItem[]=[];const seen=new Set<string>();editor.state.doc.descendants(node=>{if(node.type.name==='image'&&!seen.has(node.attrs.src)){items.push({src:node.attrs.src,name:node.attrs.alt||'Image',image:true});seen.add(node.attrs.src)}for(const mark of node.marks){const href=mark.type.name==='link'?mark.attrs.href:null;if(isAttachmentUrl(href)&&!seen.has(href)){items.push({src:href,name:node.textContent||'Attachment'});seen.add(href)}}});if(!seen.has(src))items.push({src,name,image});setAttachmentPreview({items,index:items.findIndex(item=>item.src===src)});setPicker(null);setMore(false);setTableMenu(false)};
  const issueId=root.current?.closest<HTMLElement>('.issue-detail-view[data-issue-id]')?.dataset.issueId;const selectionIssue=issueId?data.issues.find(issue=>issue.id===issueId):null;
  const toolbarMenuPosition=(width:number,height:number)=>({left:Math.max(8,Math.min(toolbarPosition.left,window.innerWidth-width-8)),top:Math.max(8,Math.min(toolbarPosition.top+toolbarPosition.height+height+14<=window.innerHeight?toolbarPosition.top+toolbarPosition.height+6:toolbarPosition.top-height-6,window.innerHeight-height-8))});
  return <div ref={root} className={`rich-editor ${readOnly?'readonly':''}`}
    onPasteCapture={event=>{if(readOnly||(event.target as HTMLElement).matches('input,textarea'))return;const files=Array.from(event.clipboardData.files);if(files.length){event.preventDefault();event.stopPropagation();void uploadFiles(files);return}const text=event.clipboardData.getData('text/plain');const media=text&&mediaEmbed(text);if(media&&editor&&!editor.isActive('codeBlock')){event.preventDefault();event.stopPropagation();const id=crypto.randomUUID();editor.chain().focus().insertContent([{type:'mediaEmbed',attrs:{url:media.url,id}},{type:'paragraph'}]).run();pendingMediaRef.current=id;return}if(!event.clipboardData.getData('text/html')&&text&&(/(^|\n)\s{0,3}(#{1,6} |```|[-*+] |\d+\. |> )|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|(^|\n).+\|.+\n[-| :]+/.test(text)||data.issues.some(i=>!i.deletedAt&&i.identifier===text.trim()))){event.preventDefault();event.stopPropagation();void pasteText(text)}}}
    onDragOver={event=>{if(!readOnly&&event.dataTransfer.types.includes('Files'))event.preventDefault()}}
    onDrop={event=>{if(readOnly||!event.dataTransfer.files.length)return;event.preventDefault();const pos=editor.view.posAtCoords({left:event.clientX,top:event.clientY});if(pos)editor.commands.setTextSelection(pos.pos);void uploadFiles(Array.from(event.dataTransfer.files))}}
    onDoubleClick={event=>{const img=(event.target as HTMLElement).closest<HTMLImageElement>('img');if(img){event.preventDefault();openAttachment(img.getAttribute('src')||'',img.alt||'Image',true)}}}
    onClick={event=>{const target=event.target as HTMLElement;const comment=target.closest<HTMLElement>('[data-inline-comment-id]');if(comment){event.preventDefault();inlineComments.openThread(comment.dataset.inlineCommentId!);return}const img=target.closest<HTMLImageElement>('img');if(img&&readOnly){event.preventDefault();openAttachment(img.getAttribute('src')||'',img.alt||'Image',true);return}const file=target.closest<HTMLAnchorElement>('a[href]');if(file&&isAttachmentUrl(file.getAttribute('href'))&&!event.metaKey&&!event.ctrlKey){event.preventDefault();openAttachment(file.getAttribute('href')||'',file.textContent||'Attachment');return}const date=target.closest<HTMLElement>('[data-date]');if(date&&!readOnly){event.preventDefault();const rect=date.getBoundingClientRect();setOverlayPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-306)),top:Math.max(8,Math.min(rect.bottom+7,window.innerHeight-280))});datePosition.current=editor.view.posAtDOM(date,0);setDateValue(date.dataset.date!);setDateQuery('');setDateError('');setDateOpen(true);return}const mention=target.closest<HTMLElement>('[data-mention-id]');if(mention){event.preventDefault();const rect=mention.getBoundingClientRect();setOverlayPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-266)),top:Math.max(8,Math.min(rect.bottom+7,window.innerHeight-150))});setPreview({id:mention.dataset.mentionId!,kind:mention.dataset.mentionKind||'user',label:mention.dataset.mentionLabel||mention.textContent||''});return}const anchor=target.closest<HTMLAnchorElement>('a[href]');if(anchor&&(readOnly||event.metaKey||event.ctrlKey)){const href=anchor.getAttribute('href');if(href?.startsWith('/')&&!href.startsWith('//')){event.preventDefault();navigate(href)}}}}>
    {toolbarVisible&&createPortal(<div ref={toolbar} className={`editor-toolbar ${(issueFormatting||collaboration?.kind==='issues')&&!editor.isActive('image')?`issue-format-toolbar ${issueFormatting?'issue-format-composer':''}`:''}`} style={{left:toolbarPosition.left,top:toolbarPosition.top,visibility:toolbarPosition.visible?'visible':'hidden'}} role="toolbar" aria-label="Text formatting" onMouseDown={e=>e.preventDefault()}>
      {(issueFormatting||collaboration?.kind==='issues')&&!editor.isActive('image')?<IssueTextFormatControls composer={issueFormatting} editor={editor} onLink={openLink} onMenuOpen={setFormatDropdownOpen} actions={<>
      {selectionIssue&&!selectionIssue.sharedAccess&&!editor.state.selection.empty&&<button type="button" className="icon-button editor-selection-action" aria-label="Create sub-issues from selection" title="Create sub-issues from selection (⌘⇧O)" onMouseDown={event=>event.preventDefault()} onClick={()=>window.dispatchEvent(new CustomEvent('workspace-command',{detail:{command:'new-sub-issue'},cancelable:true}))}><IssueToolbarGlyph name="CreateIssue"/></button>}
      {inlineComments.enabled&&!editor.state.selection.empty&&<button type="button" className="icon-button" aria-label="Comment on selection" title="Comment on selection (⌘⌥M)" onClick={()=>inlineComments.begin()}><IssueToolbarGlyph name="Comment"/></button>}

      </>}/>:<>
      {selectionIssue&&!selectionIssue.sharedAccess&&!editor.state.selection.empty&&<button type="button" className="icon-button" aria-label="Create sub-issues from selection" title="Create sub-issues from selection (⌘⇧O)" onMouseDown={event=>event.preventDefault()} onClick={()=>window.dispatchEvent(new CustomEvent('workspace-command',{detail:{command:'new-sub-issue'},cancelable:true}))}><Icon name="GitBranch" size={15}/></button>}
      {inlineComments.enabled&&!editor.state.selection.empty&&<button type="button" className="icon-button" aria-label="Comment on selection" title="Comment on selection (⌘⌥M)" onClick={()=>inlineComments.begin()}><Icon name="MessageSquare" size={15}/></button>}
      {editor.isActive('image')&&<div className="editor-image-controls"><button type="button" className="button ghost" aria-label="Preview image" onClick={()=>{const attrs=editor.getAttributes('image');openAttachment(attrs.src,attrs.alt||'Image',true)}}>Preview</button><input type="number" min="32" max="4096" aria-label="Image width" key={editor.getAttributes('image').width||'auto'} defaultValue={editor.getAttributes('image').width||''} placeholder="Auto" onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(isCompositionKey(e.nativeEvent))return;if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}} onBlur={e=>{const width=Number(e.target.value);if(width>=32&&width<=4096){const dom=editor.view.nodeDOM(editor.state.selection.from) as HTMLElement;const img=dom?.matches('img')?dom as HTMLImageElement:dom?.querySelector('img');const attrs=editor.getAttributes('image');const ratio=img?.naturalWidth&&img.naturalHeight?img.naturalHeight/img.naturalWidth:attrs.width&&attrs.height?attrs.height/attrs.width:1;editor.chain().focus().updateAttributes('image',{width,height:Math.round(width*ratio)}).run()}}}/><button type="button" className="button ghost" aria-label="Reset image size" onClick={()=>editor.chain().focus().updateAttributes('image',{width:null,height:null}).run()}>Reset size</button></div>}
      {([['Bold','bold','Bold'],['Italic','italic','Italic'],['Type','underline','Underline'],['Strikethrough','strike','Strikethrough'],['Code2','code','Inline code']] as const).map(([icon,key,label])=><button type="button" key={key} className={`icon-button ${editor.isActive(key)?'active':''}`} aria-label={label} aria-pressed={editor.isActive(key)} data-tooltip-label={label} onClick={()=>{const chain=editor.chain().focus();({bold:()=>chain.toggleBold(),italic:()=>chain.toggleItalic(),underline:()=>chain.toggleUnderline(),strike:()=>chain.toggleStrike(),code:()=>chain.toggleCode()})[key]().run()}}><Icon name={icon} size={15}/></button>)}
      {templateMode&&<button type="button" className={`icon-button ${editor.isActive('templatePlaceholder')?'active':''}`} aria-label="Placeholder text" aria-pressed={editor.isActive('templatePlaceholder')} title="Placeholder text" onClick={()=>editor.chain().focus().toggleMark('templatePlaceholder').run()}>Aa</button>}
      <button type="button" className={`icon-button ${editor.isActive('link')?'active':''}`} aria-label="Edit link" title="Edit link" onClick={openLink}><Icon name="Link" size={15}/></button>
      <button type="button" className="icon-button" aria-label="Attach file" title="Attach file" disabled={uploading} onClick={()=>upload.current?.click()}><Icon name="Paperclip" size={15}/></button>
      <button type="button" className={`icon-button ${editor.isActive('table')?'active':''}`} aria-label={editor.isActive('table')?'Table actions':'Insert table'} title="Table" onClick={()=>{if(editor.isActive('table')){setTableMenu(!tableMenu);setMore(false);setLinkOpen(false)}else editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()}}><Icon name="Table2" size={15}/></button>
      <button type="button" className={`icon-button ${more?'active':''}`} aria-label="More formatting" aria-expanded={more} onClick={()=>{setMore(!more);setTableMenu(false);setLinkOpen(false)}}><Icon name="MoreHorizontal" size={15}/></button>
      </>}
    </div>,root.current?.closest('form,dialog[open]')||document.body)}
    <EditorContent editor={editor}/>
    {showAuthors&&collaborationState&&<EditorAuthorship editor={editor} state={collaborationState}/>}
    {collaboration?.kind==='documents'&&<EditorHeadingLinks editor={editor} documentId={collaboration.id}/>}
    {picker&&<div className="menu slash-menu" style={{position:'fixed',...pickerPosition}} role="listbox" aria-label={picker.kind==='mention'?'Mention suggestions':picker.kind==='emoji'?'Emoji suggestions':'Insert block'} onMouseDown={e=>e.preventDefault()}>
      <div className="menu-label">{picker.kind==='mention'?'Mention':picker.kind==='emoji'?'Emoji':'Insert'}</div>{picker.kind==='emoji'&&emojiError&&<div className="menu-empty" role="status">{emojiError}</div>}
      {suggestions.length?suggestions.map((suggestion,index)=><button type="button" key={suggestion.entity?`${suggestion.entity.kind}:${suggestion.entity.id}`:suggestion.label} role="option" aria-selected={index===picker.index%suggestions.length} className={`menu-item ${index===picker.index%suggestions.length?'selected':''}`} onClick={()=>choose(suggestion)}><>{suggestion.customEmoji?<img src={suggestion.customEmoji.url} alt="" style={{width:18,height:18,objectFit:'contain'}}/>:<Icon name={suggestion.icon}/>}</><span>{suggestion.label}</span>{suggestion.description&&<small style={{marginLeft:'auto',fontSize:"0.625rem",color:'var(--muted)'}}>{suggestion.description}</small>}</button>):<div className="menu-label">No matches</div>}
    </div>}
    {dateOpen&&<div className="menu editor-date-picker" role="dialog" aria-label="Insert date" style={{position:'fixed',...overlayPosition,zIndex:60,width:290,padding:12}} onKeyDown={e=>{e.stopPropagation();if(isCompositionKey(e.nativeEvent))return;if(e.key==='Enter'){e.preventDefault();const parsed=dateQuery?naturalDate(dateQuery):dateValue;if(parsed)applyDate(parsed);else setDateError('Enter a date such as Oct 1, today, or 2027-10-01.')}}}><label className="field"><span>Date</span><input autoFocus className="input" aria-label="Date text" placeholder="Oct 1, tomorrow…" value={dateQuery} onChange={e=>{setDateQuery(e.target.value);setDateError('');const parsed=naturalDate(e.target.value);if(parsed)setDateValue(parsed)}}/></label><input type="date" className="input" aria-label="Choose date" value={dateValue} style={{marginTop:8}} onChange={e=>{setDateValue(e.target.value);setDateQuery('')}}/><div style={{display:'flex',gap:6,marginTop:10}}>{['Today','Tomorrow','Next week'].map(label=><button type="button" className="button ghost" key={label} onClick={()=>applyDate(naturalDate(label)!)}>{label}</button>)}</div>{dateError&&<p className="error-text" role="alert">{dateError}</p>}<div style={{display:'flex',gap:6,justifyContent:'flex-end',marginTop:10}}><button type="button" className="button" onClick={()=>{setDateOpen(false);editor.commands.focus()}}>Cancel</button><button type="button" className="button primary" onClick={()=>{if(dateQuery){const parsed=naturalDate(dateQuery);if(parsed)applyDate(parsed);else setDateError('Enter a valid date.')}else applyDate()}}>Insert date</button></div></div>}
    {linkOpen&&<div className="menu" role="dialog" aria-label="Edit link" style={{position:'fixed',...overlayPosition,zIndex:60,width:330,padding:12}} onKeyDown={e=>{e.stopPropagation();if(isCompositionKey(e.nativeEvent))return;if(e.key==='Enter'){e.preventDefault();applyLink()}if(e.key==='Escape'){setLinkOpen(false);editor.commands.focus()}}}>
      <label className="field"><span>Link URL</span><input autoFocus className="input" aria-label="Link URL" value={linkValue} placeholder="https://…" onChange={e=>setLinkValue(e.target.value)}/></label>
      {linkError&&<p className="error-text">{linkError}</p>}
      <div style={{display:'flex',gap:7,justifyContent:'flex-end',marginTop:10}}><button type="button" className="button" onClick={()=>{setLinkOpen(false);editor.commands.focus()}}>Cancel</button>{editor.isActive('link')&&<button type="button" className="button" onClick={()=>{editor.chain().focus().extendMarkRange('link').unsetLink().run();setLinkOpen(false)}}>Remove link</button>}<button type="button" className="button primary" onClick={applyLink}>Apply</button></div>
    </div>}
    {more&&createPortal(<div ref={toolbarMenu} className="menu" role="menu" aria-label="Formatting options" style={{position:'fixed',...toolbarMenuPosition(240,330),zIndex:1001,width:240,maxWidth:'calc(100vw - 16px)',maxHeight:'min(330px, calc(100vh - 16px))',overflowY:'auto',overflowX:'hidden'}} onMouseDown={e=>e.preventDefault()}>{blockCommands.filter(c=>c.key!=='attachment'&&c.key!=='table').map(c=><button type="button" key={c.name} className="menu-item" role="menuitem" onClick={()=>run(c)}><Icon name={c.icon}/>{c.name}</button>)}<div className="menu-separator"/>{(['left','center','right'] as const).map(align=><button type="button" className="menu-item" role="menuitem" key={align} onClick={()=>{editor.chain().focus().setTextAlign(align).run();setMore(false)}}><Icon name="AlignLeft"/>Align {align}</button>)}<button type="button" className="menu-item" role="menuitem" onClick={()=>{editor.chain().focus().clearNodes().unsetAllMarks().run();setMore(false)}}><Icon name="X"/>Clear formatting</button></div>,root.current?.closest('form,dialog[open]')||document.body)}
    {tableMenu&&createPortal(<div ref={toolbarMenu} className="menu" role="menu" aria-label="Table actions" style={{position:'fixed',...toolbarMenuPosition(220,330),zIndex:1001,width:220,maxWidth:'calc(100vw - 16px)',maxHeight:'min(330px, calc(100vh - 16px))',overflowY:'auto',overflowX:'hidden'}} onMouseDown={e=>e.preventDefault()}>{([
      ['Add row above',()=>editor.chain().focus().addRowBefore().run()],['Add row below',()=>editor.chain().focus().addRowAfter().run()],['Add column left',()=>editor.chain().focus().addColumnBefore().run()],['Add column right',()=>editor.chain().focus().addColumnAfter().run()],['Toggle header row',()=>editor.chain().focus().toggleHeaderRow().run()],['Merge selected cells',()=>editor.chain().focus().mergeCells().run()],['Split cell',()=>editor.chain().focus().splitCell().run()],['Delete row',()=>editor.chain().focus().deleteRow().run()],['Delete column',()=>editor.chain().focus().deleteColumn().run()],['Delete table',()=>editor.chain().focus().deleteTable().run()],
    ] as const).map(([label,action])=><button type="button" className={`menu-item ${label==='Delete table'?'danger':''}`} role="menuitem" key={label} onClick={()=>{action();setTableMenu(false)}}>{label}</button>)}</div>,root.current?.closest('form,dialog[open]')||document.body)}
    {preview&&<div className="menu" role="dialog" aria-label="Mention details" style={{position:'fixed',...overlayPosition,zIndex:60,width:250,padding:14}}><div style={{display:'flex',alignItems:'center',gap:8}}><Icon name={preview.kind==='user'?'User':preview.kind==='project'?'Box':preview.kind==='document'?'FileText':'Circle'}/><strong>{preview.label}</strong><button type="button" style={{marginLeft:'auto'}} className="icon-button" aria-label="Close mention" onClick={()=>setPreview(null)}><Icon name="X" size={14}/></button></div>{preview.kind==='user'?<p className="muted" style={{marginTop:10,fontSize:"0.75rem"}}>{data.users.find(u=>u.id===preview.id)?.email||'Workspace member'}</p>:<button type="button" className="button" style={{marginTop:12}} onClick={()=>navigate(`/${preview.kind==='issue'?'issues':preview.kind}/${preview.id}`)}>Open {preview.kind}<Icon name="ArrowUpRight" size={13}/></button>}</div>}
    {inlineComments.panel}
    {attachmentPreview&&<AttachmentPreview {...attachmentPreview} onIndex={index=>setAttachmentPreview({...attachmentPreview,index})} onClose={()=>{setAttachmentPreview(null);editor.commands.focus()}}/>}
    <input ref={upload} type="file" multiple hidden onChange={async e=>{await uploadFiles(Array.from(e.target.files||[]));e.target.value=''}}/>
    {uploading&&<p className="muted" role="status" style={{fontSize:"0.6875rem",marginTop:8}}>Uploading attachment…</p>}{uploadError&&<div><p className="error-text" role="alert">{uploadError}</p>{onUploadStatusChange&&<button type="button" className="button" onClick={()=>{setUploadError('');onUploadStatusChange({pending:false,error:''})}}>Dismiss upload error</button>}</div>}
  </div>;
}

function emojiSuggestions(query:string,module:typeof import('../features/emoji-data')|null):Suggestion[]{
 const normalized=query.trim().toLowerCase(),result:Suggestion[]=[],seen=new Set<string>();
 const append=(name:string,emoji:string)=>{if(seen.has(emoji))return;seen.add(emoji);result.push({label:emoji+' :'+name+':',emoji,icon:'Smile'})};
 for(const [name,emoji] of emojiEntries)if(name.includes(normalized))append(name,emoji);
 if(module){const aliases=new Map<string,string[]>();for(const [alias,id] of Object.entries(module.emojiCatalog.aliases)){const values=aliases.get(id)||[];values.push(alias);aliases.set(id,values)}
 for(const item of Object.values(module.emojiCatalog.emojis)){if(!(item.id+' '+item.name+' '+item.keywords.join(' ')+' '+(aliases.get(item.id)||[]).join(' ')).toLowerCase().includes(normalized))continue;const native=item.skins[0]?.native;if(native)append(item.id,native);if(result.length>=20)break}}
 return result.slice(0,20);
}
