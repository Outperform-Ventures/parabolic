import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('issue discovery and template commands dispatch real issue-scoped workflows',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Command actions',email:'command-actions@example.test',password:'command-actions-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json();
  const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Unusual frosted search phrase',description:'<p>Preserved template description</p>',teamId:state.teams[0].id,priority:2,estimate:3}})).json();
  const command=async(label:string)=>{const input=page.getByRole('combobox',{name:'Command menu',exact:true});await expect.poll(async()=>{if(await input.count())return 1;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('workspace-command',{detail:{command:'command-menu'}})));return 0;}).toBe(1);await input.fill(label);await page.getByRole('option').filter({hasText:label}).first().click();};
  await page.goto(url+'/issues/'+issue.id);await command('Show similar issues');await expect(page).toHaveURL(/\/search\?q=Unusual\+frosted\+search\+phrase&type=Issues/);
  await page.goto(url+'/issues/'+issue.id);await command('Convert into template');await expect(page).toHaveURL(/\/settings\/templates\?template=/);await expect.poll(()=>app.repo.all('templates',state.workspaceId).find(row=>row.name===issue.title)?.properties?.estimate).toBe(3);
 }finally{await page.close();await app.close();}
});

test('workspace and team commands open their backed, permission-scoped workflows',async({page,request})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Workspace actions',email:'workspace-actions@example.test',password:'workspace-actions-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0];
  const run=async(label:string)=>{const input=page.getByRole('combobox',{name:'Command menu',exact:true});await expect.poll(async()=>{if(await input.count())return 1;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('workspace-command',{detail:{command:'command-menu'}})));return 0;}).toBe(1);await input.fill(label);await page.getByRole('option').filter({hasText:label}).first().click();};
  await page.goto(url+'/my-issues');await run('Change interface theme');await expect(page.getByLabel('Interface theme',{exact:true})).toBeFocused();
  await page.goto(url+'/my-issues');await run('Change default view');await expect(page.getByLabel('Default home view',{exact:true})).toBeFocused();
  await page.goto(url+'/my-issues');await run('Invite to Parabolic');await expect(page.getByRole('dialog',{name:'Invite to your workspace',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.goto(url+'/my-issues');await run('Open suspended user');await expect(page.getByLabel('Member status',{exact:true})).toContainText('Suspended');
  await page.goto(url+'/my-issues');await run('Create a team');await expect(page.getByRole('dialog',{name:'Create team',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  const invite=await(await page.request.post(url+'/api/v1/invitations',{data:{email:'team-owner@example.test',role:'member'}})).json(),joined=await(await request.post(url+'/auth/join',{data:{token:invite.token,name:'Team owner',password:'team-owner-password'}})).json();await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{ownerIds:[joined.user.id]}});
  await page.goto(url+'/team/'+team.id+'/overview');await run('Leave team');await expect(page.getByRole('dialog',{name:`Leave ${team.name}?`,exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 }finally{await page.close();await app.close();}
});

test('command inventory follows invite, team creation, template-owner and leave safeguards',async({page,browser})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),memberContext=await browser.newContext(),member=await memberContext.newPage();try{
  await page.request.post(url+'/auth/setup',{data:{name:'Policy owner',email:'policy-owner@example.test',password:'policy-owner-password'}});const state=await(await page.request.get(url+'/api/v1/state')).json(),team=state.teams[0],invitation=await(await page.request.post(url+'/api/v1/invitations',{data:{email:'policy-member@example.test',role:'member'}})).json(),joined=await(await memberContext.request.post(url+'/auth/join',{data:{token:invitation.token,name:'Policy member',password:'policy-member-password'}})).json();
  await page.request.post(url+'/api/v1/memberships',{data:{teamId:team.id,userId:joined.user.id,role:'member'}});await page.request.patch(url+'/api/v1/workspaces/'+state.workspaceId,{data:{allowMemberInvites:false,teamCreationPolicy:'admins'}});await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{templateManagement:'owners',ownerIds:[state.user.id]}});const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Policy issue',teamId:team.id}})).json();
  const count=async(label:string)=>{const input=member.getByRole('combobox',{name:'Command menu',exact:true});await expect.poll(async()=>{if(await input.count())return 1;await member.evaluate(()=>window.dispatchEvent(new CustomEvent('workspace-command',{detail:{command:'command-menu'}})));return 0;}).toBe(1);await input.fill(label);const result=await member.getByRole('option').filter({hasText:label}).count();await input.press('Escape');return result;};
  await member.goto(url+'/my-issues');expect(await count('Invite to Parabolic')).toBe(0);expect(await count('Create a team')).toBe(0);expect((await memberContext.request.post(url+'/api/v1/teams',{data:{name:'Forbidden team',key:'NO'}})).status()).toBe(403);
  await page.request.patch(url+'/api/v1/workspaces/'+state.workspaceId,{data:{allowMemberInvites:true,teamCreationPolicy:'members'}});await member.reload();expect(await count('Invite to Parabolic')).toBe(1);expect(await count('Create a team')).toBe(1);
  await member.goto(url+'/issues/'+issue.id);expect(await count('Show similar issues')).toBe(1);expect(await count('Convert into template')).toBe(0);await page.request.patch(url+'/api/v1/teams/'+team.id,{data:{templateManagement:'members'}});await member.reload();expect(await count('Convert into template')).toBe(1);expect(await count('Leave team')).toBe(1);
  const child=await(await page.request.post(url+'/api/v1/teams',{data:{name:'Policy child',key:'PC',parentId:team.id}})).json();await page.request.post(url+'/api/v1/memberships',{data:{teamId:child.id,userId:joined.user.id,role:'member'}});await member.reload();expect(await count('Leave team')).toBe(0);
 }finally{await member.close();await memberContext.close();await page.close();await app.close();}
});
