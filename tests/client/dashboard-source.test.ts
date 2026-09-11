import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardSource} from '../../src/client/features/dashboard-source';
import {defaultInsight} from '../../src/client/features/insight-data';
import {matchesFilter} from '../../src/client/query';
test('linked dashboard definitions compose source/team/project filters and do not use a stale snapshot when access disappears',()=>{
 const source:any={id:'view',teamId:'team',projectId:'project',filters:{match:'any',conditions:[{field:'priority',operator:'eq',value:1},{field:'priority',operator:'eq',value:2}]},insightConfig:{...defaultInsight,group:'Priority'}};
 const widget={...defaultInsight,sourceViewId:'view'},definition=dashboardSource(widget,[source])!;
 assert.equal(definition.group,'Priority');assert.equal(matchesFilter({id:'a',teamId:'team',projectId:'project',priority:2} as any,definition.filters),true);
 assert.equal(matchesFilter({id:'b',teamId:'other',projectId:'project',priority:2} as any,definition.filters),false);
 assert.equal(dashboardSource(widget,[]),null);assert.equal(dashboardSource(widget,[{...source,deletedAt:'2026-01-01'}]),null);
});

test('workspace dashboards exclude private, restricted and redacted-team issues while personal scopes retain authorized records',async()=>{
 const {dashboardIssueVisible}=await import('../../src/client/features/dashboard-source');const teams:any=[{id:'public',visibility:'public'},{id:'private',visibility:'private'},{id:'legacy',private:true},{id:'restricted',visibility:'restricted'}];
 assert.equal(dashboardIssueVisible({id:'a',teamId:'public'} as any,teams,undefined,true),true);
 for(const teamId of ['private','legacy','restricted',null,'missing'])assert.equal(dashboardIssueVisible({id:'a',teamId} as any,teams,undefined,true),false);
 assert.equal(dashboardIssueVisible({id:'a',teamId:'private'} as any,teams,undefined,false),true);
 assert.equal(dashboardIssueVisible({id:'a',teamId:'private'} as any,teams,'public',false),false);
});
