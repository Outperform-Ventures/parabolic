import {missingInsightDimension} from './insight-dimensions';
import {projectLabelIndex} from '../../shared/project-label-filter';
import type {Entity} from '../../shared/types';
import type {InsightDatum,InsightSource,InsightConfig} from './insight-data';
type Entry={key:string;label:string;entityId?:string;empty?:boolean;unknown?:boolean};
/** Stable entity keys are independent of presentation. Only native name-folded dimensions fold names. */
export function normalizeInsightNames(rows:InsightDatum[],source:InsightSource,config:InsightConfig,projectLabels=projectLabelIndex(source.projects,source.labels)){
 const {group,segment}=config;
 const groupLabels:Record<string,string>={},segmentLabels:Record<string,string>={},entityRefs:Record<string,string>={},emptyKeys=new Set<string>(),unknownKeys=new Set<string>();
 const entity=(field:string,id:string|undefined,records:Entity[],fallback:string):Entry=>id?{key:JSON.stringify(['entity',field,id]),label:records.find(record=>record.id===id)?.name||records.find(record=>record.id===id)?.title||fallback,entityId:id}:{key:JSON.stringify(['empty',field]),label:fallback,empty:true};
 const references=(field:string,row:InsightDatum,names:string[],slot:'group'|'segment'):Entry[]|undefined=>{
  const issue=row.issue,first=names[0],single:Record<string,[string|undefined,Entity[]]>={Assignee:[issue.assigneeId,source.users],Creator:[issue.creatorId||issue.createdBy,source.users],Team:[issue.teamId,source.teams],Project:[issue.projectId,source.projects],Cycle:[issue.cycleId,source.cycles],Milestone:[issue.milestoneId,source.milestones??[]],Template:[issue.templateId||issue.lastAppliedTemplateId,source.templates??[]]};
  if(single[field]){const [id,records]=single[field];return[{...entity(field,id,records,first),label:first}];}
  if(field==='Customer'){
   const requests=(source.requests??[]).filter(request=>!request.deletedAt&&(request.issueId===issue.id||request.issueIds?.includes(issue.id))),ids=[...new Set([issue.customerId,...issue.customerIds??[],...requests.map(request=>request.customerId||'__unknown_customer__')].filter(Boolean))];
   if(!ids.length)return[entity(field,undefined,[],'No customer')];
   return ids.map(id=>{const customer=source.customers?.find(customer=>customer.id===id);return customer?entity(field,id,[customer],customer.name):{key:JSON.stringify(['unknown',field]),label:'Unknown customer',unknown:true};});
  }
  if(field==='Initiative'){
   const project=source.projects.find(project=>project.id===issue.projectId),seen=new Set<string>(),pending=[project?.initiativeId,...project?.initiativeIds??[]].filter(Boolean),result:Entry[]=[];
   while(pending.length){const id=pending.pop()!;if(seen.has(id))continue;seen.add(id);const item=source.initiatives?.find(item=>item.id===id);result.push(entity(field,id,source.initiatives??[],'Unknown initiative'));pending.push(...[item?.parentId,...item?.parentIds??[]].filter(Boolean));}
   return result.length?result:[entity(field,undefined,[],'No initiative')];
  }
  if(field==='Project label'||field==='Project label group'){
   const groupId=slot==='group'?config.groupLabelGroupId:config.segmentLabelGroupId,group=[...(source.labelGroups??[]),...source.labels.filter(label=>label.isGroup)].find(group=>group.id===groupId);const labels=source.labels.filter(label=>!label.deletedAt&&!label.isGroup&&(projectLabels.get(issue.projectId)??[]).includes(label.id)&&names.includes(label.name)&&(field!=='Project label group'||!groupId||label.labelGroupId===groupId||!!group&&label.group===group.name));
   return labels.length?labels.map(label=>entity(field,label.id,source.labels,label.name)):[entity(field,undefined,[],first)];
  }
  return undefined;
 };
 const normalize=(names:string[],field:string,row:InsightDatum,labels:Record<string,string>,slot:'group'|'segment')=>{
  let entries=references(field,row,names,slot);
  if(!entries){const typed=field==='Status',folded=typed||field==='Label'||field==='Label group',status=typed?source.statuses.find(status=>status.id===row.issue.statusId):undefined,category=status?.type??row.issue.status??'unknown';entries=names.map(name=>{
    const empty=missingInsightDimension(row.issue,field,name,source,projectLabels.get(row.issue.projectId)),key=folded?JSON.stringify(empty?['empty',field]:[typed?'status':'label',typed?category:'',name.toLowerCase()]):name;
    const entityId=typed?status?.id:folded?source.labels.find(label=>row.issue.labelIds?.includes(label.id)&&label.name===name&&(field!=='Label group'||!(slot==='group'?config.groupLabelGroupId:config.segmentLabelGroupId)||label.labelGroupId===(slot==='group'?config.groupLabelGroupId:config.segmentLabelGroupId)))?.id:undefined;
    return{key,label:name,empty,entityId};
   });}
  for(const entry of entries){labels[entry.key]??=entry.label;if(entry.entityId)entityRefs[entry.key]??=entry.entityId;if(entry.empty)emptyKeys.add(entry.key);if(entry.unknown)unknownKeys.add(entry.key);}
  return [...new Map(entries.map(entry=>[entry.key,labels[entry.key]])).entries()];
 };
 const normalized=rows.map(row=>{const groups=normalize(row.groups,group,row,groupLabels,'group'),segments=normalize(row.segments??[row.segment],segment,row,segmentLabels,'segment');return {...row,groups:groups.map(entry=>entry[1]),groupKeys:groups.map(entry=>entry[0]),segments:segments.map(entry=>entry[1]),segment:segments[0]?.[1],segmentKeys:segments.map(entry=>entry[0])};});
 return{rows:normalized,groupLabels,segmentLabels,entityRefs,emptyKeys,unknownKeys};
}
