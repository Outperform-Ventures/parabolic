import {finalizeTemplatePlaceholders} from './template-placeholders';
import {teamMembers} from "./team-hierarchy";
import {copyAppliedTemplateAssets} from './template-assets';
import {templateLabelDefaults} from '../shared/template-labels';
import {prepareTemplateUploads} from './template-uploads';
import { assert } from './errors.ts';
import type { Actor, RecordEntity, Repository } from './repository.ts';

const reserved=new Set(['id','workspaceId','createdAt','updatedAt','creatorId','authorId','creatorIdentity','actorIdentity','version','deletedAt','templateId','templateAnswers','parentId','__proto__','constructor','prototype']);
const properties=new Set(['title','priority','dueDate','customerId','labelIds']);
const types=new Set(['text','textarea','select','checkboxes','date','instructions','property','number','checkbox','file']);
const escape=(value:any)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const empty=(value:any)=>value==null||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length);
const hasForm=(template:RecordEntity)=>Array.isArray(template.formFields)&&template.formFields.some((field:any)=>field.type!=='instructions');

export function templateApplies(repo:Repository,template:RecordEntity,teamId?:string,override?:RecordEntity){if(!template.teamId)return true;const seen=new Set<string>();let id=teamId;while(id&&!seen.has(id)){if(id===template.teamId)return true;seen.add(id);const team=override?.id===id?override:repo.raw('teams',id);id=team?.parentId||team?.parentTeamId;}return false;}

export function validateTemplate(repo:Repository,actor:Actor,template:RecordEntity,previous?:RecordEntity){
  if((!template.type||template.type==='issue')&&!template.teamId&&(!previous||previous.teamId!==template.teamId||JSON.stringify(previous.properties)!==JSON.stringify(template.properties))){
    assert(!template.properties?.statusId&&!template.properties?.cycleId,422,'Workspace templates cannot preset a team status or cycle','INVALID_TEMPLATE');
    assert(!(template.properties?.labelIds||[]).some((id:string)=>repo.raw('labels',id,true)?.teamId),422,'Workspace templates cannot preset team labels','INVALID_TEMPLATE');
  }
  if(template.formFields!=null){assert(Array.isArray(template.formFields)&&template.formFields.length<=100,422,'A form may contain at most 100 fields','INVALID_TEMPLATE');const ids=new Set<string>();for(const field of template.formFields){assert(field&&typeof field.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(field.id)&&!ids.has(field.id),422,'Form fields need unique identifiers','INVALID_TEMPLATE');ids.add(field.id);assert(types.has(field.type),422,'Unsupported form field type','INVALID_TEMPLATE');if(field.type==='file')assert(!field.property,422,'File fields cannot set issue properties','INVALID_TEMPLATE');if(field.property)assert(properties.has(field.property),422,'Unsupported form property','INVALID_TEMPLATE');if(field.options){assert(Array.isArray(field.options)&&field.options.length<=1000,422,'Invalid form options','INVALID_TEMPLATE');for(const option of field.options)assert(typeof option==='string'||typeof option==='number'&&Number.isFinite(option)||option&&typeof option==='object'&&!Array.isArray(option)&&typeof option.label==='string'&&['string','number'].includes(typeof(option.value??option.id??option.label)),422,'Form options must have text labels and scalar values','INVALID_TEMPLATE');}if(field.description!=null)assert(typeof field.description==='string',422,'Form field descriptions must be text','INVALID_TEMPLATE');if(field.label!=null)assert(typeof field.label==='string'&&field.label.length<=1000,422,'Form field labels must be text','INVALID_TEMPLATE');}}
  let count=0;const visit=(children:any,depth=0)=>{assert(Array.isArray(children)&&depth<=5,422,'Invalid sub-issue template nesting','INVALID_TEMPLATE');for(const child of children){assert(child&&typeof child==='object'&&!Array.isArray(child),422,'Invalid sub-issue template','INVALID_TEMPLATE');assert(++count<=100,422,'A template may create at most 100 sub-issues','INVALID_TEMPLATE');if(child.subIssues)visit(child.subIssues,depth+1);}};if(template.subIssues)visit(template.subIssues);
  for(const team of repo.all('teams',actor.workspaceId))for(const field of ['defaultTemplateId','nonMemberDefaultTemplateId','defaultProjectTemplateId'])if(team[field]===template.id){assert(templateApplies(repo,template,team.id),422,'Template scope would invalidate a team default','INVALID_TEMPLATE');assert(!template.type||template.type===(field==='defaultProjectTemplateId'?'project':'issue'),422,'Template type would invalidate a team default','INVALID_TEMPLATE');if(field==='defaultTemplateId')assert(!hasForm(template),422,'A team member default cannot use a form template','INVALID_TEMPLATE');}
}

