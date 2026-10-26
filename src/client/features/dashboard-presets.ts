import {defaultInsight,type InsightConfig} from './insight-data';
import type {DashboardDisplay} from './dashboard-presentation';
import type {Entity} from '../../shared/types';

export function dashboardStarter(template:string, statuses:Entity[]) {
  if(!['overview','customer','workload','business'].includes(template))return [];
  const active={field:'statusId',operator:'none',value:statuses.filter(s=>['completed','canceled','cancelled','duplicate'].includes(s.type)).map(s=>s.id)};
  const widget=(name:string,config:Record<string,any>,conditions:any[]=[]):InsightConfig & {id:string;name:string;displayMode?:DashboardDisplay;layout?:{x:number;y:number;w:number;h:number}}=>({...defaultInsight,id:crypto.randomUUID(),name,...config,filters:{match:'all' as const,conditions:[active,...conditions]}});
  if(template==='customer')return [
    widget('Open work by customer',{displayMode:'table',group:'Assigned customer',layout:{x:0,y:0,w:8,h:5}}),
    widget('Customer work overdue',{displayMode:'metric',group:'None',layout:{x:8,y:0,w:4,h:3}},[{field:'effectiveCustomerIds',operator:'notEmpty'},{field:'dueDate',operator:'before',value:'P0D'}]),
    widget('Due in the next 7 days',{displayMode:'metric',group:'None',layout:{x:8,y:3,w:4,h:3}},[{field:'effectiveCustomerIds',operator:'notEmpty'},{field:'dueDate',operator:'gte',value:'P0D'},{field:'dueDate',operator:'lte',value:'P7D'}]),
    widget('Customer effort by status',{displayMode:'chart',measure:'Effort',group:'Assigned customer',segment:'Status type',layout:{x:0,y:6,w:12,h:5}}),
  ];
  if(template==='workload')return [
    widget('Unassigned issues',{displayMode:'metric',group:'None',layout:{x:0,y:0,w:4,h:3}},[{field:'assigneeId',operator:'empty'}]),
    widget('Open issues',{displayMode:'metric',group:'None',layout:{x:4,y:0,w:4,h:3}}),
    widget('Remaining effort',{displayMode:'metric',measure:'Effort',group:'None',layout:{x:8,y:0,w:4,h:3}}),
    widget('Effort by owner',{displayMode:'chart',measure:'Effort',group:'Assignee',segment:'Status type',layout:{x:0,y:3,w:8,h:5}}),
    widget('Work by team',{displayMode:'table',group:'Team',layout:{x:8,y:3,w:4,h:5}}),
  ];
  if(template==='business')return [
    widget('Open issues',{displayMode:'metric',group:'None',layout:{x:0,y:0,w:4,h:3}}),
    widget('Overdue issues',{displayMode:'metric',group:'None',layout:{x:4,y:0,w:4,h:3}},[{field:'dueDate',operator:'before',value:'P0D'}]),
    widget('Remaining effort',{displayMode:'metric',measure:'Effort',group:'None',layout:{x:8,y:0,w:4,h:3}}),
    {...widget('Work over time',{displayMode:'chart',group:'Burn-up',segment:'Status type',interval:'week',layout:{x:0,y:3,w:8,h:5}}),filters:{match:'all' as const,conditions:[]}},
    widget('Effort by customer',{displayMode:'table',measure:'Effort',group:'Assigned customer',layout:{x:8,y:3,w:4,h:5}}),
  ];
  return [
    widget('Open issues',{chartType:'Metric',group:'None',layout:{x:0,y:0,w:4,h:3}}),
    widget('Overdue issues',{chartType:'Metric',group:'None',layout:{x:4,y:0,w:4,h:3}},[{field:'dueDate',operator:'before',value:'P0D'}]),
    widget('Due in the next 7 days',{chartType:'Metric',group:'None',layout:{x:8,y:0,w:4,h:3}},[{field:'dueDate',operator:'gte',value:'P0D'},{field:'dueDate',operator:'lte',value:'P7D'}]),
    widget('Work by status',{displayMode:'chart',chartType:'Bar',group:'Status',layout:{x:0,y:3,w:8,h:5}}),
    widget('Effort by customer',{displayMode:'table',chartType:'Table',measure:'Effort',group:'Assigned customer',layout:{x:8,y:3,w:4,h:5}}),
  ];
}
