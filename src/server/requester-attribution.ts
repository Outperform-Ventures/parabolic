import type {Repository} from './repository';
export function requesterIdentity(repo:Repository,workspaceId:string,id:string){
 if(!id||!repo.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='asks_requesters'").get())return undefined;
 const row=repo.db.prepare('SELECT id,name FROM asks_requesters WHERE id=? AND workspace_id=?').get(id,workspaceId) as {id:string;name:string}|undefined;
 return row?{id:row.id,name:row.name,kind:'requester' as const}:undefined;
}
