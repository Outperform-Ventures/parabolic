import {copyAppliedTemplateAssets} from './template-assets';
import {templateLabelDefaults} from '../shared/template-labels';
import { randomUUID } from 'node:crypto';
import { assert } from './errors.ts';
import type { Actor, RecordEntity, Repository } from './repository.ts';
import { templateApplies } from './templates.ts';

const reserved=new Set(['id','workspaceId','createdAt','updatedAt','creatorId','authorId','creatorIdentity','actorIdentity','version','deletedAt','templateId','projectId','parentId','__proto__','constructor','prototype']);
function fields(value:any){return Object.fromEntries(Object.entries(value||{}).filter(([key])=>!reserved.has(key)));}
function offsetDate(base:string,offset:any){assert(typeof offset==='number'&&Number.isInteger(offset)&&Math.abs(offset)<=36500,422,'Relative dates require a whole number of days','INVALID_TEMPLATE');const date=new Date(`${base.slice(0,10)}T12:00:00Z`);assert(Number.isFinite(date.getTime()),422,'Project start date is invalid','INVALID_TEMPLATE');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}

export function validateProjectPlan(template:RecordEntity){
  for(const key of ['dependencyIds','blockingProjectIds'])if(template.properties?.[key]!=null)assert(Array.isArray(template.properties[key])&&template.properties[key].every((id:any)=>typeof id==='string')&&new Set(template.properties[key]).size===template.properties[key].length,422,'Project dependencies must be unique project identifiers','INVALID_TEMPLATE');
  const plan=template.projectPlan;if(!plan)return;assert(plan&&typeof plan==='object'&&!Array.isArray(plan),422,'Project plan must be an object','INVALID_TEMPLATE');
  for(const key of ['milestones','issues','documents'])if(plan[key]){assert(Array.isArray(plan[key])&&plan[key].length<=500,422,'A project template may contain at most 500 entries per collection','INVALID_TEMPLATE');const ids=new Set<string>();for(const value of plan[key]){assert(value&&typeof value==='object'&&!Array.isArray(value),422,'Invalid project plan entry','INVALID_TEMPLATE');if(value.id){assert(typeof value.id==='string'&&!ids.has(value.id),422,'Project plan entry identifiers must be unique','INVALID_TEMPLATE');ids.add(value.id);}}}
  if(plan.durationDays!=null){assert(plan.durationDays>=0,422,'Project duration cannot be negative','INVALID_TEMPLATE');offsetDate('2026-01-01',plan.durationDays);}
  for(const milestone of plan.milestones||[])if(milestone.targetOffsetDays!=null)offsetDate('2026-01-01',milestone.targetOffsetDays);
  for(const issue of plan.issues||[])if(issue.dueOffsetDays!=null)offsetDate('2026-01-01',issue.dueOffsetDays);
}

export function prepareProjectTemplate(repo:Repository,actor:Actor,project:RecordEntity,provided:Record<string,any>){
  const teamId=project.teamId||project.teamIds?.[0];if(!Object.hasOwn(provided,'templateId')&&teamId){const candidate=repo.raw('templates',repo.raw('teams',teamId)?.defaultProjectTemplateId);project.templateId=candidate&&!candidate.archivedAt&&candidate.type==='project'?candidate.id:null;}
  if(!project.templateId)return null;const template=repo.get({...actor,scopes:[...actor.scopes,'read']},'templates',project.templateId);assert((!template.type||template.type==='project')&&!template.archivedAt,422,'Template is not an available project template','INVALID_TEMPLATE');
  assert(templateApplies(repo,template,teamId||template.properties?.teamId||template.properties?.teamIds?.[0]),422,'Template belongs to a different team hierarchy','INVALID_TEMPLATE');
  for(const[key,value]of Object.entries({...templateLabelDefaults(fields(template.properties),id=>repo.raw('labels',id,true)),...(template.title?{name:template.title}:{}),...(template.description?{description:template.description}:{})}))if(!Object.hasOwn(provided,key))project[key]=structuredClone(value);
  delete project.blockingProjectIds;
  if(typeof project.description==='string')project.description=copyAppliedTemplateAssets(repo,actor,template,project.description);
  const base=String(project.startDate||project.createdAt).slice(0,10);if(template.projectPlan?.durationDays!=null&&!project.targetDate)project.targetDate=offsetDate(base,template.projectPlan.durationDays);return template;
}

export function createProjectPlan(repo:Repository,actor:Actor,project:RecordEntity,template:RecordEntity){
  const plan=template.projectPlan||{};validateProjectPlan(template);const base=String(project.startDate||project.createdAt).slice(0,10),milestones=new Map<string,string>(),issues=new Map<string,string>();
  for(const milestone of plan.milestones||[]){const values=fields(milestone);delete values.targetOffsetDays;const created=repo.create(actor,'milestones',{...values,projectId:project.id,...(milestone.targetOffsetDays!=null?{targetDate:offsetDate(base,milestone.targetOffsetDays)}:{})});if(milestone.id)milestones.set(milestone.id,created.id);}
  for(const issue of plan.issues||[])if(issue.id)issues.set(issue.id,randomUUID());
  const defaultTeam=project.teamId||project.teamIds?.[0]||repo.all('teams',actor.workspaceId).find(team=>repo.canRead(actor,'teams',team))?.id;
  const created:{source:any;entity:RecordEntity}[]=[];
  for(const source of plan.issues||[]){const values=fields(source);if(typeof values.description==='string')values.description=copyAppliedTemplateAssets(repo,actor,template,values.description);delete values.milestoneKey;delete values.parentKey;delete values.dueOffsetDays;if(source.milestoneKey)assert(milestones.has(source.milestoneKey),422,'Project issue references an unknown template milestone','INVALID_TEMPLATE');const entity=repo.create(actor,'issues',{...templateLabelDefaults(values,id=>repo.raw('labels',id,true)),id:source.id?issues.get(source.id):randomUUID(),teamId:source.teamId||defaultTeam,projectId:project.id,templateId:source.templateId||null,...(source.milestoneKey?{milestoneId:milestones.get(source.milestoneKey)}:{}),...(source.dueOffsetDays!=null?{dueDate:offsetDate(base,source.dueOffsetDays)}:{})});created.push({source,entity});}
  for(const {source,entity} of created)if(source.parentKey){assert(issues.has(source.parentKey),422,'Project issue references an unknown template parent','INVALID_TEMPLATE');repo.update(actor,'issues',entity.id,{parentId:issues.get(source.parentKey)});}
  for(const targetId of template.properties?.blockingProjectIds||[]){const target=repo.get(actor,'projects',targetId);repo.update(actor,'projects',target.id,{dependencyIds:[...new Set([...(target.dependencyIds||[]),project.id])]});}
  for(const document of plan.documents||[]){const values=fields(document);for(const key of ['description','content','body'])if(typeof values[key]==='string')values[key]=copyAppliedTemplateAssets(repo,actor,template,values[key]);repo.create(actor,'documents',{...values,projectId:project.id});}
}
