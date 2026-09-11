import React,{useEffect,useRef,useState} from 'react';
import {apiRequest,useAppStore} from '../store';
type Requester={id:string;email:string;name:string;enabled:boolean;registered:boolean;invited:boolean};
export function AsksRequesters(){
 const {data}=useAppStore();
 return <RequesterManagement key={data.workspaceId} workspaceId={data.workspaceId}/>;
}
function RequesterManagement({workspaceId}:{workspaceId:string}){
 const [rows,setRows]=useState<Requester[]>([]),[email,setEmail]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[authorized,setAuthorized]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[invitation,setInvitation]=useState<{url:string;email:string}|null>(null),[copied,setCopied]=useState(false);
 const mounted=useRef(true);
 const refresh=async()=>{const result=await apiRequest('/api/v1/asks-requesters');if(mounted.current){setRows(result.nodes);setAuthorized(true)}};
 useEffect(()=>{mounted.current=true;void refresh().catch(reason=>{if(mounted.current)setError(reason.message)}).finally(()=>{if(mounted.current)setLoading(false)});return()=>{mounted.current=false}},[]);
 const invite=async(details:{email:string;name?:string})=>{if(busy)return;setBusy(true);setError('');setInvitation(null);setCopied(false);try{const row=await apiRequest('/api/v1/asks-requesters',{method:'POST',body:JSON.stringify(details)});if(!mounted.current)return;setInvitation({email:row.email,url:window.location.origin+'/ask-access/'+encodeURIComponent(workspaceId)+'/account#invite='+encodeURIComponent(row.token)});setEmail('');setName('');await refresh()}catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Invitation failed')}finally{if(mounted.current)setBusy(false)}};
 const revoke=async(row:Requester)=>{if(busy)return;setBusy(true);setError('');try{await apiRequest('/api/v1/asks-requesters/'+encodeURIComponent(row.id),{method:'DELETE'});if(mounted.current){if(invitation?.email===row.email)setInvitation(null);await refresh()}}catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Revocation failed')}finally{if(mounted.current)setBusy(false)}};
 return <section className="feature-setting-section asks-requesters-section" aria-label="Requester access"><div className="asks-section-heading"><div><h2>Requester access</h2><p>Invite people to access Asks without workspace membership.</p></div></div><div className="feature-settings-card asks-requesters-card">
  {loading?<p className="asks-inline-status" role="status">Loading requesters…</p>:authorized?<><form className="asks-invite-form" onSubmit={event=>{event.preventDefault();void invite({email,...(name.trim()?{name:name.trim()}:{})})}}>
   <input className="input" aria-label="Requester name" placeholder="Name" maxLength={200} value={name} onChange={event=>setName(event.target.value)}/><input className="input" aria-label="Requester email" placeholder="Email" type="email" required value={email} onChange={event=>setEmail(event.target.value)}/><button className="button" disabled={busy}>Create invitation</button>
  </form>
  {invitation&&<div className="asks-invitation" role="region" aria-label="Requester invitation"><p>Invitation for {invitation.email}. This link expires in seven days and can be used once.</p><input className="input" aria-label="Invitation link" readOnly value={invitation.url} onFocus={event=>event.target.select()}/><div><button className="button" onClick={()=>{void navigator.clipboard.writeText(invitation.url).then(()=>setCopied(true)).catch(()=>setError('Select and copy the invitation link. Clipboard access is unavailable.'))}}>{copied?'Copied':'Copy invitation link'}</button><button className="button" onClick={()=>setInvitation(null)}>Dismiss invitation</button></div></div>}
  {rows.map(row=><div className="feature-settings-row asks-requester-row" key={row.id}><div><strong>{row.name}</strong><p>{row.email} · {!row.enabled?'Revoked':row.invited?'Invitation pending':row.registered?'Active':'Not registered'}</p></div><div className="asks-row-actions"><button className="button" disabled={busy} onClick={()=>void invite({email:row.email})}>{row.enabled?'Reissue invitation':'Invite again'}</button>{row.enabled&&<button className="button" disabled={busy} onClick={()=>void revoke(row)}>Revoke access</button>}</div></div>)}{!rows.length&&!error&&<div className="feature-settings-row asks-empty-row"><span>No requesters yet</span></div>}</>:null}
  {error&&<p className="asks-inline-error" role="alert">{error}</p>}
 </div></section>;
}
