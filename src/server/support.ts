import {randomUUID} from 'node:crypto';
import type {Repository,Actor} from './repository';
import {assert} from './errors';
import {enqueueMail,mailConfigured} from './mail';

export const SUPPORT_ATTACHMENT_COUNT=3;
export const SUPPORT_ATTACHMENT_BYTES=5_000_000;
const accepted=/^(?:image\/(?:png|jpeg|gif|webp)|video\/(?:mp4|webm|quicktime)|application\/(?:pdf|json)|text\/plain)$/;

export function supportDestination(){const candidate=process.env.PARABOLIC_SUPPORT_EMAIL?.trim(),email=candidate&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)?candidate:null;return {configured:!!email&&mailConfigured(),email};}

/** Enqueues only data the person reviewed in the form. No workspace entity data, URLs or diagnostics are inferred. */
export function submitSupport(repo:Repository,actor:Actor,input:any){
 const destination=supportDestination();
 assert(destination.configured,503,'Support is not configured','SUPPORT_NOT_CONFIGURED');
 assert(input&&['support','feedback','performance'].includes(input.kind),422,'Choose a supported message type','VALIDATION_ERROR');
 assert(typeof input.message==='string'&&input.message.trim().length>0&&input.message.length<=10_000,422,'Enter a message of 10,000 characters or fewer','VALIDATION_ERROR');
 const attachmentIds=input.attachmentIds??[];
 assert(Array.isArray(attachmentIds)&&attachmentIds.length<=SUPPORT_ATTACHMENT_COUNT&&attachmentIds.every((id:unknown)=>typeof id==='string'),422,`Attach at most ${SUPPORT_ATTACHMENT_COUNT} files`,'VALIDATION_ERROR');
 const attachments=attachmentIds.map((id:string)=>repo.db.prepare('SELECT id,filename,mime_type,size,content,creator_id,entity_id FROM attachments WHERE id=? AND workspace_id=?').get(id,actor.workspaceId) as any);
 assert(attachments.every(file=>file&&file.creator_id===actor.userId&&!file.entity_id),422,'An attachment is unavailable','INVALID_ATTACHMENT');
 assert(attachments.every(file=>file.size<=SUPPORT_ATTACHMENT_BYTES&&accepted.test(file.mime_type)),422,'An attachment type or size is unsupported','INVALID_ATTACHMENT');
 assert(new Set(attachmentIds).size===attachmentIds.length,422,'An attachment was selected more than once','INVALID_ATTACHMENT');
 assert(new Set(attachments.map(file=>file.filename)).size===attachments.length,422,'Attachment filenames must be unique','INVALID_ATTACHMENT');
 const id=randomUUID(),labels={support:'Contact support',feedback:'Parabolic feedback',performance:'Performance problem'} as const;
 const mailId=repo.transaction(()=>{const value=enqueueMail(repo,{workspaceId:actor.workspaceId,to:destination.email!,subject:labels[input.kind as keyof typeof labels],text:input.message.trim(),dedupeKey:`support:${actor.workspaceId}:${actor.userId}:${id}`,attachments:attachments.map(file=>({filename:file.filename,mimeType:file.mime_type,content:Buffer.from(file.content)}))});for(const file of attachments)repo.db.prepare('DELETE FROM attachments WHERE id=?').run(file.id);return value;});
 return {id,queued:true,mailId};
}
