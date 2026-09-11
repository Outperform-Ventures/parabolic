import type {Entity} from '../../shared/types';
export type InsightInterval='day'|'week'|'month'|'quarter'|'year'|'thirtyMinutes';
export const insightIntervals:InsightInterval[]=['thirtyMinutes','day','week','month','quarter','year'];
export function insightPeriod(value:string|number,interval:InsightInterval,fiscalMonth=0):number{
 const date=new Date(value);if(!Number.isFinite(+date))return NaN;
 if(interval==='thirtyMinutes'){date.setUTCMinutes(Math.floor(date.getUTCMinutes()/30)*30,0,0);return +date;}
 date.setUTCHours(0,0,0,0);
 if(interval==='week')date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
 if(interval==='month')date.setUTCDate(1);
 if(interval==='quarter'||interval==='year'){const offset=(date.getUTCMonth()-fiscalMonth+12)%12;date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-(interval==='year'?offset:offset%3));}
 return +date;
}
export function nextInsightPeriod(value:number,interval:InsightInterval):number{const date=new Date(value);if(interval==='thirtyMinutes')date.setUTCMinutes(date.getUTCMinutes()+30);else if(interval==='day')date.setUTCDate(date.getUTCDate()+1);else if(interval==='week')date.setUTCDate(date.getUTCDate()+7);else date.setUTCMonth(date.getUTCMonth()+({month:1,quarter:3,year:12}[interval]));return +date;}
export function insightPeriodLabel(value:number,interval:InsightInterval):string{const iso=new Date(value).toISOString();return interval==='thirtyMinutes'?iso.slice(0,16)+'Z':interval==='month'?iso.slice(0,7):interval==='year'?iso.slice(0,4):iso.slice(0,10);}
export function availableInsightDimensions(slices:readonly string[],measure:string,teams:Entity[],context:{project?:boolean;cycle?:boolean;customers?:boolean}={}){
 const duration=!['Issue count','Effort'].includes(measure);
 return slices.filter(slice=>{
  if(['Created week','Completed week'].includes(slice))return false;
  if(duration&&['Label','Project label','Initiative','Burn-up'].includes(slice))return false;
  if(['Cycle Time','Lead Time'].includes(measure)&&['Status','Status type'].includes(slice))return false;
  if(measure==='Issue Age'&&['Created date','Completed date','Canceled date'].includes(slice))return false;
  if(slice==='Milestone'&&!context.project)return false;
  if(context.project&&['Project','Initiative'].includes(slice))return false;
  if(slice==='Team'&&teams.length===1)return false;
  if(slice==='Customer'&&context.customers===false)return false;
  if(slice==='Estimate'&&teams.length>0&&teams.every(team=>team.estimateScale==='None'))return false;
  if(['Cycle','Added to cycle'].includes(slice)&&teams.length>0&&teams.every(team=>team.cyclesEnabled===false))return false;
  if(slice==='Cycle'&&context.cycle)return false;
  return true;
 });
}
export function availableInsightIntervals(group:string,cycle=false):InsightInterval[]{return [...(group==='Burn-up'?[]:['year' as const]),'quarter','month','week',...(cycle?['day' as const]:[])];}
export function availableInsightSegments(group:string,dimensions:readonly string[]):string[]{const excluded=new Set(['Cycle',...dimensions.filter(value=>value.endsWith(' date')||value.endsWith(' week')||value==='Burn-up')]);excluded.add(group);if(group==='Status')excluded.add('Status type');if(group==='Burn-up'){excluded.add('Label');excluded.add('Project label');}if(['Label','Label group','Project label','Project label group'].includes(group))for(const value of ['Label','Label group','Project label','Project label group'])excluded.add(value);if(group==='Project'){excluded.add('Initiative');}if(group==='Milestone'){excluded.add('Project');excluded.add('Initiative');}return dimensions.filter(value=>!excluded.has(value));}
