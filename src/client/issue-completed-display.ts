import type {Entity} from '../shared/types';
export function completedIssueVisible(issue:Entity,window:string|undefined,now:Date,cycles:Entity[]):boolean {
 if(!window||window==='all')return true;
 if(window==='none')return false;
 if(window==='cycle')return cycles.some(c=>c.id===issue.cycleId&&Date.parse(c.startDate)<=now.getTime()&&Date.parse(c.endDate)>=now.getTime());
 const days=window==='day'?1:window==='week'?7:30;
 return Date.parse(issue.completedAt||issue.canceledAt||issue.updatedAt)>=now.getTime()-days*86400000;
}
export function orderCompletedIssues(items:Entity[],statuses:Entity[],enabled?:boolean):Entity[] {
 if(!enabled)return items;
 const completed=new Set(statuses.filter(s=>s.type==='completed'||s.type==='canceled').map(s=>s.id));
 const sorted=items.filter(i=>completed.has(i.statusId)).sort((a,b)=>Date.parse(b.completedAt||b.canceledAt||b.updatedAt)-Date.parse(a.completedAt||a.canceledAt||a.updatedAt));
 let index=0;
 return items.map(i=>completed.has(i.statusId)?sorted[index++]:i);
}
