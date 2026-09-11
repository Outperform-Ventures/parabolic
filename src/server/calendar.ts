/** Advance a scheduled instant on its local calendar, retaining wall time across DST. */
export function advanceOccurrence(instant:Date,recurrence:{frequency:string;interval?:number;timeZone?:string;startDate?:string;dayOfMonth?:number}) {
  const zone=recurrence.timeZone||'UTC';const interval=recurrence.interval||1;
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=(date:Date)=>Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  const local=parts(instant);const calendar=new Date(Date.UTC(local.year,local.month-1,local.day,local.hour,local.minute,local.second));
  if(recurrence.frequency==='monthly'||recurrence.frequency==='yearly'){const anchor=recurrence.dayOfMonth||(recurrence.startDate?parts(new Date(recurrence.startDate)).day:local.day);calendar.setUTCDate(1);calendar.setUTCMonth(calendar.getUTCMonth()+interval*(recurrence.frequency==='yearly'?12:1));const last=new Date(Date.UTC(calendar.getUTCFullYear(),calendar.getUTCMonth()+1,0)).getUTCDate();calendar.setUTCDate(Math.min(anchor,last));}
  else calendar.setUTCDate(calendar.getUTCDate()+interval*(recurrence.frequency==='weekly'?7:1));
  const target=calendar.getTime();let candidate=target;const tried:number[]=[];
  for(let i=0;i<4;i++){const observed=parts(new Date(candidate));const asUtc=Date.UTC(observed.year,observed.month-1,observed.day,observed.hour,observed.minute,observed.second);const corrected=candidate+(target-asUtc);if(corrected===candidate)return new Date(candidate);if(tried.includes(corrected))return new Date(Math.max(candidate,corrected));tried.push(candidate);candidate=corrected;}
  return new Date(candidate);
}
