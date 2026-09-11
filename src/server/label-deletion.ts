import type {Actor,Repository} from './repository';

function cleanDefaults(value:any,id:string):any{if(Array.isArray(value))return value.map(item=>cleanDefaults(item,id));if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='labelIds'&&Array.isArray(item)?item.filter(value=>value!==id):cleanDefaults(item,id)]))}

// Label removal is a workspace-wide referential cleanup, including archived or
// deleted work that could later be restored. Parent access is not broadened.
export function removeLabelAssignments(repo:Repository,actor:Actor,id:string){
 for(const row of repo.db.prepare("SELECT kind,data FROM entities WHERE workspace_id=? AND kind IN ('issues','projects','templates') AND (EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.labelIds')) WHERE value=?) OR (kind='templates' AND instr(data,?)>0))").all(actor.workspaceId,id,id) as {kind:string;data:string}[]){
  const before=JSON.parse(row.data),clean=row.kind==='templates'?cleanDefaults(before,id):{...before,labelIds:before.labelIds.filter((value:string)=>value!==id)};if(JSON.stringify(clean)===JSON.stringify(before))continue;const after={...clean,updatedAt:(actor.now||new Date()).toISOString(),version:before.version+1};
  repo.save(row.kind,after,'update',actor);repo.activity(actor,row.kind,after,'update',before);
 }
}
