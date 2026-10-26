import {customerAssignments} from '../../shared/customer-assignments';
import {insightPeriod,insightPeriodLabel} from './insight-options';
import {cycleAddition} from '../../shared/cycle-addition';
import type {Entity} from '../../shared/types';
import {getSlaStatus} from '../query';
import type {InsightConfig,InsightSource} from './insight-data';
export const extraInsightSlices=['Added to cycle','Assigned customer','Customer','Initiative','Milestone','Estimate','SLA status','Template','External source','Label group','Project label group','Created date','Completed date','Started date','Canceled date','Due date'] as const;
export function extraInsightDimension(issue:Entity,field:string,source:InsightSource,config:InsightConfig,slot:'group'|'segment',now:number):string[]|undefined{
 const records=(kind:'customers'|'initiatives'|'milestones'|'templates')=>source[kind]??[];
 const name=(kind:'customers'|'initiatives'|'milestones'|'templates',id:string,empty:string)=>records(kind).find(row=>row.id===id)?.name||records(kind).find(row=>row.id===id)?.title||empty;
 if(field==='Added to cycle'){const period=cycleAddition(issue,source.cycles.find(cycle=>cycle.id===issue.cycleId));return[period==='planned'?'Planned':period==='duringCycle'?'During cycle':period==='afterCycle'?'After cycle':'No info'];}
 if(field==='Estimate')return[typeof issue.estimate==='number'?String(issue.estimate):'No estimate'];
 if(field==='Milestone')return[name('milestones',issue.milestoneId,'No milestone')];
 if(field==='Template')return[name('templates',issue.templateId||issue.lastAppliedTemplateId,'No template')];
 if(field==='External source')return[issue.externalSource||issue.source||'No external source'];
 if(field==='SLA status')return[{none:'No SLA',lowRisk:'Low risk',mediumRisk:'Medium risk',highRisk:'High risk',breached:'Breached',achieved:'Achieved',failed:'Failed',paused:'Paused'}[getSlaStatus(issue,now)]||getSlaStatus(issue,now)];
 if(field==='Assigned customer'){const ids=customerAssignments(issue,source.projects,source.customers).effectiveCustomerIds;return ids.length?ids.map(id=>name('customers',id,'Unknown customer')):['No customer'];}
 if(field==='Customer'){const ids=[...new Set([issue.customerId,...issue.customerIds??[],...(source.requests??[]).filter(request=>!request.deletedAt&&(request.issueId===issue.id||request.issueIds?.includes(issue.id))).map(request=>request.customerId||'__unknown_customer__')].filter(Boolean))];return ids.length?ids.map(id=>name('customers',id,'Unknown customer')):['No customer'];}
 if(field==='Initiative'){const project=source.projects.find(project=>project.id===issue.projectId),found=new Set<string>(),pending=[project?.initiativeId,...project?.initiativeIds??[]].filter(Boolean);while(pending.length){const id=pending.pop()!;if(found.has(id))continue;found.add(id);const item=records('initiatives').find(item=>item.id===id);pending.push(...[item?.parentId,...item?.parentIds??[]].filter(Boolean));}return found.size?[...found].map(id=>name('initiatives',id,'Unknown initiative')):['No initiative'];}
 if(field==='Label group'||field==='Project label group'){
  const project=source.projects.find(project=>project.id===issue.projectId),ids=field==='Label group'?issue.labelIds??[]:project?.labelIds??[],groupId=slot==='group'?config.groupLabelGroupId:config.segmentLabelGroupId,groups=[...(source.labelGroups??[]),...source.labels.filter(label=>label.isGroup)],group=groups.find(group=>group.id===groupId);
  const labels=source.labels.filter(label=>!label.deletedAt&&!label.isGroup&&ids.includes(label.id)&&(!groupId||label.labelGroupId===groupId||!!group&&label.group===group.name));return labels.length?[...new Set(labels.map(label=>label.name))]:['No '+(group?.name||'label')];
 }
 const key=({'Created date':'createdAt','Completed date':'completedAt','Started date':'startedAt','Canceled date':'canceledAt','Due date':'dueDate'} as Record<string,string>)[field];
 if(key){const period=insightPeriod(issue[key],config.interval,config.fiscalMonth);return Number.isFinite(period)?[insightPeriodLabel(period,config.interval)]:['No date'];}
 return undefined;
}

