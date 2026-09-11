import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Button,Modal} from './components/ui';
import {SidebarDocs} from './sidebar-docs';
import {apiReferenceSections,HELP_REFERENCE_EVENT,loadParabolicHealth,type ParabolicHealth,type HelpReferenceAction} from './help-reference-data';
import './help-references.css';

export {apiReferenceSections,HELP_REFERENCE_EVENT,loadParabolicHealth,type ParabolicHealth,type HelpReferenceAction} from './help-reference-data';

/** One event contract lets the command palette and Help menu open the same surfaces. */
export function openHelpReference(action:HelpReferenceAction){
 window.dispatchEvent(new CustomEvent<HelpReferenceAction>(HELP_REFERENCE_EVENT,{detail:action}));
}

export function ApiDocumentation({onClose}:{onClose:()=>void}){
 const origin=location.origin;
 return <Modal title="Parabolic API Documentation" wide onClose={onClose}><div className="api-reference modal-body">
  <p className="api-reference-intro">Build internal tools against the same API used by this workspace. This bundled reference works without an external documentation service.</p>
  <section><h3>Service origin</h3><code>{origin}</code></section>
  {apiReferenceSections.slice(1).map(section=><section key={section.title}><h3>{section.title}</h3><p>{section.body}</p>{section.title==='REST API'&&<pre><code>{`GET ${origin}/api/v1/issues?first=50\nAuthorization: Bearer &lt;scoped token&gt;`}</code></pre>}{section.title==='GraphQL'&&<pre><code>{`POST ${origin}/graphql\n{ "query": "query { issues(first: 20) { nodes { id title } } }" }`}</code></pre>}{section.title==='Parabolic SDK'&&<pre><code>{`import { ParabolicClient } from '@parabolic/sdk';\nconst client = new ParabolicClient({ baseUrl, token });`}</code></pre>}{section.title==='MCP'&&<code>{origin}/mcp</code>}</section>)}
  <p className="api-reference-settings"><Link to="/settings/api" onClick={onClose}>Open API settings</Link> to create scoped credentials and configure webhooks.</p>
 </div></Modal>;
}

type Connection={mode:'embedded'|'remote';origin:string};
async function currentConnection():Promise<Connection>{
 if(!window.desktop?.getConnection)return {mode:'remote',origin:location.origin};
 try{const value=await window.desktop.getConnection(),url=new URL(value.activeUrl);return {mode:value.mode,origin:url.origin};}
 catch{return {mode:'remote',origin:location.origin};}
}

export function ParabolicStatusDialog({onClose}:{onClose:()=>void}){
 const [health,setHealth]=useState<ParabolicHealth|null>(null),[connection,setConnection]=useState<Connection|null>(null),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setHealth(null);void loadParabolicHealth().then(value=>{if(active)setHealth(value)});void currentConnection().then(value=>{if(active)setConnection(value)});return()=>{active=false};},[revision]);
 return <Modal title="Parabolic status" onClose={onClose}><div className="parabolic-status modal-body" aria-live="polite">
  {!health?<><span className="status-indicator checking"/><div><h3>Checking…</h3><p>Requesting current service health.</p></div></>:health.status==='operational'?<><span className="status-indicator operational"/><div><h3>Operational</h3><p>Parabolic is responding normally{health.version?` · Version ${health.version}`:''}.</p></div></>:<><span className="status-indicator unavailable"/><div><h3>Unavailable</h3><p>{health.message}</p><Button onClick={()=>setRevision(value=>value+1)}>Check again</Button></div></>}
  {connection&&<dl><dt>Connection</dt><dd>{window.desktop?(connection.mode==='embedded'?'Embedded service':'Remote service'):'Web service'}</dd><dt>Service origin</dt><dd><code>{connection.origin}</code></dd></dl>}
 </div></Modal>;
}

/** Mount once near the workspace root. Transient state never survives reload. */
export function HelpReferenceDialogs(){
 const [action,setAction]=useState<HelpReferenceAction|null>(null);
 useEffect(()=>{const listener=(event:Event)=>setAction((event as CustomEvent<HelpReferenceAction>).detail);window.addEventListener(HELP_REFERENCE_EVENT,listener);return()=>window.removeEventListener(HELP_REFERENCE_EVENT,listener);},[]);
 if(action==='documentation')return <SidebarDocs onClose={()=>setAction(null)}/>;
 if(action==='api-documentation')return <ApiDocumentation onClose={()=>setAction(null)}/>;
 if(action==='status')return <ParabolicStatusDialog onClose={()=>setAction(null)}/>;
 return null;
}
