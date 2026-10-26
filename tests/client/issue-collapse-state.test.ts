import { test } from "node:test";
import assert from "node:assert/strict";
import { issueCollapseKey, parseCollapsedGroups } from "../../src/client/issue-collapse-state";

test("collapse preferences are isolated by workspace, user, view and grouping", () => {
  const keys = [
    issueCollapseKey("display:workspace:user:master", "statusId"),
    issueCollapseKey("display:workspace:user:active", "statusId"),
    issueCollapseKey("display:workspace:other:master", "statusId"),
    issueCollapseKey("display:other:user:master", "statusId"),
    issueCollapseKey("display:workspace:user:master", "priority"),
    issueCollapseKey("display:workspace:user:master", "statusId", "assigneeId"),
  ];
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(issueCollapseKey("view", "statusId", ""), issueCollapseKey("view", "statusId", "none"));
});

test("malformed preferences safely default to expanded groups", () => {
  for (const raw of [null, "", "{invalid", "null", "false", "42", '{"done":true}']) {
    assert.deepEqual(parseCollapsedGroups(raw), []);
  }
  assert.deepEqual(parseCollapsedGroups('["done",4,null,"done","backlog"]'), ["done", "backlog"]);
});

test("nested group keys round-trip without losing their parent identity", () => {
  const groups = ["done", '[["statusId","done"],["assigneeId","owner"]]'];
  assert.deepEqual(parseCollapsedGroups(JSON.stringify(groups)), groups);
});
