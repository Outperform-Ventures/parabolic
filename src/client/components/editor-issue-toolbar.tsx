import type {ReactNode} from 'react';
import type {Editor} from '@tiptap/react';
import {Dropdown} from './ui';
import {IssueToolbarGlyph} from './editor-toolbar-glyphs';
import {toggleEditorCollapse} from './editor-collapse';

/** Controls observed on the native issue-description selection toolbar. */
export function IssueTextFormatControls({editor,onLink,onMenuOpen,actions,composer=false}:{composer?:boolean;editor:Editor;onLink:()=>void;onMenuOpen:(open:boolean)=>void;actions:ReactNode}){
 const level=[1,2,3,4].find(level=>editor.isActive('heading',{level}));
 const marks=[['Bold','bold','Bold'],['Italic','italic','Italic'],['Strikethrough','strike','Strikethrough'],['Underline','underline','Underline']] as const;
 const list=editor.isActive('taskList')?'taskList':editor.isActive('orderedList')?'orderedList':editor.isActive('bulletList')?'bulletList':null;
 return <>
  <Dropdown menuClassName={`issue-text-style-menu ${composer?'composer-format-menu':''}`} alignOffset={-6} sideOffset={8} snapToPixels onOpenChange={onMenuOpen} trigger={<button type="button" className="icon-button editor-text-style" disabled={!!list} aria-label={level?`Heading ${level}`:'Regular text'}><IssueToolbarGlyph name={level?`Heading${level as 1|2|3|4}`:'Text'}/><IssueToolbarGlyph name="ChevronDown" size={12}/></button>}>
   {[0,1,2,3,4].map(n=><button key={n} type="button" className="menu-item" role="menuitemradio" aria-checked={n===0?!level:level===n} onClick={()=>{const chain=editor.chain().focus();if(n===0)chain.setParagraph().run();else chain.setHeading({level:n as 1|2|3|4}).run();}}><span className="editor-style-label"><span data-heading-level={n}>{n?`Heading ${n}`:'Regular text'}</span></span><span className="editor-style-accessory"><span className="editor-style-check" aria-hidden="true">{(n===0?!level:level===n)&&<IssueToolbarGlyph name="Check" size={12}/>}</span><span className="editor-style-keys" aria-label={`Command Option ${n}`}><kbd aria-hidden="true">⌘</kbd><kbd aria-hidden="true">⌥</kbd><kbd aria-hidden="true">{n}</kbd></span></span></button>)}
  </Dropdown>
  {marks.map(([label,key,icon])=><button key={key} type="button" disabled={key==='bold'&&!!level} className={`icon-button ${editor.isActive(key)?'active':''}`} aria-label={label} aria-pressed={editor.isActive(key)} title={label} onClick={()=>{const chain=editor.chain().focus();({bold:()=>chain.toggleBold(),italic:()=>chain.toggleItalic(),strike:()=>chain.toggleStrike(),underline:()=>chain.toggleUnderline()})[key]().run();}}><IssueToolbarGlyph name={icon}/></button>)}
  <button type="button" className={`icon-button ${editor.isActive('link')?'active':''}`} aria-label="Edit link" title="Link" aria-pressed={editor.isActive('link')} onClick={onLink}><IssueToolbarGlyph name="Link"/></button>
  <button type="button" className={`icon-button ${editor.isActive('blockquote')?'active':''}`} aria-label="Quote" title="Quote" aria-pressed={editor.isActive('blockquote')} onClick={()=>editor.chain().focus().toggleBlockquote().run()}><IssueToolbarGlyph name="Quote"/></button>
  <button type="button" className={`icon-button ${editor.isActive('details')?'active':''}`} aria-label="Collapse" title="Collapse" aria-pressed={editor.isActive('details')} onClick={()=>toggleEditorCollapse(editor)}><IssueToolbarGlyph name="Collapse"/></button>
  <button type="button" className={`icon-button ${editor.isActive('code')?'active':''}`} aria-label="Inline code" title="Inline code" aria-pressed={editor.isActive('code')} onClick={()=>editor.chain().focus().toggleCode().run()}><IssueToolbarGlyph name="InlineCode"/></button>
  <button type="button" className={`icon-button ${editor.isActive('codeBlock')?'active':''}`} aria-label="Code block" title="Code block" aria-pressed={editor.isActive('codeBlock')} onClick={()=>editor.chain().focus().toggleCodeBlock().run()}><IssueToolbarGlyph name="CodeBlock"/></button>
  <Dropdown menuClassName={`issue-list-style-menu ${composer?'composer-format-menu':''}`} alignOffset={-6} sideOffset={8} snapToPixels onOpenChange={onMenuOpen} trigger={<button type="button" className={`icon-button editor-list-style ${list?'active':''}`} disabled={!!level} aria-label={list==='taskList'?'Checklist':list==='orderedList'?'Numbered list':'List'} title={list==='taskList'?'Checklist':list==='orderedList'?'Numbered list':'List'}><IssueToolbarGlyph name={list==='taskList'?'Checklist':list==='orderedList'?'NumberedList':'List'}/><IssueToolbarGlyph name="ChevronDown" size={12}/></button>}>
   {([['List','bulletList'],['Numbered list','orderedList'],['Checklist','taskList']] as const).map(([label,key])=><button key={key} type="button" className="menu-item" role="menuitemradio" aria-checked={list===key} onClick={()=>{const chain=editor.chain().focus();({bulletList:()=>chain.toggleBulletList(),orderedList:()=>chain.toggleOrderedList(),taskList:()=>chain.toggleTaskList()})[key]().run();}}><IssueToolbarGlyph name={key==='taskList'?'Checklist':key==='orderedList'?'NumberedList':'List'}/><span>{label}</span><span className="editor-list-check" aria-hidden="true">{list===key&&<IssueToolbarGlyph name="Check" size={12}/>}</span></button>)}
  </Dropdown>
  {actions}
 </>;
}
