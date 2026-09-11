import React,{useRef,useState}from'react';
import type{Entity}from'../shared/types';
import{Button,Icon,Modal}from'./components/ui';
import './issue-link-dialog.css';
export function IssueLinkDialog({issues,onClose,onSave}:{issues:Entity[];onClose:()=>void;onSave:(link:{url:string;title:string})=>Promise<unknown>}){
 const[url,setUrl]=useState(''),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),pending=useRef(false);
 const heading=issues.length===1?`Add link to ${issues[0].identifier??issues[0].id}`:`Add link to ${issues.length} issues`;
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(pending.current)return;setError('');let parsed:URL;try{parsed=new URL(url.trim());}catch{setError('Enter a valid URL');return;}if(!['http:','https:'].includes(parsed.protocol)){setError('Use an HTTP or HTTPS URL');return;}pending.current=true;setBusy(true);try{await onSave({url:parsed.href,title:title.trim()||parsed.hostname});onClose();}catch(e){setError((e as Error).message);pending.current=false;setBusy(false);}};
 return <Modal ariaLabel={heading} className="issue-link-dialog" onClose={onClose}><form onSubmit={submit} noValidate><h2><Icon name="IssueActionAddlink" size={16}/>{heading}</h2><label><span>URL</span><input autoFocus aria-label="URL" placeholder="https://…" value={url} onChange={e=>setUrl(e.target.value)} disabled={busy}/></label><label><span>Title <small>(optional)</small></span><input aria-label="Title (optional)" value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/></label>{error&&<p role="alert" className="error-text">{error}</p>}<div className="issue-link-buttons"><Button disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy?'Adding…':'Add link'}</Button></div></form></Modal>;
}
