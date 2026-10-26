import {customerSubscriptionMatches} from '../shared/customer-subscription';
import {applyCustomerTier} from './customer-tiers.ts';
import { domainToASCII } from 'node:url';
import {bindRequestSource,moveRequestSource} from './issue-attachments.ts';
import { randomUUID } from 'node:crypto';
import { assert } from './errors.ts';
import { projectStatuses } from './project-statuses.ts';
import type { Actor,RecordEntity,Repository } from './repository.ts';

export function normalizeCustomerDomain(value:unknown):string{
  assert(typeof value==='string'&&value.length<=512,422,'Customer domain must be a valid domain','INVALID_CUSTOMER');let domain=value.trim().toLowerCase();if(!domain)return '';if(/^https?:\/\//.test(domain)){try{const url=new URL(domain);assert(!url.username&&!url.password&&!url.port&&url.pathname==='/'&&!url.search&&!url.hash,422,'Enter only the customer domain','INVALID_CUSTOMER');domain=url.hostname;}catch{assert(false,422,'Customer domain is invalid','INVALID_CUSTOMER');}}
  domain=domainToASCII(domain.replace(/^www\./,'').replace(/\.$/,''));assert(domain.length<=253&&domain.includes('.')&&domain.split('.').every(part=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)),422,'Customer domain is invalid','INVALID_CUSTOMER');return domain;
}
export function validateCustomerSettings(repo:Repository,actor:Actor,workspace:RecordEntity){
  const settings=workspace.customerSettings;if(settings===undefined)return;assert(settings&&typeof settings==='object'&&!Array.isArray(settings),422,'Customer settings must be an object','INVALID_CUSTOMER_SETTINGS');
  if(settings.defaultTeamId){const team=repo.raw('teams',settings.defaultTeamId);assert(team&&repo.canRead({...actor,scopes:[...actor.scopes,'read']},'teams',team),422,'Default customer team is not accessible','INVALID_REFERENCE');}
  if(settings.revenueUnit!==undefined)assert(typeof settings.revenueUnit==='string'&&/^[A-Z]{3}$/.test(settings.revenueUnit),422,'Revenue unit must be a three-letter currency code','INVALID_CUSTOMER_SETTINGS');
  for(const key of ['tiers','statuses'])if(settings[key]!==undefined){assert(Array.isArray(settings[key])&&settings[key].length<=100&&settings[key].every((v:any)=>typeof v==='string'&&v.trim().length>0&&v.length<=100),422,`${key} must contain nonempty names`,'INVALID_CUSTOMER_SETTINGS');assert(new Set(settings[key].map((v:string)=>v.trim().toLowerCase())).size===settings[key].length,422,`${key} must contain unique names`,'INVALID_CUSTOMER_SETTINGS');settings[key]=settings[key].map((v:string)=>v.trim());}
  if(settings.excludedDomains!==undefined){assert(Array.isArray(settings.excludedDomains)&&settings.excludedDomains.length<=1000,422,'Excluded domains must be an array','INVALID_CUSTOMER_SETTINGS');settings.excludedDomains=[...new Set(settings.excludedDomains.map((v:any)=>{assert(typeof v==='string',422,'Invalid excluded domain','INVALID_CUSTOMER_SETTINGS');const value=v.trim().toLowerCase();if(value.includes('@')){assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),422,'Invalid excluded email','INVALID_CUSTOMER_SETTINGS');return value;}return normalizeCustomerDomain(value);} ))];}
}
export function customerDomains(customer:Record<string,any>):string[]{return Array.isArray(customer.domains)?customer.domains:customer.domain?[normalizeCustomerDomain(customer.domain)]:[];}
function domainList(value:unknown):string[]{
  assert(Array.isArray(value)&&value.length<=1000,422,'Customer domains must be an array','INVALID_CUSTOMER');
  const domains=value.map(normalizeCustomerDomain);assert(domains.every(Boolean),422,'Customer domains cannot be empty','INVALID_CUSTOMER');return [...new Set(domains)];
}
function externalIdList(value:unknown):string[]{
  assert(Array.isArray(value)&&value.length<=1000&&value.every(id=>typeof id==='string'&&id.trim().length>0&&id.length<=1000),422,'Customer external identifiers must be nonempty strings','INVALID_CUSTOMER');
  return [...new Set(value)];
}
export function validateCustomer(repo:Repository,actor:Actor,customer:RecordEntity,previous?:RecordEntity,provided:Record<string,any>=customer){
  let domains=domainList(customerDomains(customer));
  const hasDomains=Object.hasOwn(provided,'domains'),hasDomain=Object.hasOwn(provided,'domain');
  if(hasDomains)domains=domainList(provided.domains);
  if(hasDomain){const primary=customer.domain==null?'':normalizeCustomerDomain(customer.domain),legacyEdit=!hasDomains||previous&&JSON.stringify(domains)===JSON.stringify(customerDomains(previous));
    if(legacyEdit)domains=[...new Set([...(primary?[primary]:[]),...domains.filter(domain=>domain!==previous?.domain&&domain!==primary)])];
    else assert(primary===(domains[0]||''),422,'Customer domain and domains disagree','INVALID_CUSTOMER');
  }
  customer.domains=domains;customer.domain=domains[0]||'';
  customer.externalIds=externalIdList(customer.externalIds??[]);
  const others=repo.all('customers',actor.workspaceId).filter(other=>other.id!==customer.id),excluded=repo.raw('workspaces',actor.workspaceId)?.customerSettings?.excludedDomains||[];
  for(const domain of domains){assert(!others.some(other=>customerDomains(other).includes(domain)),409,'A customer with this domain already exists','CUSTOMER_DOMAIN_EXISTS');if(!previous||!customerDomains(previous).includes(domain))assert(!excluded.includes(domain)&&!excluded.includes(String(customer.email||'').trim().toLowerCase()),422,'This customer domain or email is excluded','CUSTOMER_DOMAIN_EXCLUDED');}
  for(const id of customer.externalIds)assert(!others.some(other=>other.externalIds?.includes(id)),409,'A customer with this external identifier already exists','CUSTOMER_EXTERNAL_ID_EXISTS');
  for(const field of ['revenue','size'])if(customer[field]!=null&&customer[field]!=='')assert(typeof customer[field]==='number'&&Number.isFinite(customer[field])&&customer[field]>=0&&(field!=='size'||Number.isInteger(customer[field])),422,`${field} must be a nonnegative ${field==='size'?'integer':'number'}`,'INVALID_CUSTOMER');
  for(const field of ['tier','status'])if(customer[field]!=null)assert(typeof customer[field]==='string'&&customer[field].length<=100,422,`Invalid customer ${field}`,'INVALID_CUSTOMER');
  applyCustomerTier(repo,actor,customer,previous,provided);
  if(customer.email)assert(typeof customer.email==='string'&&customer.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email),422,'Invalid customer email','INVALID_CUSTOMER');
}
export function upsertCustomer(repo:Repository,actor:Actor,input:Record<string,any>){return repo.transaction(()=>{
  repo.access(actor,'customers',undefined,true);
  assert(input&&typeof input==='object'&&!Array.isArray(input),422,'Customer input must be an object','INVALID_CUSTOMER');
  const domains=Object.hasOwn(input,'domains')?domainList(input.domains):[],externalIds=Object.hasOwn(input,'externalId')?externalIdList([input.externalId]):[];
  assert(domains.length||externalIds.length,422,'A customer domain or external identifier is required','INVALID_CUSTOMER');
  const matches=repo.all('customers',actor.workspaceId).filter(customer=>customerDomains(customer).some(domain=>domains.includes(domain))||customer.externalIds?.some((id:string)=>externalIds.includes(id)));
  assert(matches.length<=1,409,'Customer identifiers match different customers','CUSTOMER_IDENTITY_CONFLICT');
  const previous=matches[0],fields:Record<string,any>={};
  for(const key of ['name','revenue','size','ownerId','logoUrl','tierId'])if(Object.hasOwn(input,key))fields[key]=input[key];
  fields.domains=[...new Set([...(previous?customerDomains(previous):[]),...domains])];
  fields.externalIds=[...new Set([...(previous?.externalIds??[]),...externalIds])];
  if(previous){repo.access(actor,'customers',previous,true);return repo.update(actor,'customers',previous.id,fields);}
  fields.name??=domains[0]??externalIds[0];return repo.create(actor,'customers',fields);
});}
export function requestState(repo:Repository,request:RecordEntity):string{
  const issue=request.issueId?repo.raw('issues',request.issueId):null,project=request.projectId?repo.raw('projects',request.projectId):null;
  const category=issue?repo.raw('statuses',issue.statusId)?.type:project?projectStatuses(repo,project.workspaceId).find(s=>s.id===project.status)?.type:null;
  if(category==='completed')return 'Completed';if(category==='canceled'||category==='duplicate')return 'Canceled';if(issue||project)return 'Open';return request.status||'Open';
}
export function validateRequest(repo:Repository,request:RecordEntity,actor?:Actor,previous?:RecordEntity){
  if(request.commentId!=null){
    assert(typeof request.commentId==='string'&&request.commentId.length>0,422,'Invalid request comment','INVALID_REQUEST');
    if(actor&&request.commentId!==previous?.commentId)repo.get(actor,'comments',request.commentId);
  }
  assert(!(request.issueId&&request.projectId),422,'A request can link to an issue or a project, not both','INVALID_REQUEST_TARGET');request.important??=false;assert(typeof request.important==='boolean',422,'Important must be true or false','INVALID_REQUEST');
  if(request.requesterEmail)assert(typeof request.requesterEmail==='string'&&request.requesterEmail.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.requesterEmail),422,'Invalid requester email','INVALID_REQUEST');if(request.requesterName!=null)assert(typeof request.requesterName==='string'&&request.requesterName.length<=500,422,'Invalid requester name','INVALID_REQUEST');
  if(request.sourceUrl){assert(typeof request.sourceUrl==='string'&&request.sourceUrl.length<=4096,422,'Invalid request source URL','INVALID_REQUEST');let url:URL|undefined;try{url=new URL(request.sourceUrl)}catch{}assert(url&&['https:','http:'].includes(url.protocol)&&!url.username&&!url.password,422,'Request source must be an HTTP or HTTPS URL','INVALID_REQUEST');}
  request.status=requestState(repo,request);
  const moved=previous&&((previous.issueId||null)!==(request.issueId||null)||(previous.projectId||null)!==(request.projectId||null));
  request.requestOriginIssueId=previous?(Object.hasOwn(previous,'requestOriginIssueId')?previous.requestOriginIssueId:previous.originalIssueId||previous.issueId||null):request.issueId||null;
  request.originalIssueId=previous?.originalIssueId||((moved&&request.requestOriginIssueId)?request.requestOriginIssueId:null);
  if(moved&&actor)moveRequestSource(repo,actor,previous,request);
  bindRequestSource(repo,request,actor);
}
export function synchronizeCustomerRequests(repo:Repository,actor:Actor,kind:string,entity:RecordEntity,previous:RecordEntity){
  if(!['issues','projects'].includes(kind)||(kind==='issues'?entity.statusId===previous.statusId:entity.status===previous.status))return;
  const key=kind==='issues'?'issueId':'projectId';for(const request of repo.all('requests',actor.workspaceId).filter(r=>r[key]===entity.id)){const status=requestState(repo,request);if(status!==request.status){const next={...request,status,version:request.version+1,updatedAt:(actor.now||new Date()).toISOString()};repo.save('requests',next,'update',actor);repo.activity(actor,'requests',next,'update',request);repo.notify(actor,'requests',next,request);}}
}
export function customerRequestRecipients(repo:Repository,actor:Actor,request:RecordEntity,previous:RecordEntity|undefined,add:(id:string,reason:string)=>void){
  if(previous&&request.important===previous.important&&request.status===previous.status&&request.customerId===previous.customerId&&request.issueId===previous.issueId&&request.projectId===previous.projectId)return;
  const customer=request.customerId?repo.raw('customers',request.customerId):null;if(customer?.ownerId)add(customer.ownerId,'requests');
  for(const subscription of repo.all('subscriptions',actor.workspaceId))if([request.customerId,request.issueId,request.projectId].filter(Boolean).some(id=>subscription.customerId===id||subscription.issueId===id||subscription.projectId===id||subscription.entityId===id)){const customerSubscription=subscription.customerId===request.customerId||subscription.entityId===request.customerId;if(!customerSubscription||customerSubscriptionMatches(subscription.customerEvents,request,previous))add(subscription.userId,'requests');}
  for(const [kind,id] of [['customers',request.customerId],['issues',request.issueId],['projects',request.projectId]])if(id)for(const userId of repo.raw(kind,id)?.subscriberIds||[])add(userId,'requests');
}
export function mergeCustomers(repo:Repository,actor:Actor,sourceId:string,targetId:unknown){return repo.transaction(()=>{
  assert(typeof targetId==='string'&&targetId!==sourceId,422,'Choose a different target customer','INVALID_CUSTOMER_MERGE');const source=repo.get(actor,'customers',sourceId),target=repo.get(actor,'customers',targetId);repo.access(actor,'customers',source,true);repo.access(actor,'customers',target,true);const at=(actor.now||new Date()).toISOString();
  // Customer merges replace only the customer reference, including records whose
  // content is private to another member. No hidden content is returned.
  const rows=repo.db.prepare("SELECT kind,data FROM entities WHERE workspace_id=? AND kind NOT IN ('activities','customers') AND (json_extract(data,'$.customerId')=? OR json_extract(data,'$.entityId')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.customerIds')) WHERE value=?) OR EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.directCustomerIds')) WHERE value=?))").all(actor.workspaceId,sourceId,sourceId,sourceId,sourceId) as {kind:string,data:string}[];
  for(const row of rows){const previous=JSON.parse(row.data) as RecordEntity,next:RecordEntity={...previous,updatedAt:at,version:previous.version+1};if(next.customerId===sourceId)next.customerId=targetId;if(next.directCustomerIds)next.directCustomerIds=[...new Set(next.directCustomerIds.map((id:string)=>id===sourceId?targetId:id))];if(next.customerIds)next.customerIds=[...new Set(next.customerIds.map((id:string)=>id===sourceId?targetId:id))];if(next.entityId===sourceId)next.entityId=targetId;if(row.kind==='favorites'){next.label=target.name;if(next.route===`/customer/${sourceId}`)next.route=`/customer/${targetId}`;}
    if(['favorites','subscriptions'].includes(row.kind)&&!next.deletedAt){const duplicate=repo.all(row.kind,actor.workspaceId).find(record=>record.id!==next.id&&record.userId===next.userId&&(record.customerId===targetId||record.entityId===targetId));if(duplicate)next.deletedAt=at;}
    repo.save(row.kind,next,next.deletedAt&&!previous.deletedAt?'delete':'update',actor);
  }
  repo.db.prepare("UPDATE attachments SET entity_id=? WHERE workspace_id=? AND entity_kind='customers' AND entity_id=?").run(targetId,actor.workspaceId,sourceId);
  const domains=domainList([...customerDomains(target),...customerDomains(source)]),externalIds=externalIdList([...(target.externalIds??[]),...(source.externalIds??[])]);
  const updated:RecordEntity={...target,domain:domains[0]||'',domains,externalIds,subscriberIds:[...new Set([...(target.subscriberIds||[]),...(source.subscriberIds||[])])],mergedCustomerIds:[...new Set([...(target.mergedCustomerIds||[]),source.id,...(source.mergedCustomerIds||[])])],updatedAt:at,version:target.version+1};repo.save('customers',updated,'update',actor);repo.activity(actor,'customers',updated,'merge',target);repo.remove(actor,'customers',source.id);return updated;
});}