/** Distinguish absent references from genuine names such as “No label”. */
export function missingInsightDimension(issue:Entity,field:string,name:string,source:InsightSource,projectLabels?:readonly string[]):boolean{
 if(field==='None')return false;
 if(field==='Assigned customer')return !customerAssignments(issue,source.projects,source.customers).effectiveCustomerIds.length;
 if(field==='Priority')return !Number(issue.priority);
 if(field==='Estimate')return typeof issue.estimate!=='number';
 if(field==='Added to cycle')return cycleAddition(issue,source.cycles.find(cycle=>cycle.id===issue.cycleId))===null;
 if(field==='SLA status')return getSlaStatus(issue)==='none';
 if(field==='External source')return !issue.externalSource&&!issue.source;
 const dateField=({'Created date':'createdAt','Created week':'createdAt','Completed date':'completedAt','Completed week':'completedAt','Started date':'startedAt','Canceled date':'canceledAt','Due date':'dueDate'} as Record<string,string>)[field];
 if(dateField)return !Number.isFinite(Date.parse(issue[dateField]));
 const refs:Record<string,[Entity[],string|undefined]>={Assignee:[source.users,issue.assigneeId],Creator:[source.users,issue.creatorId||issue.createdBy],Team:[source.teams,issue.teamId],Project:[source.projects,issue.projectId],Cycle:[source.cycles,issue.cycleId],Status:[source.statuses,issue.statusId],'Status type':[source.statuses,issue.statusId],Milestone:[source.milestones??[],issue.milestoneId],Template:[source.templates??[],issue.templateId||issue.lastAppliedTemplateId]};
 const ref=refs[field];if(ref)return !ref[1]||!ref[0].some(record=>record.id===ref[1]);
 if(['Label','Label group','Project label','Project label group'].includes(field)){
  const project=source.projects.find(project=>project.id===issue.projectId),ids=field.startsWith('Project')?projectLabels??project?.labelIds??[]:issue.labelIds??[];
  return !source.labels.some(label=>!label.deletedAt&&!label.isGroup&&ids.includes(label.id)&&label.name===name);
 }
 if(field==='Customer'){const ids=[issue.customerId,...issue.customerIds??[],...(source.requests??[]).filter(request=>!request.deletedAt&&(request.issueId===issue.id||request.issueIds?.includes(issue.id))).map(request=>request.customerId)];return !ids.some(Boolean)&&!(source.requests??[]).some(request=>!request.deletedAt&&(request.issueId===issue.id||request.issueIds?.includes(issue.id))); }
 if(field==='Initiative'){const project=source.projects.find(project=>project.id===issue.projectId),visited=new Set<string>(),pending=[project?.initiativeId,...project?.initiativeIds??[]].filter(Boolean);while(pending.length){const id=pending.pop()!;if(visited.has(id))continue;visited.add(id);const item=source.initiatives?.find(item=>item.id===id);if(item?.name===name)return false;pending.push(...[item?.parentId,...item?.parentIds??[]].filter(Boolean));}return true;}
 return false;
}

export function unknownInsightCustomer(issue:Entity,name:string,source:InsightSource):boolean{if(name!=='Unknown customer')return false;const ids=[issue.customerId,...issue.customerIds??[],...(source.requests??[]).filter(request=>!request.deletedAt&&(request.issueId===issue.id||request.issueIds?.includes(issue.id))).map(request=>request.customerId)];return !(source.customers??[]).some(customer=>ids.includes(customer.id)&&customer.name===name);}