export function validateTeamTemplates(repo:Repository,actor:Actor,team:RecordEntity){
  for(const field of ['defaultTemplateId','nonMemberDefaultTemplateId','defaultProjectTemplateId'])if(team[field]){const template=repo.get({...actor,scopes:[...actor.scopes,'read']},'templates',team[field]);const expected=field==='defaultProjectTemplateId'?'project':'issue';assert(!template.type||template.type===expected,422,`Team default must use a ${expected} template`,'INVALID_TEMPLATE');assert(templateApplies(repo,template,team.id,team),422,'Template belongs to a different team hierarchy','INVALID_TEMPLATE');if(field==='defaultTemplateId')assert(!hasForm(template),422,'A team member default cannot use a form template','INVALID_TEMPLATE');}
}

export function prepareIssueTemplate(repo:Repository,actor:Actor,issue:RecordEntity,fields:Record<string,any>):RecordEntity|null {
  if(!Object.hasOwn(fields,'templateId')&&issue.teamId){const team=repo.raw('teams',issue.teamId);const member=!!team&&teamMembers(repo,team).includes(actor.userId);issue.templateId=(member?team?.defaultTemplateId:team?.nonMemberDefaultTemplateId)||null;}
  if(!issue.templateId)return null;
  const template=repo.get({...actor,scopes:[...actor.scopes,'read']},'templates',issue.templateId);assert(!template.type||template.type==='issue',422,'Template is not an issue template','INVALID_TEMPLATE');
  if(!issue.teamId&&template.teamId)issue.teamId=template.teamId;
  assert(templateApplies(repo,template,issue.teamId||template.properties?.teamId),422,'Template belongs to a different team hierarchy','INVALID_TEMPLATE');
  assert(!(issue.parentId&&template.subIssues?.length),422,'Sub-issue templates cannot create additional sub-issues','INVALID_TEMPLATE');
  const defaults={...(template.properties||(Array.isArray(template.fields)?{}:template.fields)||{}),...(template.title?{title:template.title}:{}),...(template.description?{description:template.description}:{})};
  for(const[key,value]of Object.entries(templateLabelDefaults(defaults,id=>repo.raw('labels',id,true))))if(!reserved.has(key)&&!Object.hasOwn(fields,key))issue[key]=structuredClone(value);
  // Parent-team templates retain workflow categories when inherited by a child.
  // Explicit statuses unrelated to the template still pass through validation.
  if(issue.statusId&&issue.statusId===defaults.statusId){const original=repo.raw('statuses',issue.statusId);if(original&&original.teamId!==issue.teamId){const options=repo.all('statuses',actor.workspaceId).filter(status=>status.teamId===issue.teamId&&status.type===original.type).sort((a,b)=>(a.position||0)-(b.position||0));issue.statusId=options.find(status=>status.name===original.name)?.id||options[0]?.id;}}
  if(issue.cycleId&&issue.cycleId===defaults.cycleId&&repo.raw('cycles',issue.cycleId)?.teamId!==issue.teamId)issue.cycleId=null;
  const answers=issue.templateAnswers??{};assert(answers&&typeof answers==='object'&&!Array.isArray(answers),422,'Template answers must be an object','INVALID_TEMPLATE_ANSWERS');assert(JSON.stringify(answers).length<=100_000,422,'Template answers are too large','INVALID_TEMPLATE_ANSWERS');
  const sections:string[]=[];
  for(const field of template.formFields||[]){if(field.type==='instructions'){sections.push(String(field.content||field.description||field.label||''));continue;}let value=Object.hasOwn(answers,field.id)?answers[field.id]:field.property?issue[field.property]:undefined;if(field.property==='labelIds'&&field.group&&Array.isArray(value))value=value.filter(id=>repo.raw('labels',id,true)?.group===field.group);if(field.required)assert(!empty(value)&&(field.type!=='checkbox'||value===true),422,`${field.label||field.id} is required`,'REQUIRED_TEMPLATE_FIELD',{fieldId:field.id});if(empty(value))continue;
    if(field.type==='file'){assert(!field.property,422,'File fields cannot set issue properties','INVALID_TEMPLATE');sections.push(prepareTemplateUploads(repo,actor,issue,field,value));continue;}
    if(field.type==='checkboxes'||field.property==='labelIds')assert(Array.isArray(value)&&value.length<=1000,422,`${field.label||field.id} requires a list`,'INVALID_TEMPLATE_ANSWERS');
    if(['text','textarea'].includes(field.type)&&!field.property)assert(typeof value==='string',422,`${field.label||field.id} requires text`,'INVALID_TEMPLATE_ANSWERS');
    if(field.type==='checkbox')assert(typeof value==='boolean',422,'Checkbox answer must be true or false','INVALID_TEMPLATE_ANSWERS');
    if(field.type==='number')assert(typeof value==='number'&&Number.isFinite(value),422,'Numeric answer is invalid','INVALID_TEMPLATE_ANSWERS');
    if(field.type==='date'||field.property==='dueDate')assert(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,422,'Date answer is invalid','INVALID_TEMPLATE_ANSWERS');
    if(field.options?.length&&['select','checkboxes'].includes(field.type)){const allowed=field.options.map((option:any)=>typeof option==='object'?option.value??option.id??option.label:option);assert((Array.isArray(value)?value:[value]).every(v=>allowed.includes(v)),422,`${field.label||field.id} contains an unavailable option`,'INVALID_TEMPLATE_ANSWERS');}
    if(field.property){assert(properties.has(field.property),422,'Unsupported form property','INVALID_TEMPLATE');if(field.property==='labelIds'&&field.group){for(const id of value)assert(repo.raw('labels',id)?.group===field.group,422,'Selected label belongs to another group','INVALID_TEMPLATE_ANSWERS');issue.labelIds=[...(issue.labelIds||[]).filter((id:string)=>repo.raw('labels',id)?.group!==field.group),...value];}else issue[field.property]=structuredClone(value);if(field.property==='priority')issue.priority=Number(value);}
    else sections.push(`<p><strong>${escape(field.label||field.id)}</strong></p><p>${escape(Array.isArray(value)?value.join(', '):value).replace(/\n/g,'<br>')}</p>`);
  }
  const interpolate=(text:string,html=false)=>text.replace(/\{\{([A-Za-z0-9_-]+)\}\}/g,(_match,key)=>{const value=answers[key];return html?escape(Array.isArray(value)?value.join(', '):value):String(Array.isArray(value)?value.join(', '):value??'');});
  if(typeof issue.title==='string')issue.title=interpolate(issue.title);
  issue.description=copyAppliedTemplateAssets(repo,actor,template,finalizeTemplatePlaceholders(interpolate(String(issue.description||''),true),String(defaults.description||''))+sections.join(''));
  return template;
}

