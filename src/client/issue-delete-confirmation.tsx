import React,{useRef,useState} from 'react';
import type {Entity} from '../shared/types';
import {issueName} from './issues';
import {Button,Modal} from './components/ui';
import './issue-delete-confirmation.css';
export function IssueDeleteConfirmation({issues,onConfirm,onClose}:{issues:Entity[];onConfirm:()=>Promise<unknown>;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),pending=useRef(false);
 const title=issues.length===1?`Delete "${issueName(issues[0])} ‒ ${issues[0].title}"?`:`Delete ${issues.length} issues?`;
 const confirm=async()=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await onConfirm();onClose();}catch(error){setError(error instanceof Error?error.message:'Unable to delete issue');pending.current=false;setBusy(false);}};
 return <Modal ariaLabel={title} className="issue-delete-confirmation" onClose={onClose}><div className="issue-delete-content"><h2>{title}</h2><p>Deleted issues are available in the "Recently deleted" view for 30 days, before they are permanently deleted.</p>{error&&<p role="alert" className="error-text">{error}</p>}<div className="issue-delete-buttons"><Button onClick={onClose} disabled={busy}>Cancel</Button><Button autoFocus variant="danger" disabled={busy} onClick={()=>void confirm()}>{busy?'Deleting…':'Delete'}</Button></div></div></Modal>;
}
