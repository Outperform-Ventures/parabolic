import React,{useState} from 'react';
import {documentParents,documentMovePatch,type DocumentParentKind} from '../../shared/document-parent';
import {FormDialog,live,useActions,type Row} from './shared';

export function DocumentMove({document,onClose}:{document:Row;onClose:()=>void}){
 const {data,update}=useActions(),initial=(Object.keys(documentParents) as DocumentParentKind[]).find(kind=>document[documentParents[kind].field]);
 const [kind,setKind]=useState<DocumentParentKind>(initial||'projects'),[id,setId]=useState(initial?document[documentParents[initial].field]:'');
 const info=documentParents[kind],items=live(data[kind]);
 return <FormDialog title="Move document" fields={[]} submit="Move document" onClose={onClose} onSave={async()=>{
  if(id&&!items.some(item=>item.id===id))throw Error('This destination is no longer available.');
  const patch=documentMovePatch(id?{kind,id}:undefined);if(Object.entries(patch).every(([key,value])=>(document[key]||null)===value))return true;
  return update('documents',document.id,patch);
 }}><label className="feature-field"><span>Move to</span><select className="input" aria-label="Move to" value={kind} onChange={event=>{setKind(event.target.value as DocumentParentKind);setId('')}}>{Object.entries(documentParents).map(([kind,parent])=><option key={kind} value={kind}>{parent.label}</option>)}</select></label><label className="feature-field"><span>{info.label}</span><select className="input" aria-label={info.label} value={id} onChange={event=>setId(event.target.value)}><option value="">None — standalone document</option>{items.map(item=><option key={item.id} value={item.id}>{item.title||item.name}</option>)}</select></label><p className="muted">Content, comments and history stay with this document.</p></FormDialog>;
}
