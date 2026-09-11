import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, type Entity } from "../../src/shared/types";
import {
  nestIssueGroups,
  issueGroupPathPatch,
} from "../../src/client/issue-groups";
const entity = (id: string, values: Record<string, any> = {}): Entity => ({
  id,
  workspaceId: "workspace",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  version: 1,
  ...values,
});
test("nested groups retain order, both property dimensions and sparse board cells", () => {
  const data = emptyData();
  data.users = [
    entity("alice", { name: "Alice" }),
    entity("bob", { name: "Bob" }),
  ];
  const issues = [
    entity("first", { priority: 2, assigneeId: "alice" }),
    entity("second", { priority: 1, assigneeId: "bob" }),
    entity("third", { priority: 2, assigneeId: "bob" }),
  ];
  const { columns, rows } = nestIssueGroups(
    issues,
    "priority",
    "assigneeId",
    data,
    undefined,
    true,
  );
  assert.deepEqual(
    columns.map((c) => c.id),
    ["1", "2", "3", "4", "0"],
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    columns
      .find((c) => c.id === "2")!
      .subgroups!.map((c) => c.issues.map((i) => i.id)),
    [["first"], ["third"]],
  );
  assert.equal(rows.find((r) => r.id === "alice")!.cells.size, 1);
  const target = rows.find((r) => r.id === "bob")!.cells.get("1")!;
  assert.deepEqual(issueGroupPathPatch(target, data, issues[0]), {
    priority: 1,
    assigneeId: "bob",
  });
  assert.equal(
    new Set(columns.flatMap((c) => c.subgroups?.map((s) => s.key) || [])).size,
    3,
  );
});
test("moving two-dimensional label groups preserves unrelated labels and exclusivity", () => {
  const data = emptyData();
  data.labels = [
    entity("red", { name: "Red", group: "Color" }),
    entity("blue", { name: "Blue", group: "Color" }),
    entity("large", { name: "Large" }),
  ];
  const item = entity("issue", { priority: 3, labelIds: ["red", "large"] });
  const patch = issueGroupPathPatch(
    {
      path: [
        { field: "priority", id: "1" },
        { field: "labelIds", id: "blue" },
      ],
    },
    data,
    item,
    [
      { field: "priority", id: "3" },
      { field: "labelIds", id: "red" },
    ],
  );
  assert.deepEqual(patch, { priority: 1, labelIds: ["large", "blue"] });
});
