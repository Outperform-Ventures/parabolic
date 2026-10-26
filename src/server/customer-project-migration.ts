import {directCustomerIds} from '../shared/customer-assignments';
import {assert} from './errors';
import type {Actor,Repository} from './repository';

export type CustomerProjectMapping={projectId:string;customerId?:string;customerName?:string};
/** Explicit, additive migration. Call only after backing up the workspace. */
export function linkCustomerProjects(repo:Repository,actor:Actor,mappings:CustomerProjectMapping[],apply=false){
  assert(mappings.length>0&&mappings.length<=100,422,'Choose between 1 and 100 projects','INVALID_MIGRATION');
  assert(new Set(mappings.map(m=>m.projectId)).size===mappings.length,422,'Each project must appear only once','INVALID_MIGRATION');
  return repo.transaction(()=>{
    const customers=repo.all('customers',actor.workspaceId),issues=repo.all('issues',actor.workspaceId);
    const normalize=(name:string)=>name.trim().toLocaleLowerCase();
    const plans=mappings.map(mapping=>{
      const project=repo.get(actor,'projects',mapping.projectId);repo.access(actor,'projects',project,true);
      assert(!project.archivedAt,422,'Cannot migrate an archived project','INVALID_MIGRATION');
      const name=(mapping.customerName||project.name).trim();
      const matches=mapping.customerId?[repo.get(actor,'customers',mapping.customerId)]:customers.filter(c=>normalize(c.name)===normalize(name));
      assert(matches.length<=1,422,'Customer name is ambiguous; specify its ID','AMBIGUOUS_CUSTOMER');
      const customer=matches[0];
      assert(!customer?.archivedAt,422,'Choose an active customer','ARCHIVED_CUSTOMER');
      if(customer)repo.access(actor,'customers',customer);
      const linkedIssues=issues.filter(i=>i.projectId===project.id&&i.inheritProjectCustomers!==false);
      return{project,customer,name,inheritedIssueCount:linkedIssues.length,activeInheritedIssueCount:linkedIssues.filter(i=>!i.archivedAt).length};
    });
    let createdCustomers=0,updatedProjects=0;
    const createdByName=new Map<string,string>();
    const rows=plans.map(plan=>{
      let customerId=plan.customer?.id||createdByName.get(normalize(plan.name));
      if(apply&&!customerId){customerId=repo.create(actor,'customers',{name:plan.name,status:'Active',ownerId:actor.userId}).id;createdCustomers++;createdByName.set(normalize(plan.name),customerId)}
      const needsLink=!customerId||!directCustomerIds(plan.project).includes(customerId);
      if(apply&&needsLink){repo.update(actor,'projects',plan.project.id,{version:plan.project.version,directCustomerIds:[...new Set([...directCustomerIds(plan.project),customerId!])],customerId:null});updatedProjects++}
      return{projectId:plan.project.id,customerId:customerId||null,customerName:plan.name,createCustomer:!plan.customer,addProjectLink:needsLink,inheritedIssues:plan.inheritedIssueCount,activeInheritedIssues:plan.activeInheritedIssueCount};
    });
    return{applied:apply,createdCustomers,updatedProjects,rows};
  });
}