export function createTemplateChildren(repo:Repository,actor:Actor,issue:RecordEntity,template:RecordEntity){
  let count=0;const answers=issue.templateAnswers||{};
  const visit=(children:any[],parent:RecordEntity,depth=0)=>{assert(depth<=5,422,'Sub-issue nesting exceeds the template limit','INVALID_TEMPLATE');for(const child of children){assert(++count<=100,422,'A template may create at most 100 sub-issues','INVALID_TEMPLATE');const fields={...(child.properties||{}),...child};delete fields.subIssues;delete fields.properties;for(const key of reserved)delete fields[key];for(const field of ['title','description'])if(typeof fields[field]==='string')fields[field]=fields[field].replace(/\{\{([A-Za-z0-9_-]+)\}\}/g,(_match:string,key:string)=>field==='description'?escape(answers[key]):String(answers[key]??''));if(typeof fields.description==='string')fields.description=copyAppliedTemplateAssets(repo,actor,template,fields.description);const created=repo.create(actor,'issues',{teamId:parent.teamId,projectId:parent.projectId||null,...templateLabelDefaults(fields,id=>repo.raw('labels',id,true)),parentId:parent.id,templateId:null});if(child.subIssues?.length)visit(child.subIssues,created,depth+1);}};
  visit(template.subIssues||[],issue);
}
