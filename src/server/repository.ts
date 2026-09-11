import {projectPropertyIndex,withProjectProperties,usesProjectProperties,projectLabelConditionEntity} from '../shared/project-property-filter.ts';
import {projectedStatusTime,prepareStatusTime} from './issue-status-time';
import {statusTimeFields} from '../shared/issue-status-time';
import {matchCustomerValue} from '../shared/customer-quick-filter';
import {withIssueQuickFilter,usesIssueQuickFilter} from '../shared/issue-quick-filter';
import {resolveCurrentUserFilter} from '../shared/current-user-filter';
import {guestContentVisible,guestTeamResourcePatch} from './guest-access';
import {queueAsksEmail} from './asks-email';
import {validateApprovedDomains} from "./approved-domains";
import {assertTeamWritable} from "./team-lifecycle";
import {normalizeViewOwner} from "./view-owner";
import {refreshDueDateNotificationTitles} from './due-date-notifications';
import {enqueueUrgentIssueEmail} from './urgent-email';
import {prepareIssueTeamMove} from "./issue-team-move";
import {assertTeamPolicy,isTeamOwner} from './team-permissions.ts';
import {initializeIssueIdentifiers} from './issue-identifiers';
import {initializeCustomerTiers,initializeWorkspaceTiers,validateCustomerTier,assertTierUnused,synchronizeTierName} from './customer-tiers.ts';
import {requesterIdentity} from './requester-attribution';
import {prepareTemplateAssets} from './template-assets';
import {validateAskForm} from './direct-asks';
import {validateAskPage,askPageTemplates} from './asks-pages';
import {notifyViewSubscriptions,validateViewSubscription} from './view-subscriptions';
import {labelSubscriptionRecipients,validateLabelSubscription} from './label-subscriptions';
import {expandRelationshipFilter} from './relationship-filter';
import {expandFilterGroups,InvalidFilterGroup} from '../shared/filter-groups';
import {matchesStructuredFilter} from '../shared/structured-filter';
import {matchDateRange} from '../shared/date-filter-range';
import {resolveCalendarFilter} from '../shared/relative-date-filter';
import {expandGroupFilter} from './label-group-filter';
import {effectiveIssueSubscribers} from '../shared/issue-subscriptions';
import {initializeIssueSubscribers,subscriptionIssueChanged,prepareSubscriberSelection,removeDeselectedSubscriptionRecords} from './issue-subscribers';
import {initializeCycleAssignmentHistory} from './cycle-assignment-history';
import {usesCycleTiming} from '../shared/cycle-addition';
import {prepareRecurringIssue,validateRecurrence} from './recurring-issues';
import {prepareLabelGroup,validateLabelGroup,renameGroupMembers,groupMembers,initializeLabelGroups} from './label-groups';
import {issueLabelNameError} from '../shared/label-name-validation';
import {projectLabelIndex,withProjectLabels,usesProjectLabels} from '../shared/project-label-filter.ts';
import {mergeLabel} from './label-merge';
import {removeLabelAssignments} from './label-deletion';
import {contentAttribution} from '../shared/content-attribution.ts';
import {documentRecipients,documentSubscribers} from './document-notifications.ts';
import {projectActivityRecipients} from './project-notifications.ts';
import {buildProjectDependencyMetrics,usesProjectDependencyMetrics} from '../shared/project-dependency-metrics.ts';
import {prepareParentIssue,inheritParentIssue,prepareDuplicateIssue,mergeIssueContext} from './issue-operations.ts';
import {validateComment,resolutionOnly,validateThreadSubscription,subscribeCommentParticipants,threadRecipients,removeResolutionReply,removeCommentReplies,restoreCommentThread} from './comments.ts';
import {prepareTriage,validateTriageSettings,triageRecipients,TRIAGE_DERIVED_FIELDS} from './triage.ts';
import {validateReactions} from './reactions.ts';
import {validateFavorite,unfileFavoriteChildren} from './favorites.ts';
import {webhookMatches,webhookEntity} from './webhook-scope.ts';
import {oauthAppTeamAccess} from './oauth-app-permissions.ts';
import {validateReminder} from './reminders.ts';
import {retainOpenNotifications,issueStatusNotification,validateNotificationArrival} from './notifications.ts';
import {validateCustomEmojis} from './custom-emojis.ts';
import {prepareCycle,prepareCycleSettings,applyCycleAutomation,cycleEntityChanged,CYCLE_DERIVED_FIELDS} from './cycles.ts';
import {prepareIssueRelations,synchronizeIssueRelations,indexIssueRelations} from './issue-relations.ts';
import {sharedIssueAccess,mayManageSharing,mayGuestEdit,validateSharedIssuePatch,presentEntity,preserveHiddenProjectTeams,validateIssueSharing} from './visibility.ts';
import {teamAccess,prepareTeamHierarchy,validateTeamHierarchy,synchronizeTeamHierarchy,assertNoChildMembership,initializeTeamWorkflow} from './team-hierarchy.ts';
import {validateUpdateEntity,recordLatestUpdate,updateRecipients} from './updates.ts';
import {validateCustomer,validateCustomerSettings,validateRequest,synchronizeCustomerRequests,customerRequestRecipients} from './customers.ts';
import {initializeRequestSources,removeUnusedRequestSource} from './issue-attachments.ts';
import {buildCustomerMetrics,withCustomerMetrics,usesCustomerMetrics} from '../shared/customer-metrics.ts';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { assert, HttpError } from './errors.ts';
import { sanitizeEntityContent } from './content.ts';
import { applySla, slaStatus, slaDeadline } from './sla.ts';
import {convertLabel} from './label-conversion';
import { normalizeInitiative, validateInitiative } from './initiatives.ts';
import { applyProjectStatus, validateProjectStatuses } from './project-statuses.ts';
import {validateWorkflowStatus,validateWorkflowRemoval} from './workflow-statuses.ts';
import { prepareProjectTemplate, createProjectPlan, validateProjectPlan } from './project-templates.ts';
import { indexedList,exactFilter,canReadAllParents } from './list-query.ts';
import {pagination,cursorId,type PaginationOptions} from './pagination.ts';
import { prepareIssueTemplate, createTemplateChildren, validateTeamTemplates, validateTemplate, templateApplies } from './templates.ts';

export const KINDS = ['workspaces','teams','users','memberships','statuses','issues','projects','milestones','initiatives','cycles','labels','labelGroups','views','documents','comments','activities','notifications','customers','customerTiers','requests','dashboards','templates','favorites','subscriptions','integrations','automations','slaPolicies','asksForms','asksPages','updates'] as const;
export type RecordEntity = {id:string;workspaceId:string;createdAt:string;updatedAt:string;version:number;[key:string]:any};
type EntityPage={nodes:RecordEntity[];totalCount:number;pageInfo:{hasNextPage:boolean;hasPreviousPage:boolean;startCursor:string|null;endCursor:string|null}};
export type Actor = {userId:string;workspaceId:string;role:string;scopes:string[];tokenId?:string;sessionHash?:string;appId?:string;system?:boolean;requesterIntake?:boolean;hierarchySync?:boolean;triageSync?:boolean;subscriberSync?:boolean;triageWake?:boolean;cycleSync?:boolean;customEmojiMutation?:boolean;silent?:boolean;now?:Date;timeZone?:string;recordCache?:Map<string,RecordEntity|null>;permissionCache?:Map<string,boolean>};
export type Change = {seq:number;workspaceId:string;kind:string;action:string;entity:RecordEntity;id:string;actorId:string;accessChanged?:boolean;accessRevision?:number};
const PRIVATE = new Set(['favorites','notifications','subscriptions']);
const ADMIN = new Set(['customerTiers','workspaces','memberships','integrations','automations','slaPolicies','asksForms','asksPages']);
const NAMED = new Set(['workspaces','users','teams','statuses','projects','milestones','initiatives','cycles','labels','labelGroups','views','customers','dashboards','templates','automations','slaPolicies','asksForms','asksPages']);
const REFERENCES: Record<string,string> = { teamId:'teams',projectId:'projects',milestoneId:'milestones',initiativeId:'initiatives',cycleId:'cycles',assigneeId:'users',leadId:'users',leadTeamId:'teams',ownerId:'users',customerId:'customers',issueId:'issues',documentId:'documents',updateId:'updates',statusId:'statuses',templateId:'templates',slaPolicyId:'slaPolicies' };
const ARRAYS: Record<string,string> = {teamIds:'teams',memberIds:'users',projectIds:'projects',initiativeIds:'initiatives',labelIds:'labels',blockedByIds:'issues',blockingIds:'issues',relatedIds:'issues',subscriberIds:'users'};
export function isKind(kind: string) { return (KINDS as readonly string[]).includes(kind); }
export function filterSql(filter:any):{sql:string;params:any[]} {
  if(Array.isArray(filter)||Array.isArray(filter?.conditions))return {sql:'1',params:[]};
  if(!filter||!Object.keys(filter).length)return {sql:'1',params:[]};assert(typeof filter==='object'&&!Array.isArray(filter),400,'Filter must be an object','INVALID_FILTER');const parts:string[]=[],params:any[]=[];
  const scalar=(value:any)=>{assert(value===null||['string','number','boolean'].includes(typeof value),400,'Filter expects a scalar value','INVALID_FILTER');return typeof value==='boolean'?(value?1:0):value;};
  for(const [key,value]of Object.entries(filter) as [string,any][]){
    if(key==='and'||key==='or'){assert(Array.isArray(value)&&value.length<=100,400,`${key} requires an array`,'INVALID_FILTER');const children=value.map(filterSql);parts.push(`(${children.map(c=>c.sql).join(key==='and'?' AND ':' OR ')||'1'})`);for(const c of children)params.push(...c.params);continue;}
    if(key==='not'){const child=filterSql(value);parts.push(`NOT (${child.sql})`);params.push(...child.params);continue;}
    assert(/^[A-Za-z][A-Za-z0-9_.]*$/.test(key),400,'Invalid filter field','INVALID_FILTER');const field=`json_extract(data,'$.${key}')`;
    const operations=value===null||typeof value!=='object'?{eq:value}:Array.isArray(value)?{in:value}:value;
    for(const[operator,expected]of Object.entries(operations) as [string,any][]){
      if(['eq','neq','gt','gte','lt','lte'].includes(operator)){const op=({eq:'IS',neq:'IS NOT',gt:'>',gte:'>=',lt:'<',lte:'<='} as Record<string,string>)[operator];parts.push(`${field} ${op} ?`);params.push(scalar(expected));}
      else if(operator==='in'||operator==='nin'){assert(Array.isArray(expected)&&expected.length<=1000,400,'Set filter requires an array of at most 1000 values','INVALID_FILTER');parts.push(expected.length?`${field} ${operator==='in'?'IN':'NOT IN'} (${expected.map(()=>'?').join(',')})`:operator==='in'?'0':'1');params.push(...expected.map(scalar));}
      else if(operator==='null'){parts.push(`${field} IS ${expected?'':'NOT '}NULL`);}
      else if(operator==='contains'){parts.push(`CASE WHEN json_type(data,'$.${key}')='array' THEN EXISTS(SELECT 1 FROM json_each(${field}) WHERE value=?) WHEN json_type(data,'$.${key}')='text' THEN instr(${field},?)>0 ELSE 0 END`);params.push(scalar(expected),String(expected));}
      else if(operator==='startsWith'){parts.push(`json_type(data,'$.${key}')='text' AND substr(${field},1,length(?))=?`);params.push(String(expected),String(expected));}
      else if(operator==='containsAll'){assert(Array.isArray(expected),400,'containsAll requires an array','INVALID_FILTER');for(const v of expected){parts.push(`EXISTS(SELECT 1 FROM json_each(${field}) WHERE value=?)`);params.push(scalar(v));}}
      else if(['eqIgnoreCase','neqIgnoreCase','notStartsWith','endsWith','notEndsWith','notContains','containsIgnoreCase','notContainsIgnoreCase'].includes(operator)){assert(typeof expected==='string',400,'String filter requires a string value','INVALID_FILTER');parts.push('1');}
      else if(operator==='some'){parts.push('1');}
      else throw new HttpError(400,`Unsupported filter operator: ${operator}`,'INVALID_FILTER');
    }
  }
  return {sql:parts.map(p=>`(${p})`).join(' AND ')||'1',params};
}
export function matchesFilter(entity: any, filter: any): boolean {
  if(filter?.groups!==undefined)filter=expandFilterGroups(filter);
  const condition=(c:any)=>{const conditionEntity=projectLabelConditionEntity(entity,c);const customerMatch=matchCustomerValue(entity,c);if(customerMatch!==undefined)return customerMatch;const raw=c.field==='slaStatus'?slaStatus(entity):String(c.field||'').split('.').reduce((value,key)=>value?.[key],conditionEntity);const rangeMatch=matchDateRange(raw,c);if(rangeMatch!==undefined)return rangeMatch;const values=Array.isArray(raw)?raw:[raw],expected=c.value;const equal=values.some(value=>String(value??'').toLowerCase()===String(expected??'').toLowerCase());switch(c.operator){case'eq':case'is':case'equals':return equal;case'neq':case'isNot':return !equal;case'contains':case'includes':return values.some(value=>String(value??'').toLowerCase().includes(String(expected??'').toLowerCase()));case'notContains':return !values.some(value=>String(value??'').toLowerCase().includes(String(expected??'').toLowerCase()));case'in':return Array.isArray(expected)&&values.some(value=>expected.includes(value??null));case'none':return Array.isArray(expected)&&!values.some(value=>expected.includes(value));case'notAll':return Array.isArray(expected)&&!expected.every(value=>values.includes(value));case'all':return Array.isArray(expected)&&expected.every(value=>values.includes(value));case'empty':case'isEmpty':return raw==null||raw===''||(Array.isArray(raw)&&!raw.length);case'notEmpty':return raw!=null&&raw!==''&&(!Array.isArray(raw)||raw.length>0);case'before':case'lt':return raw!=null&&raw<expected;case'after':case'gt':return raw!=null&&raw>expected;case'gte':return raw!=null&&raw>=expected;case'lte':return raw!=null&&raw<=expected;default:throw new HttpError(400,'Unknown filter operator','INVALID_FILTER');}};
  if(Array.isArray(filter))return filter.every(condition);
  if(Array.isArray(filter?.conditions))return filter.match==='any'?(!filter.conditions.length||filter.conditions.some(condition)):filter.conditions.every(condition);
  if (!filter || typeof filter !== 'object') return true;
  return matchesStructuredFilter(entity,filter,matchesFilter,message=>{throw new HttpError(400,message,'INVALID_FILTER')});
}

