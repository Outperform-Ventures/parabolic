import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../../src/server/database';
import {Repository} from '../../src/server/repository';
import {Auth} from '../../src/server/auth';
import {linkCustomerProjects} from '../../src/server/customer-project-migration';

async function fixture(){const db=openDatabase(':memory:'),repo=new Repository(db),auth=new Auth(db,repo),setup=await auth.setup({name:'Owner',email:'migration@example.test',password:'isolated-migration-tests'}),actor={workspaceId:setup.workspaceId,userId:setup.user.id,role:'owner',scopes:['admin']},team=repo.all('teams',actor.workspaceId)[0];return{db,repo,actor,team}}

test('migration is additive, previewable, idempotent, and retains every issue and existing project property',async()=>{
 const {db,repo,actor,team}=await fixture();try{
  const existing=repo.create(actor,'customers',{name:'Existing customer'}),p=repo.create(actor,'projects',{name:'New customer',teamIds:[team.id],summary:'Keep this project'}),q=repo.create(actor,'projects',{name:'Existing customer',teamIds:[team.id]});
  const issue=repo.create(actor,'issues',{title:'Keep this issue',teamId:team.id,projectId:p.id}),archived=repo.create(actor,'issues',{title:'Archived issue',teamId:team.id,projectId:p.id,archivedAt:new Date().toISOString()}),optedOut=repo.create(actor,'issues',{title:'Unlinked issue',teamId:team.id,projectId:p.id,inheritProjectCustomers:false});
  const before=repo.all('issues',actor.workspaceId),mapping=[{projectId:p.id},{projectId:q.id,customerId:existing.id}],count=repo.all('customers',actor.workspaceId).length;
  const preview=linkCustomerProjects(repo,actor,mapping);assert.equal(preview.applied,false);assert.equal(repo.all('customers',actor.workspaceId).length,count);assert.equal(repo.get(actor,'projects',p.id).version,p.version);
  const result=linkCustomerProjects(repo,actor,mapping,true);assert.equal(result.createdCustomers,1);assert.equal(result.updatedProjects,2);assert.equal(result.rows[0].inheritedIssues,2);assert.equal(result.rows[0].activeInheritedIssues,1);assert.deepEqual(repo.all('issues',actor.workspaceId),before);assert.equal(repo.get(actor,'projects',p.id).summary,p.summary);assert.equal(repo.all('requests',actor.workspaceId).length,0);
  assert.deepEqual(repo.present(actor,'issues',issue).effectiveCustomerIds,[result.rows[0].customerId]);assert.deepEqual(repo.present(actor,'issues',archived).effectiveCustomerIds,[result.rows[0].customerId]);assert.deepEqual(repo.present(actor,'issues',optedOut).effectiveCustomerIds,[]);
  const repeat=linkCustomerProjects(repo,actor,mapping,true);assert.equal(repeat.createdCustomers,0);assert.equal(repeat.updatedProjects,0);
 }finally{db.close()}
});
test('migration validates every target before writing and refuses ambiguous customer names',async()=>{
 const {db,repo,actor,team}=await fixture();try{const p=repo.create(actor,'projects',{name:'Ambiguous',teamIds:[team.id]});repo.create(actor,'customers',{name:'Ambiguous'});repo.create(actor,'customers',{name:'Ambiguous'});const count=repo.all('customers',actor.workspaceId).length;assert.throws(()=>linkCustomerProjects(repo,actor,[{projectId:p.id}],true),/ambiguous/);assert.throws(()=>linkCustomerProjects(repo,actor,[{projectId:p.id,customerName:'Brand new'},{projectId:'missing'}],true));assert.equal(repo.all('customers',actor.workspaceId).length,count);assert.equal(repo.get(actor,'projects',p.id).version,p.version);assert.throws(()=>linkCustomerProjects(repo,actor,[{projectId:p.id},{projectId:p.id}],true));}finally{db.close()}
});
