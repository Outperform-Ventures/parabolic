import {projectPublishedAssetUrls,publishedTemplateAsset} from './template-assets';
import {askPageTemplates,askDestination,submitAskPage} from './asks-pages';
import type {AsksRequester} from './asks-auth';
import type {Actor,RecordEntity,Repository} from './repository';
import {assert} from './errors';
import {templateApplies} from './templates';
import {randomUUID} from 'node:crypto';
import {sanitizeEditorContent} from './content';

// Only these functions use a service actor, after requester-session resolution.
// It is never returned or accepted by workspace authentication.
const serviceReader=(requester:AsksRequester):Actor=>({userId:requester.id,workspaceId:requester.workspaceId,role:'member',scopes:['read'],system:true,requesterIntake:true});
function published(repo:Repository,requester:AsksRequester){const actor=serviceReader(requester);return repo.all('asksPages',requester.workspaceId).filter(page=>page.enabled!==false&&!page.archivedAt).sort((a,b)=>(a.position??0)-(b.position??0)||a.name.localeCompare(b.name)).map(page=>({page,templates:askPageTemplates(repo,actor,page)})).filter(row=>row.templates.length)}
function choices(repo:Repository,requester:AsksRequester,template:RecordEntity,page:RecordEntity,field:any){
 if(field.property==='customerId')return repo.all('customers',requester.workspaceId).filter(c=>!c.archivedAt).map(c=>({value:c.id,label:c.name}));
 if(field.property==='labelIds')return repo.all('labels',requester.workspaceId).filter(label=>!label.archivedAt&&(label.entityType||'issues')==='issues'&&label.group===field.group&&templateApplies(repo,{...template,teamId:label.teamId},askDestination(template,page))).map(label=>({value:label.id,label:label.name}));
 if(field.property==='priority')return ['No priority','Urgent','High','Medium','Low'].map((label,value)=>({value,label}));
 return (field.options||[]).map((option:any)=>typeof option==='object'?{value:option.value??option.id??option.label,label:option.label}:{value:option,label:option});
}
function projectedForm(repo:Repository,requester:AsksRequester,template:RecordEntity,page:RecordEntity){
 const fields=(template.formFields||[]).map((field:any)=>({id:field.id,type:field.type,label:field.label||'',...(field.description?{description:field.description}:{}),required:!!field.required,...(field.property?{property:field.property}:{}),...(field.type==='instructions'?{content:projectPublishedAssetUrls(repo,template,page.slug,field.content||field.description||field.label||'')}:{}),...(['select','checkboxes'].includes(field.type)||['customerId','labelIds','priority'].includes(field.property)?{options:choices(repo,requester,template,page,field)}:{})}));
 const defaults:Record<string,any>={title:template.title??template.properties?.title??'',description:projectPublishedAssetUrls(repo,template,page.slug,template.description??template.properties?.description??'')};
 for(const field of fields)if(field.property&&Object.hasOwn(template.properties||{},field.property)){const value=template.properties[field.property];if(field.options){if(field.property==='labelIds')defaults[field.property]=(value||[]).filter((id:string)=>field.options.some((option:any)=>option.value===id));else if(field.options.some((option:any)=>String(option.value)===String(value)))defaults[field.property]=value}else defaults[field.property]=value}
 return{id:template.id,name:template.name,fields,defaults};
}
export function requesterForms(repo:Repository,requester:AsksRequester){return{pages:published(repo,requester).map(({page,templates})=>({id:page.id,name:page.name,description:page.description||'',slug:page.slug,forms:templates.map(template=>projectedForm(repo,requester,template,page))}))}}
export function requesterPublishedAsset(repo:Repository,requester:AsksRequester,slug:string,templateId:string,id:string){
 const template=published(repo,requester).find(row=>row.page.slug===slug)?.templates.find(template=>template.id===templateId),file=template&&publishedTemplateAsset(repo,template,id);
 assert(file,404,'Template file is unavailable','NOT_FOUND');return file;
}
export function validateRequesterUpload(repo:Repository,requester:AsksRequester,slug:string,templateId:string,fieldId:string){
 const publication=published(repo,requester).find(row=>row.page.slug===slug),template=publication?.templates.find(template=>template.id===templateId);
 assert(template&&(fieldId==='__description'||template.formFields?.some((field:any)=>field.id===fieldId&&field.type==='file')),404,'Upload field is unavailable','NOT_FOUND');
}
function requesterDescription(repo:Repository,requester:AsksRequester,template:RecordEntity,html:string,copy:boolean){
 const clean=sanitizeEditorContent(html).replace(/(src|href)="(?:https?:\/\/[^/"\s]+)?\/asks-api\/([A-Za-z0-9_-]+)\/template-assets\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)(?:[?#][^"]*)?"/g,(_match,attribute,wid,tid,id)=>{
  assert(wid===requester.workspaceId&&tid===template.id&&publishedTemplateAsset(repo,template,id),422,'A template attachment is unavailable','INVALID_TEMPLATE_ATTACHMENT');return attribute+'="/api/v1/attachments/'+id+'"';
 });
 const copies=new Map<string,string>();
 return clean.replace(/(src|href)="((?:https?:\/\/[^/"\s]+)?\/(?:asks-api\/([A-Za-z0-9_-]+)\/files|api\/v1\/attachments)\/([A-Za-z0-9_-]+)(?:[?#][^"]*)?)"/g,(match,attribute,url,workspaceId,id)=>{
  assert(!workspaceId||workspaceId===requester.workspaceId,422,'An uploaded file is unavailable','INVALID_TEMPLATE_ATTACHMENT');
  const file=repo.db.prepare('SELECT * FROM attachments WHERE id=? AND workspace_id=?').get(id,requester.workspaceId) as any;
  const templateFile=!workspaceId&&!!publishedTemplateAsset(repo,template,id);
  assert(file&&(file.creator_id===requester.id||templateFile),422,'An uploaded file is unavailable','INVALID_TEMPLATE_ATTACHMENT');
  if(templateFile&&file.creator_id!==requester.id)return match;
  let target=copies.get(id)||id;
  if(copy&&file.entity_id&&!copies.has(id)){target=randomUUID();repo.db.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)').run(target,requester.workspaceId,requester.id,file.filename,file.mime_type,file.size,null,null,file.content,new Date().toISOString());copies.set(id,target)}
  return attribute+'="/api/v1/attachments/'+target+'"';
 });
}
export function submitRequesterForm(repo:Repository,requester:AsksRequester,slug:string,input:any){
 assert(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(key=>['templateId','submissionKey','title','description','templateAnswers'].includes(key)),422,'Provide only request form fields','INVALID_ASK_REQUEST');
 const publication=published(repo,requester).find(row=>row.page.slug===slug),template=publication?.templates.find(template=>template.id===input.templateId);assert(publication&&template,404,'Form is unavailable','NOT_FOUND');
 const answers=input.templateAnswers??{},form=projectedForm(repo,requester,template,publication.page);assert(answers&&typeof answers==='object'&&!Array.isArray(answers)&&Object.keys(answers).every(id=>form.fields.some((field:any)=>field.id===id&&field.type!=='instructions')),422,'An answer refers to an unavailable field','INVALID_TEMPLATE_ANSWERS');
 for(const field of form.fields){const value=answers[field.id];if(value==null||value==='')continue;
  if(['customerId','labelIds','priority'].includes(field.property)){const selected=field.property==='labelIds'?value:[value];assert(Array.isArray(selected)&&selected.every((id:any)=>field.options.some((option:any)=>String(option.value)===String(id))),422,'An answer contains an unavailable choice','INVALID_TEMPLATE_ANSWERS')}
  if(field.type==='file'){assert(Array.isArray(value)&&value.every((id:any)=>typeof id==='string'),422,'Provide uploaded files','INVALID_TEMPLATE_ANSWERS');for(const id of value){const file=repo.db.prepare('SELECT creator_id FROM attachments WHERE id=? AND workspace_id=?').get(id,requester.workspaceId) as any;assert(file?.creator_id===requester.id,422,'An uploaded file is unavailable','INVALID_TEMPLATE_ATTACHMENT')}}
 }
 if(typeof input.description==='string')requesterDescription(repo,requester,template,input.description,false);
 return submitAskPage(repo,{...serviceReader(requester),scopes:['read','write']},slug,input,{email:requester.email,name:requester.name},fields=>{if(typeof fields.description==='string')fields.description=requesterDescription(repo,requester,template,fields.description,true)});
}
