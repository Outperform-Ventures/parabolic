import type {Entity} from '../shared/types';
export function commonIssueValues(issues:Entity[],field:string){return (issues[0]?.[field]??[]).filter((id:string)=>issues.every(issue=>(issue[field]??[]).includes(id))) as string[];}
export function issueBulkPropertyChanges(issues:Entity[],patch:Record<string,any>,preserveMixed=false,touched:string[]=[],labels:Entity[]=[]){
 const groups=new Map(labels.filter(label=>label.group).map(label=>[label.id,`${label.teamId??''}:${label.group}`]));
 return issues.map(issue=>{const data={...patch};if(preserveMixed)for(const[field,value]of Object.entries(patch)){if(!Array.isArray(value))continue;const removed=new Set(touched.filter(id=>!value.includes(id))),added=value.filter(id=>touched.includes(id)),replaced=new Set(field==='labelIds'?added.map(id=>groups.get(id)).filter(Boolean):[]);data[field]=[...new Set([...(issue[field]??[]).filter((id:string)=>!removed.has(id)&&!replaced.has(groups.get(id))),...added])];}return {kind:'issues' as const,id:issue.id,expectedVersion:issue.version,data};});
}

export function commonIssueStatusOptions(issues:Entity[],statuses:Entity[]){
 const available=issues.map(issue=>(issue.sharedStatuses??statuses.filter(status=>status.teamId===issue.teamId)).filter((status:Entity)=>!status.deletedAt&&!status.archivedAt));
 return (available[0]??[]).filter((status:Entity)=>available.every((list:Entity[])=>list.some(candidate=>candidate.id===status.id||candidate.type===status.type&&candidate.name===status.name))).sort((a:Entity,b:Entity)=>(a.position??0)-(b.position??0)).map((status:Entity)=>({id:status.id,name:status.name}));
}
export function resolveIssueBulkStatuses(issues:Entity[],changes:ReturnType<typeof issueBulkPropertyChanges>,statuses:Entity[]){
 const all=[...statuses,...issues.flatMap(issue=>issue.sharedStatuses??[])];
 return changes.map((change,index)=>{if(!change.data.statusId)return change;const issue=issues[index],source=all.find(status=>status.id===change.data.statusId),available=(issue.sharedStatuses??statuses.filter(status=>status.teamId===issue.teamId)).filter((status:Entity)=>!status.deletedAt&&!status.archivedAt);const target=available.find((status:Entity)=>status.id===change.data.statusId)||available.find((status:Entity)=>source&&status.name===source.name&&status.type===source.type);if(!target)throw new Error('The selected status is not available in every selected team.');return {...change,data:{...change.data,statusId:target.id}};});
}
