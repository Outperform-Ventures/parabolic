import {guestCapabilities} from '../../shared/guest-capabilities';
import {documentParents,type DocumentParent,type DocumentParentKind} from '../../shared/document-parent';
import React,{useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FormDialog,live,useActions,type Row} from './shared';

export function documentTemplates(data:{projects:Row[];templates:Row[];issues?:Row[];cycles?:Row[];teams?:Row[];initiatives?:Row[]},projectId?:string,parent?:DocumentParent) {
  const target=parent?live(data[parent.kind]).find(item=>item.id===parent.id):live(data.projects).find(project=>project.id===projectId),teamIds=new Set([...(target?.teamIds||[]),target?.teamId,target?.leadTeamId,...(parent?.kind==='teams'?[parent.id]:[])].filter(Boolean));
  return live(data.templates).filter(template=>template.type==='document'&&(!(projectId||parent)||!template.teamId||teamIds.has(template.teamId)));
}

export function DocumentForm({initialProjectId='',initialParent,onClose}:{initialProjectId?:string;initialParent?:DocumentParent;onClose:()=>void}) {
  const {data,user,create}=useActions(),navigate=useNavigate(),access=guestCapabilities(data,user?.id),fallback=access.guest?{kind:"teams" as const,id:access.teamIds[0]}:undefined;
  const [title,setTitle]=useState(''),[parentKind,setParentKind]=useState<DocumentParentKind>(initialParent?.kind||fallback?.kind||'projects'),[parentId,setParentId]=useState(initialParent?.id||initialProjectId||fallback?.id||''),[templateId,setTemplateId]=useState(''),[visibility,setVisibility]=useState('workspace');
  const parent=parentId?{kind:parentKind,id:parentId}:undefined,parents=live(data[parentKind]).filter(item=>!access.guest||(parentKind==='teams'?access.canTeam(item.id):access.canEntity(item))),templates=documentTemplates(data,undefined,parent),parentInfo=documentParents[parentKind];
  const chooseParent=(id:string)=>{
    setParentId(id);
    if(templateId&&!documentTemplates(data,undefined,id?{kind:parentKind,id}:undefined).some(template=>template.id===templateId))setTemplateId('');
  };
  return <FormDialog title="New document" fields={[]} onClose={onClose} onSave={async()=>{
    if(access.guest&&!parentId)throw Error('Choose a team or project you have joined.');
    const name=title.trim();if(!name)throw Error('Enter a document title.');
    if(parentId&&!parents.some(item=>item.id===parentId))throw Error('This '+parentInfo.label.toLowerCase()+' is no longer available.');
    const template=templates.find(template=>template.id===templateId);
    if(templateId&&!template)throw Error('This template is no longer available for this document.');
    const document=await create('documents',{title:name,[parentInfo.field]:parentId||null,visibility,content:template?.content??template?.description??'',...(template?{templateId:template.id}:{}),userId:data.user?.id,history:[]});
    navigate('/document/'+document.id);return document;
  }}>
    <label className="feature-field"><span>Title *</span><input autoFocus required className="input" aria-label="Title" value={title} onChange={event=>setTitle(event.target.value)}/></label>
    <label className="feature-field"><span>Template</span><select className="input" aria-label="Template" value={templateId} onChange={event=>setTemplateId(event.target.value)}><option value="">No template</option>{templates.map(template=><option key={template.id} value={template.id}>{template.name||template.title}</option>)}</select></label>
    <label className="feature-field"><span>Attach to</span><select className="input" aria-label="Attach to" value={parentKind} onChange={event=>{setParentKind(event.target.value as DocumentParentKind);setParentId('');setTemplateId('')}}>{Object.entries(documentParents).filter(([kind])=>!access.guest||kind!=='initiatives').map(([kind,info])=><option value={kind} key={kind}>{info.label}</option>)}</select></label>
    <label className="feature-field"><span>{parentInfo.label}</span><select className="input" aria-label={parentInfo.label} value={parentId} onChange={event=>chooseParent(event.target.value)}>{!access.guest&&<option value="">None</option>}{parents.map(item=><option key={item.id} value={item.id}>{item.title||item.name}</option>)}</select></label>
    <label className="feature-field"><span>Sharing</span><select className="input" aria-label="Sharing" value={visibility} onChange={event=>setVisibility(event.target.value)}><option value="workspace">Workspace</option><option value="private">Only me</option></select></label>
  </FormDialog>;
}
