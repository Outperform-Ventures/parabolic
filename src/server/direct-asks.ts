import{createHash}from'node:crypto';
import{assert}from'./errors';
import type{Actor,RecordEntity,Repository}from'./repository';
const types=new Set(['text','textarea','select','checkbox','date','number','email']);
const escape=(value:any)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const optionValue=(option:any)=>typeof option==='object'?option.value:option;
export function validateAskForm(form:RecordEntity){
 if(form.enabled===undefined)form.enabled=true;assert(typeof form.enabled==='boolean',422,'Enabled must be a boolean','INVALID_ASK_FORM');
 assert(form.fields===undefined||Array.isArray(form.fields)&&form.fields.length<=100,422,'A request form may contain up to 100 fields','INVALID_ASK_FORM');
 const ids=new Set<string>();form.fields=(form.fields||[]).map((field:any)=>{
  assert(field&&typeof field==='object'&&!Array.isArray(field),422,'Invalid request field','INVALID_ASK_FORM');const id=field.id??field.name,type=field.type??'text';
  assert(typeof id==='string'&&id.length>0&&id.length<=100&&!['__proto__','constructor','prototype'].includes(id)&&!ids.has(id),422,'Fields need distinct identifiers','INVALID_ASK_FORM');ids.add(id);
  assert(types.has(type)&&typeof field.label==='string'&&field.label.trim().length>0&&field.label.length<=500,422,'Choose a valid field type and label','INVALID_ASK_FORM');
  assert(field.required===undefined||typeof field.required==='boolean',422,'Required must be a boolean','INVALID_ASK_FORM');
  if(type==='select'){assert(Array.isArray(field.options)&&field.options.length>0&&field.options.length<=1000,422,'Dropdowns need valid options','INVALID_ASK_FORM');const seen=new Set<string>();for(const option of field.options){assert(typeof option==='string'||option&&typeof option==='object'&&!Array.isArray(option)&&typeof option.label==='string'&&(typeof option.value==='string'||typeof option.value==='number'&&Number.isFinite(option.value)),422,'Invalid dropdown option','INVALID_ASK_FORM');const value=optionValue(option);assert(String(value).length>0&&!seen.has(String(value)),422,'Dropdown values must be distinct and non-empty','INVALID_ASK_FORM');seen.add(String(value));}}
  return{...field,id,type};
 });
}
export function directAskContext(repo:Repository,actor:Actor,id:string):{actor:Actor;form:RecordEntity}{
 const form=repo.raw('asksForms',id);assert(form&&form.enabled!==false&&!form.archivedAt,404,'Form is unavailable','NOT_FOUND');
 // Browser users can follow a direct link to another workspace they belong to;
 // scoped API credentials cannot acquire another workspace through that link.
 const reader:Actor=actor.sessionHash&&actor.workspaceId!==form.workspaceId?{...actor,workspaceId:form.workspaceId,role:repo.role(actor.userId,form.workspaceId),recordCache:new Map(),permissionCache:new Map()}:actor;
 repo.access(reader,'asksForms',form);const team=repo.get(reader,'teams',form.teamId);assert(!team.archivedAt,404,'Form is unavailable','NOT_FOUND');return{actor:reader,form:{...form,fields:(form.fields||[]).map((field:any)=>({...field,id:field.id??field.name,type:field.type??'text'}))}};
}
export function validateAskAnswers(form:RecordEntity,raw:any){
 assert(raw===undefined||raw&&typeof raw==='object'&&!Array.isArray(raw),422,'Answers must be an object','INVALID_ASK_ANSWERS');const answers=raw??{};assert(JSON.stringify(answers).length<=100000,422,'Answers are too large','INVALID_ASK_ANSWERS');const fields=form.fields||[];assert(Object.keys(answers).every(id=>fields.some((field:any)=>(field.id??field.name)===id)),422,'An answer refers to an unknown field','INVALID_ASK_ANSWERS');
 for(const field of fields){const id=field.id??field.name,value=answers[id],type=field.type??'text',empty=value===undefined||value===null||typeof value==='string'&&!value.trim();if(field.required)assert(!empty&&(type!=='checkbox'||value===true),422,`${field.label} is required`,'REQUIRED_ASK_FIELD',{fieldId:id});if(empty)continue;
  if(type==='checkbox')assert(typeof value==='boolean',422,`${field.label} must be true or false`,'INVALID_ASK_ANSWERS');
  else if(type==='number')assert(typeof value==='number'&&Number.isFinite(value),422,`${field.label} must be a number`,'INVALID_ASK_ANSWERS');
  else if(type==='select')assert(field.options?.some((option:any)=>optionValue(option)===value),422,`${field.label} contains an unavailable option`,'INVALID_ASK_ANSWERS');
  else {assert(typeof value==='string'&&value.length<=100000,422,`${field.label} must be text`,'INVALID_ASK_ANSWERS');if(type==='email')assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),422,`${field.label} must be an email address`,'INVALID_ASK_ANSWERS');if(type==='date')assert(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,422,`${field.label} must be a valid date`,'INVALID_ASK_ANSWERS');}
 }
 return answers;
}
export function submitDirectAsk(repo:Repository,actor:Actor,form:RecordEntity,fields:any){
 assert(fields&&typeof fields==='object'&&!Array.isArray(fields),422,'Provide request fields','INVALID_ASK_REQUEST');assert(typeof fields.title==='string'&&fields.title.trim()&&fields.title.length<=1000,422,'Request title is required','INVALID_ASK_REQUEST');const body=fields.body??fields.description??'';assert(typeof body==='string'&&body.length<=100000,422,'Description must be text','INVALID_ASK_REQUEST');const answers=validateAskAnswers(form,fields.answers),key=fields.submissionKey;assert(key===undefined||typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key),422,'Invalid submission identifier','INVALID_SUBMISSION_KEY');const hash=createHash('sha256').update(JSON.stringify({formId:form.id,title:fields.title,body,answers})).digest('hex');
 return repo.transaction(()=>{
  if(key){const row=repo.db.prepare("SELECT data FROM entities WHERE kind='requests' AND workspace_id=? AND json_extract(data,'$.requesterId')=? AND json_extract(data,'$.formId')=? AND json_extract(data,'$.submissionKey')=? LIMIT 1").get(actor.workspaceId,actor.userId,form.id,key) as {data:string}|undefined;if(row){const request=JSON.parse(row.data);assert(!request.deletedAt&&request.submissionHash===hash,409,'This submission identifier was already used','SUBMISSION_CONFLICT');const issue=repo.get(actor,'issues',request.issueId);return{id:request.id,identifier:issue.identifier,status:'received',replayed:true};}}
  const defaults:Record<string,any>={};for(const key of ['priority','assigneeId','projectId','cycleId','milestoneId','labelIds','estimate','dueDate','customerId'])if(Object.hasOwn(form.properties??{},key))defaults[key]=form.properties[key];
  const status=repo.all('statuses',actor.workspaceId).find(s=>s.teamId===form.teamId&&s.type==='triage');const sections=(form.fields||[]).flatMap((field:any)=>{const value=answers[field.id??field.name];if(value===undefined||value===null||value==='')return[];const label=field.type==='select'?field.options.find((o:any)=>optionValue(o)===value):null;const rendered=label&&typeof label==='object'?label.label:typeof value==='boolean'?(value?'Yes':'No'):value;return [`<p><strong>${escape(field.label)}</strong></p><p>${escape(rendered).replace(/\n/g,'<br>')}</p>`]});
  const issue=repo.create(actor,'issues',{...defaults,title:fields.title,description:body+sections.join(''),teamId:form.teamId,statusId:status?.id,templateId:null});
  const request=repo.create(actor,'requests',{title:fields.title,body,requesterId:actor.userId,requesterEmail:repo.raw('users',actor.userId)?.email,issueId:issue.id,status:'open',formId:form.id,answers,...(key?{submissionKey:key,submissionHash:hash}:{})});return{id:request.id,identifier:issue.identifier,status:'received',replayed:false};
 });
}
