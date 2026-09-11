import {usesProjectProperties} from '../shared/project-property-filter';
import {hasRelationshipFilter} from './relationship-filter';
import {hasRelativeTimestampFilter} from '../shared/relative-date-filter.ts';
import {usesProjectLabels} from '../shared/project-label-filter.ts';
import {usesProjectDependencyMetrics} from '../shared/project-dependency-metrics.ts';
import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {assert,HttpError} from './errors.ts';
import {isKind,matchesFilter,type Actor,type Repository} from './repository.ts';
import {canReadAllParents} from './list-query.ts';
import {usesCustomerMetrics} from '../shared/customer-metrics.ts';
export interface SearchOptions{kinds?:string[];first?:number;after?:string;filter?:Record<string,unknown>;orderBy?:string;includeArchived?:boolean;titleOnly?:boolean}
const initialized=new WeakSet<DatabaseSync>();
/** Quick-open indexes only titles and identifiers, independent of document size. */
export function initializeSearchIndexes(db:DatabaseSync){
  if(initialized.has(db))return;
  const existed=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entity_title_search'").get();
  const oldTrigger=db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='title_search_insert'").get() as {sql:string}|undefined;
  const upgrade=existed&&!oldTrigger?.sql.includes('previousIdentifiers');
  if(upgrade)db.exec('DROP TRIGGER IF EXISTS title_search_insert; DROP TRIGGER IF EXISTS title_search_update; DROP TRIGGER IF EXISTS title_search_delete; DELETE FROM entity_title_search;');
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS entity_title_search USING fts5(kind UNINDEXED,id UNINDEXED,workspace_id UNINDEXED,title,tokenize='unicode61 remove_diacritics 2',prefix='2 3 4');
    CREATE TRIGGER IF NOT EXISTS title_search_insert AFTER INSERT ON entities BEGIN
      INSERT INTO entity_title_search(rowid,kind,id,workspace_id,title) SELECT NEW.rowid,NEW.kind,NEW.id,NEW.workspace_id,coalesce(json_extract(NEW.data,'$.title'),'')||' '||coalesce(json_extract(NEW.data,'$.name'),'')||' '||coalesce(json_extract(NEW.data,'$.identifier'),'')||' '||coalesce(json_extract(NEW.data,'$.previousIdentifiers'),'') WHERE NEW.deleted_at IS NULL;
    END;
    CREATE TRIGGER IF NOT EXISTS title_search_update AFTER UPDATE ON entities BEGIN
      DELETE FROM entity_title_search WHERE rowid=OLD.rowid;
      INSERT INTO entity_title_search(rowid,kind,id,workspace_id,title) SELECT NEW.rowid,NEW.kind,NEW.id,NEW.workspace_id,coalesce(json_extract(NEW.data,'$.title'),'')||' '||coalesce(json_extract(NEW.data,'$.name'),'')||' '||coalesce(json_extract(NEW.data,'$.identifier'),'')||' '||coalesce(json_extract(NEW.data,'$.previousIdentifiers'),'') WHERE NEW.deleted_at IS NULL;
    END;
    CREATE TRIGGER IF NOT EXISTS title_search_delete AFTER DELETE ON entities BEGIN DELETE FROM entity_title_search WHERE rowid=OLD.rowid; END;`);
  if(!existed||upgrade)db.exec(`INSERT INTO entity_title_search(rowid,kind,id,workspace_id,title) SELECT rowid,kind,id,workspace_id,coalesce(json_extract(data,'$.title'),'')||' '||coalesce(json_extract(data,'$.name'),'')||' '||coalesce(json_extract(data,'$.identifier'),'')||' '||coalesce(json_extract(data,'$.previousIdentifiers'),'') FROM entities WHERE deleted_at IS NULL;`);
  initialized.add(db);
}
const stopWords=new Set('a an and are as at be but by for if in into is it no not of on or such that the their then there these they this to was will with'.split(' '));
export function searchExpression(query:string,identifier?:(value:string)=>string|undefined){
  const parts=[...query.matchAll(/"([^"]*)"|(\S+)/g)].map(match=>({value:(match[1]??match[2]).replaceAll('"','').trim(),quoted:match[1]!==undefined})).filter(part=>/[\p{L}\p{N}]/u.test(part.value)&&(part.quoted||!stopWords.has(part.value.toLowerCase())));
  assert(parts.length<=100,400,'Use at most 100 search terms','INVALID_QUERY');
  return parts.map(({value,quoted})=>{const text=!quoted?identifier?.(value)??value:value;return `"${text.replaceAll('"','""')}"${quoted?'':'*'}`;}).join(' AND ');
}
const canonical=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const searchWords=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function matchesUserSearch(query:string,text:string){const haystack=` ${searchWords(text)} `;return [...query.matchAll(/"([^"]*)"|(\S+)/g)].every(match=>{const value=searchWords(match[1]??match[2]);if(!value||match[1]===undefined&&stopWords.has(value))return true;return haystack.includes(` ${value}${match[1]!==undefined?' ':''}`);});}
function matchSnippet(entity:Record<string,any>,query:string){
  const text=String(entity.body??entity.description??entity.content??'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,value=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[value]!)).replace(/\s+/g,' ').trim();
  if(!text)return undefined;const terms=query.toLowerCase().replaceAll('"','').split(/\s+/).filter(term=>term&&!stopWords.has(term));const positions=terms.map(term=>text.toLowerCase().indexOf(term)).filter(index=>index>=0),start=Math.max(0,(positions.length?Math.min(...positions):0)-50),end=Math.min(text.length,start+180);return `${start?'…':''}${text.slice(start,end)}${end<text.length?'…':''}`;
}
type Hit={kind:string;id:string;sourceKind:string;sourceId:string;rank:number;updatedAt:string;createdAt:string;archived:number;statusType:string|null;title:string;identifier:string};
const statusRank=(hit:Hit)=>hit.archived?5:hit.kind!=='issues'?0:['unstarted','started'].includes(hit.statusType??'')?0:hit.statusType==='backlog'||hit.statusType==='triage'?1:hit.statusType==='completed'?2:3;
export function searchEntities(repo:Repository,actor:Actor,query:string,options:SearchOptions={}){
  actor={...actor,recordCache:new Map(),permissionCache:new Map()};query=query.trim();assert(query.length<=1000,400,'Search query is too long','INVALID_QUERY');
  const requested=[...new Set(options.kinds||['issues','projects','documents','initiatives','customers'])].sort();assert(requested.every(isKind),400,'Unknown search collection','INVALID_QUERY');
  const kinds=requested.filter(kind=>repo.hasScope(actor,kind)),first=Math.min(Math.max(options.first||50,1),500),orderBy=options.orderBy||'relevance';assert(/^(relevance|updatedAt(?::(?:asc|desc))?|createdAt(?::(?:asc|desc))?)$/.test(orderBy),400,'Unknown search ordering','INVALID_QUERY');
  assert(options.filter===undefined||(typeof options.filter==='object'&&options.filter!==null&&!Array.isArray(options.filter)&&JSON.stringify(options.filter).length<=100000),400,'Filter must be an object','INVALID_FILTER');
  const relativeTimestamp=hasRelativeTimestampFilter(options.filter);let cursor:any;
  if(options.after){try{cursor=JSON.parse(Buffer.from(options.after,'base64url').toString());}catch{throw new HttpError(400,'Invalid search cursor','INVALID_CURSOR');}assert(cursor&&typeof cursor==='object'&&Number.isSafeInteger(cursor.offset)&&cursor.offset>=0,400,'Invalid search cursor','INVALID_CURSOR');}
  // Timestamp-relative queries retain their initial clock across pages. Identity still
  // binds the original filter, viewer timezone, permissions identity and resolved values.
  const anchor=relativeTimestamp?(cursor?.anchor??(actor.now??new Date()).toISOString()):undefined;
  if(relativeTimestamp)assert(typeof anchor==='string'&&Number.isFinite(Date.parse(anchor))&&new Date(anchor).toISOString()===anchor,400,'Invalid search cursor clock','INVALID_CURSOR');
  const originalFilter=options.filter;
  const filterActor=relativeTimestamp?{...actor,now:new Date(anchor!)}:actor;
  options={...options,filter:hasRelationshipFilter(options.filter)?{or:kinds.map(kind=>({and:[{kind:{eq:kind}},repo.resolveFilter(filterActor,options.filter,kind)]}))}:repo.resolveFilter(filterActor,options.filter)};
  const queryKey=createHash('sha256').update(JSON.stringify({query,kinds:requested,filter:options.filter||null,orderBy,includeArchived:options.includeArchived!==false,titleOnly:!!options.titleOnly,workspaceId:actor.workspaceId,userId:actor.userId,...(relativeTimestamp?{anchor,originalFilter,timeZone:actor.timeZone??'UTC'}:{})})).digest('hex');let offset=0;
  if(cursor){assert(cursor.queryKey===queryKey,400,'Search cursor belongs to another query','INVALID_CURSOR');offset=cursor.offset;}
  const identifierLookup=repo.db.prepare("SELECT data FROM entities WHERE workspace_id=? AND kind='issues' AND deleted_at IS NULL AND (json_extract(data,'$.identifier')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(entities.data,'$.previousIdentifiers')) WHERE value=?))");
  const expression=searchExpression(query,value=>{if(!kinds.includes('issues'))return;const id=/^([a-z][a-z0-9]*?)-?(\d+)$/i.exec(value);if(!id)return;const row=identifierLookup.get(actor.workspaceId,`${id[1].toUpperCase()}-${id[2]}`,`${id[1].toUpperCase()}-${id[2]}`) as {data:string}|undefined;if(row&&repo.canRead(actor,'issues',JSON.parse(row.data)))return `${id[1]} ${id[2]}`;});
  const hasFilter=!!options.filter&&(Array.isArray(options.filter.conditions)?options.filter.conditions.length>0:Object.keys(options.filter).some(key=>key!=='match'));
  if((!expression&&!hasFilter)||!kinds.length)return {nodes:[],totalCount:0,pageInfo:{hasNextPage:false,endCursor:null}};
  if(options.titleOnly&&expression)initializeSearchIndexes(repo.db);
  const table=options.titleOnly?'entity_title_search':'entity_search',withComments=!!expression&&!options.titleOnly&&kinds.includes('issues')&&repo.hasScope(actor,'comments'),sourceKinds=[...new Set([...kinds,...(withComments?['comments']:[])])];
  const mapComment=withComments?"source.kind='comments' AND json_extract(source.data,'$.issueId') IS NOT NULL":'0';
  const rows=repo.db.prepare(`SELECT target.kind,target.id,source.kind AS sourceKind,source.id AS sourceId,${expression?`bm25(${table})`:'0'} AS rank,target.updated_at AS updatedAt,target.created_at AS createdAt,
    CASE WHEN json_extract(target.data,'$.archivedAt') IS NOT NULL THEN 1 ELSE 0 END AS archived,
    json_extract(status.data,'$.type') AS statusType,coalesce(json_extract(target.data,'$.title'),json_extract(target.data,'$.name'),'') AS title,coalesce(json_extract(target.data,'$.identifier'),'') AS identifier
    FROM ${expression?`${table} JOIN entities source ON source.kind=${table}.kind AND source.id=${table}.id`:'entities source'}
    JOIN entities target ON target.kind=CASE WHEN ${mapComment} THEN 'issues' ELSE source.kind END AND target.id=CASE WHEN ${mapComment} THEN json_extract(source.data,'$.issueId') ELSE source.id END
    LEFT JOIN entities status ON status.kind='statuses' AND status.id=json_extract(target.data,'$.statusId')
    WHERE ${expression?`${table} MATCH ? AND ${table}.workspace_id=?`:'source.workspace_id=?'} AND source.kind IN (${sourceKinds.map(()=>'?').join(',')}) AND source.deleted_at IS NULL AND target.deleted_at IS NULL AND target.workspace_id=?`).iterate(...(expression?[expression,actor.workspaceId]:[actor.workspaceId]),...sourceKinds,actor.workspaceId) as Iterable<Hit>;
  const metricFilter=usesProjectProperties(options.filter)||usesProjectLabels(options.filter)||usesCustomerMetrics(options.filter)||usesProjectDependencyMetrics(options.filter),fast=!options.filter&&!sourceKinds.some(kind=>['users','workspaces','activities','favorites','notifications','subscriptions'].includes(kind))&&canReadAllParents(repo,actor),found=new Map<string,Hit>();
  for(const hit of rows){
    if(!kinds.includes(hit.kind)||options.includeArchived===false&&hit.archived)continue;
    if(!fast){const source=repo.raw(hit.sourceKind,hit.sourceId);if(!source||!repo.canRead(actor,hit.sourceKind,source))continue;const entity=hit.sourceKind===hit.kind&&hit.sourceId===hit.id?source:repo.raw(hit.kind,hit.id);if(!entity||!repo.canRead(actor,hit.kind,entity))continue;if(options.filter&&!metricFilter&&!matchesFilter({...repo.present(actor,hit.kind,entity),kind:hit.kind},options.filter))continue;actor.recordCache!.clear();}
    const key=`${hit.kind}:${hit.id}`,previous=found.get(key);if(!previous||hit.rank<previous.rank)found.set(key,hit);
  }
  // User rows belong to their original workspace; their current memberships govern visibility.
  if(kinds.includes('users'))for(const user of repo.all('users',actor.workspaceId)){
    if(!repo.canRead(actor,'users',user)||options.includeArchived===false&&user.archivedAt)continue;const presented=repo.present(actor,'users',user);if(!matchesUserSearch(query,`${presented.name??''} ${presented.username??''} ${presented.email??''}`)||options.filter&&!metricFilter&&!matchesFilter({...presented,kind:'users'},options.filter))continue;
    found.set(`users:${user.id}`,{kind:'users',id:user.id,sourceKind:'users',sourceId:user.id,rank:0,updatedAt:user.updatedAt,createdAt:user.createdAt,archived:user.archivedAt?1:0,statusType:null,title:user.name??'',identifier:''});
  }
  if(metricFilter)for(const kind of kinds){const hits=[...found.values()].filter(hit=>hit.kind===kind),entities=hits.flatMap(hit=>{const entity=repo.raw(kind,hit.id);return entity?[repo.present(actor,kind,entity)]:[];});const withCustomers=usesCustomerMetrics(options.filter)?repo.enrichCustomerMetrics(actor,kind,entities):entities;const enriched=usesProjectDependencyMetrics(options.filter)?repo.enrichProjectDependencies(actor,kind,withCustomers):withCustomers;for(const entity of (usesProjectProperties(options.filter)?repo.enrichProjectProperties(actor,kind,enriched):usesProjectLabels(options.filter)?repo.enrichProjectLabels(actor,kind,enriched):enriched))if(!matchesFilter({...entity,kind},options.filter))found.delete(`${kind}:${entity.id}`);}
  const normalized=canonical(query),[field,direction]=orderBy.split(':'),hits=[...found.values()].sort((a,b)=>{
    if(field!=='relevance'){const key=field as 'updatedAt'|'createdAt';return (direction==='asc'?1:-1)*a[key].localeCompare(b[key])||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id);}
    const exactA=canonical(a.identifier)===normalized?0:canonical(a.title)===normalized?1:2,exactB=canonical(b.identifier)===normalized?0:canonical(b.title)===normalized?1:2;
    return exactA-exactB||statusRank(a)-statusRank(b)||a.rank-b.rank||b.updatedAt.localeCompare(a.updatedAt)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id);
  });
  const nodes=hits.slice(offset,offset+first).flatMap(hit=>{const entity=repo.raw(hit.kind,hit.id);if(!entity)return [];const presented=repo.present(actor,hit.kind,entity),source=hit.sourceKind===hit.kind&&hit.sourceId===hit.id?presented:repo.raw(hit.sourceKind,hit.sourceId);const safeSource=source&&repo.canRead(actor,hit.sourceKind,source)?repo.present(actor,hit.sourceKind,source):undefined;return [{...presented,kind:hit.kind,...(!options.titleOnly&&safeSource?{matchSnippet:matchSnippet(safeSource,query)}:{})}];});
  return {nodes,totalCount:hits.length,pageInfo:{hasNextPage:offset+nodes.length<hits.length,endCursor:nodes.length?Buffer.from(JSON.stringify({queryKey,offset:offset+nodes.length,...(relativeTimestamp?{anchor}:{})})).toString('base64url'):null}};
}
