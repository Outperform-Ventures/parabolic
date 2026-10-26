import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardConfig,dashboardDisplay,dashboardFilterCount} from '../../src/client/features/dashboard-presentation';
import {defaultInsight,calculateInsight} from '../../src/client/features/insight-data';
import {dashboardStarter} from '../../src/client/features/dashboard-presets';
import {emptyData,type Entity} from '../../src/shared/types';
const entity=(id:string,data:any={}):Entity=>({id,workspaceId:'w',version:1,createdAt:'2026-09-01',updatedAt:'2026-09-01',...data});
test('legacy presentation migrates in memory without changing saved analysis',()=>{
 assert.equal(dashboardDisplay({chartType:'Table'}),'table');assert.equal(dashboardDisplay({chartType:'Metric'}),'metric');assert.equal(dashboardDisplay({chartType:'Bar'}),'chart');assert.equal(dashboardDisplay({chartType:'Metric',displayMode:'chart'}),'chart');
 const config={...defaultInsight,chartType:'Scatter'};assert.equal(dashboardConfig(config,'table').chartType,'Table');assert.equal(dashboardConfig(config,'metric').chartType,'Metric');assert.equal(dashboardConfig(config,'chart').chartType,'Scatter');assert.equal(config.chartType,'Scatter');assert.equal(dashboardConfig({...config,chartType:'Metric'},'chart').chartType,'Auto');
});
test('hidden filter indicators include nested filter groups',()=>{assert.equal(dashboardFilterCount({conditions:[{}],groups:[{conditions:[{},{}],groups:[{conditions:[{}]}]}]}),4);assert.equal(dashboardFilterCount(undefined),0)});
test('customer delivery metrics count directly and project-inherited customers without including unrelated work',()=>{
 const data=emptyData();data.statuses=[entity('open',{type:'unstarted'}),entity('done',{type:'completed'})];data.customers=[entity('customer')];data.projects=[entity('project',{directCustomerIds:['customer']})];
 data.issues=[entity('a',{statusId:'open',projectId:'project',effectiveCustomerIds:['customer'],dueDate:'2026-09-10'}),entity('b',{statusId:'open',directCustomerIds:['customer'],effectiveCustomerIds:['customer'],dueDate:'2026-09-14'}),entity('c',{statusId:'open',dueDate:'2026-09-10'}),entity('d',{statusId:'done',effectiveCustomerIds:['customer'],dueDate:'2026-09-10'})];
 const widgets=dashboardStarter('customer',data.statuses),now=Date.parse('2026-09-13T12:00:00Z');assert.equal(calculateInsight(data,widgets[1],undefined,now).total,1);assert.equal(calculateInsight(data,widgets[2],undefined,now).total,1);
 for(const template of ['customer','workload','business']){const widgets=dashboardStarter(template,data.statuses);assert.ok(widgets.length>=4);assert.ok(widgets.every(widget=>['chart','table','metric'].includes(widget.displayMode??'')));assert.equal(new Set(widgets.map(widget=>widget.id)).size,widgets.length)}
});
