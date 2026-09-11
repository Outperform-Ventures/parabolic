import type {Repository,RecordEntity} from './repository';
/** Recover identifier aliases from recorded moves when upgrading an existing workspace. */
export function initializeIssueIdentifiers(repo:Repository){
 const name='historical-issue-identifiers-v1';
 if(repo.db.prepare('SELECT name FROM data_migrations WHERE name=?').get(name))return;
 repo.transaction(()=>{
  const rows=repo.db.prepare("SELECT data FROM entities WHERE kind='activities' AND json_extract(data,'$.entityKind')='issues' AND json_type(data,'$.changes.identifier.from')='text' ORDER BY created_at").all() as {data:string}[];
  const aliases=new Map<string,Set<string>>();
  for(const row of rows){const activity=JSON.parse(row.data),value=activity.changes.identifier.from;
   if(!/^[A-Z][A-Z0-9]{0,9}-[1-9][0-9]*$/.test(value))continue;
   const key=activity.workspaceId+':'+activity.entityId,set=aliases.get(key)??new Set<string>();set.add(value);aliases.set(key,set);
  }
  const now=new Date().toISOString();
  for(const row of repo.db.prepare("SELECT data FROM entities WHERE kind='issues'").all() as {data:string}[]){
   const issue=JSON.parse(row.data) as RecordEntity,prior=aliases.get(issue.workspaceId+':'+issue.id);if(!prior?.size)continue;
   const values=[...new Set([...(Array.isArray(issue.previousIdentifiers)?issue.previousIdentifiers:[]),...prior])].filter(value=>value!==issue.identifier);
   if(JSON.stringify(values)===JSON.stringify(issue.previousIdentifiers))continue;
   const next={...issue,previousIdentifiers:values,version:issue.version+1};
   repo.save('issues',next,'update',{userId:'system',workspaceId:issue.workspaceId,role:'owner',scopes:['admin'],system:true});
  }
  repo.db.prepare('INSERT INTO data_migrations VALUES(?,?)').run(name,now);
 });
}
