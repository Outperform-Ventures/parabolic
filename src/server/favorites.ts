import {assert} from './errors.ts';
import type {Actor,RecordEntity,Repository} from './repository.ts';
export function validateFavorite(repo:Repository,actor:Actor,entity:RecordEntity,previous?:RecordEntity,provided:Record<string,any>=entity){
  assert(!previous||entity.type===previous.type,422,'Favorite type cannot be changed','INVALID_FAVORITE_TYPE');
  if(entity.type==='folder'){
    const name=Object.hasOwn(provided,'name')?provided.name:Object.hasOwn(provided,'label')?provided.label:entity.name??entity.label;
    assert(typeof name==='string'&&name.trim().length>0&&name.trim().length<=100,422,'Folder name must contain 1–100 characters','INVALID_FOLDER_NAME');entity.name=entity.label=name.trim();
    assert(!entity.folderId&&!entity.parentId&&!entity.entityId&&!entity.entityKind&&!entity.issueId&&!entity.projectId&&!entity.teamId&&!entity.documentId&&!entity.initiativeId,422,'Favorite folders cannot contain a parent or entity target','INVALID_FOLDER');entity.folderId=null;
  }else if(entity.folderId!=null){const folder=repo.raw('favorites',entity.folderId);assert(folder&&folder.type==='folder'&&folder.workspaceId===actor.workspaceId&&folder.userId===actor.userId,422,'Choose an active favorite folder of your own','INVALID_FOLDER');}
}
export function unfileFavoriteChildren(repo:Repository,actor:Actor,folder:RecordEntity){
  if(folder.type!=='folder')return;const at=(actor.now||new Date()).toISOString();
  for(const row of repo.db.prepare("SELECT data FROM entities WHERE kind='favorites' AND workspace_id=? AND json_extract(data,'$.userId')=? AND json_extract(data,'$.folderId')=?").all(folder.workspaceId,folder.userId,folder.id) as {data:string}[]){const child=JSON.parse(row.data);repo.save('favorites',{...child,folderId:null,version:child.version+1,updatedAt:at},'update',actor);}
}
