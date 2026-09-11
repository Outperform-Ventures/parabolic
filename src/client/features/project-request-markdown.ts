import {richTextToMarkdown} from '../markdown';
import type {Row} from './shared';

const label=(value:string)=>value.replaceAll('\\','\\\\').replaceAll('[','\\[').replaceAll(']','\\]');
export function projectRequestsMarkdown(projects:Row[],requests:Row[],customers:Row[],origin:string) {
  const selected=new Set(projects.map(project=>project.id)),byProject=new Map<string,Row[]>(),byCustomer=new Map(customers.map(customer=>[customer.id,customer]));
  for(const request of requests){if(request.deletedAt||request.archivedAt||!selected.has(request.projectId))continue;const rows=byProject.get(request.projectId)||[];rows.push(request);byProject.set(request.projectId,rows)}
  return projects.map(project=>{
    const rows=byProject.get(project.id)||[];
    if(!rows.length)return '# '+project.name;
    const entries=rows.map(request=>{
      const customer=byCustomer.get(request.customerId),name=label(customer?.name||'Deleted customer');
      const date=new Date(request.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const heading='- '+(customer?'['+name+']('+origin+'/customer/'+customer.id+')':name)+' • '+date;
      const body=richTextToMarkdown(request.body||'');
      const source=/^https?:\/\//i.test(request.sourceUrl||'')?'[Source](<'+String(request.sourceUrl).replaceAll('>','%3E').replaceAll('<','%3C')+'>)':'';
      const details=[body,source].filter(Boolean).join('\n\n');
      return heading+(details?'\n\n'+details.split('\n').map(line=>'  '+line).join('\n'):'');
    });
    return '# '+project.name+'\n\n## Customer requests\n\n'+entries.join('\n\n');
  }).join('\n\n------\n\n');
}
