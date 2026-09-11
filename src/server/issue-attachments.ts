import {randomUUID} from 'node:crypto';
import type {Repository,RecordEntity,Actor} from './repository.ts';

export function validSourceUrl(value:unknown):value is string {
 if(typeof value!=='string'||!value||value.length>4096)return false;
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}
}
// Preserve an unshared source identity when its request moves. Shared sources
// are copied so moving one request cannot move another request's source.
export function moveRequestSource(repo:Repository,actor:Actor,previous:RecordEntity,next:RecordEntity){
 const targetKind=next.issueId?'issues':next.projectId?'projects':null;if(!targetKind)return;
 const targetId=next.issueId||next.projectId;repo.access(actor,targetKind,repo.get(actor,targetKind,targetId),true);
 if(!validSourceUrl(next.sourceUrl)||next.sourceUrl!==previous.sourceUrl)return;
 const oldIssue=!!previous.issueId,newIssue=!!next.issueId,oldId=oldIssue?previous.attachmentId:previous.projectAttachmentId;
 if(!oldId)return;
 const oldTable=oldIssue?'issue_attachments':'project_attachments',newTable=newIssue?'issue_attachments':'project_attachments',oldParent=oldIssue?'issue_id':'project_id',newParent=newIssue?'issue_id':'project_id';
 const row=repo.db.prepare(`SELECT * FROM ${oldTable} WHERE id=? AND workspace_id=? AND ${oldParent}=? AND url=?`).get(oldId,actor.workspaceId,previous.issueId||previous.projectId,previous.sourceUrl) as Record<string,any>|undefined;if(!row)return;
 if(repo.db.prepare(`SELECT id FROM ${newTable} WHERE workspace_id=? AND ${newParent}=? AND url=?`).get(actor.workspaceId,targetId,next.sourceUrl))return;
 const shared=repo.all('requests',actor.workspaceId).some(other=>other.id!==previous.id&&(oldIssue?other.attachmentId:other.projectAttachmentId)===oldId);
 const details=oldIssue?JSON.parse(row.details||'{}'):{title:row.title,creatorId:row.creator_id,metadata:JSON.parse(row.metadata),updatedAt:row.updated_at};
 const id=shared?randomUUID():oldId;
 if(oldTable===newTable&&!shared){repo.db.prepare(`UPDATE ${oldTable} SET ${oldParent}=? WHERE id=? AND workspace_id=?`).run(targetId,oldId,actor.workspaceId);if(newIssue)repo.db.prepare('UPDATE issue_attachments SET details=? WHERE id=?').run(JSON.stringify({...details,updatedAt:next.updatedAt}),id);else repo.db.prepare('UPDATE project_attachments SET updated_at=? WHERE id=?').run(next.updatedAt,id);return;}
 if(newIssue)repo.db.prepare('INSERT INTO issue_attachments(id,workspace_id,issue_id,url,created_at,details) VALUES(?,?,?,?,?,?)').run(id,actor.workspaceId,targetId,row.url,row.created_at,JSON.stringify({...details,updatedAt:next.updatedAt}));
 else repo.db.prepare('INSERT INTO project_attachments(id,workspace_id,project_id,url,title,creator_id,metadata,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,actor.workspaceId,targetId,row.url,details.title??row.url,details.creatorId??previous.creatorId??actor.userId,JSON.stringify(details.metadata??{}),row.created_at,next.updatedAt);
 if(!shared)repo.db.prepare(`DELETE FROM ${oldTable} WHERE id=? AND workspace_id=?`).run(oldId,actor.workspaceId);
}
// Run after saving the request's deletion, inside the same transaction.
export function removeUnusedRequestSource(repo:Repository,request:RecordEntity){
 const remaining=repo.all('requests',request.workspaceId);
 if(request.attachmentId&&!remaining.some(other=>other.attachmentId===request.attachmentId))repo.db.prepare('DELETE FROM issue_attachments WHERE id=? AND workspace_id=? AND issue_id=? AND url=?').run(request.attachmentId,request.workspaceId,request.issueId,request.sourceUrl);
 if(request.projectAttachmentId&&!remaining.some(other=>other.projectAttachmentId===request.projectAttachmentId))repo.db.prepare('DELETE FROM project_attachments WHERE id=? AND workspace_id=? AND project_id=? AND url=?').run(request.projectAttachmentId,request.workspaceId,request.projectId,request.sourceUrl);
}
// Called only after request authorization/reference validation, within its write transaction.
// Attachment identity is derived from the issue and URL; supplied IDs cannot rebind a resource.
export function bindRequestSource(repo:Repository,request:RecordEntity,actor?:Actor){
 request.projectAttachmentId=null;
 if(request.projectId&&!request.issueId&&validSourceUrl(request.sourceUrl)){
  request.attachmentId=null;const project=repo.raw('projects',request.projectId,true);if(!project||project.workspaceId!==request.workspaceId)return;
  let row=repo.db.prepare('SELECT id FROM project_attachments WHERE workspace_id=? AND project_id=? AND url=?').get(request.workspaceId,request.projectId,request.sourceUrl) as {id:string}|undefined;
  if(!row){row={id:randomUUID()};repo.db.prepare('INSERT INTO project_attachments(id,workspace_id,project_id,url,title,creator_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(row.id,request.workspaceId,request.projectId,request.sourceUrl,request.sourceUrl,actor?.userId??request.creatorId??null,request.updatedAt,request.updatedAt);}
  request.projectAttachmentId=row.id;return;
 }
 if(!request.issueId||!validSourceUrl(request.sourceUrl)){request.attachmentId=null;return;}
 const parent=repo.raw('issues',request.issueId,true);
 if(!parent||parent.workspaceId!==request.workspaceId){request.attachmentId=null;return;}
 let row=repo.db.prepare('SELECT id FROM issue_attachments WHERE workspace_id=? AND issue_id=? AND url=?').get(request.workspaceId,request.issueId,request.sourceUrl) as {id:string}|undefined;
 if(!row){row={id:randomUUID()};repo.db.prepare('INSERT INTO issue_attachments(id,workspace_id,issue_id,url,created_at) VALUES(?,?,?,?,?)').run(row.id,request.workspaceId,request.issueId,request.sourceUrl,request.updatedAt);}
 request.attachmentId=row.id;
}

export function initializeRequestSources(repo:Repository){
 const name='request-source-attachments-v2';if(repo.db.prepare('SELECT name FROM data_migrations WHERE name=?').get(name))return;
 repo.transaction(()=>{
  const rows=repo.db.prepare("SELECT data FROM entities WHERE kind='requests'").all() as {data:string}[],now=new Date().toISOString();
  for(const row of rows){const request=JSON.parse(row.data) as RecordEntity,next={...request};bindRequestSource(repo,next);if((request.attachmentId??null)===next.attachmentId&&(request.projectAttachmentId??null)===next.projectAttachmentId)continue;
   next.version++;const data=JSON.stringify(next);
   repo.db.prepare("UPDATE entities SET data=?,version=? WHERE kind='requests' AND id=?").run(data,next.version,next.id);
   repo.db.prepare("INSERT INTO changes(workspace_id,kind,action,entity_id,data,actor_id,created_at) VALUES(?,'requests','update',?,?,'system',?)").run(next.workspaceId,next.id,data,now);
  }
  repo.db.prepare('INSERT INTO data_migrations VALUES(?,?)').run(name,now);
 });
}
