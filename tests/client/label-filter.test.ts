import test from 'node:test';import assert from 'node:assert/strict';
import {matchesFilter,expandLabelFilter,type FilterSpec} from '../../src/client/query';
import {matchesFilter as serverMatches} from '../../src/server/repository';
import type {Entity} from '../../src/shared/types';
const row=(id:string,values:any={}):Entity=>({id,workspaceId:'w',createdAt:'2026-01-01',updatedAt:'2026-01-01',version:1,...values});
const labels=[row('a',{name:'Bug',teamId:'a'}),row('b',{name:'Bug',teamId:'b',archivedAt:'2026-01-02'}),row('p',{name:'Bug',entityType:'projects'}),row('gone',{name:'Bug',deletedAt:'2026-01-02'}),row('different',{name:'Feature'})];
test('label aliases match across teams, preserve archived history and exclude other label types and deleted definitions',()=>{
 const spec:FilterSpec={match:'all',conditions:[{field:'labelIds',operator:'contains',value:'a'}]};
 assert(matchesFilter(row('i',{labelIds:['b']}),spec,labels));assert(!matchesFilter(row('i',{labelIds:['b']}),spec));
 for(const id of ['p','gone','different'])assert(!matchesFilter(row('i',{labelIds:[id]}),spec,labels));
 assert(!matchesFilter(row('i',{labelIds:['b'],teamId:'b'}),{...spec,conditions:[...spec.conditions,{field:'teamId',operator:'eq',value:'a'}]},labels));
 assert(!matchesFilter(row('i',{labelIds:['b']}),spec,labels.map(l=>l.id==='b'?{...l,name:'Feature'}:l)));
});
test('expanded API search filters agree with app matching for positive, negative and compound conditions without changing raw API identity',()=>{
 for(const match of ['all','any'] as const)for(const operator of ['eq','contains','in','neq','notContains','empty','notEmpty'])for(const ids of [[],['a'],['b'],['p'],['different'],['b','different']]){
  const spec:FilterSpec={match,conditions:[{field:'labelIds',operator,value:operator==='in'?['a']:'a'},{field:'teamId',operator:'eq',value:'b'}]},entity=row('i',{labelIds:ids,teamId:'b'});
  assert.equal(serverMatches(entity,expandLabelFilter(spec,labels)),matchesFilter(entity,spec,labels),JSON.stringify({match,operator,ids}));
 }
 const spec:FilterSpec={match:'all',conditions:[{field:'labelIds',operator:'eq',value:'a'}]};assert(!serverMatches(row('i',{labelIds:['b']}),spec));
 for(const match of ['all','any'] as const)assert(serverMatches(row('i'),expandLabelFilter({match,conditions:[]},labels)));
});

test('retired merge IDs resolve through the kept label, survive rename and stop matching if that label is deleted',()=>{
 const kept=row('kept',{name:'Canonical',mergedLabelIds:['retired','older']}),work=row('work',{labelIds:['kept']}),spec:FilterSpec={match:'all',conditions:[{field:'labelIds',operator:'eq',value:'older'}]};
 for(const value of [kept,{...kept,name:'Renamed'},{...kept,archivedAt:'2026-01-02'}]){assert(matchesFilter(work,spec,[value]));assert(serverMatches(work,expandLabelFilter(spec,[value])))}
 assert(!matchesFilter(work,spec,[{...kept,deletedAt:'2026-01-02'}]));assert(!serverMatches(work,spec));
});

test('group filters track current children across scopes without conflating same-name labels or project groups',async()=>{
 const {filterLabelRecords}=await import('../../src/shared/label-filter-values');
 const groups=[row('g',{name:'Area'}),row('gt',{name:'Area',teamId:'t'}),row('gp',{name:'Area',entityType:'projects'}),row('empty',{name:'Empty'})];
 const data={labelGroups:groups,labels:[row('a',{name:'A',labelGroupId:'g'}),row('b',{name:'B',labelGroupId:'gt',teamId:'t'}),row('plain',{name:'Area'}),row('p',{name:'P',labelGroupId:'gp',entityType:'projects'})]};
 const records=filterLabelRecords(data);assert.equal(filterLabelRecords(data),records);
 for(const operator of ['eq','contains','in','neq','notContains','all','none'])for(const chosen of [[],['g'],['empty'],['g','plain'],['g','gp']])for(const assigned of [[],['a'],['b'],['plain'],['p'],['a','plain']]){
  const spec:FilterSpec={match:'all',conditions:[{field:'labelIds',operator,value:chosen}]},entity=row('i',{labelIds:assigned});
  const present=(id:string)=>id==='g'?assigned.some(v=>['a','b'].includes(v)):id==='gp'?assigned.includes('p'):id==='empty'?false:assigned.includes(id);
  const expected=operator==='all'?chosen.every(present):['neq','notContains','none'].includes(operator)?!chosen.some(present):chosen.some(present);
  assert.equal(matchesFilter(entity,spec,records),expected,JSON.stringify({operator,chosen,assigned}));
  assert.equal(serverMatches(entity,expandLabelFilter(spec,records)),expected,JSON.stringify({expanded:true,operator,chosen,assigned}));
 }
 const spec:FilterSpec={match:'all',conditions:[{field:'labelIds',operator:'eq',value:'g'}]};
 const moved=filterLabelRecords({...data,labels:data.labels.map(l=>l.id==='a'?{...l,labelGroupId:null}:l)});
 assert(!matchesFilter(row('i',{labelIds:['a']}),spec,moved));
 const added=filterLabelRecords({...data,labels:[...data.labels,row('new',{name:'New',labelGroupId:'g'})]});
 assert(matchesFilter(row('i',{labelIds:['new']}),spec,added));
 const converted=filterLabelRecords({labels:[row('g',{name:'Area',deletedAt:'2026-01-02',convertedTo:'labelGroups'}),...data.labels],labelGroups:groups});
 assert(matchesFilter(row('i',{labelIds:['a']}),spec,converted));
});

test('all and none also agree for raw label IDs without a definitions index',()=>{
 for(const operator of ['all','none'])for(const value of [[],['a'],['a','b']])for(const assigned of [[],['a'],['b'],['a','b']]){
  const filter:FilterSpec={match:'all',conditions:[{field:'labelIds',operator,value}]},entity=row('i',{labelIds:assigned});
  const expected=operator==='all'?value.every(id=>assigned.includes(id)):!value.some(id=>assigned.includes(id));
  assert.equal(matchesFilter(entity,filter),expected);assert.equal(serverMatches(entity,filter),expected);
 }
});
