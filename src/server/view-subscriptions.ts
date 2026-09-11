import {randomUUID} from 'node:crypto';
import {assert,HttpError} from './errors';
import {filterSql,matchesFilter,type Actor,type Repository,type RecordEntity} from './repository';
import {usesCustomerMetrics} from '../shared/customer-metrics';
import {usesProjectLabels} from '../shared/project-label-filter';

export function validateViewSubscription(repo:Repository,actor:Actor,e:RecordEntity,previous?:RecordEntity){
 const isView=e.entityKind==='views'||e.type==='view'||e.viewId;
 if(previous?.entityKind==='views')assert(e.entityKind==='views'&&e.entityId===previous.entityId,422,'A view subscription cannot change its target','INVALID_VIEW_SUBSCRIPTION');
 if(!isView)return;
 const id=e.entityId??e.viewId;
 assert(typeof id==='string'&&(!e.viewId||e.viewId===id)&&(!e.entityKind||e.entityKind==='views')&&!['issueId','projectId','commentId','documentId','initiativeId','teamId'].some(field=>e[field]),422,'Choose a single issue view','INVALID_VIEW_SUBSCRIPTION');
 const reader={...actor,scopes:[...actor.scopes,'read']},view=repo.raw('views',id);
 assert(view&&!view.archivedAt&&view.entityType==='issues'&&repo.canRead(reader,'views',view),422,'Choose an accessible issue view','INVALID_VIEW_SUBSCRIPTION');
 e.entityKind='views';e.entityId=id;delete e.viewId;
 for(const field of ['notifyOnAdded','notifyOnClosed']){if(e[field]===undefined)e[field]=true;assert(typeof e[field]==='boolean',422,'Subscription options must be booleans','INVALID_VIEW_SUBSCRIPTION');}
 assert(e.notifyOnAdded||e.notifyOnClosed,422,'Choose at least one notification event','INVALID_VIEW_SUBSCRIPTION');
 const zone=e.timeZone??actor.timeZone??'UTC';assert(typeof zone==='string'&&zone.length<=100,422,'Choose a valid timezone','INVALID_VIEW_SUBSCRIPTION');
 try{e.timeZone=new Intl.DateTimeFormat('en',{timeZone:zone}).resolvedOptions().timeZone}catch{assert(false,422,'Choose a valid timezone','INVALID_VIEW_SUBSCRIPTION')}
 filterSql(repo.resolveFilter({...reader,timeZone:e.timeZone},view.filters,'issues'));
 assert(!repo.all('subscriptions',actor.workspaceId).some(s=>s.id!==e.id&&s.userId===e.userId&&s.entityKind==='views'&&s.entityId===id),409,'Already subscribed to this view','DUPLICATE_VIEW_SUBSCRIPTION');
}

/** Each saved view produces at most one alert per issue mutation and recipient. */
export function notifyViewSubscriptions(repo:Repository,actor:Actor,issue:RecordEntity,previous?:RecordEntity){
 if(actor.silent||issue.deletedAt||issue.archivedAt)return;
 const now=actor.now??new Date(),at=now.toISOString(),seen=new Set<string>();
 const closed=!!previous&&issue.statusId!==previous.statusId&&['completed','canceled'].includes(repo.raw('statuses',issue.statusId)?.type);
 const subscriptions=repo.db.prepare("SELECT data FROM entities WHERE workspace_id=? AND kind='subscriptions' AND deleted_at IS NULL AND json_extract(data,'$.entityKind')='views'").all(actor.workspaceId) as {data:string}[];
 for(const row of subscriptions){const s:RecordEntity=JSON.parse(row.data);
  if(s.entityKind!=='views'||s.userId===actor.userId||s.archivedAt)continue;
  const key=s.userId+':'+s.entityId;if(seen.has(key))continue;seen.add(key);
  const reader={...repo.actorForUser(s.userId,actor.workspaceId),now,timeZone:s.timeZone??'UTC'},view=repo.raw('views',s.entityId);
  if(reader.role==='none'||!view||view.archivedAt||view.entityType!=='issues'||!repo.canRead(reader,'views',view)||!repo.canRead(reader,'issues',issue))continue;
  let filter:any;try{filter=repo.resolveFilter(reader,view.filters,'issues');filterSql(filter)}catch(error){if(error instanceof HttpError&&error.status<500)continue;throw error}
  const match=(value:RecordEntity|undefined)=>{
   if(!value||value.deletedAt||value.archivedAt||view.teamId&&value.teamId!==view.teamId||!repo.canRead(reader,'issues',value))return false;
   let values=[value];if(usesCustomerMetrics(filter))values=repo.enrichCustomerMetrics(reader,'issues',values);if(usesProjectLabels(filter))values=repo.enrichProjectLabels(reader,'issues',values);
   return matchesFilter(repo.present(reader,'issues',values[0]),filter);
  };
  const before=match(previous),after=match(issue),reasons:string[]=[];
  if(s.notifyOnAdded!==false&&!before&&after)reasons.push('viewIssueAdded');
  if(s.notifyOnClosed!==false&&closed&&(before||after))reasons.push('viewIssueClosed');
  if(!reasons.length)continue;
  repo.save('notifications',{id:randomUUID(),workspaceId:actor.workspaceId,createdAt:at,updatedAt:at,version:1,userId:s.userId,actorId:actor.userId,issueId:issue.id,viewId:view.id,entityKind:'issues',entityId:issue.id,type:reasons.includes('viewIssueClosed')?'viewIssueClosed':'viewIssueAdded',reasons,title:issue.title,viewEventStatus:closed?repo.raw('statuses',issue.statusId)?.type:null,readAt:null,archivedAt:null},'create',actor);
 }
}
