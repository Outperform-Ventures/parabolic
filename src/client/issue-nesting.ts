import type {Entity} from '../shared/types';
export type NestedIssueRow={issue:Entity;depth:number;hasChildren:boolean};
/** Build a stable visible forest. Missing/filtered parents leave their children visible. */
export function nestedIssueRows(issues:Entity[],collapsed:readonly string[]=[]):NestedIssueRow[]{
 const byId=new Map(issues.map(i=>[i.id,i])),children=new Map<string,Entity[]>(),closed=new Set(collapsed),seen=new Set<string>(),rows:NestedIssueRow[]=[];
 for(const issue of issues)if(issue.parentId&&issue.parentId!==issue.id&&byId.has(issue.parentId)){const list=children.get(issue.parentId)||[];list.push(issue);children.set(issue.parentId,list)}
 const visit=(issue:Entity,depth:number,hidden=false)=>{if(seen.has(issue.id))return;seen.add(issue.id);const descendants=children.get(issue.id)||[];if(!hidden)rows.push({issue,depth,hasChildren:descendants.length>0});for(const child of descendants)visit(child,depth+1,hidden||closed.has(issue.id));};
 for(const issue of issues)if(!issue.parentId||issue.parentId===issue.id||!byId.has(issue.parentId))visit(issue,0);
 // A malformed imported cycle must neither loop nor make records unreachable.
 for(const issue of issues)if(!seen.has(issue.id))visit(issue,0);
 return rows;
}
