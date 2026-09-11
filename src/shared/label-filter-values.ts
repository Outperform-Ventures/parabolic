import type {Entity} from './types';
const combined=new WeakMap<Entity[],WeakMap<Entity[],Entity[]>>();
const noGroups:Entity[]=[];
/** Include group identities without exposing them as assignable label records. */
export function filterLabelRecords(data:{labels:Entity[];labelGroups?:Entity[]}){
 const groups=data.labelGroups??noGroups;let byGroups=combined.get(data.labels);if(!byGroups){byGroups=new WeakMap();combined.set(data.labels,byGroups)}
 let result=byGroups.get(groups);if(!result){result=[...data.labels,...groups.map(group=>({...group,isGroup:true}))];byGroups.set(groups,result)}return result;
}
const indexes=new WeakMap<Entity[],Map<string,string[]>>();
export function labelFilterTargets(records:Entity[],id:string):string[]{
 let targets=indexes.get(records);if(!targets){
  targets=new Map();const active=records.filter(record=>!record.deletedAt),identities=new Map<string,Entity[]>();
  const key=(label:Entity)=>JSON.stringify([label.entityType||'issues',label.isGroup?'group':'label',label.name?.toLocaleLowerCase()]);
  for(const label of active){const values=identities.get(key(label))??[];values.push(label);identities.set(key(label),values)}
  for(const label of active){const peers=identities.get(key(label))!;const values=label.isGroup?active.filter(child=>!child.isGroup&&peers.some(group=>(child.entityType||'issues')===(group.entityType||'issues')&&(child.teamId||null)===(group.teamId||null)&&(child.labelGroupId===group.id||!child.labelGroupId&&child.group===group.name))).map(child=>child.id):peers.map(peer=>peer.id);targets.set(label.id,values);}
  for(const label of active.filter(label=>!label.isGroup))for(const merged of label.mergedLabelIds||[])if(!targets.has(merged))targets.set(merged,targets.get(label.id)!);
  indexes.set(records,targets);
 }
 return targets.get(id)??[id];
}
