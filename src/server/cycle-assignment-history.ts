import type {Repository} from './repository';
/** Recover only from a continuous issue-version history ending at the current version. */
export function recoverCycleAddedAt(issue:Record<string,any>,events:{action:string;data:string}[]):string|null{
 let previous:Record<string,any>|null=null,since:string|null=null;
 for(const event of events){let snapshot:Record<string,any>;try{snapshot=JSON.parse(event.data)}catch{previous=null;since=null;continue;}
  if(snapshot.id!==issue.id||snapshot.workspaceId!==issue.workspaceId){previous=null;since=null;continue;}
  const continuous=previous&&Number.isInteger(previous.version)&&snapshot.version===previous.version+1;
  if(event.action==='create'&&snapshot.version===1){since=snapshot.cycleId?snapshot.createdAt:null;}
  else if(!continuous){since=null;}
  else if(snapshot.cycleId!==previous!.cycleId){since=snapshot.cycleId?snapshot.updatedAt:null;}
  previous=snapshot;
 }
 return previous?.version===issue.version&&previous?.cycleId===issue.cycleId&&issue.cycleId&&since&&Number.isFinite(Date.parse(since))?since:null;
}
export function initializeCycleAssignmentHistory(repo:Repository){
 repo.db.exec('CREATE TABLE IF NOT EXISTS data_migrations(name TEXT PRIMARY KEY,completed_at TEXT NOT NULL)');
 const name='cycle-assignment-history-v1';if(repo.db.prepare('SELECT name FROM data_migrations WHERE name=?').get(name))return;
 repo.transaction(()=>{
  repo.db.exec('CREATE INDEX IF NOT EXISTS changes_entity_history ON changes(workspace_id,kind,entity_id,seq)');
  const rows=repo.db.prepare("SELECT data FROM entities WHERE kind='issues' AND json_extract(data,'$.cycleId') IS NOT NULL AND json_extract(data,'$.cycleAddedAt') IS NULL").all() as {data:string}[];
  const history=repo.db.prepare("SELECT action,data FROM changes WHERE kind='issues' AND entity_id=? AND workspace_id=? ORDER BY seq");
  const now=new Date().toISOString();
  for(const row of rows){const issue=JSON.parse(row.data),at=recoverCycleAddedAt(issue,history.all(issue.id,issue.workspaceId) as {action:string;data:string}[]);if(!at)continue;
   const version=issue.version+1,data=JSON.stringify({...issue,cycleAddedAt:at,version});
   repo.db.prepare("UPDATE entities SET data=?,version=? WHERE kind='issues' AND id=? AND workspace_id=?").run(data,version,issue.id,issue.workspaceId);
   // Reconcile existing client caches without manufacturing a user edit or webhook.
   repo.db.prepare("INSERT INTO changes(workspace_id,kind,action,entity_id,data,actor_id,created_at) VALUES(?,'issues','update',?,?,'system',?)").run(issue.workspaceId,issue.id,data,now);
  }
  repo.db.prepare('INSERT INTO data_migrations VALUES(?,?)').run(name,now);
 });
}
