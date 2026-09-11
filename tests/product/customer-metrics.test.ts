import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerMetrics,
  withCustomerMetrics,
  usesCustomerMetrics,
} from "../../src/shared/customer-metrics";
import type { Entity } from "../../src/shared/types";
const row = (id: string, fields: Record<string, any> = {}): Entity => ({
  id,
  workspaceId: "workspace",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  version: 1,
  ...fields,
});
test("customer metrics deduplicate revenue while retaining request count, importance and target scope", () => {
  const customers = [
    row("acme", {
      revenue: 10000,
      size: 50,
      tier: "Enterprise",
      status: "Active",
    }),
    row("small", { revenue: 100, size: 2, tier: "Startup", status: "Churned" }),
  ];
  const requests = [
    row("one", { customerId: "acme", issueId: "issue" }),
    row("two", { customerId: "acme", issueId: "issue", important: true }),
    row("three", { customerId: "small", projectId: "project" }),
    row("deleted", {
      customerId: "small",
      issueId: "issue",
      deletedAt: "2026-02-01",
    }),
  ];
  const issue = withCustomerMetrics(
    row("issue"),
    buildCustomerMetrics(customers, requests, "issues"),
  );
  assert.equal(issue.customerCount, 1);
  assert.equal(issue.customerRequestCount, 2);
  assert.equal(issue.customerRevenue, 10000);
  assert.equal(issue.customerImportant, true);
  assert.deepEqual(issue.customerTier, ["Enterprise"]);
  const project = withCustomerMetrics(
    row("project"),
    buildCustomerMetrics(customers, requests, "projects"),
  );
  assert.equal(project.customerRevenue, 100);
  assert.equal(project.customerImportant, false);
  assert.equal(withCustomerMetrics(row("other"), new Map()).customerCount, 0);
  assert.equal(
    usesCustomerMetrics({
      conditions: [{ field: "customerRevenue", operator: "gte", value: 100 }],
    }),
    true,
  );
  assert.equal(
    usesCustomerMetrics({
      conditions: [{ field: "title", operator: "contains", value: "test" }],
    }),
    false,
  );
});
test('important count is distinct per customer and numeric filter values preserve each customer',()=>{
 const customers=[row('a',{ownerId:'owner',revenue:60,size:30}),row('b',{revenue:50,size:25})],requests=[row('r1',{customerId:'a',issueId:'issue',important:true}),row('r2',{customerId:'a',issueId:'issue',important:true}),row('r3',{customerId:'b',issueId:'issue'})];
 const metrics=withCustomerMetrics(row('issue'),buildCustomerMetrics(customers,requests,'issues'));
 assert.equal(metrics.customerImportantCount,1);assert.deepEqual(metrics.customerOwnerIds,['owner',null]);assert.deepEqual(metrics.customerRevenueValues,[60,50]);assert.equal(metrics.customerRevenue,110);
 const hidden=withCustomerMetrics(row('issue'),buildCustomerMetrics(customers.slice(1),requests,'issues'));assert.equal(hidden.customerImportantCount,0);assert.deepEqual(hidden.customerRevenueValues,[50]);
});
test('unknown customers mean unidentified requests, not missing requests or inaccessible customer records',()=>{
 const requests=[row('unknown',{issueId:'unknown',customerId:null}),row('hidden',{issueId:'hidden',customerId:'private'})];const metrics=buildCustomerMetrics([],requests,'issues');
 assert.deepEqual(withCustomerMetrics(row('unknown'),metrics).customerIds,[null]);assert.deepEqual(withCustomerMetrics(row('no-requests'),metrics).customerIds,[]);assert.deepEqual(withCustomerMetrics(row('hidden'),metrics).customerIds,[]);
});
