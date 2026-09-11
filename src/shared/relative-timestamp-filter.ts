import type{RelativeDateClock}from'./relative-date-filter';
type Parts={year:number;month:number;day:number;hour:number;minute:number;second:number;millisecond:number};
const formatters=new Map<string,Intl.DateTimeFormat>();
function parts(date:Date,zone?:string):Parts{
 if(!zone)return {year:date.getFullYear(),month:date.getMonth()+1,day:date.getDate(),hour:date.getHours(),minute:date.getMinutes(),second:date.getSeconds(),millisecond:date.getMilliseconds()};
 let formatter=formatters.get(zone);if(!formatter){formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});formatters.set(zone,formatter)}
 const values=Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));return {...values,millisecond:date.getUTCMilliseconds()} as Parts;
}
function wallDate(p:Parts){const date=new Date(0);date.setUTCFullYear(p.year,p.month-1,p.day);date.setUTCHours(p.hour,p.minute,p.second,p.millisecond);return date;}
function fromWall(p:Parts,zone?:string):Date|undefined{
 if(!zone){const date=new Date(0);date.setFullYear(p.year,p.month-1,p.day);date.setHours(p.hour,p.minute,p.second,p.millisecond);return date;}
 const target=+wallDate(p),offsets=new Set<number>();
 for(const hours of [-36,-12,0,12,36]){const sample=new Date(target+hours*3600000);offsets.add(+wallDate(parts(sample,zone))-(+sample))}
 const candidates=[...offsets].map(offset=>{const date=new Date(target-offset);return {date,wall:+wallDate(parts(date,zone))}});
 const exact=candidates.filter(c=>c.wall===target).sort((a,b)=>+a.date-(+b.date));if(exact.length)return exact[0].date;
 // A skipped local time advances through the gap; repeated local times choose the earlier instant.
 return candidates.filter(c=>c.wall>target).sort((a,b)=>a.wall-b.wall||+a.date-(+b.date))[0]?.date;
}
function shiftCalendar(date:Date,months:number,days:number,zone?:string):Date|undefined{
 const local=parts(date,zone),wall=wallDate(local);
 if(months){wall.setUTCDate(1);wall.setUTCMonth(wall.getUTCMonth()+months);const end=new Date(wall);end.setUTCMonth(end.getUTCMonth()+1,0);wall.setUTCDate(Math.min(local.day,end.getUTCDate()))}
 if(days)wall.setUTCDate(wall.getUTCDate()+days);
 if(wall.getUTCFullYear()<1||wall.getUTCFullYear()>9999)return;
 return fromWall({year:wall.getUTCFullYear(),month:wall.getUTCMonth()+1,day:wall.getUTCDate(),hour:wall.getUTCHours(),minute:wall.getUTCMinutes(),second:wall.getUTCSeconds(),millisecond:wall.getUTCMilliseconds()},zone);
}
/** Calendar units retain wall time; H/M/S are elapsed units. Resolution must be anchored once per query. */
export function resolveRelativeTimestamp(value:unknown,{now=new Date(),timeZone}:RelativeDateClock={}):string|undefined{
 if(typeof value!=='string'||!Number.isFinite(+now))return;
 const match=/^([+-])?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
 if(!match||match.slice(2).every(part=>part===undefined)||value.endsWith('T'))return;
 const units=match.slice(2).map(part=>Number(part||0));if(units.some(unit=>!Number.isSafeInteger(unit)||unit>10000))return;
 const sign=match[1]==='-'?-1:1;let result:Date|undefined=new Date(now);
 const months=sign*(units[0]*12+units[1]),days=sign*(units[2]*7+units[3]);
 if(months)result=shiftCalendar(result,months,0,timeZone);if(!result)return;
 if(days)result=shiftCalendar(result,0,days,timeZone);if(!result)return;
 result=new Date(+result+sign*(units[4]*3600000+units[5]*60000+units[6]*1000));
 if(!Number.isFinite(+result)||result.getUTCFullYear()<1||result.getUTCFullYear()>9999)return;
 return result.toISOString();
}

/** A date-only timestamp operand denotes midnight in the viewer's calendar. */
export function resolveTimestampFilterValue(value:unknown,clock:RelativeDateClock={}):string|undefined{
 const relative=resolveRelativeTimestamp(value,clock);if(relative!==undefined)return relative;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
 const [year,month,day]=value.split('-').map(Number),check=new Date(value+'T12:00:00Z');
 if(year<1||!Number.isFinite(+check)||check.toISOString().slice(0,10)!==value)return;
 return fromWall({year,month,day,hour:0,minute:0,second:0,millisecond:0},clock.timeZone)?.toISOString();
}
