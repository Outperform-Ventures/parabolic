import {decodeHTML} from 'entities';
import {randomUUID} from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import {enqueueMail} from './mail';
import {assert} from './errors';
import type {Actor,RecordEntity,Repository} from './repository';
const plain=(value:unknown)=>decodeHTML(sanitizeHtml(String(value||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n'),{allowedTags:[],allowedAttributes:{}})).trim();
function initialize(repo:Repository){repo.db.exec('CREATE TABLE IF NOT EXISTS asks_email_events(mail_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,request_id TEXT NOT NULL,event_type TEXT NOT NULL,source_id TEXT NOT NULL,created_at TEXT NOT NULL)');}
function recipient(repo:Repository,request:RecordEntity){
 if(!request.asksPageId||!request.requesterEmail||!request.requesterId)return null;
 const requester=repo.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='asks_requesters'").get()?repo.db.prepare('SELECT email,enabled FROM asks_requesters WHERE id=? AND workspace_id=?').get(request.requesterId,request.workspaceId) as any:null;
 if(requester)return requester.enabled&&requester.email===request.requesterEmail?requester.email:null;
 const user=repo.raw('users',request.requesterId);return user&&user.email===request.requesterEmail&&repo.role(user.id,request.workspaceId)!=='none'?user.email:null;
}
function queue(repo:Repository,request:RecordEntity,eventType:string,sourceId:string){if(!recipient(repo,request))return;initialize(repo);const dedupeKey=`asks-email:${request.id}:${eventType}:${sourceId}`;enqueueMail(repo,{workspaceId:request.workspaceId,to:request.requesterEmail,subject:'Request update',text:'',dedupeKey});const row=repo.db.prepare('SELECT id FROM mail_outbox WHERE dedupe_key=?').get(dedupeKey) as {id:string};repo.db.prepare('INSERT OR IGNORE INTO asks_email_events VALUES(?,?,?,?,?,?)').run(row.id,request.workspaceId,request.id,eventType,sourceId,new Date().toISOString());}
export function queueAsksEmail(repo:Repository,actor:Actor,kind:string,record:RecordEntity,previous?:RecordEntity){
 if(kind==='requests'&&!previous&&record.asksPageId)queue(repo,record,'acknowledgment',record.id);
 if(kind==='comments'&&!previous&&record.asksRequestId&&!record.asksInbound){const request=repo.raw('requests',record.asksRequestId);if(request&&request.issueId===record.issueId)queue(repo,request,'reply',record.id);}
 if(kind==='issues'&&previous&&record.statusId!==previous.statusId)for(const request of repo.all('requests',record.workspaceId).filter(request=>request.asksPageId&&request.issueId===record.id))queue(repo,request,'status',record.id+':'+record.version);
}
export function refreshAsksEmail(repo:Repository,mailId:string):null|{defer:true}|{from?:string;replyTo?:string;inReplyTo?:string;subject:string;text:string}{
 initialize(repo);const event=repo.db.prepare('SELECT * FROM asks_email_events WHERE mail_id=?').get(mailId) as any;if(!event)return null;
 const request=repo.raw('requests',event.request_id),issue=request&&repo.raw('issues',request.issueId);if(!request||!issue||!recipient(repo,request))return null;
 const domain=repo.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='asks_domains'").get()?repo.db.prepare('SELECT * FROM asks_domains WHERE workspace_id=?').get(request.workspaceId) as any:null;
 if(domain?.sender_address&&!domain.sender_verified_at)return {defer:true};
 const from=domain?.sender_address||undefined,page=repo.raw('asksPages',request.asksPageId),title=plain(request.title||issue.title),identifier=issue.identifier||'Request';let text:string;
 if(event.event_type==='reply'){const comment=repo.raw('comments',event.source_id);if(!comment||comment.issueId!==issue.id||comment.asksRequestId!==request.id)return null;text=plain(comment.body);}
 else if(event.event_type==='acknowledgment')text=`We received your request: ${title}.\n\nThe team will follow up in this email thread.`;
 else text='Your request status is now '+(repo.raw('statuses',issue.statusId)?.name||'updated')+'.';
 if(page?.emailReplyFormat)text=String(page.emailReplyFormat).replace(/\{(reply|title|requester|identifier)\}/g,(_match,key:string)=>({reply:text,title,requester:request.requesterName||'',identifier} as Record<string,string>)[key]||'');
 const acknowledgment=repo.db.prepare("SELECT mail_id FROM asks_email_events WHERE request_id=? AND event_type='acknowledgment' LIMIT 1").get(request.id) as {mail_id:string}|undefined;
 return {from,replyTo:from,inReplyTo:event.event_type!=='acknowledgment'&&acknowledgment?`<${acknowledgment.mail_id}@parabolic.internal>`:undefined,subject:`${event.event_type==='acknowledgment'?'Received':'Re'}: [${identifier}] ${title}`,text};
}
export function replyToAsksRequester(repo:Repository,actor:Actor,requestId:string,body:unknown){
 const request=repo.get(actor,'requests',requestId);assert(request.asksPageId&&recipient(repo,request),422,'This request has no active email recipient','REQUESTER_UNAVAILABLE');const issue=repo.get(actor,'issues',request.issueId);repo.access(actor,'issues',issue,true);assert(typeof body==='string'&&body.trim().length>0&&body.length<=100000,422,'Enter a reply','INVALID_REPLY');
 return repo.create(actor,'comments',{id:randomUUID(),issueId:issue.id,body:body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'),asksRequestId:request.id});
}
