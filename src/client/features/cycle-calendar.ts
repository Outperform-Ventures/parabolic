export function cycleLocalDay(value:string,zone='UTC'){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 return ['year','month','day'].map(key=>parts.find(part=>part.type===key)?.value).join('-');
}
export function cycleInclusiveEnd(value:string,zone='UTC'){return cycleLocalDay(new Date(Date.parse(value)-60001).toISOString(),zone)}
export function cycleExclusiveEnd(day:string){return new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10)}
