import {ensureDuplicateStatus} from './workflow-statuses.ts';
import {createHash} from 'node:crypto';
import {assert} from './errors.ts';
import {isTeamOwner} from './team-permissions.ts';
import {teamAncestors} from './team-hierarchy.ts';
import {mergeLabel} from './label-merge.ts';
import type {Actor,Repository,RecordEntity} from './repository.ts';

export function previewTeamNesting(repo:Repository,actor:Actor,teamId:string,parentId:string){
 const team=repo.get(actor,'teams',teamId),parent=repo.get(actor,'teams',parentId);
 repo.access(actor,'teams',team,true);
 assert(isTeamOwner(repo,actor,team),403,'Changing team hierarchy requires a team owner or administrator','FORBIDDEN');
 assert(!team.archivedAt&&!parent.archivedAt&&team.id!==parent.id&&!teamAncestors(repo,parent).some(p=>p.id===team.id),422,'Choose an active parent outside this team’s descendants','INVALID_PARENT');
 const teams=repo.all('teams',actor.workspaceId),subtree=teams.filter(t=>t.id===team.id||teamAncestors(repo,t).some(p=>p.id===team.id));
 assert(teamAncestors(repo,parent).length+1+Math.max(...subtree.map(t=>teamAncestors(repo,t).findIndex(p=>p.id===team.id)+1))+1<=5,422,'Teams support at most five hierarchy levels','TEAM_DEPTH');
 for(const affected of subtree)repo.access(actor,'teams',affected);
 const ancestors=[parent,...teamAncestors(repo,parent)],scopes=new Set(ancestors.map(t=>t.id));
 const statuses=repo.all('statuses',actor.workspaceId),labels=repo.all('labels',actor.workspaceId).filter(l=>!l.archivedAt),childStatuses=statuses.filter(s=>s.teamId===team.id),parentStatuses=statuses.filter(s=>s.teamId===parent.id);
 if(childStatuses.some(s=>s.type==='duplicate')&&!parentStatuses.some(s=>s.type==='duplicate'))parentStatuses.push({id:'__duplicate__',workspaceId:actor.workspaceId,teamId:parent.id,name:'Duplicate',type:'duplicate',version:0,createdAt:'',updatedAt:''});
 const labelConflicts=subtree.flatMap(t=>labels.filter(l=>l.teamId===t.id).flatMap(source=>{const targets=labels.filter(l=>scopes.has(l.teamId)&&l.name.trim().toLowerCase()===source.name.trim().toLowerCase()&&(l.entityType||'issues')===(source.entityType||'issues'));return targets.length?[{source,teamName:t.name,targets}]:[]}));
 const snapshot=createHash('sha256').update(JSON.stringify([...teams,...statuses,...labels,...repo.all('cycles',actor.workspaceId)].map(e=>[e.id,e.version]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))).digest('hex');
 return {team,parent,snapshot,childStatuses,parentStatuses,labelConflicts,privateParent:!!parent.private||parent.visibility==='restricted',cycleSchedule:!!(parent.cyclesEnabled||parent.cycleEnabled)};
}
function save(repo:Repository,actor:Actor,kind:string,before:RecordEntity,fields:Record<string,any>){const after={...before,...fields,version:before.version+1,updatedAt:(actor.now||new Date()).toISOString()};repo.save(kind,after,'update',actor);repo.activity(actor,kind,after,'update',before);}
function remapStatuses(value:any,mapping:Map<string,string>):any{
 if(Array.isArray(value))return value.map(v=>remapStatuses(v,mapping));if(!value||typeof value!=='object')return value;
 const result:any={};for(const [key,item]of Object.entries(value)){if(key==='history'){result[key]=item;continue;}if(['statusId','defaultStatusId','inheritedStatusId'].includes(key)&&typeof item==='string')result[key]=mapping.get(item)||item;else if(value.field==='statusId'&&key==='value')result[key]=Array.isArray(item)?[...new Set(item.map(id=>mapping.get(id)||id))]:typeof item==='string'?mapping.get(item)||item:item;else result[key]=remapStatuses(item,mapping);}return result;
}
export function commitTeamNesting(repo:Repository,actor:Actor,teamId:string,input:any){return repo.transaction(()=>{
 assert(typeof input.parentId==='string',422,'Choose a parent team','INVALID_PARENT');const preview=previewTeamNesting(repo,actor,teamId,input.parentId);
 assert(input.snapshot===preview.snapshot,409,'Team settings changed. Reload the conflict review before continuing.','NESTING_CONFLICT');
 assert(typeof input.inheritStatuses==='boolean',422,'Choose a workflow inheritance option','INVALID_NESTING');
 const choices=input.labels||{},statusChoices={...(input.statuses||{})};assert(choices&&typeof choices==='object'&&!Array.isArray(choices)&&statusChoices&&typeof statusChoices==='object'&&!Array.isArray(statusChoices),422,'Invalid conflict choices','INVALID_NESTING');
 for(const conflict of preview.labelConflicts){const choice=choices[conflict.source.id];assert(choice&&['merge','rename'].includes(choice.action),422,`Resolve the duplicate label ${conflict.source.name}`,'UNRESOLVED_CONFLICT');if(choice.action==='merge')assert(conflict.targets.some(t=>t.id===choice.targetId),422,'Choose an inherited label from this conflict','INVALID_NESTING');else {assert(typeof choice.name==='string'&&choice.name.trim()&&choice.name.trim().length<=255,422,'Enter a new label name','INVALID_NESTING');const name=choice.name.trim().toLowerCase();assert(!repo.all('labels',actor.workspaceId).some(l=>!l.archivedAt&&(l.entityType||'issues')===(conflict.source.entityType||'issues')&&l.id!==conflict.source.id&&(l.teamId===conflict.source.teamId||l.teamId===preview.parent.id||teamAncestors(repo,preview.parent).some(p=>p.id===l.teamId))&&l.name.trim().toLowerCase()===name),422,'Choose a label name that does not conflict with this team or its parents','UNRESOLVED_CONFLICT');}}
 if(preview.privateParent)assert(['restricted','private'].includes(input.visibility),422,'Choose restricted or private access','INVALID_NESTING');
 if(input.inheritStatuses)for(const source of preview.childStatuses){const target=preview.parentStatuses.find(s=>s.id===statusChoices[source.id]);assert(target&&target.type===source.type,422,`Map ${source.name} to a parent status in the same workflow category`,'UNRESOLVED_CONFLICT');}
 const renamed=new Set<string>();for(const conflict of preview.labelConflicts){const choice=choices[conflict.source.id];if(choice.action==='rename'){const key=[conflict.source.teamId,conflict.source.entityType||'issues',choice.name.trim().toLowerCase()].join(':');assert(!renamed.has(key),422,'Choose distinct names for the local labels','UNRESOLVED_CONFLICT');renamed.add(key);}}
 const internal:Actor={...actor,system:true,hierarchySync:true,silent:true,scopes:['admin']};
 if(input.inheritStatuses){
  if(Object.values(statusChoices).includes('__duplicate__')){const duplicate=ensureDuplicateStatus(repo,internal,preview.parent.id);for(const id of Object.keys(statusChoices))if(statusChoices[id]==='__duplicate__')statusChoices[id]=duplicate.id;}
  const canonical=new Map<string,string>(),mapping=new Map<string,string>();
  for(const source of preview.childStatuses){const targetId=statusChoices[source.id];if(!canonical.has(targetId))canonical.set(targetId,source.id);mapping.set(source.id,canonical.get(targetId)!);}
  for(const row of repo.db.prepare("SELECT kind,data FROM entities WHERE workspace_id=? AND kind IN ('issues','teams','templates','views','automations','statuses')").all(actor.workspaceId) as {kind:string,data:string}[]){const before=JSON.parse(row.data),after=remapStatuses(before,mapping);if(JSON.stringify(before)!==JSON.stringify(after))save(repo,internal,row.kind,before,after);}
  for(const source of preview.childStatuses){const current=repo.raw('statuses',source.id)!;if(mapping.get(source.id)!==source.id){repo.save('statuses',{...current,deletedAt:(actor.now||new Date()).toISOString(),version:current.version+1},'delete',internal);}else save(repo,internal,'statuses',current,{inheritedStatusId:statusChoices[source.id],inheritedFromTeamId:input.parentId});}
 }
 // Parent change and all reference rewrites share the outer transaction.
 repo.update(actor,'teams',teamId,{parentId:input.parentId,inheritStatuses:input.inheritStatuses,...(preview.privateParent?{visibility:input.visibility}:{})});
 for(const conflict of preview.labelConflicts){const choice=choices[conflict.source.id],source=repo.raw('labels',conflict.source.id)!;if(choice.action==='merge')mergeLabel(repo,internal,source,choice.targetId);else repo.update(internal,'labels',source.id,{name:choice.name.trim()});}
 return repo.present(actor,'teams',repo.get(actor,'teams',teamId));
});}
