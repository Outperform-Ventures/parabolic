import {assert} from './errors';
import type {Repository,RecordEntity,Actor} from './repository';
import {targetsIssue,effectiveIssueSubscribers} from '../shared/issue-subscriptions';

function recordUsers(repo:Repository,workspaceId:string,issueId:string):string[] {
 const rows=repo.db.prepare("SELECT data FROM entities WHERE kind='subscriptions' AND workspace_id=? AND deleted_at IS NULL AND (json_extract(data,'$.issueId')=? OR json_extract(data,'$.entityId')=?)").all(workspaceId,issueId,issueId) as {data:string}[];
 return [...new Set(rows.map(row=>JSON.parse(row.data)).filter(s=>targetsIssue(s,issueId)).map(s=>s.userId as string).filter(Boolean))].sort();
}

export function subscriptionIssueChanged(repo:Repository,actor:Actor,next:RecordEntity,previous:RecordEntity|null) {
 if(actor.subscriberSync)return;
 const ids=new Set<string>();
 for(const record of [previous,next])if(record)for(const id of [record.issueId,record.entityId])if(id&&targetsIssue({...record,deletedAt:null},id))ids.add(id);
 for(const id of ids){const issue=repo.raw('issues',id,true);if(!issue||issue.workspaceId!==next.workspaceId)continue;
  const subscriptionUserIds=recordUsers(repo,issue.workspaceId,id);
  if(JSON.stringify(issue.subscriptionUserIds??[])===JSON.stringify(subscriptionUserIds))continue;
  // Subscriber changes must reach readers who cannot read another user's private subscription record.
  repo.save('issues',{...issue,subscriptionUserIds,version:issue.version+1},'update',actor);
 }
}

export function initializeIssueSubscribers(repo:Repository) {
 repo.db.exec("CREATE INDEX IF NOT EXISTS issue_subscription_targets ON entities(workspace_id,json_extract(data,'$.issueId')) WHERE kind='subscriptions' AND deleted_at IS NULL; CREATE INDEX IF NOT EXISTS entity_subscription_targets ON entities(workspace_id,json_extract(data,'$.entityId')) WHERE kind='subscriptions' AND deleted_at IS NULL");
 const name='issue-subscribers-v1';if(repo.db.prepare('SELECT name FROM data_migrations WHERE name=?').get(name))return;
 repo.transaction(()=>{
  const rows=repo.db.prepare("SELECT data FROM entities WHERE kind='issues'").all() as {data:string}[],now=new Date().toISOString();
  for(const row of rows){const issue=JSON.parse(row.data),subscriptionUserIds=recordUsers(repo,issue.workspaceId,issue.id),next={...issue,subscriptionUserIds,subscribers:effectiveIssueSubscribers({...issue,subscriptionUserIds}),version:issue.version+1},data=JSON.stringify(next);
   repo.db.prepare("UPDATE entities SET data=?,version=? WHERE kind='issues' AND id=?").run(data,next.version,next.id);
   repo.db.prepare("INSERT INTO changes(workspace_id,kind,action,entity_id,data,actor_id,created_at) VALUES(?,'issues','update',?,?,'system',?)").run(next.workspaceId,next.id,data,now);
  }
  repo.db.prepare('INSERT INTO data_migrations VALUES(?,?)').run(name,now);
 });
}

export function prepareSubscriberSelection(repo:Repository,actor:Actor,previous:RecordEntity,patch:Record<string,any>):string[]|undefined {
 if(!Object.hasOwn(patch,'replaceSubscribers'))return;
 assert(patch.replaceSubscribers===true,422,'replaceSubscribers must be true','INVALID_SUBSCRIBERS');
 const selected=patch.subscribers;
 assert(Array.isArray(selected)&&selected.length<=1000&&selected.every(id=>typeof id==='string'),422,'Select up to 1,000 subscribers','INVALID_SUBSCRIBERS');
 const ids=[...new Set(selected as string[])].sort(),existing=new Set(effectiveIssueSubscribers(previous));
 for(const id of ids){const recipient=repo.actorForUser(id,actor.workspaceId);assert(recipient.role!=='none',422,'Subscriber must be a workspace member','INVALID_SUBSCRIBERS');if(!existing.has(id))assert(repo.canRead(recipient,'issues',previous),422,'Subscriber must have access to this issue','INVALID_SUBSCRIBERS');}
 return ids;
}

export function removeDeselectedSubscriptionRecords(repo:Repository,actor:Actor,issue:RecordEntity,selected:string[]) {
 const keep=new Set(selected),rows=repo.db.prepare("SELECT data FROM entities WHERE kind='subscriptions' AND workspace_id=? AND deleted_at IS NULL AND (json_extract(data,'$.issueId')=? OR json_extract(data,'$.entityId')=?)").all(issue.workspaceId,issue.id,issue.id) as {data:string}[];
 for(const row of rows){const record=JSON.parse(row.data);if(!targetsIssue(record,issue.id)||keep.has(record.userId))continue;const at=(actor.now||new Date()).toISOString();repo.save('subscriptions',{...record,deletedAt:at,updatedAt:at,version:record.version+1},'delete',{...actor,subscriberSync:true});}
}
