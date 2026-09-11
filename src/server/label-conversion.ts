import {assert} from './errors';
import {groupMembers} from './label-groups';
import type {Actor,RecordEntity,Repository} from './repository';

function usesLabel(value:unknown,id:string):boolean{
 if(Array.isArray(value))return value.some(item=>usesLabel(item,id));
 if(!value||typeof value!=='object')return false;
 const object=value as Record<string,any>;
 const includes=(v:any):boolean=>v===id||(Array.isArray(v)?v.some(includes):v&&typeof v==='object'?Object.values(v).some(includes):false);
 if(['labelId','labelIds'].includes(object.field)&&includes(object.value))return true;
 return Object.entries(object).some(([key,item])=>['labelId','labelIds'].includes(key)?includes(item):usesLabel(item,id));
}

/** Repository.update provides the enclosing transaction, permission and version checks. */
export function convertLabel(repo:Repository,actor:Actor,kind:'labels'|'labelGroups',source:RecordEntity){
 const targetKind=kind==='labels'?'labelGroups':'labels';
 if(kind==='labels'){
  assert(!source.group&&!source.labelGroupId&&!source.parentId,422,'Only a top-level label can become a group','LABEL_CONVERSION_IN_USE');
  const assigned=repo.all(source.entityType==='projects'?'projects':'issues',actor.workspaceId).some(item=>item.labelIds?.includes(source.id));
  assert(!assigned,422,'Remove label assignments before converting to a group','LABEL_CONVERSION_IN_USE');
  const usedByRule=repo.all('automations',actor.workspaceId).some(rule=>rule.type==='routing'&&(usesLabel(rule.filter,source.id)||usesLabel(rule.set||{labelIds:rule.labelIds},source.id)));
  assert(!usedByRule,422,'Labels used by triage rules cannot become groups','LABEL_CONVERSION_IN_USE');
 }else assert(!groupMembers(repo,actor,source).length,422,'Only an empty group can become a label','LABEL_CONVERSION_IN_USE');
 const oldTarget=repo.raw(targetKind,source.id,true);
 assert(!oldTarget||oldTarget.workspaceId===actor.workspaceId&&oldTarget.deletedAt&&oldTarget.convertedTo===kind,409,'A record with this identity already exists','LABEL_CONVERSION_CONFLICT');
 const at=(actor.now||new Date()).toISOString();
 const target:RecordEntity={...source,version:Math.max(source.version,oldTarget?.version||0)+1,updatedAt:at,deletedAt:null};
 for(const field of ['convertTo','convertedTo','permanentlyDeleted','group','labelGroupId','parentId','previousNames'])delete target[field];
 repo.access(actor,targetKind,target,true);
 repo.validate(actor,targetKind,target,undefined,target);
 const retired={...source,convertedTo:targetKind,permanentlyDeleted:true,deletedAt:at,updatedAt:at,version:source.version+1};
 repo.save(kind,retired,'delete',actor);
 repo.save(targetKind,target,oldTarget?'update':'create',actor);
 repo.activity(actor,kind,retired,'delete',source);
 repo.activity(actor,targetKind,target,'create');
 return retired;
}
