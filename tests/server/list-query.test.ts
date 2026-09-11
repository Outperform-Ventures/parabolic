import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server/app.ts';
import type { Actor } from '../../src/server/repository.ts';

test('indexed collection counts and cursors agree with the permission evaluator, including privacy fallback',async()=>{
  const app=createApp({databasePath:':memory:',port:0});try{const setup=await app.auth.setup({email:'owner@example.com',name:'Owner',password:'owner-secure-password'});const actor:Actor={userId:setup.user.id,workspaceId:setup.workspaceId,role:'owner',scopes:['read','write','admin'],now:new Date('2026-01-01T00:00:00Z')};const repo=app.repo,team=repo.all('teams',actor.workspaceId)[0];repo.transaction(()=>{for(let i=0;i<600;i++)repo.create(actor,'issues',{title:`List record ${i}`,teamId:team.id,priority:i%5});});
    for(const filter of [{},{priority:{eq:1}},{priority:{in:[1,2,4]}},{and:[{priority:{gte:1}},{priority:{lte:3}}]}])for(const orderBy of ['updatedAt:desc','createdAt:asc']){let after:string|undefined,seen:string[]=[];do{const actual=repo.list(actor,'issues',{filter,orderBy,first:70,after});const expected=repo.list(actor,'issues',{filter,orderBy,first:70,after,query:'List record'});assert.deepEqual(actual,expected);seen.push(...actual.nodes.map((e:any)=>e.id));after=actual.pageInfo.hasNextPage?actual.pageInfo.endCursor!:undefined;}while(after);assert.equal(seen.length,new Set(seen).size);}
    const privateTeam=repo.create(actor,'teams',{name:'Hidden',key:'HID',private:true,memberIds:[actor.userId]});const hidden=repo.create(actor,'issues',{title:'List record private',teamId:privateTeam.id});const full=repo.list(actor,'issues',{first:500});assert.equal(full.totalCount,601);
    repo.update(actor,'teams',privateTeam.id,{memberIds:[],creatorId:'ignored'});const other:Actor={...actor,userId:'excluded-user',role:'member'};const limited=repo.list(other,'issues',{first:500});assert.equal(limited.totalCount,600);assert.ok(!limited.nodes.some((e:any)=>e.id===hidden.id));
    const custom=repo.create(actor,'issues',{id:'CUSTOM_issue',teamId:team.id,title:'List record custom'});assert.equal(repo.list(actor,'issues',{first:500}).totalCount,602);assert.deepEqual(repo.list(actor,'issues',{first:500}),repo.list(actor,'issues',{first:500,query:'List record'}));assert.ok(custom);
  }finally{await app.close();}
});
