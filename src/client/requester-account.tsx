import React,{useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {RequesterPortal} from './requester-portal';
import './requester-account.css';

export type RequesterIdentity={id:string;name:string;email:string;workspaceId:string};
type Identity=RequesterIdentity;
type Status={workspace:{id:string;name:string};requester:Identity|null};
export async function requesterRequest(path:string,body?:unknown,signal?:AbortSignal){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 const value=response.status===204?null:await response.json();
 if(!response.ok)throw Object.assign(new Error(value?.error?.message||value?.message||'Unable to complete this request'),{status:response.status});
 return value;
}
export default function RequesterAccount(){
 const location=useLocation(),workspaceId=location.pathname.split('/')[2];
 return <Account key={workspaceId} workspaceId={workspaceId}/>;
}
function Account({workspaceId}:{workspaceId:string}){
 const location=useLocation(),accountMode=/\/account\/?$/.test(location.pathname);
 const base='/asks-api/'+encodeURIComponent(workspaceId)+'/auth/';
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[currentPassword,setCurrentPassword]=useState('');
 const [invitation,setInvitation]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('invite')||'');
 const generation=useRef(0),mounted=useRef(true),working=useRef(false);
 useEffect(()=>{
  const changed=()=>{setInvitation(new URLSearchParams(window.location.hash.slice(1)).get('invite')||'');setPassword('');setCurrentPassword('');setError('');setNotice('')};
  window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);
 },[]);
 useEffect(()=>{
  mounted.current=true;let controller:AbortController|undefined;
  const refresh=()=>{if(working.current)return;const version=++generation.current;controller?.abort();controller=new AbortController();void requesterRequest(base+'status',undefined,controller.signal).then(value=>{if(mounted.current&&version===generation.current){setStatus(value);if(!value.requester){setPassword('');setCurrentPassword('')}setError('');setLoading(false)}}).catch(reason=>{if(mounted.current&&version===generation.current&&!controller?.signal.aborted){setStatus(null);setError(reason.message);setLoading(false)}})};
  refresh();window.addEventListener('focus',refresh);const visibility=()=>{if(document.visibilityState==='visible')refresh()};document.addEventListener('visibilitychange',visibility);
  return()=>{mounted.current=false;++generation.current;controller?.abort();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visibility)};
 },[base]);
 const perform=async(action:'join'|'login'|'logout'|'password')=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');setNotice('');const version=++generation.current;
  try{
   const body=action==='join'?{token:invitation,password}:action==='login'?{email,password}:action==='password'?{currentPassword,newPassword:password}:{};
   const result=await requesterRequest(base+action,body);
   if(!mounted.current||version!==generation.current)return;
   setPassword('');setCurrentPassword('');
   if(action==='join'||action==='login'){
    setStatus(previous=>previous?{...previous,requester:result.requester}:previous);
    if(action==='join'){setInvitation('');const url=new URL(window.location.href);url.hash='';window.history.replaceState(null,'',url.pathname+url.search)}
   }else if(action==='logout'){setStatus(previous=>previous?{...previous,requester:null}:previous)}
   else setNotice('Password updated. Your other requester sessions have been signed out.');
  }catch(reason){if(mounted.current&&version===generation.current)setError(reason instanceof Error?reason.message:'Unable to complete this request')}
  finally{working.current=false;if(mounted.current)setBusy(false)}
 };
 const joining=!!invitation;
 return <main className={'requester-account'+(!accountMode&&status?.requester?' requester-site':'')}><section className="requester-account-card" aria-busy={loading||busy}>
  <div className="requester-account-brand">{status?.workspace.name||'Asks'}</div>
  {loading?<p role="status">Loading…</p>:!status?<><h1>Asks is unavailable</h1><p role="alert">{error}</p><button className="button" onClick={()=>window.location.reload()}>Try again</button></>:joining||!status.requester?<>
   <h1>{joining?'Accept your invitation':'Log in to Asks'}</h1><p>{joining?'Choose a password for your requester account.':'Use your requester email and password.'}</p>
   <form onSubmit={event=>{event.preventDefault();void perform(joining?'join':'login')}}>
    {!joining&&<label>Email<input className="input" type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)}/></label>}
    <label>{joining?'Create password':'Password'}<input className="input" type="password" autoComplete={joining?'new-password':'current-password'} required minLength={joining?10:undefined} maxLength={1024} value={password} onChange={event=>setPassword(event.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy?'Please wait…':joining?'Accept invitation':'Log in'}</button>
   </form>
   {joining&&<button className="button" disabled={busy} onClick={()=>{setInvitation('');setPassword('');setError('');window.history.replaceState(null,'',window.location.pathname+window.location.search)}}>Use an existing account</button>}
  </>:!accountMode?<><nav className="requester-nav"><Link to={'/ask-access/'+workspaceId}>Asks</Link><Link to={'/ask-access/'+workspaceId+'/account'}>Account</Link><button className="button" disabled={busy} onClick={()=>void perform('logout')}>Log out of Asks</button></nav><RequesterPortal key={workspaceId+':'+status.requester.id} requester={status.requester} onSessionEnded={()=>{setStatus(previous=>previous?{...previous,requester:null}:null);setPassword('');setCurrentPassword('')}}/></>:<>
   <Link to={'/ask-access/'+workspaceId}>Browse request forms</Link><h1>Requester account</h1><p>Signed in as <strong>{status.requester.name}</strong><br/>{status.requester.email}</p>
   <form onSubmit={event=>{event.preventDefault();void perform('password')}}><h2>Change password</h2>
    <label>Current password<input className="input" type="password" autoComplete="current-password" required maxLength={1024} value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></label>
    <label>New password<input className="input" type="password" autoComplete="new-password" required minLength={10} maxLength={1024} value={password} onChange={event=>setPassword(event.target.value)}/></label>
    <button className="button" disabled={busy}>Update password</button>
   </form>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}<button className="button" disabled={busy} onClick={()=>void perform('logout')}>Log out of Asks</button>
  </>}
 </section></main>;
}
