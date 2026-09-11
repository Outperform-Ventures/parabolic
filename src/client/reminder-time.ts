const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const at=(date:Date,hour=9,minute=0)=>{const next=new Date(date);next.setHours(hour,minute,0,0);return next;};
function calendar(year:number,month:number,day:number,hour=9,minute=0){const value=new Date(year,month,day,hour,minute,0,0);return value.getFullYear()===year&&value.getMonth()===month&&value.getDate()===day&&value.getHours()===hour&&value.getMinutes()===minute?value:null;}
function addMonths(date:Date,count:number){const value=new Date(date),day=value.getDate();value.setDate(1);value.setMonth(value.getMonth()+count);value.setDate(Math.min(day,new Date(value.getFullYear(),value.getMonth()+1,0).getDate()));return value;}
/** Uses the viewer's local calendar; returns null for incomplete or invalid input. */
export function parseReminderTime(input:string,now=new Date()):Date|null{
 let text=input.trim().toLowerCase().replace(/^(?:til|until)\s+/,'').replace(/,/g,'').replace(/\s+/g,' ');if(!text)return null;
 const relative=text.match(/^(?:for|in)\s+(\d+)\s+(minute|hour|day|week|month|year)s?$/);if(relative){const count=Number(relative[1]);if(count<1||count>10000)return null;const value=new Date(now),unit=relative[2];if(unit==='minute'||unit==='hour')value.setTime(value.getTime()+count*(unit==='hour'?3600000:60000));else if(unit==='month'||unit==='year')return addMonths(value,count*(unit==='year'?12:1));else value.setDate(value.getDate()+count*(unit==='week'?7:1));return value;}
 if(text==='an hour from now')return new Date(now.getTime()+3600000);
 if(text==='a month from now')return at(addMonths(now,1));
 const bare=text.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?$/);if(bare){const result=parseReminderTime('in '+text,now);return result&&(['minute','hour'].includes(bare[2])?result:at(result));}
 if(text==='later today')return new Date(now.getTime()+3*3600000);
 let hour=9,minute=0;const time=text.match(/(?:\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)||text.match(/(?:\s+(?:at\s+)?)?(\d{1,2}):(\d{2})$/);
 if(time){hour=Number(time[1]);minute=Number(time[2]||0);if(minute>59||hour>(time[3]?12:23)||(time[3]&&hour===0))return null;if(time[3])hour=hour%12+(time[3]==='pm'?12:0);text=text.slice(0,time.index).trim();}
 let value:Date|null=null;if(!text||text==='today')value=at(now,hour,minute);
 else if(text==='tomorrow'){value=at(now,hour,minute);value.setDate(value.getDate()+1);}
 else if(text==='next week'){value=at(now,hour,minute);value.setDate(value.getDate()+((8-value.getDay())%7||7));}
 else if(text==='this weekend'||text==='next weekend'){value=at(now,hour,minute);value.setDate(value.getDate()+((6-value.getDay()+7)%7||7));}
 else if(text==='next month')value=new Date(now.getFullYear(),now.getMonth()+1,1,hour,minute);
 else if(text==='next quarter')value=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3+3,1,hour,minute);
 else if(text==='next year')value=new Date(now.getFullYear()+1,0,1,hour,minute);
 else if(weekdays.includes(text.replace(/^next\s+/,''))){value=at(now,hour,minute);const day=weekdays.indexOf(text.replace(/^next\s+/,''));value.setDate(value.getDate()+((day-value.getDay()+7)%7||7));}
 else{const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(iso)value=calendar(Number(iso[1]),Number(iso[2])-1,Number(iso[3]),hour,minute);else{const named=text.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/),numeric=text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);if(named||numeric){const month=named?months.findIndex(month=>month===named[1]||month.slice(0,3)===named[1]):Number(numeric![1])-1,day=Number((named||numeric)![2]),year=Number((named||numeric)![3]||now.getFullYear());if(month<0||month>11)return null;value=calendar(year,month,day,hour,minute);if(value&&!(named||numeric)![3]&&value<=now)value=calendar(year+1,month,day,hour,minute);}}}
 if(value&&!text&&value<=now)value.setDate(value.getDate()+1);return value&&Number.isFinite(value.getTime())&&value>now?value:null;
}
export const reminderPresets=(now=new Date())=>['An hour from now','Tomorrow','Next week','A month from now'].map(label=>({label,date:parseReminderTime(label,now)!}));
export const reminderTimeLabel=(value:string|Date)=>new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));
export function reminderChoiceLabel(input:string,value:string|Date){
 const text=input.trim().toLowerCase().replace(/\s+/g,' '),relative=text.match(/^(?:for|in\s+)?(\d+)\s+(minute|hour|day|week|month|year)s?$/);
 if(relative){const count=Number(relative[1]),unit=relative[2];return `In ${count} ${unit}${count===1?'':'s'}`;}
 return reminderTimeLabel(value);
}
