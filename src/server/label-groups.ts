import {migrateProjectDisplayGroups} from '../shared/project-display-groups';
import {assert} from './errors';
import type {Actor,Repository,RecordEntity} from './repository';
const type=(e:Record<string,any>)=>e.entityType??'issues';
const scope=(e:Record<string,any>)=>e.teamId||null;
export function groupMembers(repo:Repository,actor:Actor,group:RecordEntity){return repo.all('labels',actor.workspaceId,true).filter(label=>!label.deletedAt&&(label.labelGroupId===group.id||(!label.labelGroupId&&label.group===group.name&&type(label)===type(group)&&scope(label)===scope(group))));}
export function validateLabelGroup(repo:Repository,actor:Actor,e:RecordEntity,previous?:RecordEntity){
 e.previousNames=previous?[...new Set([...(previous.previousNames||[]),...(previous.name!==String(e.name??'').trim()?[previous.name]:[])])]:[];
 e.entityType=type(e);e.teamId=scope(e);e.name=String(e.name??'').trim();
 assert(['issues','projects'].includes(e.entityType),422,'Groups support issues or projects','INVALID_LABEL_TYPE');
 assert(e.name&&!/[/:]/.test(e.name),422,'Use a nonempty, single-level group name','INVALID_LABEL_GROUP');
 assert(!e.parentId&&!e.group&&!e.labelGroupId,422,'Label groups cannot be nested','INVALID_LABEL_GROUP');
 assert((previous&&previous.name===e.name&&type(previous)===type(e)&&scope(previous)===scope(e))||!repo.all('labelGroups',actor.workspaceId).some(g=>g.id!==e.id&&g.name.toLocaleLowerCase()===e.name.toLocaleLowerCase()&&type(g)===type(e)&&scope(g)===scope(e)),422,'This label group already exists in this scope','DUPLICATE_LABEL_GROUP');
}
export function prepareLabelGroup(repo:Repository,actor:Actor,e:RecordEntity,previous?:RecordEntity,provided:Record<string,any>=e){
 let group:RecordEntity|undefined;
 if(Object.hasOwn(provided,'labelGroupId')&&provided.labelGroupId){group=repo.get(actor,'labelGroups',provided.labelGroupId);assert(type(group)===type(e)&&scope(group)===scope(e),422,'Label and group must use the same scope and type','INVALID_LABEL_GROUP');e.group=group.name;}
 else if(Object.hasOwn(provided,'labelGroupId')&&!provided.labelGroupId&&!Object.hasOwn(provided,'group'))e.group=null;
 if(!e.group){e.group=null;e.labelGroupId=null;return;}
 assert(typeof e.group==='string'&&!/[/:]/.test(e.group),422,'Label groups cannot be nested','INVALID_LABEL_GROUP');e.group=e.group.trim();assert(e.group,422,'Use a nonempty group name','INVALID_LABEL_GROUP');
 group??=repo.all('labelGroups',actor.workspaceId).find(g=>g.name.toLocaleLowerCase()===e.group.toLocaleLowerCase()&&type(g)===type(e)&&scope(g)===scope(e));
 group??=repo.create(actor,'labelGroups',{name:e.group,entityType:type(e),teamId:scope(e),color:e.color});
 e.group=group.name;e.labelGroupId=group.id;
}
export function renameGroupMembers(repo:Repository,actor:Actor,e:RecordEntity,previous:RecordEntity){
 const renamed=e.name!==previous.name,rescoped=type(e)!==type(previous)||scope(e)!==scope(previous),archived=(e.archivedAt||null)!==(previous.archivedAt||null);if(!renamed&&!rescoped&&!archived)return;
 for(const label of groupMembers(repo,actor,previous)){
  const patch:Record<string,any>={};if(renamed)patch.group=e.name;if(rescoped){patch.teamId=scope(e);patch.entityType=type(e);patch.group=e.name;patch.labelGroupId=e.id;}
  if(e.archivedAt&&!label.archivedAt){patch.archivedAt=e.archivedAt;patch.archivedByGroupId=e.id;}
  else if(!e.archivedAt&&label.archivedByGroupId===e.id){patch.archivedAt=null;patch.archivedByGroupId=null;}
  if(Object.keys(patch).length)repo.update(actor,'labels',label.id,patch);
 }
 if(type(e)==='projects')for(const view of repo.all('views',actor.workspaceId,true)){if(view.entityType!=='projects'||!view.display||typeof view.display!=='object')continue;const display=migrateProjectDisplayGroups(view.display,[previous]);if(display===view.display)continue;const after={...view,display,version:view.version+1,updatedAt:(actor.now||new Date()).toISOString()};repo.save('views',after,'update',actor);repo.activity(actor,'views',after,'update',view);}
}

/** Backfill legacy string groups once, retaining label IDs and assignments. */
export function initializeLabelGroups(repo:Repository){
 const rows=repo.db.prepare("SELECT data FROM entities WHERE kind IN ('labels','labelGroups') AND deleted_at IS NULL").all() as {data:string}[];
 const keys=new Set((repo.db.prepare("SELECT data FROM entities WHERE kind='labelGroups' AND deleted_at IS NULL").all() as {data:string}[]).map(row=>{const g=JSON.parse(row.data);return JSON.stringify([g.workspaceId,scope(g),type(g),g.name.toLocaleLowerCase()])}));
 repo.transaction(()=>{for(const row of rows){const label=JSON.parse(row.data);if(typeof label.group!=='string'||!label.group.trim()||label.group!==label.group.trim()||/[/:]/.test(label.group))continue;const key=JSON.stringify([label.workspaceId,scope(label),type(label),label.group.toLocaleLowerCase()]);if(keys.has(key))continue;keys.add(key);const actor:Actor={workspaceId:label.workspaceId,userId:'system',role:'owner',scopes:['admin'],system:true};repo.create(actor,'labelGroups',{name:label.group,teamId:scope(label),entityType:type(label),color:label.color});}});
}