export class Repository {
  db: DatabaseSync;
  onChanges?: (changes: Change[])=>void;
  private pending: Change[]=[];
  private depth=0;
  private representations=new WeakMap<object,string>();
  constructor(db:DatabaseSync) {this.db=db;initializeLabelGroups(this);initializeCycleAssignmentHistory(this);initializeIssueSubscribers(this);initializeRequestSources(this);initializeCustomerTiers(this);initializeIssueIdentifiers(this);}
  transaction<T>(fn:()=>T):T {
    if(this.depth) return fn();
    this.db.exec('BEGIN IMMEDIATE'); this.depth++; this.pending=[];
    let result:T;let changes:Change[];
    try { result=fn(); this.db.exec('COMMIT');changes=this.pending;this.pending=[];this.depth--; }
    catch(error) {this.db.exec('ROLLBACK');this.pending=[];this.depth--;throw error;}
    this.onChanges?.(changes);return result;
  }
  raw(kind:string,id:string,includeDeleted=false):RecordEntity|null {
    if(typeof id!=='string'||!id)return null;
    const row=this.db.prepare(`SELECT data FROM entities WHERE kind=? AND id=? ${includeDeleted?'':'AND deleted_at IS NULL'}`).get(kind,id) as any;
    return row?JSON.parse(row.data):null;
  }
  all(kind:string,workspaceId:string,includeDeleted=false):RecordEntity[] {
    if(kind==='users')return this.db.prepare(`SELECT e.data FROM entities e WHERE e.kind='users' AND e.deleted_at IS NULL AND e.id IN (SELECT json_extract(data,'$.userId') FROM entities WHERE kind='memberships' AND workspace_id=? AND deleted_at IS NULL)`).all(workspaceId).map((r:any)=>JSON.parse(r.data));
    return this.db.prepare(`SELECT data FROM entities WHERE kind=? AND workspace_id=? ${includeDeleted?'':'AND deleted_at IS NULL'}`).all(kind,workspaceId).map((r:any)=>JSON.parse(r.data));
  }
  role(userId:string,workspaceId:string) {
    const row=this.db.prepare("SELECT json_extract(data,'$.role') AS role FROM entities WHERE kind='memberships' AND workspace_id=? AND json_extract(data,'$.userId')=? AND json_extract(data,'$.teamId') IS NULL AND deleted_at IS NULL LIMIT 1").get(workspaceId,userId) as any;return row?.role||'none';
  }
  actorForUser(userId:string,workspaceId:string,scopes:string[]=['read']):Actor {
    let role=this.role(userId,workspaceId),appId:string|undefined;
    if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='oauth_app_installations'").get()){
      const installation=this.db.prepare('SELECT i.app_id,a.id AS active_id FROM oauth_app_installations i LEFT JOIN oauth_apps a ON a.id=i.app_id WHERE i.user_id=? AND i.workspace_id=?').get(userId,workspaceId) as {app_id:string;active_id:string|null}|undefined;
      if(installation){appId=installation.app_id;role=role==='none'||!installation.active_id?'none':'member';}
    }
    return {userId,workspaceId,role,scopes,...(appId?{appId}:{})};
  }
  accessRevision(workspaceId:string){return Number((this.db.prepare('SELECT revision FROM workspace_permissions WHERE workspace_id=?').get(workspaceId) as any)?.revision||0);}
  nextIssueNumber(teamId:string){
    if(!this.db.prepare('SELECT team_id FROM issue_sequences WHERE team_id=?').get(teamId)){const row=this.db.prepare("SELECT MAX(CAST(json_extract(data,'$.number') AS INTEGER)) AS n FROM entities WHERE kind='issues' AND json_extract(data,'$.teamId')=?").get(teamId) as any;this.db.prepare('INSERT INTO issue_sequences VALUES(?,?)').run(teamId,Number(row?.n||0));}
    return Number((this.db.prepare('UPDATE issue_sequences SET last_number=last_number+1 WHERE team_id=? RETURNING last_number').get(teamId) as any).last_number);
  }
  hasScope(actor:Actor,kind:string,write=false) {
    if(kind==='labelGroups'&&this.hasScope(actor,'labels',write))return true;
    if(actor.role==='guest'&&kind==='initiatives')return false;
    return actor.scopes.includes('admin') || actor.scopes.includes(write?'write':'read') || actor.scopes.includes(`${kind}:${write?'write':'read'}`) || (!write&&(actor.scopes.includes('write')||actor.scopes.includes(`${kind}:write`)));
  }
  cachedRaw(actor:Actor,kind:string,id:string,includeDeleted=false){const key=`${kind}:${id}:${includeDeleted}`;if(actor.recordCache?.has(key))return actor.recordCache.get(key)!;let result=this.raw(kind,id,includeDeleted);if(!result&&includeDeleted){const tombstone=this.db.prepare('SELECT access_data FROM entity_tombstones WHERE kind=? AND id=?').get(kind,id) as any;if(tombstone)result=JSON.parse(tombstone.access_data);}actor.recordCache?.set(key,result);return result;}
  canRead(actor:Actor,kind:string,e:RecordEntity,seen=new Set<string>()):boolean {
    const key=`${kind}:${e.id}`;actor.recordCache?.set(`${key}:true`,e);if(!e.deletedAt)actor.recordCache?.set(`${key}:false`,e);if(actor.permissionCache?.has(key))return actor.permissionCache.get(key)!;const result=this.canReadUncached(actor,kind,e,seen);actor.permissionCache?.set(key,result);return result;
  }
  private canReadUncached(actor:Actor,kind:string,e:RecordEntity,seen:Set<string>):boolean {
    if(actor.role==='none'&&!actor.system)return false;
    if(kind==='users')return this.hasScope(actor,kind)&&(e.id===actor.userId||this.role(e.id,actor.workspaceId)!=='none');
    if(kind==='workspaces'&&this.hasScope(actor,kind)&&this.role(actor.userId,e.id)!=='none')return true;
    if(e.workspaceId!==actor.workspaceId || !this.hasScope(actor,kind)) return false;
    if(actor.system)return true;
    if(kind==='issues'&&actor.appId){const team=this.cachedRaw(actor,'teams',e.teamId,true);if(!team||oauthAppTeamAccess(this,actor,team)!==true)return false;}
    if(kind==='issues'&&sharedIssueAccess(this,actor,e))return true;
    if(actor.role==='guest'&&!guestContentVisible(this,actor,kind,e))return false;
    if(PRIVATE.has(kind) && e.userId!==actor.userId) return false;
    if(kind==='asksPages'&&!['owner','admin'].includes(actor.role)&&!askPageTemplates(this,actor,e).length)return false;
    if(kind==='notifications'&&e.viewId){const view=this.cachedRaw(actor,'views',e.viewId);if(!view||!this.canRead({...actor,scopes:[...actor.scopes,'read']},'views',view,seen))return false;}
    if((kind==='favorites'||kind==='subscriptions')&&e.entityId){const parentKind=e.entityKind||({issue:'issues',project:'projects',customer:'customers',initiative:'initiatives',view:'views',team:'teams'} as any)[e.type];const parent=parentKind?this.cachedRaw(actor,parentKind,e.entityId,true):null;if(parent&&!this.canRead({...actor,scopes:[...actor.scopes,'read']},parentKind,parent,seen))return false;}
    if((kind==='views'||kind==='dashboards'||kind==='documents') && (e.visibility==='personal'||e.visibility==='private') && (e.creatorId||e.userId)!==actor.userId && !e.memberIds?.includes(actor.userId)) return false;
    if(seen.has(`${kind}:${e.id}`))return true; seen.add(`${kind}:${e.id}`);
    const teamIds=[...(e.teamIds||[]),...(e.teamId?[e.teamId]:[]),...(kind==='initiatives'&&e.leadTeamId?[e.leadTeamId]:[]),...(kind==='teams'?[e.id]:[])];
    if(kind==='projects'&&teamIds.length){if(!teamIds.some(id=>{const team=this.cachedRaw(actor,'teams',id,true);return !team||teamAccess(this,actor,team);}))return false;}
    for(const teamId of kind==='projects'?[]:teamIds) {
      const team=this.cachedRaw(actor,'teams',teamId,true); if(!team) continue;
      if(!teamAccess(this,actor,team))return false;
    }
    for(const field of ['issueId','projectId','documentId','updateId']) if(e[field]) {const parent=this.cachedRaw(actor,REFERENCES[field],e[field],true);if(parent&&!this.canRead({...actor,scopes:[...actor.scopes,'read']},REFERENCES[field],parent,seen))return false;}
    if(kind==='documents'&&e.cycleId){const parent=this.cachedRaw(actor,'cycles',e.cycleId,true);if(parent&&!this.canRead({...actor,scopes:[...actor.scopes,'read']},'cycles',parent,seen))return false;}
    if((kind==='activities'||kind==='notifications')&&e.entityKind&&e.entityId){const parent=this.cachedRaw(actor,e.entityKind,e.entityId,true);if(kind==='notifications'&&!parent)return false;if(parent&&!this.canRead({...actor,scopes:[...actor.scopes,'read']},e.entityKind,parent,seen))return false;}
    if((kind==='comments'||kind==='updates'||kind==='documents'||kind==='views'||kind==='dashboards')&&e.initiativeId){const parent=this.cachedRaw(actor,'initiatives',e.initiativeId,true);if(parent&&!this.canRead({...actor,scopes:[...actor.scopes,'read']},'initiatives',parent,seen))return false;}
    return true;
  }
  access(actor:Actor,kind:string,e?:RecordEntity,write=false,patch?:Record<string,unknown>) {
    assert(isKind(kind),404,'Unknown collection','NOT_FOUND');
    assert(this.hasScope(actor,kind,write),403,'The credential does not grant this scope','FORBIDDEN');
    if(e)assert(this.canRead({...actor,scopes:[...actor.scopes,'read']},kind,e),404,'Record not found','NOT_FOUND');
    if(write) {
      const guestResourceEdit=guestTeamResourcePatch(this,actor,kind,e,patch);
      assert(actor.role!=='none'&&(actor.role!=='guest'||guestResourceEdit||mayGuestEdit(this,actor,kind,e)),403,'A workspace member or shared issue access is required','FORBIDDEN');
      if(ADMIN.has(kind)&&!(['memberships','automations'].includes(kind)&&(!e||e.teamId)))assert(['owner','admin'].includes(actor.role),403,'Administrator access required','FORBIDDEN');
      if(e){if(!guestResourceEdit)assertTeamPolicy(this,actor,kind,e);assertTeamWritable(this,actor,kind,e);}
      if(kind==='users'&&e&&e.id!==actor.userId)throw new HttpError(403,'You can only edit your own profile','FORBIDDEN');
      if(kind==='activities')throw new HttpError(403,'Activity records cannot be edited','FORBIDDEN');
      if((kind==='comments'||kind==='updates')&&e&&e.authorId!==actor.userId&&!['owner','admin'].includes(actor.role))throw new HttpError(403,'Only the author can edit this comment','FORBIDDEN');
    }
  }
  present(actor:Actor,kind:string,e:RecordEntity){const key=actor.userId+':'+actor.workspaceId+':'+actor.role+':'+actor.scopes.join(',');if(this.representations.get(e)===key)return e;const result=presentEntity(this,actor,kind,kind==='issues'?projectedStatusTime(this,e):e);this.representations.set(result,key);return result;}
  get(actor:Actor,kind:string,id:string,includeDeleted=false) {
    let e=this.raw(kind,id,includeDeleted);
    if(!e&&kind==='issues'&&/^[a-z][a-z0-9]{0,9}-[1-9][0-9]*$/i.test(id)){
      const row=this.db.prepare(`SELECT data FROM entities WHERE kind='issues' AND workspace_id=? ${includeDeleted?'':'AND deleted_at IS NULL'} AND (json_extract(data,'$.identifier')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(entities.data,'$.previousIdentifiers')) WHERE value=?)) LIMIT 1`).get(actor.workspaceId,id.toUpperCase(),id.toUpperCase()) as {data:string}|undefined;
      if(row)e=JSON.parse(row.data);
    }
    assert(e,404,'Record not found','NOT_FOUND');this.access(actor,kind,e);return e;
  }
  list(actor:Actor,kind:string,opts:PaginationOptions&{filter?:any;orderBy?:string;includeDeleted?:boolean;query?:string}={}) {
    actor={...actor,recordCache:new Map(),permissionCache:new Map()};
    this.access(actor,kind);
    opts={...opts,filter:this.resolveFilter(actor,opts.filter,kind)};
    const {size,backward}=pagination(opts);const withEdges=(page:EntityPage)=>{const nodes=page.nodes.map(e=>this.present(actor,kind,e));return {...page,nodes,edges:nodes.map(node=>({node,cursor:this.cursor(actor,kind,node.id)}))};};
    const dependencyEnriched=kind==='projects'&&(usesProjectDependencyMetrics(opts.filter)||usesProjectDependencyMetrics(opts.orderBy?.split(':')[0]));
    const customerEnriched=['issues','projects'].includes(kind)&&(usesCustomerMetrics(opts.filter)||usesCustomerMetrics(opts.orderBy?.split(':')[0]));
    const projectLabelEnriched=kind==='issues'&&usesProjectLabels(opts.filter);
    const projectPropertyEnriched=kind==='issues'&&usesProjectProperties(opts.filter);
    const quickEnriched=kind==='issues'&&usesIssueQuickFilter(opts.filter);
    const enriched=projectPropertyEnriched||quickEnriched||dependencyEnriched||customerEnriched||projectLabelEnriched||(['issues','activities'].includes(kind)&&usesCycleTiming(opts.filter));
    const validatedFilter=filterSql(enriched?undefined:opts.filter);
    const rawFilterSafe=!enriched&&exactFilter(opts.filter,kind)&&canReadAllParents(this,actor);
    const compiled=rawFilterSafe?validatedFilter:{sql:'1',params:[]};
    const indexed=enriched?null:indexedList(this,actor,kind,opts,compiled,rawFilterSafe);if(indexed)return withEdges(indexed);
    let values=(kind==='users'?this.all(kind,actor.workspaceId):this.db.prepare(`SELECT data FROM entities WHERE kind=? AND workspace_id=? ${opts.includeDeleted?'':'AND deleted_at IS NULL'} AND (${compiled.sql})`).all(kind,actor.workspaceId,...compiled.params).map((r:any)=>JSON.parse(r.data) as RecordEntity)).filter(e=>this.canRead(actor,kind,e));
    if(customerEnriched){const metrics=buildCustomerMetrics(this.all('customers',actor.workspaceId).filter(e=>this.canRead(actor,'customers',e)),this.all('requests',actor.workspaceId).filter(e=>this.canRead(actor,'requests',e)),kind as 'issues'|'projects',values);values=values.map(e=>withCustomerMetrics(e,metrics));}
    if(projectLabelEnriched)values=this.enrichProjectLabels(actor,kind,values);
    if(projectPropertyEnriched)values=this.enrichProjectProperties(actor,kind,values);
    if(dependencyEnriched)values=this.enrichProjectDependencies(actor,kind,values);
    values=values.map(e=>this.present(actor,kind,e));
    if(quickEnriched){const readable=this.all('issues',actor.workspaceId).filter(e=>this.canRead(actor,'issues',e)).map(e=>this.present(actor,'issues',e));values=values.map(e=>withIssueQuickFilter(e,readable));}
    values=values.filter(e=>matchesFilter(e,opts.filter));
    if(opts.query) {const q=opts.query.toLowerCase(); values=values.filter(e=>[e.title,e.name,e.identifier,e.description,e.content,e.body].some(x=>String(x||'').replace(/<[^>]*>/g,' ').toLowerCase().includes(q)));}
    const parts=(opts.orderBy||'updatedAt:desc').split(':');const key=parts[0];const dir=parts[1]==='asc'?1:-1;
    values.sort((a,b)=>{const av=a[key]??'',bv=b[key]??'';return (av<bv?-1:av>bv?1:0)*dir||a.id.localeCompare(b.id);});
    const totalCount=values.length;let lower=0,upper=totalCount;
    if(opts.after||opts.before){const id=cursorId(actor,kind,opts.after||opts.before!),index=values.findIndex(e=>e.id===id);assert(index>=0,400,'Cursor record is no longer present; restart pagination','INVALID_CURSOR');if(opts.after)lower=index+1;else upper=index;}
    const start=backward?Math.max(lower,upper-size):lower,end=backward?upper:Math.min(upper,lower+size),nodes=values.slice(start,end);
    return withEdges({nodes,totalCount,pageInfo:{hasNextPage:end<totalCount,hasPreviousPage:start>0,startCursor:nodes.length?this.cursor(actor,kind,nodes[0].id):null,endCursor:nodes.length?this.cursor(actor,kind,nodes.at(-1)!.id):null}});
  }
  resolveFilter(actor:Actor,filter:any,kind='issues'){try{const fixed={...actor,now:actor.now??new Date()},prepare=(value:any)=>expandGroupFilter(this,fixed,resolveCalendarFilter(expandFilterGroups(resolveCurrentUserFilter(value,actor.userId)),{now:fixed.now,timeZone:fixed.timeZone??'UTC'}));return expandRelationshipFilter(this,fixed,prepare(filter),kind,prepare,matchesFilter,filterSql);}catch(error){if(error instanceof InvalidFilterGroup)throw new HttpError(400,error.message,'INVALID_FILTER');throw error}}
  enrichProjectProperties(actor:Actor,kind:string,values:RecordEntity[]){if(kind!=='issues')return values;const read=(kind:string)=>this.all(kind,actor.workspaceId).filter(e=>this.canRead(actor,kind,e));const index=projectPropertyIndex(read('projects'),read('labels'),read('milestones'));return values.map(e=>withProjectProperties(e,index));}
  enrichProjectLabels(actor:Actor,kind:string,values:RecordEntity[]){if(kind!=='issues')return values;const read=(kind:string)=>this.all(kind,actor.workspaceId).filter(entity=>this.canRead(actor,kind,entity));const index=projectLabelIndex(read('projects'),read('labels'));return values.map(entity=>withProjectLabels(entity,index));}
  enrichProjectDependencies(actor:Actor,kind:string,values:RecordEntity[]){if(kind!=='projects')return values;const read=(kind:string)=>this.all(kind,actor.workspaceId).filter(entity=>this.canRead(actor,kind,entity));const metrics=buildProjectDependencyMetrics({projects:read('projects'),issues:read('issues'),activities:read('activities'),statuses:read('statuses'),teams:read('teams')});return values.map(entity=>({...entity,...metrics.get(entity.id)}));}
  enrichCustomerMetrics(actor:Actor,kind:string,values:RecordEntity[]){if(kind!=='issues'&&kind!=='projects')return values;const metrics=buildCustomerMetrics(this.all('customers',actor.workspaceId).filter(e=>this.canRead(actor,'customers',e)),this.all('requests',actor.workspaceId).filter(e=>this.canRead(actor,'requests',e)),kind,values);return values.map(e=>withCustomerMetrics(e,metrics));}
  cursor(actor:Actor,kind:string,id:string){return Buffer.from(JSON.stringify({kind,workspaceId:actor.workspaceId,id})).toString('base64url');}
  scan(actor:Actor,kind:string,options:{first?:number;after?:string}={}){
    this.access(actor,kind);actor={...actor,recordCache:new Map(),permissionCache:new Map()};const first=Math.max(1,Math.min(options.first||500,2000));let lastId='';if(options.after){let cursor:any;try{cursor=JSON.parse(Buffer.from(options.after,'base64url').toString());}catch{throw new HttpError(400,'Invalid synchronization cursor','INVALID_CURSOR');}assert(cursor.kind===kind&&cursor.workspaceId===actor.workspaceId,400,'Cursor belongs to another collection','INVALID_CURSOR');lastId=cursor.id;}
    const nodes:RecordEntity[]=[];let done=false;while(nodes.length<=first&&!done){const rows=kind==='users'?this.db.prepare("SELECT id,data FROM entities WHERE kind='users' AND deleted_at IS NULL AND id>? AND id IN (SELECT json_extract(data,'$.userId') FROM entities WHERE kind='memberships' AND workspace_id=? AND deleted_at IS NULL) ORDER BY id LIMIT ?").all(lastId,actor.workspaceId,Math.max(500,first+1)) as any[]:this.db.prepare('SELECT id,data FROM entities WHERE kind=? AND workspace_id=? AND id>? ORDER BY id LIMIT ?').all(kind,actor.workspaceId,lastId,Math.max(500,first+1)) as any[];if(!rows.length)break;for(const row of rows){lastId=row.id;const e=JSON.parse(row.data);if(this.canRead(actor,kind,e))nodes.push(this.present(actor,kind,e));if(nodes.length>first)break;}done=rows.length<Math.max(500,first+1);}
    const hasNextPage=nodes.length>first;const page=nodes.slice(0,first);return {nodes:page,pageInfo:{hasNextPage,endCursor:page.length?this.cursor(actor,kind,page.at(-1)!.id):null}};
  }
  bootstrap(actor:Actor){
    const state:any={workspaceId:actor.workspaceId,user:this.raw('users',actor.userId)},cursors:Record<string,string>={};
    const heavy=new Set(['issues','documents','comments','activities','notifications','requests']);
    for(const kind of KINDS){if(!this.hasScope(actor,kind)){state[kind]=[];continue;}if(heavy.has(kind)){const page=this.scan(actor,kind,{first:kind==='issues'?500:100});state[kind]=page.nodes;if(page.pageInfo.hasNextPage)cursors[kind]=page.pageInfo.endCursor!;}else state[kind]=this.all(kind,actor.workspaceId,!['users','memberships','workspaces'].includes(kind)).filter(e=>this.canRead(actor,kind,e)).map(e=>this.present(actor,kind,e));}
    if(this.hasScope(actor,'workspaces'))state.workspaces=this.db.prepare("SELECT e.data FROM entities e WHERE e.kind='workspaces' AND e.deleted_at IS NULL AND e.id IN (SELECT workspace_id FROM entities WHERE kind='memberships' AND deleted_at IS NULL AND json_extract(data,'$.userId')=? AND json_extract(data,'$.teamId') IS NULL)").all(actor.userId).map((r:any)=>JSON.parse(r.data));
    const seq=Number((this.db.prepare('SELECT MAX(seq) AS seq FROM changes WHERE workspace_id=?').get(actor.workspaceId) as any)?.seq||0);return {state,cursors,seq,accessRevision:this.accessRevision(actor.workspaceId)};
  }
  changes(actor:Actor,after:number,first=1000){
    actor={...actor,recordCache:new Map(),permissionCache:new Map()};const limit=Math.min(Math.max(first,1),2000);const rows=this.db.prepare('SELECT * FROM changes WHERE workspace_id=? AND seq>? ORDER BY seq LIMIT ?').all(actor.workspaceId,after,limit+1) as any[];const page=rows.slice(0,limit);const events=page.flatMap(row=>{const entity=JSON.parse(row.data);return this.canRead(actor,row.kind,this.raw(row.kind,entity.id,true)||entity)?[{seq:row.seq,kind:row.kind,action:row.action,entity:this.present(actor,row.kind,entity),id:row.entity_id,actorId:row.actor_id,workspaceId:row.workspace_id}]:[];});return {events,nextSeq:page.length?Number(page.at(-1).seq):after,hasMore:rows.length>limit,accessRevision:this.accessRevision(actor.workspaceId)};
  }
  state(actor:Actor) {
    actor={...actor,recordCache:new Map(),permissionCache:new Map()};
    const state:any={workspaceId:actor.workspaceId,user:this.raw('users',actor.userId)};
    for(const kind of KINDS) state[kind]=this.hasScope(actor,kind)?this.all(kind,actor.workspaceId,!['users','memberships','workspaces'].includes(kind)).filter(e=>this.canRead(actor,kind,e)).map(e=>this.present(actor,kind,e)):[];
    if(this.hasScope(actor,'workspaces'))state.workspaces=this.db.prepare("SELECT e.data FROM entities e WHERE e.kind='workspaces' AND e.deleted_at IS NULL AND e.id IN (SELECT workspace_id FROM entities WHERE kind='memberships' AND deleted_at IS NULL AND json_extract(data,'$.userId')=? AND json_extract(data,'$.teamId') IS NULL)").all(actor.userId).map((r:any)=>JSON.parse(r.data));
    state.seq=Number((this.db.prepare('SELECT MAX(seq) AS seq FROM changes WHERE workspace_id=?').get(actor.workspaceId) as any)?.seq||0);
    return state;
  }
  validate(actor:Actor,kind:string,e:RecordEntity,previous?:RecordEntity,provided:Record<string,any>=e) {
    if(actor.role==='guest'&&!actor.system)assert(guestTeamResourcePatch(this,actor,kind,previous,provided)||mayGuestEdit(this,actor,kind,e),403,'Guest access is limited to operational work in explicitly joined teams','FORBIDDEN');
    if(kind==='workspaces'&&e.approvedEmailDomains!==undefined)e.approvedEmailDomains=validateApprovedDomains(e.approvedEmailDomains);
    if(kind==='workspaces'&&!actor.system)for(const key of ['deletionRequestedBy','deletionScheduledAt','deletionExecuteAt'])if(Object.hasOwn(provided,key))assert((provided[key]??null)===(previous?.[key]??null),403,'Use the confirmed workspace deletion flow','FORBIDDEN');
    assertTeamWritable(this,!previous&&kind==='issues'?{...actor,system:false}:actor,kind,e);
    if(kind==='teams'&&e.parentId&&(!previous||previous.parentId!==e.parentId)){const parent=this.raw('teams',e.parentId);if(parent)assertTeamWritable(this,{...actor,system:false},'teams',parent);}
    if(!actor.system)for(const key of ['retiredAt','teamDeletionCohort'])if(Object.hasOwn(provided,key))assert((provided[key]??null)===(previous?.[key]??null),403,'Use the team retirement or restoration flow','FORBIDDEN');
    if(kind==='asksPages')validateAskPage(this,actor,e);
    if(kind==='asksForms')validateAskForm(e);
    if(kind==='labelGroups')validateLabelGroup(this,actor,e,previous);
    if(kind==='labels'){
      prepareLabelGroup(this,actor,e,previous,provided);
      const nameError=issueLabelNameError(e,previous);assert(!nameError,422,nameError||'Reserved label name','RESERVED_LABEL_NAME');
      const type=e.entityType??'issues';assert(['issues','projects'].includes(type),422,'Labels support issues or projects','INVALID_LABEL_TYPE');
      if(previous&&(previous.entityType??'issues')!==type){const used=this.db.prepare("SELECT 1 FROM entities e WHERE e.workspace_id=? AND e.kind=? AND EXISTS(SELECT 1 FROM json_each(e.data,'$.labelIds') WHERE value=?) LIMIT 1").get(actor.workspaceId,type==='issues'?'projects':'issues',e.id);assert(!used,422,'Remove this label from work before changing its type','LABEL_TYPE_IN_USE');}
    }
    if((kind==='issues'||kind==='projects')&&e.labelIds){assert(Array.isArray(e.labelIds),422,'Labels must be an array','VALIDATION_ERROR');for(const id of e.labelIds){if(previous?.labelIds?.includes(id))continue;const label=this.raw('labels',id);if(label){assert((label.entityType??'issues')===kind,422,'Label type does not match this work','INVALID_LABEL_TYPE');assert(!label.archivedAt,422,'Archived labels cannot be newly applied','ARCHIVED_LABEL');}}}
    if(kind==='labels'&&e.group){
      assert(typeof e.group==='string',422,'Label group must be a name','VALIDATION_ERROR');
      const count=this.db.prepare("SELECT COUNT(*) AS count FROM entities WHERE workspace_id=? AND kind='labels' AND deleted_at IS NULL AND id<>? AND json_extract(data,'$.group')=? AND COALESCE(json_extract(data,'$.teamId'),'')=? AND COALESCE(json_extract(data,'$.entityType'),'issues')=?").get(actor.workspaceId,e.id,e.group,e.teamId||'',e.entityType||'issues') as {count:number};
      assert(count.count<250,422,'A label group can contain at most 250 labels','LABEL_GROUP_LIMIT');
    }
    if(!guestTeamResourcePatch(this,actor,kind,previous,provided))assertTeamPolicy(this,actor,kind,e);
    if(kind==='memberships'&&previous?.teamId&&previous.role==='owner')assert(isTeamOwner(this,actor,this.raw('teams',previous.teamId)!),403,'Only team owners can manage owners','TEAM_OWNER_REQUIRED');
    if(kind==='comments')validateComment(this,actor,e,previous,provided);
    if(kind==='subscriptions'){
      if(e.entityKind==='teams'){
        const team=this.raw('teams',e.entityId);
        assert(team&&!team.archivedAt&&this.canRead({...actor,scopes:[...actor.scopes,'read']},'teams',team),422,'Choose an accessible team','INVALID_TEAM_SUBSCRIPTION');
        for(const field of ['notifyOnAdded','notifyOnClosed','notifyOnTriage']){if(e[field]===undefined)e[field]=false;assert(typeof e[field]==='boolean',422,'Subscription options must be booleans','INVALID_TEAM_SUBSCRIPTION');}
        assert(e.notifyOnAdded||e.notifyOnClosed||e.notifyOnTriage,422,'Choose at least one notification event','INVALID_TEAM_SUBSCRIPTION');
        assert(!this.all('subscriptions',actor.workspaceId).some(s=>s.id!==e.id&&s.userId===e.userId&&s.entityKind==='teams'&&s.entityId===e.entityId),409,'Already subscribed to this team','DUPLICATE_TEAM_SUBSCRIPTION');
      }
      if(previous?.entityKind==='teams')assert(e.entityKind==='teams'&&e.entityId===previous.entityId,422,'A team subscription cannot change its target','INVALID_TEAM_SUBSCRIPTION');
      validateThreadSubscription(this,actor,e,previous);validateViewSubscription(this,actor,e,previous);validateLabelSubscription(this,actor,e,previous);}
    if(kind==='favorites')validateFavorite(this,actor,e,previous,provided);
    if(kind==='views'){if(e.entityType===undefined)e.entityType='issues';assert(['issues','projects','initiatives'].includes(e.entityType),422,'Views support issues, projects or initiatives','INVALID_VIEW_TYPE');normalizeViewOwner(this,actor,e,previous);}
    if(kind==='notifications'){if(actor.role==='guest'&&!previous)assert(e.type==='reminder',403,'Guests can create only their own reminders','FORBIDDEN');validateReminder(this,actor,e,previous);validateNotificationArrival(actor,e,previous,provided);}
    if(kind==='teams'||kind==='automations')validateTriageSettings(this,actor,kind,e,previous);
    if(kind==='documents')for(const id of e.subscriberIds||[])if(!previous?.subscriberIds?.includes(id)){const recipient=this.actorForUser(id,actor.workspaceId);assert(recipient.role!=='none'&&this.canRead(recipient,'documents',e),422,'Subscriber must have access to this document','INVALID_SUBSCRIBER');}
    sanitizeEntityContent(e);if(actor.role==='guest'&&['comments','favorites','subscriptions'].includes(kind))assert(mayGuestEdit(this,actor,kind,e),403,'Guests can comment only on issues shared with them','FORBIDDEN');validateUpdateEntity(this,actor,kind,e,previous);if(['issues','comments','updates'].includes(kind))validateReactions(this,actor,e,previous);
    if(kind==='issues'||kind==='comments')this.deriveIssueReferences(actor,e);
    if(kind==='issues'){this.addMentionRelations(actor,e,e,previous);prepareIssueRelations(this,actor,e,provided,previous);}
    if(kind==='customerTiers')validateCustomerTier(this,actor,e,previous);
    if(NAMED.has(kind))assert(typeof e.name==='string'&&e.name.trim().length>0&&e.name.length<=500,422,'Name must contain 1–500 characters','VALIDATION_ERROR');
    if(kind==='issues'||kind==='documents'||kind==='requests')assert(typeof e.title==='string'&&e.title.trim().length>0&&e.title.length<=1000,422,'Title must contain 1–1000 characters','VALIDATION_ERROR');
    if(kind==='projects'&&e.labelIds){assert(Array.isArray(e.labelIds),422,'Labels must be an array','VALIDATION_ERROR');const groups=new Set<string>();for(const id of e.labelIds){const label=this.raw('labels',id);if(label?.group){assert(!groups.has(label.group),422,'A project can have only one label from each group','LABEL_GROUP_CONFLICT',{group:label.group});groups.add(label.group);}}}
    if(kind==='comments')assert(typeof e.body==='string'&&e.body.trim().length>0,422,'Comment cannot be empty','VALIDATION_ERROR');
    if(kind==='issues') {
      validateIssueSharing(this,actor,e,previous);
      assert(e.teamId,422,'An issue must belong to a team','VALIDATION_ERROR');
      assert(Number.isInteger(e.priority)&&e.priority>=0&&e.priority<=4,422,'Priority must be between 0 and 4','VALIDATION_ERROR');
      assert(e.estimate==null||(typeof e.estimate==='number'&&Number.isFinite(e.estimate)&&e.estimate>=0),422,'Estimate must be nonnegative','VALIDATION_ERROR');
      if(e.statusId){const status=this.raw('statuses',e.statusId);assert(status?.teamId===e.teamId,422,'Status belongs to another team','VALIDATION_ERROR');}
      if(e.cycleId){const cycle=this.raw('cycles',e.cycleId);assert(cycle?.teamId===e.teamId,422,'Cycle belongs to another team','VALIDATION_ERROR');}
      if(e.labelIds){assert(Array.isArray(e.labelIds),422,'Labels must be an array','VALIDATION_ERROR');const groups=new Set<string>();for(const id of e.labelIds){const label=this.raw('labels',id);if(label&&(!previous?.labelIds?.includes(id)||previous.teamId!==e.teamId))assert(templateApplies(this,label,e.teamId),422,'Label belongs to a different team hierarchy','INVALID_LABEL_SCOPE');if(label?.group){assert(!groups.has(label.group),422,'An issue can have only one label from each group','LABEL_GROUP_CONFLICT',{group:label.group});groups.add(label.group);}}}
      if(e.milestoneId){const milestone=this.raw('milestones',e.milestoneId);assert(milestone?.projectId===e.projectId,422,'Milestone belongs to another project','VALIDATION_ERROR');}
      if(e.relations){assert(Array.isArray(e.relations)&&e.relations.length<=1000,422,'Relations must be an array','VALIDATION_ERROR');for(const relation of e.relations){if(previous&&sharedIssueAccess(this,actor,previous)&&previous.relations?.some((old:any)=>JSON.stringify(old)===JSON.stringify(relation)))continue;assert(['related','blocks','blocked_by','blocking','blockedBy','duplicate'].includes(relation.type)&&relation.issueId!==e.id,422,'Invalid issue relation','INVALID_RELATION');const target=this.raw('issues',relation.issueId);assert(target&&this.canRead(actor,'issues',target),422,'Related issue is not accessible','INVALID_REFERENCE');}}
    }
    for(const [field,targetKind] of Object.entries(REFERENCES))if(e[field]!=null&&e[field]!=='') {if(previous&&e[field]===previous[field]&&(kind==='projects'||kind==='requests'||kind==='issues'&&sharedIssueAccess(this,actor,previous)))continue;const target=this.raw(targetKind,e[field]);if(kind==='issues'&&['statusId','cycleId'].includes(field)&&previous&&sharedIssueAccess(this,actor,previous)&&target?.teamId===previous.teamId)continue;assert(target&&this.canRead({...actor,scopes:[...actor.scopes,'read']},targetKind,target),422,`${field} does not reference an accessible record`,'INVALID_REFERENCE');}
    for(const [field,targetKind] of Object.entries(ARRAYS))if(e[field]!=null) {assert(Array.isArray(e[field])&&e[field].length<=1000,422,`${field} must be an array`,'VALIDATION_ERROR');for(const id of e[field]){if(previous?.[field]?.includes(id)&&(kind==='initiatives'&&field==='projectIds'||kind==='projects'||kind==='issues'&&sharedIssueAccess(this,actor,previous)))continue;const target=this.raw(targetKind,id);if(kind==='issues'&&targetKind==='labels'&&target&&previous?.labelIds?.includes(id)&&previous.teamId===e.teamId)continue;if(kind==='issues'&&targetKind==='labels'&&previous&&sharedIssueAccess(this,actor,previous)&&target&&templateApplies(this,target,previous.teamId))continue;assert(target&&this.canRead({...actor,scopes:[...actor.scopes,'read']},targetKind,target),422,`${field} references an inaccessible record`,'INVALID_REFERENCE');if(targetKind===kind)assert(id!==e.id,422,'A record cannot relate to itself','INVALID_RELATION');}}
    if(e.parentId&&!(kind==='issues'&&previous?.parentId===e.parentId&&sharedIssueAccess(this,actor,e))){const parent=this.raw(kind,e.parentId);assert(parent&&this.canRead(actor,kind,parent),422,'Parent does not exist','INVALID_REFERENCE');let current:RecordEntity|null=parent;const seen=new Set([e.id]);while(current){assert(!seen.has(current.id),422,'Parent relation would create a cycle','CYCLIC_RELATION');seen.add(current.id);current=current.parentId?this.raw(kind,current.parentId):null;}}
    for(const field of kind==='issues'?['dependencyIds']:['blockedByIds','dependencyIds'])if(e[field]) {assert(Array.isArray(e[field]),422,`${field} must be an array`,'VALIDATION_ERROR');const visit=(id:string,seen:Set<string>)=>{assert(id!==e.id,422,'Dependency would create a cycle','CYCLIC_RELATION');if(seen.has(id))return;seen.add(id);const other=this.raw(kind,id);assert(other&&this.canRead(actor,kind,other),422,'Dependency does not exist','INVALID_REFERENCE');for(const next of other[field]||[])visit(next,seen);};for(const id of e[field])if(!(kind==='issues'&&previous?.[field]?.includes(id)&&sharedIssueAccess(this,actor,previous)))visit(id,new Set());}
    if(e.duplicateOfId){assert(kind==='issues'&&e.duplicateOfId!==e.id,422,'Invalid duplicate relation','INVALID_RELATION');if(!(previous?.duplicateOfId===e.duplicateOfId&&sharedIssueAccess(this,actor,e)))this.get(actor,'issues',e.duplicateOfId);}
    for(const field of ['dueDate','targetDate','startDate','endDate','snoozedUntil','nextRunAt'])if(e[field])assert(typeof e[field]==='string'&&Number.isFinite(Date.parse(e[field])),422,`${field} must be an ISO date`,'VALIDATION_ERROR');
    if(e.startDate&&e.endDate)assert(Date.parse(e.startDate)<Date.parse(e.endDate),422,'End date must be after start date','VALIDATION_ERROR');
    if(kind==='initiatives')validateInitiative(this,actor,e,previous);
    if(kind==='customers')validateCustomer(this,actor,e,previous,provided);
    if(kind==='requests')validateRequest(this,e,actor,previous);
    if(kind==='workspaces'){validateCustomerSettings(this,actor,e);if(e.workWeek!==undefined)assert(['mon-fri','sun-thu'].includes(e.workWeek),422,'Choose Monday–Friday or Sunday–Thursday business days','INVALID_WORK_WEEK');}
    if(kind==='comments'&&e.anchor){assert(e.anchor.kind==='yjs'&&typeof e.anchor.quote==='string'&&e.anchor.quote.length<=1000&&JSON.stringify(e.anchor).length<=10000,422,'Invalid comment anchor','INVALID_COMMENT_ANCHOR');}
    if(kind==='workspaces'){validateProjectStatuses(this,actor,e);validateCustomEmojis(actor,e,previous);}
    if(kind==='projects')applyProjectStatus(this,actor,e,previous);
    if(kind==='templates'){validateTemplate(this,actor,e,previous);validateProjectPlan(e);}
    if(kind==='teams'){validateTeamHierarchy(this,actor,e);if(!previous||previous.parentId===e.parentId)validateTeamTemplates(this,actor,e);}
    if(!actor.hierarchySync&&previous&&((kind==='statuses'&&previous.inheritedStatusId)||(kind==='cycles'&&previous.inheritedCycleId)))assert(false,422,'Edit the inherited definition on the parent team','INHERITED_SETTING');
    if(kind==='teams'){assert(/^[A-Z][A-Z0-9]{0,9}$/.test(e.key||e.identifier||''),422,'Team identifier must use 1–10 uppercase letters or numbers','VALIDATION_ERROR');const key=e.key||e.identifier;assert(!this.all('teams',actor.workspaceId).some(t=>t.id!==e.id&&(t.key||t.identifier)===key),409,'Team identifier already exists','CONFLICT');e.key=key;e.identifier=key;}
    if(kind==='memberships'){assert(actor.system||!Object.hasOwn(provided,'pendingInvitation')||e.pendingInvitation===previous?.pendingInvitation,422,'Invitation acceptance is managed by invitation redemption','PENDING_INVITATION');assert(!(e.pendingInvitation&&!e.teamId&&e.role==='owner'),422,'Accept the invitation before assigning workspace ownership','PENDING_INVITATION');assert(['owner','admin','member','guest'].includes(e.role),422,'Invalid membership role','VALIDATION_ERROR');assert(e.userId&&this.raw('users',e.userId)&&this.role(e.userId,actor.workspaceId)!=='none',422,'User not in workspace; create an invitation first','INVALID_REFERENCE');assert(!this.all('memberships',actor.workspaceId).some(m=>m.id!==e.id&&m.userId===e.userId&&(m.teamId||null)===(e.teamId||null)),409,'Membership already exists','CONFLICT');if(previous?.role==='owner'&&!previous.teamId&&e.role!=='owner')assert(this.all('memberships',actor.workspaceId).some(m=>m.id!==e.id&&m.role==='owner'&&!m.teamId),422,'Workspace must have at least one owner','LAST_OWNER');}
    if(kind==='memberships'&&!e.teamId&&previous&&previous.role!=='guest'&&e.role==='guest'){
      this.db.prepare('DELETE FROM api_tokens WHERE user_id=? AND workspace_id=?').run(e.userId,actor.workspaceId);
      if(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='oauth_refresh_tokens'").get())this.db.prepare('UPDATE oauth_refresh_tokens SET revoked_at=? WHERE user_id=? AND workspace_id=?').run(new Date().toISOString(),e.userId,actor.workspaceId);
    }
    if(kind==='statuses')validateWorkflowStatus(this,actor,e,previous);
    if(kind==='users'){if(e.username!=null){assert(typeof e.username==='string',422,'Username must be text','INVALID_USERNAME');e.username=e.username.trim();assert(e.username===''||/^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(e.username),422,'Username must contain 1–32 letters, numbers, dots, underscores or hyphens','INVALID_USERNAME');if(e.username)assert(!this.db.prepare("SELECT id FROM entities WHERE kind='users' AND deleted_at IS NULL AND id<>? AND lower(json_extract(data,'$.username'))=lower(?) LIMIT 1").get(e.id,e.username),409,'This username is already in use','USERNAME_EXISTS');}const account=this.db.prepare('SELECT email FROM accounts WHERE id=?').get(e.id) as any;assert(account&&(account.email===e.email||previous?.email===e.email),422,'Account email cannot be changed through profile updates','VALIDATION_ERROR');}
    if(kind==='integrations'){assert(!e.connected&&!e.accessToken&&!e.refreshToken,422,'Provider connections are not implemented yet','CONNECTOR_UNAVAILABLE');e.status='not_connected';}
    validateRecurrence(e.recurrence);
    if(kind==='slaPolicies'&&e.action!=='remove'){slaDeadline(actor.now||new Date(),Number(e.duration??e.durationMinutes),e.durationUnit||'minute');if(e.durationUnit)assert(['hour','day','businessDay','week'].includes(e.durationUnit),422,'Invalid SLA duration unit','VALIDATION_ERROR');}
    assert(JSON.stringify(e).length<2_000_000,413,'Record is too large','PAYLOAD_TOO_LARGE');
  }
  create(actor:Actor,kind:string,fields:any,options:{createdAt?:Date}={}):RecordEntity {
    return this.transaction(()=>{
      this.access(actor,kind,undefined,true);
      assert(kind!=='workspaces'&&kind!=='users',422,kind==='workspaces'?'Use the authenticated workspace creation endpoint':'Use invitations to add accounts','INVALID_OPERATION');
      const id=fields.id||randomUUID();assert(typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id),422,'Invalid record ID','VALIDATION_ERROR');
      assert(!this.db.prepare('SELECT id FROM entity_tombstones WHERE kind=? AND id=?').get(kind,id),410,'This record was permanently deleted','PERMANENTLY_DELETED');const existing=this.raw(kind,id,true);if(existing){this.access(actor,kind,existing);return existing;}
      const at=(actor.now||new Date()).toISOString();const clean={...fields};for(const key of ['workspaceId','createdAt','updatedAt','lastEditedBy','lastEditedAt','mergedLabelIds','version','deletedAt','creatorId','authorId','creatorIdentity','actorIdentity','sharedAccess','canManageSharing','sharedStatuses','sharedLabels','sharedEstimateConfig','initializeWorkflow','initializeCycles','__proto__','constructor','prototype','cycleAddedAt','cycleAddition','subscribers','subscriptionUserIds','replaceSubscribers','convertedTo','convertTo'])delete clean[key];
      if(kind==='issues')for(const key of [...TRIAGE_DERIVED_FIELDS,...statusTimeFields])delete clean[key];
      if(kind==='cycles'&&!actor.cycleSync)for(const key of CYCLE_DERIVED_FIELDS)delete clean[key];
      assert(options.createdAt===undefined||(kind==='requests'&&options.createdAt instanceof Date&&Number.isFinite(options.createdAt.getTime())&&options.createdAt.getTime()<=Date.parse(at)),422,'Invalid historical creation time','INVALID_CREATED_AT');
      const e:RecordEntity={...clean,id,workspaceId:actor.workspaceId,createdAt:options.createdAt?.toISOString()??at,updatedAt:at,version:1,creatorId:actor.userId};
      if(actor.requesterIntake)e.creatorIdentity=requesterIdentity(this,actor.workspaceId,actor.userId);
      if(PRIVATE.has(kind)||kind==='subscriptions')e.userId=actor.userId;
      if(kind==='comments'||kind==='updates'){e.authorId=actor.userId;e.userId=actor.userId;if(e.entityId&&e.entityType){const map:Record<string,string>={issue:'issueId',project:'projectId',initiative:'initiativeId',document:'documentId'};if(map[e.entityType])e[map[e.entityType]]=e.entityId;}}
      if(kind==='users'){delete e.password;delete e.passwordHash;delete e.emailVerified;}
      if(kind==='documents'||kind==='projects'){delete e.history;e.lastEditedBy=actor.userId;e.lastEditedAt=at;}
      if(kind==='documents')e.subscriberIds=[...new Set([actor.userId,...(e.subscriberIds||[])])];
      let appliedTemplate:RecordEntity|null=null;
      if(kind==='issues') {
        prepareParentIssue(this,actor,e);appliedTemplate=prepareIssueTemplate(this,actor,e,fields);inheritParentIssue(this,actor,e);
        assert(typeof e.title==='string'&&e.title.trim(),422,'Title is required','VALIDATION_ERROR');assert(typeof e.teamId==='string'&&e.teamId.length,422,'An issue must belong to a team','VALIDATION_ERROR');
        e.priority??=0;e.labelIds??=[];if(e.assigneeId===undefined&&this.raw('users',actor.userId)?.preferences?.autoAssign)e.assigneeId=actor.userId;e.assigneeId??=null;e.description??='';e.sortOrder??=Date.now();
        prepareRecurringIssue(this,actor,e,fields);if(e.recurrence&&!e.nextRunAt)e.nextRunAt=e.recurrence.startDate||new Date(Date.now()+86400000).toISOString();
        prepareTriage(this,actor,e,fields);
        inheritParentIssue(this,actor,e);prepareDuplicateIssue(this,actor,e);if(this.raw('statuses',e.statusId)?.type==='started')e.startedAt??=at;if(['completed','canceled','duplicate'].includes(this.raw('statuses',e.statusId)?.type))e.completedAt=at;
        const team=this.raw('teams',e.teamId);
        e.slaPolicyId ||=team?.slaPolicyId||null;
        e.previousIdentifiers=[];e.number=this.nextIssueNumber(e.teamId);e.identifier=`${team?.key||team?.identifier||'ISS'}-${e.number}`;e.subscriberIds=[...new Set([...(e.subscriberIds||[]),...(actor.system&&actor.requesterIntake?[]:[actor.userId]),e.assigneeId].filter(Boolean))];
      }
      if(kind==='teams'){const workspace=this.raw('workspaces',actor.workspaceId);assert(actor.system||actor.role!=='guest'&&actor.role!=='none'&&(workspace?.teamCreationPolicy!=='admins'||['owner','admin'].includes(actor.role)),403,'Team creation permission is required','FORBIDDEN');prepareCycleSettings(this,actor,e,fields);prepareTeamHierarchy(this,actor,e,fields);}
      if(kind==='cycles')prepareCycle(this,actor,e,fields);
      if(kind==='issues')applyCycleAutomation(this,actor,e,fields);
      if(kind==='initiatives')normalizeInitiative(e,fields);
      if(kind==='projects')appliedTemplate=prepareProjectTemplate(this,actor,e,fields);
      if(kind==='issues')applySla(this,actor,e,undefined,e,matchesFilter,actor.now||new Date());
      if(kind==='templates')prepareTemplateAssets(this,actor,e);this.validate(actor,kind,e,undefined,fields);if(kind==='issues')prepareStatusTime(this,e);this.bindAttachments(actor,kind,e);this.save(kind,e,'create',actor);if(kind==='issues'){synchronizeIssueRelations(this,actor,e);mergeIssueContext(this,actor,e);}if(kind==='comments'){this.commentMentions(actor,e);subscribeCommentParticipants(this,actor,e);}this.activity(actor,kind,e,'create');this.notify(actor,kind,e);recordLatestUpdate(this,actor,kind,e);synchronizeTeamHierarchy(this,actor,kind,e);if(kind==='teams'&&fields.initializeWorkflow!==false)initializeTeamWorkflow(this,actor,this.raw('teams',e.id)!);if(kind==='issues'&&appliedTemplate?.subIssues?.length)createTemplateChildren(this,actor,e,appliedTemplate);if(kind==='projects'&&appliedTemplate)createProjectPlan(this,actor,e,appliedTemplate);if(kind!=='teams'||fields.initializeCycles!==false)cycleEntityChanged(this,actor,kind,e);return kind==='teams'||kind==='notifications'?this.raw(kind,e.id)!:e;
    });
  }
  update(actor:Actor,kind:string,id:string,patch:any):RecordEntity {
    return this.transaction(()=>{
      const previous=this.get(actor,kind,id);if(kind==='issues')validateSharedIssuePatch(this,actor,previous,patch);
      const reactionOnly=(kind==='comments'||kind==='updates')&&Object.keys(patch).every(key=>['reactions','version'].includes(key)),threadResolution=kind==='comments'&&resolutionOnly(patch);
      if(!reactionOnly&&!threadResolution)this.access(actor,kind,previous,true,patch);else assert(actor.role!=='none'&&this.hasScope(actor,kind,true)&&(actor.role!=='guest'||mayGuestEdit(this,actor,kind,previous)),403,'Write access required','FORBIDDEN');
      if(patch.version!=null&&patch.version!==previous.version)throw new HttpError(409,'Record changed on another client','VERSION_CONFLICT',{current:this.present(actor,kind,previous)});
      if((kind==='labels'||kind==='labelGroups')&&Object.hasOwn(patch,'convertTo')){
        assert(patch.convertTo===(kind==='labels'?'labelGroups':'labels')&&Object.keys(patch).every(key=>['convertTo','version'].includes(key)),422,'Conversion cannot be combined with other edits','INVALID_LABEL_CONVERSION');
        return convertLabel(this,actor,kind,previous);
      }
      if(kind==='labels'&&Object.hasOwn(patch,'mergeIntoId')){assert(Object.keys(patch).every(key=>['mergeIntoId','version'].includes(key)),422,'Merge cannot be combined with other label edits','INVALID_LABEL_MERGE');return mergeLabel(this,actor,previous,patch.mergeIntoId);}
      const clean={...patch};if(kind==='projects')preserveHiddenProjectTeams(this,actor,previous,clean);for(const key of ['id','workspaceId','createdAt','updatedAt','lastEditedBy','lastEditedAt','mergedLabelIds','creatorId','authorId','number','identifier','creatorIdentity','actorIdentity','sharedAccess','canManageSharing','sharedStatuses','sharedLabels','sharedEstimateConfig','deletedAt','password','passwordHash','__proto__','constructor','prototype','cycleAddedAt','cycleAddition','subscribers','subscriptionUserIds','replaceSubscribers','convertedTo','convertTo'])delete clean[key];
      if(PRIVATE.has(kind)||kind==='subscriptions')delete clean.userId;
      if(kind==='documents'||kind==='projects')delete clean.history;
      if(kind==='issues')for(const key of TRIAGE_DERIVED_FIELDS)delete clean[key];
      if(kind==='cycles'&&!actor.cycleSync)for(const key of CYCLE_DERIVED_FIELDS)delete clean[key];
      const selectedSubscribers=kind==='issues'?prepareSubscriberSelection(this,actor,previous,patch):undefined;
      if(selectedSubscribers){clean.subscriberIds=selectedSubscribers.filter(id=>(previous.subscriberIds??[]).includes(id)||!(previous.subscriptionUserIds??[]).includes(id));clean.subscriptionUserIds=(previous.subscriptionUserIds??[]).filter((id:string)=>selectedSubscribers.includes(id));}
      const e={...previous,...clean,version:previous.version+1,updatedAt:(actor.now||new Date()).toISOString()};
      if(kind==='comments'||kind==='updates'){e.userId=previous.userId;e.authorId=previous.authorId;}
      if(kind==='comments'&&e.body!==previous.body)e.editedAt=new Date().toISOString();
      if(kind==='teams'){prepareCycleSettings(this,actor,e,patch);prepareTeamHierarchy(this,actor,e,patch,previous);}
      if(kind==='cycles')prepareCycle(this,actor,e,patch,previous);
      if(kind==='initiatives')normalizeInitiative(e,patch,previous);
      const previousAttribution=(kind==='documents'||kind==='projects')?contentAttribution(previous,kind,previous.lastEditedBy?[]:(this.db.prepare("SELECT data FROM entities WHERE workspace_id=? AND kind='activities' AND deleted_at IS NULL AND json_extract(data,'$.entityId')=?").all(actor.workspaceId,id) as {data:string}[]).map(row=>JSON.parse(row.data))):null;
      if(kind==='documents'&&(e.content!==previous.content||e.title!==previous.title)){e.history=[...(previous.history||[]),{id:randomUUID(),title:previous.title,content:previous.content||'',at:previousAttribution?.at||previous.updatedAt,userId:actor.userId,contentAuthorId:previousAttribution?.userId??null}].slice(-100);e.lastEditedBy=actor.userId;e.lastEditedAt=e.updatedAt;}
      if(kind==='projects'&&(e.description!==previous.description||e.name!==previous.name)){e.history=[...(previous.history||[]),{id:randomUUID(),title:previous.name,content:previous.description||'',at:previousAttribution?.at||previous.updatedAt,userId:actor.userId,contentAuthorId:previousAttribution?.userId??null}].slice(-100);e.lastEditedBy=actor.userId;e.lastEditedAt=e.updatedAt;}
      if(kind==='issues')prepareRecurringIssue(this,actor,e,patch,previous);
      if(e.recurrence&&!e.nextRunAt)e.nextRunAt=e.recurrence.startDate||new Date(Date.now()+86400000).toISOString();
      if(kind==='issues') {
        prepareDuplicateIssue(this,actor,e,previous);
        prepareIssueTeamMove(this,actor,e,patch,previous);
        prepareTriage(this,actor,e,patch,previous);
        e.previousIdentifiers=previous.previousIdentifiers??[];
        if(e.teamId!==previous.teamId) {const team=this.get({...actor,scopes:[...actor.scopes,'read']},'teams',e.teamId);e.previousIdentifiers=[...new Set([...e.previousIdentifiers,previous.identifier])];e.number=this.nextIssueNumber(e.teamId);e.identifier=`${team.key||team.identifier}-${e.number}`;if(!Object.hasOwn(patch,"cycleId"))e.cycleId=null;}
        const status=this.raw('statuses',e.statusId);if(status?.type==='started')e.startedAt??=(actor.now||new Date()).toISOString();if(status?.type==='started'&&this.raw('statuses',previous.statusId)?.type!=='started'&&!e.assigneeId&&this.raw('users',actor.userId)?.preferences?.autoAssignStarted)e.assigneeId=actor.userId;if(status?.type==='completed'||status?.type==='canceled'||status?.type==='duplicate')e.completedAt??=(actor.now||new Date()).toISOString();else e.completedAt=null;
        applyCycleAutomation(this,actor,e,patch,previous);
        if(e.assigneeId&&e.assigneeId!==previous.assigneeId)e.subscriberIds=[...new Set([...(e.subscriberIds||[]),e.assigneeId])];
      }
      if(kind==='issues')applySla(this,actor,e,previous,patch,matchesFilter,actor.now||new Date());
      if(kind==='templates')prepareTemplateAssets(this,actor,e,previous);this.validate(actor,kind,e,previous,patch);if(kind==='issues')prepareStatusTime(this,e,previous);this.bindAttachments(actor,kind,e);if(selectedSubscribers)removeDeselectedSubscriptionRecords(this,actor,e,selectedSubscribers);this.save(kind,e,'update',actor);if(kind==='customerTiers')synchronizeTierName(this,actor,e,previous);if(kind==='labelGroups')renameGroupMembers(this,actor,e,previous);if(kind==='issues'){synchronizeIssueRelations(this,actor,e,previous);mergeIssueContext(this,actor,e,previous);}if(kind==='comments'){this.commentMentions(actor,e,previous);subscribeCommentParticipants(this,actor,e,previous);}this.activity(actor,kind,e,'update',previous);this.notify(actor,kind,e,previous);recordLatestUpdate(this,actor,kind,e);synchronizeTeamHierarchy(this,actor,kind,e,previous);synchronizeCustomerRequests(this,actor,kind,e,previous);cycleEntityChanged(this,actor,kind,e,previous);
      if(kind==='issues'&&['completed','canceled','duplicate'].includes(this.raw('statuses',e.statusId)?.type)&&!['completed','canceled','duplicate'].includes(this.raw('statuses',previous.statusId)?.type)){const team=this.raw('teams',e.teamId);const statuses=this.all('statuses',actor.workspaceId);if(team?.autoCloseSubIssues)for(const child of this.all('issues',actor.workspaceId).filter(i=>i.parentId===e.id&&!i.completedAt)){const done=statuses.find(s=>s.teamId===child.teamId&&s.type==='completed');if(done)this.update(actor,'issues',child.id,{statusId:done.id});}if(e.parentId){const parent=this.raw('issues',e.parentId);const parentTeam=parent?this.raw('teams',parent.teamId):null;const children=this.all('issues',actor.workspaceId).filter(i=>i.parentId===e.parentId);const done=parent?statuses.find(s=>s.teamId===parent.teamId&&s.type==='completed'):null;if(parent&&!parent.completedAt&&parentTeam?.autoCloseParentIssues&&done&&children.every(i=>i.completedAt))this.update(actor,'issues',parent.id,{statusId:done.id});}}
      return kind==='teams'||kind==='notifications'?this.raw(kind,e.id)!:e;
    });
  }
  remove(actor:Actor,kind:string,id:string,version?:number,options?:{keepAttachment?:boolean}) {
    return this.transaction(()=>{
      const e=this.get(actor,kind,id);this.access(actor,kind,e,true);if(version!=null&&version!==e.version)throw new HttpError(409,'Record changed on another client','VERSION_CONFLICT',{current:this.present(actor,kind,e)});if(kind==='issues')assert(!sharedIssueAccess(this,actor,e),403,'Only team members can delete a shared issue','SHARED_ISSUE_RESTRICTED');
      assert(kind!=='workspaces'&&kind!=='users',422,'Workspace and account deletion is unavailable through entity deletion','INVALID_OPERATION');
      if(kind==='memberships'&&e.role==='owner'&&!e.teamId)assert(this.all('memberships',actor.workspaceId).some(m=>m.id!==id&&m.role==='owner'&&!m.teamId),422,'Workspace must have an owner','LAST_OWNER');
      if(kind==='customerTiers')assertTierUnused(this,actor,id);
      if(kind==='slaPolicies')for(const row of this.db.prepare("SELECT kind,data FROM entities WHERE workspace_id=? AND kind IN ('issues','teams') AND json_extract(data,'$.slaPolicyId')=?").all(actor.workspaceId,id) as {kind:string,data:string}[]){const previous=JSON.parse(row.data);this.save(row.kind,{...previous,slaPolicyId:null,version:previous.version+1,updatedAt:(actor.now||new Date()).toISOString()},'update',actor);}
      if(kind==='teams')assert(isTeamOwner(this,actor,e),403,'Only team owners can delete a team','TEAM_OWNER_REQUIRED');
      if(kind==='teams')assert(!this.all('issues',actor.workspaceId).some(i=>i.teamId===id),422,'Move or delete team issues before deleting the team','IN_USE');
      if(kind==='memberships'&&e.teamId)assertNoChildMembership(this,e.teamId,e.userId);
      if(!actor.hierarchySync&&((kind==='statuses'&&e.inheritedStatusId)||(kind==='cycles'&&e.inheritedCycleId)))assert(false,422,'Edit the inherited definition on the parent team','INHERITED_SETTING');
      if(kind==='teams')assert(!this.all('teams',actor.workspaceId).some(team=>team.parentId===id),422,'Move sub-teams before deleting the parent team','IN_USE');
      if(kind==='statuses'){validateWorkflowRemoval(this,actor,e);const team=this.raw('teams',e.teamId);if(team?.defaultStatusId===e.id)this.update({...actor,scopes:[...actor.scopes,'teams:write']},'teams',team.id,{defaultStatusId:null});}
      if(kind==='favorites')unfileFavoriteChildren(this,actor,e);
      if(kind==='milestones')for(const row of this.db.prepare("SELECT data FROM entities WHERE kind='issues' AND workspace_id=? AND deleted_at IS NULL AND json_extract(data,'$.milestoneId')=?").all(actor.workspaceId,id) as {data:string}[]){const issue=JSON.parse(row.data),changed={...issue,milestoneId:null,updatedAt:(actor.now||new Date()).toISOString(),version:issue.version+1};this.save('issues',changed,'update',actor);this.activity(actor,'issues',changed,'update',issue);}
      if(kind==='labelGroups')for(const label of groupMembers(this,actor,e))this.remove(actor,'labels',label.id);
      if(kind==='labels'){prepareLabelGroup(this,actor,e,e);removeLabelAssignments(this,actor,id);}
      const deleted={...e,...(['labels','labelGroups'].includes(kind)?{permanentlyDeleted:true}:{}),deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),version:e.version+1};this.save(kind,deleted,'delete',actor);if(kind==='requests'&&!options?.keepAttachment)removeUnusedRequestSource(this,deleted);if(kind==='documents')this.notify(actor,kind,deleted,e);if(kind==='comments'){removeCommentReplies(this,actor,deleted);removeResolutionReply(this,actor,deleted);}if(kind==='issues')synchronizeIssueRelations(this,actor,deleted,e);this.activity(actor,kind,deleted,'delete');recordLatestUpdate(this,actor,kind,deleted);synchronizeTeamHierarchy(this,actor,kind,deleted,e);cycleEntityChanged(this,actor,kind,deleted,e);return deleted;
    });
  }
  restore(actor:Actor,kind:string,id:string,version?:number):RecordEntity {return this.transaction(()=>{const previous=this.get(actor,kind,id,true);this.access(actor,kind,previous,true);if(version!=null&&version!==previous.version)throw new HttpError(409,'Record changed on another client','VERSION_CONFLICT',{current:this.present(actor,kind,previous)});if(kind==='issues')assert(!sharedIssueAccess(this,actor,previous),403,'Only team members can restore a shared issue','SHARED_ISSUE_RESTRICTED');if(!previous.deletedAt)return previous;assert(kind!=='labels'&&!previous.permanentlyDeleted,422,'This item was permanently deleted and cannot be restored','PERMANENTLY_DELETED');assert(!previous.teamDeletionCohort,422,'Restore the team from Recently deleted teams to recover its work together','TEAM_RESTORE_REQUIRED');if(kind==='comments')return restoreCommentThread(this,actor,previous);const e={...previous,deletedAt:null,updatedAt:new Date().toISOString(),version:previous.version+1};this.validate(actor,kind,e,previous);this.save(kind,e,'restore',actor);if(kind==='issues')synchronizeIssueRelations(this,actor,e);this.activity(actor,kind,e,'restore');recordLatestUpdate(this,actor,kind,e);cycleEntityChanged(this,actor,kind,e,previous);return kind==='notifications'?this.raw(kind,e.id)!:e;});}
  save(kind:string,e:RecordEntity,action:string,actor:Actor):void {
    if((kind==='notifications'||kind==='activities')&&!this.depth)return this.transaction(()=>this.save(kind,e,action,actor));
    if(kind==='notifications'&&action==='create')e.movedToInboxAt??=e.createdAt;
    if(kind==='issues'){e.subscribers=effectiveIssueSubscribers(e);indexIssueRelations(this,e);}
    const permissionFields=['retiredAt',...(kind==='teams'?['archivedAt']:[]),'ownerIds','ownerId','joinPolicy','labelManagement','templateManagement','settingsManagement','memberManagement','permanentlyDeleted','private','visibility','teamId','teamIds','memberIds','role','userId','projectId','issueId','documentId','initiativeId','leadTeamId','parentId','sharedWithIds','issueSharingEnabled','issueSharingPolicy','entityKind','entityId',...(kind==='documents'?['cycleId']:[]),...(kind==='asksPages'?['templateIds']:[]),...(kind==='templates'?['deletedAt','archivedAt','type']:[])];const old=action!=='create'?this.raw(kind,e.id,true):null;const accessChanged=kind==='memberships'||(kind==='teams'&&action==='delete')||!!(old&&kind==='templates'&&old.properties?.teamId!==e.properties?.teamId)||!!(old&&permissionFields.some(key=>JSON.stringify(old[key])!==JSON.stringify(e[key])));
    if(accessChanged)this.db.prepare('INSERT INTO workspace_permissions VALUES(?,1) ON CONFLICT(workspace_id) DO UPDATE SET revision=revision+1').run(e.workspaceId);
    this.db.prepare('INSERT INTO entities(kind,id,workspace_id,data,version,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at').run(kind,e.id,e.workspaceId,JSON.stringify(e),e.version,e.createdAt,e.updatedAt,e.deletedAt||null);
    const oldSearch=this.db.prepare('SELECT search_rowid FROM search_rows WHERE kind=? AND id=?').get(kind,e.id) as any;if(oldSearch){this.db.prepare('DELETE FROM entity_search WHERE rowid=?').run(oldSearch.search_rowid);this.db.prepare('DELETE FROM search_rows WHERE kind=? AND id=?').run(kind,e.id);}
    const searchable=[e.title,e.name,e.identifier,...(Array.isArray(e.previousIdentifiers)?e.previousIdentifiers:[]),e.description,e.content,e.body].filter(Boolean).join(' ').replace(/<[^>]*>/g,' ');if(!e.deletedAt&&searchable){const inserted=this.db.prepare('INSERT INTO entity_search(kind,id,workspace_id,content) VALUES(?,?,?,?)').run(kind,e.id,e.workspaceId,searchable);this.db.prepare('INSERT INTO search_rows VALUES(?,?,?)').run(kind,e.id,inserted.lastInsertRowid);}
    const memberships=kind==='users'?this.db.prepare("SELECT DISTINCT workspace_id FROM entities WHERE kind='memberships' AND json_extract(data,'$.userId')=? AND deleted_at IS NULL").all(e.id) as {workspace_id:string}[]:[];
    const workspaces=memberships.length?memberships.map(row=>row.workspace_id):[e.workspaceId],changes:Change[]=[];
    for(const workspaceId of workspaces){const result=this.db.prepare('INSERT INTO changes(workspace_id,kind,action,entity_id,data,actor_id,created_at) VALUES(?,?,?,?,?,?,?)').run(workspaceId,kind,action,e.id,JSON.stringify(e),actor.userId,new Date().toISOString());
      if(kind==='activities'&&action==='create'){
        // The actual insert ID is the causal order. Persist it in both surfaces
        // before publishing the transaction, without searching prior history.
        e.sequence=Number(result.lastInsertRowid);const data=JSON.stringify(e);
        this.db.prepare("UPDATE entities SET data=? WHERE kind='activities' AND id=?").run(data,e.id);
        this.db.prepare('UPDATE changes SET data=? WHERE seq=?').run(data,e.sequence);
      }
      const change={seq:Number(result.lastInsertRowid),workspaceId,kind,action,entity:e,id:e.id,actorId:actor.userId,...(accessChanged?{accessChanged:true,accessRevision:this.accessRevision(workspaceId)}:{})};changes.push(change);
      for(const hook of this.db.prepare('SELECT * FROM webhooks WHERE workspace_id=? AND enabled=1').all(workspaceId) as any[]){const hookActor:Actor={userId:hook.creator_id,workspaceId,role:this.role(hook.creator_id,workspaceId),scopes:['read']};if(hookActor.role==='none'||!this.canRead(hookActor,kind,e)||!webhookMatches(this,hook,kind,e))continue;const events=JSON.parse(hook.events);if(events.includes('*')||events.includes(kind)||events.includes(`${kind}.${action}`)){const deliveryId=randomUUID();const payload=JSON.stringify({id:deliveryId,type:kind,action,data:webhookEntity(this,hookActor,hook,kind,e),actorId:actor.userId,organizationId:workspaceId,createdAt:new Date().toISOString(),webhookTimestamp:Date.now()});this.db.prepare('INSERT INTO webhook_deliveries(id,webhook_id,event_id,payload,next_attempt_at,created_at) VALUES(?,?,?,?,?,?)').run(deliveryId,hook.id,change.seq,payload,new Date().toISOString(),new Date().toISOString());}}
    }
    if(this.depth)this.pending.push(...changes);else this.onChanges?.(changes);
    if(kind==='workspaces'&&action==='create')initializeWorkspaceTiers(this,e);
    if(kind==='notifications')retainOpenNotifications(this,actor,e);
    if(kind==='subscriptions')subscriptionIssueChanged(this,actor,e,old);
  }
  activity(actor:Actor,kind:string,e:RecordEntity,action:string,previous?:RecordEntity) {
    if(['activities','notifications','favorites','subscriptions','users','memberships'].includes(kind))return;
    const changes:Record<string,any>={};if(previous)for(const key of Object.keys(e))if(!['updatedAt','version',...statusTimeFields].includes(key)&&JSON.stringify(previous[key])!==JSON.stringify(e[key]))changes[key]={from:previous[key]??null,to:e[key]??null};
    const at=(actor.now||new Date()).toISOString();
    const evidence:Record<string,any>={entityVersion:e.version,...(actor.requesterIntake?{actorIdentity:requesterIdentity(this,actor.workspaceId,actor.userId)}:{})};
    if(action==='create'&&(kind==='issues'||kind==='projects'))evidence.initialLabelIds=[...(e.labelIds||[])];
    if(kind==='issues'){
      evidence.assigneeIdAtEvent=e.assigneeId??null;
      const category=(statusId:any)=>typeof statusId==='string'?this.raw('statuses',statusId,true)?.type??null:null;
      evidence.statusTypeBefore=previous?category(previous.statusId):action==='create'?null:category(e.statusId);
      evidence.statusTypeAfter=category(e.statusId);
      if(action==='create'){evidence.initialStatusId=e.statusId??null;evidence.initialStatusType=evidence.statusTypeAfter;}
    }
    if(kind==='statuses'&&action==='create')evidence.initialType=e.type;
    const record={id:randomUUID(),workspaceId:actor.workspaceId,createdAt:at,updatedAt:at,version:1,actorId:actor.userId,entityKind:kind,entityId:e.id,issueId:kind==='issues'?e.id:kind==='comments'?e.issueId:undefined,action,changes,...evidence};this.save('activities',record,'create',actor);
  }
  notify(actor:Actor,kind:string,e:RecordEntity,previous?:RecordEntity) {
    if(kind==='issues')refreshDueDateNotificationTitles(this,actor,e,previous);
    if(actor.silent)return;
    queueAsksEmail(this,actor,kind,e,previous);
    if(kind==='issues')notifyViewSubscriptions(this,actor,e,previous);
    if(!['issues','comments','updates','requests','documents','projects'].includes(kind))return;
    const recipients=new Map<string,Set<string>>();const add=(userId:string,reason:string)=>{if(!userId)return;const reasons=recipients.get(userId)||new Set<string>();reasons.add(reason);recipients.set(userId,reasons);};
    if(kind==='issues'&&!e.deletedAt&&!e.archivedAt){
      const added=!previous||previous.teamId!==e.teamId;
      const status=this.raw('statuses',e.statusId)?.type;
      const changed=!previous||previous.statusId!==e.statusId||previous.teamId!==e.teamId;
      for(const subscription of this.all('subscriptions',actor.workspaceId)){
        if(subscription.entityKind!=='teams'||subscription.entityId!==e.teamId||subscription.archivedAt)continue;
        if(subscription.notifyOnAdded===true&&added||subscription.notifyOnClosed===true&&!!previous&&changed&&['completed','canceled'].includes(status)||subscription.notifyOnTriage===true&&changed&&status==='triage')add(subscription.userId,'subscriptions');
      }
    }
    if(kind==='issues')labelSubscriptionRecipients(this,actor,e,previous,add);
    if(kind==='issues')for(const id of e.sharedWithIds||[])if(!previous?.sharedWithIds?.includes(id))add(id,'shared');
    if(e.assigneeId&&e.assigneeId!==previous?.assigneeId)add(e.assigneeId,'assigned');
    // Urgent assignment alerts apply even after the assignee unsubscribes.
    if(kind==='issues'&&e.priority===1&&previous?.priority!==1&&e.assigneeId)add(e.assigneeId,'status');
    triageRecipients(this,kind,e,previous,add);
    const issueId=kind==='issues'?e.id:e.issueId;
    if(kind==='comments'&&!previous&&issueId){const issue=this.raw('issues',issueId);if(issue&&this.raw('statuses',issue.statusId)?.type==='triage')for(const id of issue.triageResponsibleIds||[])add(id,'comments');}
    if(kind==='comments'&&!previous&&!e.updateId&&(e.projectId||e.documentId)){const parentKind=e.projectId?'projects':'documents',field=e.projectId?'projectId':'documentId',parent=this.raw(parentKind,e[field]);if(parent){if(parentKind!=='documents')add(parent.leadId||parent.creatorId,'comments');for(const id of parentKind==='documents'?documentSubscribers(parent):[...(parent.memberIds||[]),...(parent.subscriberIds||[])])add(id,'comments');for(const subscription of this.all('subscriptions',actor.workspaceId))if(subscription[field]===parent.id||subscription.entityKind===parentKind&&subscription.entityId===parent.id)add(subscription.userId,'comments');}}
    if(issueId&&(kind==='comments'&&!previous||kind==='issues'&&issueStatusNotification(this,e,previous))){const issue=this.raw('issues',issueId);if(kind==='comments'&&issue?.assigneeId)add(issue.assigneeId,'comments');for(const s of this.all('subscriptions',actor.workspaceId))if(s.issueId===issueId||s.entityId===issueId)add(s.userId,kind==='comments'?'comments':'status');for(const userId of issue?.subscriberIds||[])add(userId,kind==='comments'?'comments':'status');}
    if(kind==='requests')customerRequestRecipients(this,actor,e,previous,add);
    updateRecipients(this,actor,kind,e,previous,add);
    projectActivityRecipients(this,actor,kind,e,previous,add);
    documentRecipients(this,actor,kind,e,previous,add);
    if(kind==='comments')threadRecipients(this,actor,e,previous,add);
    if(!actor.requesterIntake)for(const userId of e.mentionIds||[])if(!previous?.mentionIds?.includes(userId))add(userId,'mentioned');
    recipients.delete(actor.userId);
    for(const [userId,reasons] of recipients){const recipient=this.actorForUser(userId,actor.workspaceId);if(recipient.role==='none'||!this.canRead(recipient,kind,e))continue;if(kind==='issues'&&e.priority===1&&previous?.priority!==1&&e.assigneeId===userId)enqueueUrgentIssueEmail(this,actor,e,userId);const at=(actor.now||new Date()).toISOString();this.save('notifications',{id:randomUUID(),workspaceId:actor.workspaceId,createdAt:at,updatedAt:at,version:1,userId,actorId:actor.userId,issueId,projectId:kind==='projects'?e.id:e.projectId,initiativeId:e.initiativeId,documentId:kind==='documents'?e.id:e.documentId,updateId:kind==='updates'?e.id:e.updateId,...(kind==='comments'?{commentId:e.id,parentCommentId:e.parentId||null}:{}),entityKind:kind,entityId:e.id,type:[...reasons][0],reasons:[...reasons],title:e.title||(kind==='projects'?e.name:'New comment'),body:e.body||'',readAt:null,archivedAt:null},'create',actor);}
  }
  private addMentionRelations(actor:Actor,issue:RecordEntity,content:RecordEntity,previous?:RecordEntity){
    if(actor.requesterIntake)return;
    const subscribers=new Set<string>(issue.subscriberIds||[]);for(const userId of content.mentionIds||[])if(!previous?.mentionIds?.includes(userId)){const recipient=this.actorForUser(userId,actor.workspaceId);if(recipient.role!=='none'&&this.canRead(recipient,'issues',issue))subscribers.add(userId);}if(subscribers.size)issue.subscriberIds=[...subscribers];
    for(const id of content.derivedIssueMentionIds||[])if(id!==issue.id&&!previous?.derivedIssueMentionIds?.includes(id)){const target=this.raw('issues',id);if(target&&this.canRead({...actor,scopes:[...actor.scopes,'read']},'issues',target)){issue.relations??=[];if(!issue.relations.some((relation:any)=>relation.issueId===id))issue.relations=[...issue.relations,{type:'related',issueId:id}];}}
  }
  private deriveIssueReferences(actor:Actor,content:RecordEntity){
    // Intake service access is for configured creation, not resolving or changing
    // unrelated workspace records through requester-supplied content.
    if(actor.requesterIntake){content.derivedIssueMentionIds=[];return;}
    const identifiers=new Set<string>();for(const field of ['description','body'])if(typeof content[field]==='string')for(const match of content[field].matchAll(/\b[A-Z][A-Z0-9]{0,9}-[1-9][0-9]{0,9}\b/g)){if(identifiers.size>=100)break;identifiers.add(match[0]);}
    const referenced=new Set<string>(content.derivedIssueMentionIds||[]);for(const identifier of identifiers){const row=this.db.prepare("SELECT data FROM entities WHERE workspace_id=? AND kind='issues' AND deleted_at IS NULL AND (json_extract(data,'$.identifier')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(entities.data,'$.previousIdentifiers')) WHERE value=?)) LIMIT 1").get(actor.workspaceId,identifier,identifier) as {data:string}|undefined;if(row){const issue=JSON.parse(row.data);if(this.canRead({...actor,scopes:[...actor.scopes,'read']},'issues',issue))referenced.add(issue.id);}}
    if(referenced.size||content.derivedIssueMentionIds)content.derivedIssueMentionIds=[...referenced];
  }
  private bindAttachments(actor:Actor,kind:string,entity:RecordEntity){
    if(!['issues','documents','comments','projects','initiatives','updates','requests'].includes(kind))return;const ids=new Set<string>();for(const field of ['description','content','body'])if(typeof entity[field]==='string')for(const match of entity[field].matchAll(/(?:src|href)="(?:https?:\/\/[^/"\s]+)?\/api\/v1\/attachments\/([A-Za-z0-9_-]+)(?:[?#][^"]*)?"/g))ids.add(match[1]);
    const parentKind=kind==='comments'||kind==='updates'?(entity.issueId?'issues':entity.projectId?'projects':entity.initiativeId?'initiatives':kind):kind,parentId=parentKind==='issues'&&kind!=='issues'?entity.issueId:parentKind==='projects'&&kind!=='projects'?entity.projectId:parentKind==='initiatives'&&kind!=='initiatives'?entity.initiativeId:entity.id;
    for(const id of ids)this.db.prepare('UPDATE attachments SET entity_kind=?,entity_id=? WHERE id=? AND workspace_id=? AND creator_id=? AND entity_id IS NULL').run(parentKind,parentId,id,actor.workspaceId,actor.userId);
  }
  private commentMentions(actor:Actor,comment:RecordEntity,previous?:RecordEntity){if(!comment.issueId)return;const issue=this.raw('issues',comment.issueId);if(!issue)return;const changed={...issue};this.addMentionRelations(actor,changed,comment.parentId?{...comment,mentionIds:[]}:comment,previous);const patch:Record<string,any>={};if(JSON.stringify(changed.subscriberIds)!==JSON.stringify(issue.subscriberIds)||JSON.stringify(changed.relations)!==JSON.stringify(issue.relations)){patch.subscriberIds=changed.subscriberIds||[];patch.relations=changed.relations||[];}if(issue.snoozedUntil&&(!previous||previous.body!==comment.body||JSON.stringify(previous.reactions)!==JSON.stringify(comment.reactions))){patch.snoozedUntil=null;}if(Object.keys(patch).length)this.update({...actor,scopes:[...actor.scopes,'issues:write'],silent:true,triageWake:true},'issues',issue.id,patch);}
}
