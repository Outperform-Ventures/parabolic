import React,{useEffect,useState} from 'react';
import {apiRequest} from '../store';
import {Action,Confirm,useActions} from './shared';
export function LeftWorkspaceMembers(){
 const {data,reload,act}=useActions(),[members,setMembers]=useState<any[]>([]),[restore,setRestore]=useState<any>(null),[error,setError]=useState('');
 const load=()=>apiRequest('/auth/workspace/left-members').then(result=>{setMembers(result.nodes);setError('')}).catch(error=>setError(error.message));
 useEffect(()=>{void load()},[data.workspaceId]);
 if(error)return <p role="alert">{error}</p>;
 if(!members.length)return null;
 return <section className="feature-setting-section"><h3>Inactive members</h3><div className="feature-settings-card">{members.map(member=><div className="feature-settings-row" key={member.id}><div><strong>{member.user?.name||member.user?.email||'Former member'}</strong><p>{member.user?.email} · {member.suspendedAt?'Suspended':'Left workspace'}</p></div><Action onClick={()=>setRestore(member)}>Restore access</Action></div>)}</div>{restore&&<Confirm title={`Restore ${restore.user?.name||'member'}’s access?`} description="This person will be able to sign in again with their existing account and previous workspace role. Previously revoked sessions stay signed out." onClose={()=>setRestore(null)} onConfirm={()=>act(async()=>{await apiRequest('/auth/workspace/restore-member',{method:'POST',body:JSON.stringify({id:restore.id})});await reload();await load();return true})}/>}</section>;
}
