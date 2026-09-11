import {defaultInsightTheme,type InsightTheme} from './insight-theme';
import type {InsightConfig,InsightData,InsightSource} from './insight-data';
export const insightPalette=['#9A48FF','#56ABFD','#4BB449','#E15F28','#F67E49','#CC05FF','#17A6A4','#9A3A63','#F84DD0','#1D8AF2','#F8C531','#BB87FC','#D04A52','#831FFF','#D09808','#B18869','#77D677','#A44907','#4ADAD3','#E166FF','#96D71E'];
const modelFields=['SLA status','Status','Status type','Label','Label group','Project label','Project label group','Project','Initiative','Priority','Estimate','Team','Added to cycle'];
export function insightColorChoice(config:InsightConfig):boolean{const field=config.segment==='None'?config.group:config.segment,latency=!['Issue count','Effort'].includes(config.measure);if(['SLA status','Status type','Priority','Estimate','Added to cycle'].includes(field))return false;return !((latency&&!modelFields.includes(config.group)&&!config.group.endsWith(' date'))||(!latency&&config.segment!=='None'&&!modelFields.includes(field)));}
export function insightColors(source:InsightSource,config:InsightConfig,result:InsightData,theme:InsightTheme=defaultInsightTheme()):Map<string,string>{const historical=config.group==='Burn-up',field=historical&&config.segment==='None'?'Status type':config.segment==='None'?config.group:config.segment,names=historical?[...new Set(result.burnup.flatMap(point=>Object.keys(point.segments)))]:config.segment==='None'?result.buckets.map(bucket=>bucket.key??bucket.label):[...new Set(result.rows.flatMap(row=>row.segmentKeys??row.segments??[row.segment]))];return new Map(names.map((key,index)=>{const name=!historical&&config.segment==='None'?result.buckets.find(bucket=>(bucket.key??bucket.label)===key)?.label??key:result.segmentLabels?.[key]??key;
 let color:string|undefined;
 if(config.colorScale!=='categorical'||['SLA status','Status type','Priority','Estimate','Added to cycle'].includes(field)){
  const records=field.includes('label')||field.includes('Label')?source.labels:field==='Project'?source.projects:field==='Initiative'?source.initiatives??[]:field==='Team'?source.teams:field==='Status'?source.statuses:[];
  color=records.find(record=>result.entityRefs?.[key]?record.id===result.entityRefs[key]:record.name===name)?.color;
  if(field==='Status type')color=({triage:'#FC7840',backlog:'#BEC2C8',unstarted:'#E2E2E2',started:'#F2C94C',completed:'#5E6AD2',canceled:'#95A2B3',duplicate:'#95A2B3'} as Record<string,string>)[name];
  if(field==='Priority')color=({Urgent:'#FC7840',High:'#F2C94C',Medium:'#78E576',Low:'#54C9D2','No priority':'#6A6A73'} as Record<string,string>)[name];
  if(field==='Estimate'){const values=[0,1,2,3,4,5,6,7,8,13,16,21,32,64],palette=['#BB87FC','#9A48FF','#56ABFD','#1D8AF2','#4ADAD3','#17A6A4','#77D677','#4BB449','#F8C531','#D09808','#F67E49','#E15F28','#D04A52','#9A3A63'];color=palette[values.indexOf(Number(name))];}
  if(field==='Added to cycle')color=({Planned:theme.colors['--semantic-blue'],'During cycle':theme.colors['--semantic-orange-mid'],'After cycle':theme.colors['--semantic-purple'],'No info':theme.empty} as Record<string,string>)[name];
  if(field==='SLA status')color=({Breached:theme.colors['--semantic-red'],Failed:theme.muted,Achieved:theme.colors['--semantic-green'],'High risk':theme.colors['--semantic-orange'],'Medium risk':theme.colors['--semantic-yellow'],'Low risk':theme.muted,'No SLA':theme.empty,Paused:theme.muted} as Record<string,string>)[name];
 }
 return[key,color||insightPalette[index%insightPalette.length]];
 }));}
