import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopNotificationEnabled} from '../../src/client/inbox-data';
import type {Entity} from '../../src/shared/types';

test('both scheduler SLA events obey the service-level desktop preference, including mixed reasons',()=>{
 for(const type of ['slaAtRisk','slaBreached']){
  const row:Entity={id:'notice',workspaceId:'workspace',createdAt:'2027-01-01T00:00:00Z',updatedAt:'2027-01-01T00:00:00Z',version:1,type,reasons:['sla',type]};
  assert.equal(desktopNotificationEnabled(row,{sla:false}),false,type);
  assert.equal(desktopNotificationEnabled({...row,reasons:undefined},{sla:false}),false,type+' without reasons');
  assert.equal(desktopNotificationEnabled(row,{sla:true}),true);
  assert.equal(desktopNotificationEnabled(row,{desktop:false,sla:true}),false);
  assert.equal(desktopNotificationEnabled({...row,reasons:[...row.reasons,'mentioned']},{sla:false,mentioned:true}),true);
 }
});

test('near-due and overdue desktop alerts obey their shared channel preference independently of Inbox subscriptions',()=>{
 for(const type of ['dueDateNear','dueDateOverdue']){const row:Entity={id:type,workspaceId:'workspace',createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z',version:1,type,reasons:[type]};assert.equal(desktopNotificationEnabled(row,{dueDateAlerts:false,[type]:true}),false);assert.equal(desktopNotificationEnabled({...row,reasons:undefined},{dueDateAlerts:false}),false);assert.equal(desktopNotificationEnabled(row,{dueDateAlerts:true}),true);assert.equal(desktopNotificationEnabled(row,{desktop:false,dueDateAlerts:true}),false)}
});
