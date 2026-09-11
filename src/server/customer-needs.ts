import {marked} from 'marked';
import TurndownService from 'turndown';
import {gfm} from 'turndown-plugin-gfm';
import {validSourceUrl} from './issue-attachments.ts';
import {sanitizeEditorContent} from './content.ts';
import {structuredDocumentHtml,structuredDocumentJson} from './collaboration-schema.ts';
import {assert} from './errors.ts';
import {isIsoTimestamp} from './comments.ts';
import {resolveRelativeTimestamp} from '../shared/relative-timestamp-filter.ts';
import type {Actor,Repository} from './repository.ts';

const markdown=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
markdown.use(gfm);
export function needBodyData(body:unknown):string|null {
  if(typeof body!=='string'||!body.trim())return null;
  return JSON.stringify(structuredDocumentJson(sanitizeEditorContent(body)));
}
function inputBody(input:Record<string,any>):string {
  assert(!(Object.hasOwn(input,'body')&&Object.hasOwn(input,'bodyData')),422,'Provide body or bodyData, not both','INVALID_CUSTOMER_NEED');
  if(Object.hasOwn(input,'bodyData')){
    if(input.bodyData==null)return '';
    assert(typeof input.bodyData==='string'&&input.bodyData.length<=100000,422,'Body data must be a JSON string of at most 100,000 characters','INVALID_CUSTOMER_NEED');
    try{return sanitizeEditorContent(structuredDocumentHtml(JSON.parse(input.bodyData)));}catch(error){assert(false,422,error instanceof Error?error.message:'Invalid body data','INVALID_CUSTOMER_NEED');}
  }
  assert(input.body==null||typeof input.body==='string'&&input.body.length<=100000,422,'Body must be Markdown of at most 100 KB','INVALID_CUSTOMER_NEED');
  return input.body==null?'':sanitizeEditorContent(marked.parse(input.body,{async:false}));
}
export function archiveCustomerNeed(repo:Repository,actor:Actor,id:string,archived:boolean){return repo.transaction(()=>{
  const need=repo.get(actor,'requests',id,true);repo.access(actor,'requests',need,true);
  if(need.deletedAt)return null;
  if(!!need.archivedAt===archived)return need;
  return repo.update(actor,'requests',id,{archivedAt:archived?(actor.now??new Date()).toISOString():null});
});}
export function deleteCustomerNeed(repo:Repository,actor:Actor,id:string,keepAttachment=false){return repo.transaction(()=>{
  const need=repo.get(actor,'requests',id);repo.access(actor,'requests',need,true);
  return repo.remove(actor,'requests',id,undefined,{keepAttachment});
});}
export function createCustomerNeedFromAttachment(repo:Repository,actor:Actor,attachmentId:string){return repo.transaction(()=>{
  repo.access(actor,'requests',undefined,true);
  const attachment=getIssueAttachment(repo,actor,attachmentId);const issue=repo.get(actor,'issues',attachment.issueId);repo.access(actor,'issues',issue,true);
  const existing=repo.all('requests',actor.workspaceId).filter(need=>need.attachmentId===attachment.id&&need.issueId===attachment.issueId&&need.sourceUrl===attachment.url).sort((a,b)=>Number(!!a.archivedAt)-Number(!!b.archivedAt)||b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id))[0];
  if(existing){repo.access(actor,'requests',existing,true);return existing.archivedAt?archiveCustomerNeed(repo,actor,existing.id,false)!:existing;}
  return createCustomerNeed(repo,actor,{issueId:attachment.issueId,attachmentId});
});}
export function updateCustomerNeed(repo:Repository,actor:Actor,id:string,input:Record<string,any>,clearAttachment=false){return repo.transaction(()=>{
  const previous=repo.get(actor,'requests',id);repo.access(actor,'requests',previous,true);
  assert(input&&typeof input==='object'&&!Array.isArray(input),422,'Customer need input is required','INVALID_CUSTOMER_NEED');
  const supported=new Set(['body','bodyData','customerId','customerExternalId','priority','applyPriorityToRelatedNeeds','attachmentUrl','issueId','projectId']);
  assert(Object.keys(input).every(key=>supported.has(key)),422,'Unsupported customer need update field','INVALID_CUSTOMER_NEED');
  const patch:Record<string,any>={};
  if(Object.hasOwn(input,'issueId')||Object.hasOwn(input,'projectId')){const target=resolveNeedTarget(repo,actor,input);patch.issueId=target.issueId;patch.projectId=target.projectId;}
  if(Object.hasOwn(input,'body')||Object.hasOwn(input,'bodyData'))patch.body=inputBody(input);
  assert(!(Object.hasOwn(input,'customerId')&&Object.hasOwn(input,'customerExternalId')),422,'Provide a customer ID or external ID','INVALID_CUSTOMER_NEED');
  if(Object.hasOwn(input,'customerId')){if(input.customerId!=null)repo.get(actor,'customers',input.customerId);patch.customerId=input.customerId;}
  if(Object.hasOwn(input,'customerExternalId')){
    assert(typeof input.customerExternalId==='string'&&input.customerExternalId.trim().length>0,422,'Customer external ID cannot be empty','INVALID_CUSTOMER_NEED');repo.access(actor,'customers');
    const customer=repo.all('customers',actor.workspaceId).find(customer=>customer.externalIds?.includes(input.customerExternalId));assert(customer,404,'Customer not found','NOT_FOUND');repo.access(actor,'customers',customer);patch.customerId=customer.id;
  }
  if(Object.hasOwn(input,'priority')){assert(input.priority===0||input.priority===1,422,'Priority must be 0 or 1','INVALID_CUSTOMER_NEED');patch.important=input.priority===1;}
  assert(input.applyPriorityToRelatedNeeds==null||typeof input.applyPriorityToRelatedNeeds==='boolean',422,'Related priority flag must be boolean','INVALID_CUSTOMER_NEED');
  assert(!(clearAttachment&&input.attachmentUrl!=null),422,'Cannot clear and replace an attachment together','INVALID_CUSTOMER_NEED');
  if(input.attachmentUrl!=null){assert(validSourceUrl(input.attachmentUrl),422,'Attachment URL must be an HTTP or HTTPS URL','INVALID_CUSTOMER_NEED');patch.sourceUrl=input.attachmentUrl;}
  if(clearAttachment)patch.sourceUrl=null;
  const need=repo.update(actor,'requests',id,patch),updatedRelatedNeeds=[];
  // Unassociated requests are not all requests from a single customer.
  if(input.applyPriorityToRelatedNeeds&&Object.hasOwn(input,'priority')&&need.customerId&&(need.issueId||need.projectId)){
    const related=repo.all('requests',actor.workspaceId).filter(other=>other.id!==id&&!other.archivedAt&&other.customerId===need.customerId&&(need.issueId?other.issueId===need.issueId:!other.issueId&&other.projectId===need.projectId));
    for(const other of related){repo.access(actor,'requests',other,true);updatedRelatedNeeds.push(repo.update(actor,'requests',other.id,{important:patch.important}));}
  }
  return {need,updatedRelatedNeeds};
});}
export function needBody(body:unknown):string|null {
  return typeof body==='string'?markdown.turndown(sanitizeEditorContent(body))||null:null;
}
export function requestComment(repo:Repository,actor:Actor,request:Record<string,any>){
  if(!request.commentId)return null;
  try{return repo.get(actor,'comments',request.commentId);}catch{return null;}
}
export interface IssueAttachment {id:string;workspaceId:string;issueId:string;url:string;createdAt:string}
export function getIssueAttachment(repo:Repository,actor:Actor,id:string):IssueAttachment {
  const row=repo.db.prepare('SELECT id,workspace_id AS workspaceId,issue_id AS issueId,url,created_at AS createdAt FROM issue_attachments WHERE id=? AND workspace_id=?').get(id,actor.workspaceId) as unknown as IssueAttachment|undefined;
  assert(row,404,'Attachment not found','NOT_FOUND');repo.get(actor,'issues',row.issueId);return row;
}
export function requestAttachment(repo:Repository,actor:Actor,request:Record<string,any>):IssueAttachment|null {
  if(!request.attachmentId)return null;
  try {const attachment=getIssueAttachment(repo,actor,request.attachmentId);return attachment.issueId===request.issueId&&attachment.url===request.sourceUrl?attachment:null;}catch{return null;}
}
export interface ProjectAttachment {id:string;workspaceId:string;projectId:string;url:string;title:string;creatorId:string|null;metadata:Record<string,unknown>;createdAt:string;updatedAt:string}
export function getProjectAttachment(repo:Repository,actor:Actor,id:string):ProjectAttachment {
 const row=repo.db.prepare('SELECT id,workspace_id AS workspaceId,project_id AS projectId,url,title,creator_id AS creatorId,metadata,created_at AS createdAt,updated_at AS updatedAt FROM project_attachments WHERE id=? AND workspace_id=?').get(id,actor.workspaceId) as unknown as (Omit<ProjectAttachment,'metadata'>&{metadata:string})|undefined;
 assert(row,404,'Attachment not found','NOT_FOUND');repo.get(actor,'projects',row.projectId);return {...row,metadata:JSON.parse(row.metadata)};
}
export function requestProjectAttachment(repo:Repository,actor:Actor,request:Record<string,any>):ProjectAttachment|null {
 if(!request.projectAttachmentId||request.issueId)return null;try{const attachment=getProjectAttachment(repo,actor,request.projectAttachmentId);return attachment.projectId===request.projectId&&attachment.url===request.sourceUrl?attachment:null;}catch{return null;}
}
export function resolveNeedTarget(repo:Repository,actor:Actor,input:Record<string,any>){
 assert(!!input.issueId!==!!input.projectId,422,'Choose exactly one issue or project','INVALID_CUSTOMER_NEED');
 if(input.projectId){assert(typeof input.projectId==='string',422,'Invalid project ID','INVALID_CUSTOMER_NEED');const project=repo.get(actor,'projects',input.projectId);repo.access(actor,'projects',project,true);return {issueId:null,projectId:project.id,title:project.name};}
 assert(typeof input.issueId==='string',422,'Invalid issue ID','INVALID_CUSTOMER_NEED');
 const direct=repo.raw('issues',input.issueId);const id=direct?.id??(repo.db.prepare("SELECT id FROM entities WHERE kind='issues' AND workspace_id=? AND deleted_at IS NULL AND json_extract(data,'$.identifier')=?").get(actor.workspaceId,input.issueId) as {id:string}|undefined)?.id;assert(id,404,'Issue not found','NOT_FOUND');const issue=repo.get(actor,'issues',id);repo.access(actor,'issues',issue,true);return {issueId:issue.id,projectId:null,title:issue.title};
}
export function createCustomerNeed(repo:Repository,actor:Actor,input:Record<string,any>){return repo.transaction(()=>{
  repo.access(actor,'requests',undefined,true);
  assert(input&&typeof input==='object'&&!Array.isArray(input),422,'Customer need input is required','INVALID_CUSTOMER_NEED');
  const target=resolveNeedTarget(repo,actor,input);
  let createdAt:Date|undefined;
  if(input.createdAt!=null){
    const now=actor.now??new Date();let value=input.createdAt;
    if(typeof value==='string'){
      const short=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
      if(short)value=`${short[1]}-${short[2]??'01'}-${short[3]??'01'}T00:00:00Z`;
      else value=resolveRelativeTimestamp(value,{now,timeZone:'UTC'})??value;
    }
    assert(isIsoTimestamp(value),422,'Creation time must be an ISO date, timestamp or duration','INVALID_CREATED_AT');
    createdAt=new Date(value);
    assert(createdAt.getTime()<=now.getTime(),422,'Creation time cannot be in the future','INVALID_CREATED_AT');
  }
  assert(input.priority==null||input.priority===0||input.priority===1,422,'Priority must be 0 or 1','INVALID_CUSTOMER_NEED');
  assert(!(input.customerId&&input.customerExternalId),422,'Provide a customer ID or external ID','INVALID_CUSTOMER_NEED');
  let customerId=input.customerId||null;
  if(input.customerExternalId!=null){
    assert(typeof input.customerExternalId==='string'&&input.customerExternalId.trim().length>0,422,'Customer external ID cannot be empty','INVALID_CUSTOMER_NEED');
    repo.access(actor,'customers');
    const customer=repo.all('customers',actor.workspaceId).find(customer=>customer.externalIds?.includes(input.customerExternalId));
    assert(customer,404,'Customer not found','NOT_FOUND');repo.access(actor,'customers',customer);customerId=customer.id;
  }
  if(customerId)repo.get(actor,'customers',customerId);
  const body=inputBody(input);
  assert(!(input.attachmentId&&input.attachmentUrl),422,'Provide an attachment ID or URL','INVALID_CUSTOMER_NEED');
  let attachment:IssueAttachment|ProjectAttachment|undefined;
  if(input.attachmentId){attachment=target.issueId?getIssueAttachment(repo,actor,input.attachmentId):getProjectAttachment(repo,actor,input.attachmentId);assert(('issueId' in attachment?attachment.issueId===target.issueId:attachment.projectId===target.projectId),422,'Attachment belongs to another issue or project','INVALID_CUSTOMER_NEED');}
  if(input.attachmentUrl!=null)assert(validSourceUrl(input.attachmentUrl),422,'Attachment URL must be an HTTP or HTTPS URL','INVALID_CUSTOMER_NEED');
  return repo.create(actor,'requests',{...target,...(input.id?{id:input.id}:{}),commentId:input.commentId??null,customerId,important:input.priority===1,body,...(attachment?{sourceUrl:attachment.url}:input.attachmentUrl?{sourceUrl:input.attachmentUrl}:{})},{createdAt});
});}
