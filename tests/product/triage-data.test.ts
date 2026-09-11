import test from 'node:test';
import assert from 'node:assert/strict';
import {filterIncludesTriage} from '../../src/client/triage-data';
test('triage is included only by a positive explicit workflow filter',()=>{
 const statuses=[{id:'incoming',type:'triage'},{id:'todo',type:'unstarted'}] as any;
 const filter=(field:string,operator:string,value:any)=>({match:'all',conditions:[{field,operator,value}]}) as any;
 assert.equal(filterIncludesTriage(filter('statusId','in',['todo','incoming']),statuses),true);
 assert.equal(filterIncludesTriage(filter('statusId','neq','todo'),statuses),false);
 assert.equal(filterIncludesTriage(filter('priority','eq',1),statuses),false);
 assert.equal(filterIncludesTriage(filter('status','eq','triage'),statuses),true);
});
