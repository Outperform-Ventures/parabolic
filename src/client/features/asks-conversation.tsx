import React,{useState} from 'react';
import {apiRequest,useAppStore} from '../store';
import {RichEditor} from '../components/ui';
export function AsksIssueConversation({issueId}:{issueId:string}){
 const store=useAppStore(),requests=store.data.requests.filter(request=>request.issueId===issueId&&request.asksPageId&&!request.deletedAt&&request.requesterEmail);
 const [reply,setReply]=useState<Record<string,string>>({}),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 if(!requests.length)return null;
 const send=async(id:string)=>{setBusy(id);setError('');try{await apiRequest('/api/v1/asks-requests/'+id+'/reply',{method:'POST',body:JSON.stringify({body:reply[id]})});setReply(value=>({...value,[id]:''}));}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(null)}};
 return <section className="activity-section asks-email-conversation" aria-label="Requester email conversation"><h3>Requester conversation</h3>{requests.map(request=><div key={request.id}><p className="muted">{request.requesterName||request.requesterEmail} · {request.requesterEmail}</p>{store.data.comments.filter(comment=>comment.asksRequestId===request.id&&!comment.deletedAt).map(comment=><div className="comment" key={comment.id}><RichEditor value={comment.body||''} readOnly onChange={()=>{}}/></div>)}<form onSubmit={event=>{event.preventDefault();void send(request.id)}}><textarea className="input" aria-label={'Email reply to '+request.requesterEmail} placeholder="Reply by email…" rows={3} value={reply[request.id]||''} onChange={event=>setReply(value=>({...value,[request.id]:event.target.value}))}/><button className="button" type="submit" disabled={!!busy||!reply[request.id]?.trim()}>{busy===request.id?'Sending…':'Send email reply'}</button></form></div>)}{error&&<p role="alert">{error}</p>}</section>
}
