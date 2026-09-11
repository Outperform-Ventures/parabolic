import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {Icon} from '../components/ui';
import {useAppStore} from '../store';
import {documentParents,type DocumentParent} from '../../shared/document-parent';
import {DocumentForm} from './document-form';

export function EntityDocuments({parent,allowCreate=true,hideEmpty=false}:{parent:DocumentParent;allowCreate?:boolean;hideEmpty?:boolean}){
 const {data}=useAppStore(),[adding,setAdding]=useState(false),field=documentParents[parent.kind].field;
 const documents=data.documents.filter(doc=>!doc.deletedAt&&!doc.archivedAt&&doc[field]===parent.id);
 if((!allowCreate||hideEmpty)&&!documents.length)return null;
 return <section className="feature-section entity-documents" aria-label="Documents"><div className="feature-between"><h3>Documents</h3>{allowCreate&&<button type="button" className="text-button" onClick={()=>setAdding(true)}><Icon name="Plus" size={14}/>Add document</button>}</div>{documents.map(doc=><Link key={doc.id} className="feature-linked-row" to={'/document/'+doc.id}><Icon name="FileText" size={14}/>{doc.title||'Untitled'}</Link>)}{adding&&<DocumentForm initialParent={parent} onClose={()=>setAdding(false)}/>}</section>;
}
