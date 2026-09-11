import {createHash} from 'node:crypto';
import {assert} from './errors';
import type {Actor,RecordEntity,Repository} from './repository';
import {templateApplies} from './templates';

export function askDestination(template:RecordEntity,page:RecordEntity){return page.teamId||template.properties?.teamId||template.teamId}
export function askPageTemplates(repo:Repository,actor:Actor,page:RecordEntity){
 return (Array.isArray(page.templateIds)?page.templateIds:[]).flatMap((id:string)=>{const template=repo.raw('templates',id),team=template&&repo.raw('teams',askDestination(template,page));return template&&!template.archivedAt&&(!template.type||template.type==='issue')&&team&&!team.archivedAt&&repo.canRead(actor,'templates',template)&&repo.canRead(actor,'teams',team)&&templateApplies(repo,template,team.id)?[template]:[]});
}
export function validateAskPage(repo:Repository,actor:Actor,page:RecordEntity){
 assert(typeof page.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)&&page.slug.length<=80,422,'Use a URL with lowercase letters, numbers and hyphens','INVALID_ASKS_PAGE');
 assert(!repo.all('asksPages',actor.workspaceId,true).some(p=>p.id!==page.id&&p.slug===page.slug),409,'This Asks page URL is already used','ASKS_URL_EXISTS');
 assert(Array.isArray(page.templateIds)&&page.templateIds.length<=100&&page.templateIds.every((id:any)=>typeof id==='string')&&new Set(page.templateIds).size===page.templateIds.length,422,'Choose up to 100 distinct templates','INVALID_ASKS_PAGE');
 if(page.emailReplyFormat!=null)assert(typeof page.emailReplyFormat==='string'&&page.emailReplyFormat.length<=10000&&(!page.emailReplyFormat||page.emailReplyFormat.includes('{reply}')),422,'Email reply format must include {reply} and be at most 10,000 characters','INVALID_EMAIL_FORMAT');
 if(page.enabled===undefined)page.enabled=true;assert(typeof page.enabled==='boolean',422,'Enabled must be a boolean','INVALID_ASKS_PAGE');
 if(page.position!==undefined)assert(typeof page.position==='number'&&Number.isFinite(page.position),422,'Invalid page position','INVALID_ASKS_PAGE');
 const reader={...actor,scopes:[...actor.scopes,'read']};assert(askPageTemplates(repo,reader,page).length===page.templateIds.length,422,'Each form needs an accessible issue template and destination team','INVALID_ASKS_TEMPLATE');
}
export function asksSite(repo:Repository,actor:Actor){
 repo.access(actor,'asksPages');
 return repo.all('asksPages',actor.workspaceId).filter(p=>p.enabled!==false&&!p.archivedAt&&repo.canRead(actor,'asksPages',p)).sort((a,b)=>(a.position??0)-(b.position??0)||a.name.localeCompare(b.name)).flatMap(page=>{
  const templates=askPageTemplates(repo,actor,page);if(!templates.length)return [];
  return [{id:page.id,name:page.name,description:page.description||'',slug:page.slug,templates:templates.map(template=>({id:template.id,name:template.name,teamId:askDestination(template,page)}))}];
 });
}
export function submitAskPage(repo:Repository,actor:Actor,slug:string,input:any,requester?:{email:string;name:string},prepareFields?:(fields:Record<string,any>)=>void){
 assert(input&&typeof input==='object'&&!Array.isArray(input),422,'Provide a request','INVALID_ASK_REQUEST');
 const page=repo.all('asksPages',actor.workspaceId).find(p=>p.slug===slug&&p.enabled!==false&&!p.archivedAt&&repo.canRead(actor,'asksPages',p));assert(page,404,'Asks page is unavailable','NOT_FOUND');
 const template=askPageTemplates(repo,actor,page).find(t=>t.id===input.templateId);assert(template,404,'Form is unavailable','NOT_FOUND');
 assert(typeof input.submissionKey==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(input.submissionKey),422,'A submission identifier is required','INVALID_SUBMISSION_KEY');
 const fields:Record<string,any>={};for(const field of ['title','description','templateAnswers'])if(Object.hasOwn(input,field))fields[field]=input[field];
 if(fields.title!==undefined)assert(typeof fields.title==='string'&&fields.title.trim().length>0&&fields.title.length<=1000,422,'A title is required','INVALID_ASK_REQUEST');
 if(fields.description!==undefined)assert(typeof fields.description==='string'&&fields.description.length<=100000,422,'Description is too long','INVALID_ASK_REQUEST');
 const hash=createHash('sha256').update(JSON.stringify({pageId:page.id,templateId:template.id,fields})).digest('hex');
 return repo.transaction(()=>{
  const existing=repo.db.prepare("SELECT data FROM entities WHERE workspace_id=? AND kind='requests' AND json_extract(data,'$.requesterId')=? AND json_extract(data,'$.submissionKey')=? LIMIT 1").get(actor.workspaceId,actor.userId,input.submissionKey) as {data:string}|undefined;
  if(existing){const request=JSON.parse(existing.data);assert(!request.deletedAt&&request.submissionHash===hash,409,'This submission identifier was already used','SUBMISSION_CONFLICT');const issue=repo.get(actor,'issues',request.issueId);return{id:request.id,issueId:issue.id,identifier:issue.identifier,status:'received',replayed:true};}
  const teamId=askDestination(template,page),triage=repo.all('statuses',actor.workspaceId).find(s=>s.teamId===teamId&&s.type==='triage');
  prepareFields?.(fields);
  const issue=repo.create(actor,'issues',{...fields,teamId,templateId:template.id,...(triage?{statusId:triage.id}:{})});
  const request=repo.create(actor,'requests',{title:issue.title,body:issue.description,requesterId:actor.userId,requesterEmail:requester?.email??repo.raw('users',actor.userId)?.email,...(requester?{requesterName:requester.name}:{}),issueId:issue.id,status:'open',asksPageId:page.id,templateId:template.id,answers:issue.templateAnswers||{},submissionKey:input.submissionKey,submissionHash:hash});
  return{id:request.id,issueId:issue.id,identifier:issue.identifier,status:'received',replayed:false};
 });
}
