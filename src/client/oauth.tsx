import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from './store';
import { Button, Icon } from './components/ui';
import './oauth.css';

interface Consent { actor?:'user'|'app';allPublicTeams?:boolean;teamIds?:string[]; clientId:string;name:string;redirectUri:string;scopes:string[];state:string|null;consentRequired:boolean;resource?:string|null;dynamicallyRegistered?:boolean }
function describeScope(scope:string,appActor=false) {
  const subject=appActor?'the application':'your account';
  if(scope==='read')return {title:'Read workspace data',description:`View the issues, projects, and other records that ${subject} can access.`};
  if(scope==='write')return {title:'Create and update workspace data',description:`Create, change, and delete records within ${appActor?'the application’s':'your'} existing permissions.`};
  const [collection,access]=scope.split(':');
  const name=collection.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase();
  return {title:`${access==='write'?'Create and update':'Read'} ${name}`,description:access==='write'?`Create, change, and delete ${name} that ${subject} can access.`:`View ${name} that ${subject} can access.`};
}
export function OAuthConsentPage() {
  const store=useAppStore(),location=useLocation();
  const [consent,setConsent]=useState<Consent|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const workspace=store.data.workspaces.find(workspace=>workspace.id===store.data.workspaceId);
  useEffect(()=>{
    const abort=new AbortController();setConsent(null);setError('');setLoading(true);
    void fetch(`/oauth/authorize${location.search}`,{credentials:'include',headers:{Accept:'application/json'},signal:abort.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error?.message??'Unable to load this authorization request');setConsent(data);}).catch(error=>{if(!abort.signal.aborted)setError(error instanceof Error?error.message:'Unable to load this authorization request');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[location.search,store.data.workspaceId]);
  const decide=async(approve:boolean)=>{
    if(!consent||busy)return;setBusy(true);setError('');
    try {
      const fields={...Object.fromEntries(new URLSearchParams(location.search)),approve};
      const response=await fetch('/oauth/authorize',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(fields)});
      const result=await response.json();if(!response.ok)throw Error(result.error?.message??'Unable to complete authorization');
      const callback=new URL(result.redirectUri),registered=new URL(consent.redirectUri);
      if(callback.origin!==registered.origin||callback.pathname!==registered.pathname||callback.username||callback.password)throw Error('The application returned an invalid redirect address');
      // The server validates exact registered redirect URIs before either consent outcome.
      if(window.desktop)await window.desktop.openExternal(callback.href);else window.location.assign(callback.href);
    } catch(error) {setError(error instanceof Error?error.message:'Unable to complete authorization');setBusy(false);}
  };
  return <main className="auth-page oauth-page"><section className="auth-card oauth-card" aria-labelledby="oauth-title"><Link to="/my-issues" className="oauth-brand"><span className="brand-mark"/><strong>Parabolic</strong></Link>{loading?<div role="status" className="oauth-loading">Loading authorization request…</div>:consent?<><div className="oauth-app-mark" aria-hidden="true">{consent.name.slice(0,1).toUpperCase()}</div><h1 id="oauth-title">{consent.actor==='app'?'Install':'Connect'} {consent.name}</h1><p>This application is requesting access to <strong>{workspace?.name??'your workspace'}</strong>.</p><div className="oauth-account"><Icon name="UserRound" size={18}/><div><strong>{store.user?.name}</strong><small>{store.user?.email}</small></div></div>{store.data.workspaces.length>1&&<label className="oauth-workspace">Workspace<select aria-label="Authorize in workspace" value={store.data.workspaceId} disabled={busy} onChange={event=>{setBusy(true);void fetch('/auth/workspace',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId:event.target.value})}).then(async response=>{if(!response.ok)throw Error('Unable to switch workspace');await store.reload();}).catch(error=>setError(error.message)).finally(()=>setBusy(false));}}>{store.data.workspaces.map(workspace=><option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>}{consent.resource&&<p className="oauth-return">MCP access to <strong>{new URL(consent.resource).host}</strong>.</p>}{consent.dynamicallyRegistered&&<p className="oauth-return">This client registered itself. Its name is provided by the application.</p>}{consent.actor==='app'&&<p className="oauth-return">Actions will be attributed to <strong>{consent.name}</strong>, a dedicated application identity. It can access {consent.allPublicTeams?'all public teams': 'selected teams'}{(consent.teamIds?.length??0)>0?`${consent.allPublicTeams?' and ':': '}${consent.teamIds!.map(id=>store.data.teams.find(team=>team.id===id)?.name??id).join(', ')}`:''}. Its permissions are managed in Applications settings.</p>}<ul className="oauth-scopes">{consent.scopes.map(scope=>{const detail=describeScope(scope,consent.actor==='app');return <li key={scope}><Icon name={scope==='write'||scope.endsWith(':write')?'Pencil':'Eye'} size={17}/><div><strong>{detail.title}</strong><p>{detail.description}</p></div></li>;})}</ul><p className="oauth-return">You will return to <strong>{new URL(consent.redirectUri).host}</strong>. You can revoke access from API settings.</p>{error&&<div className="error-text" role="alert">{error}</div>}<div className="oauth-buttons"><Button disabled={busy} onClick={()=>void decide(false)}>Deny</Button><Button variant="primary" disabled={busy} onClick={()=>void decide(true)}>{busy?'Continuing…':consent.actor==='app'?'Install application':'Authorize application'}</Button></div></>:<><h1 id="oauth-title">Unable to connect application</h1><p role="alert" className="error-text">{error}</p><Link className="button" to="/my-issues">Back to workspace</Link></>}</section></main>;
}
