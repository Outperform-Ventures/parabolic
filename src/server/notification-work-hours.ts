import type {Repository,RecordEntity} from './repository';
// Provisional local-hour bounds; native promises next working-day morning but does
// not publish exact hours. Keep the implementation choice explicit in the ledger.
export const notificationWorkHours={startHour:9,endHour:17};
export function nextEmailWorkTime(repo:Repository,n:RecordEntity,now:Date){
 const workspace=repo.raw('workspaces',n.workspaceId),week=workspace?.workWeek||'mon-fri';let zone=workspace?.timezone||'UTC';try{new Intl.DateTimeFormat('en',{timeZone:zone})}catch{zone='UTC'}
 const format=new Intl.DateTimeFormat('en',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'}),parts=(at:Date)=>Object.fromEntries(format.formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 const p=parts(now),day=new Date(Date.UTC(p.year,p.month-1,p.day)),working=(date:Date)=>week==='sun-thu'?![5,6].includes(date.getUTCDay()):![0,6].includes(date.getUTCDay());
 if(working(day)&&p.hour>=notificationWorkHours.startHour&&p.hour<notificationWorkHours.endHour)return now;
 if(p.hour>=notificationWorkHours.endHour)day.setUTCDate(day.getUTCDate()+1);while(!working(day))day.setUTCDate(day.getUTCDate()+1);
 const target=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),notificationWorkHours.startHour);let candidate=target;for(let i=0;i<5;i++){const observed=parts(new Date(candidate)),value=Date.UTC(observed.year,observed.month-1,observed.day,observed.hour,observed.minute,observed.second),next=candidate+target-value;if(next===candidate)break;candidate=next;}return new Date(candidate);
}
