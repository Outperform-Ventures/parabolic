import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entity } from "../../src/shared/types.ts";
import {
  initiativeCompletionGraph,
  weekStart,
} from "../../src/client/features/initiative-graph-data.ts";
const entity = (fields: Record<string, any>): Entity => ({
  id: "x",
  workspaceId: "w",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
  version: 1,
  ...fields,
});
const source = () => ({
  initiatives: [
    entity({ id: "root", projectIds: ["one"] }),
    entity({ id: "child", parentIds: ["root"], projectIds: ["one", "two"] }),
  ],
  projects: [
    entity({ id: "one", name: "First project" }),
    entity({ id: "two", name: "Second project" }),
  ],
  statuses: [
    entity({ id: "todo", type: "unstarted" }),
    entity({ id: "done", type: "completed" }),
  ],
  issues: [] as Entity[],
  activities: [] as Entity[],
});
const event = (
  id: string,
  at: string,
  changes: Record<string, any>,
  action = "update",
) =>
  entity({
    id: "event-" + at,
    entityKind: "issues",
    entityId: id,
    createdAt: at,
    action,
    changes,
  });
const at = (value: string) => Date.parse(value + "T12:00:00Z");
test("long histories assign completions to the final partial interval", () => {
  const data = source();
  data.initiatives[0].createdAt = "2018-01-08T00:00:00Z";
  data.issues = [entity({id:"recent", projectId:"one", statusId:"done", createdAt:"2026-09-04T12:00:00Z", completedAt:"2026-09-04T12:00:00Z"})];
  const graph = initiativeCompletionGraph(data, "root", false, at("2026-09-05"));
  assert.equal(graph.weeks.at(-1), weekStart(at("2026-09-04")));
  assert.equal(graph.series.find(row => row.project.id === "one")!.values.at(-1), 1);
  assert.equal(graph.series[0].values.reduce((sum, count) => sum + count, 0), 1);
});
test("initiative activity deduplicates descendant projects and records completion against historical membership, including reopened and removed work", () => {
  const data = source();
  data.issues = [
    entity({ id: "moved", projectId: "two", statusId: "todo" }),
    entity({
      id: "removed",
      projectId: "one",
      statusId: "done",
      deletedAt: "2026-01-20T12:00:00Z",
    }),
    entity({
      id: "child-done",
      projectId: "two",
      statusId: "done",
      completedAt: "2026-01-14T12:00:00Z",
    }),
  ];
  data.activities = [
    event("moved", "2026-01-05T12:00:00Z", {
      statusId: { from: "todo", to: "done" },
    }),
    event("moved", "2026-01-06T12:00:00Z", {
      projectId: { from: "one", to: "two" },
    }),
    event("moved", "2026-01-07T12:00:00Z", {
      statusId: { from: "done", to: "todo" },
    }),
    event("removed", "2026-01-12T12:00:00Z", {
      statusId: { from: "todo", to: "done" },
    }),
    event("removed", "2026-01-20T12:00:00Z", {}, "delete"),
  ];
  const graph = initiativeCompletionGraph(
    data,
    "root",
    false,
    at("2026-02-01"),
  );
  assert.deepEqual(
    graph.series.map((row) => row.project.id),
    ["one", "two"],
  );
  const first = graph.series.find((row) => row.project.id === "one")!,
    second = graph.series.find((row) => row.project.id === "two")!;
  assert.equal(
    first.values[graph.weeks.indexOf(weekStart(at("2026-01-05")))],
    1,
  );
  assert.equal(
    first.values[graph.weeks.indexOf(weekStart(at("2026-01-12")))],
    1,
  );
  assert.equal(first.total, 2);
  assert.equal(second.total, 1);
  assert.equal(graph.total, 3);
  const direct = initiativeCompletionGraph(
    data,
    "root",
    true,
    at("2026-02-01"),
  );
  assert.deepEqual(
    direct.series.map((row) => row.project.id),
    ["one"],
  );
  assert.equal(direct.total, 2);
});
test("one issue is counted once per project week and later completions stay out of historical snapshots", () => {
  const data = source();
  data.issues = [entity({ id: "repeat", projectId: "one", statusId: "done" })];
  data.activities = [
    event("repeat", "2026-01-05T12:00:00Z", {
      statusId: { from: "todo", to: "done" },
    }),
    event("repeat", "2026-01-06T12:00:00Z", {
      statusId: { from: "done", to: "todo" },
    }),
    event("repeat", "2026-01-07T12:00:00Z", {
      statusId: { from: "todo", to: "done" },
    }),
    event("repeat", "2026-01-13T12:00:00Z", {
      statusId: { from: "done", to: "todo" },
    }),
    event("repeat", "2026-01-14T12:00:00Z", {
      statusId: { from: "todo", to: "done" },
    }),
  ];
  const current = initiativeCompletionGraph(
    data,
    "root",
    false,
    at("2026-01-20"),
  );
  assert.equal(
    current.series[0].values.reduce((sum, value) => sum + value, 0),
    2,
  );
  assert.equal(current.total, 1);
  const past = initiativeCompletionGraph(data, "root", false, at("2026-01-10"));
  assert.equal(
    past.series[0].values.reduce((sum, value) => sum + value, 0),
    1,
  );
  const before = initiativeCompletionGraph(
    data,
    "root",
    false,
    at("2026-01-04"),
  );
  assert.equal(before.total, 0);
});
test("causal sequence and recorded workflow categories keep equal-time completion attribution stable after reload and category edits", () => {
  const data = source();
  data.statuses.find((status) => status.id === "done")!.type = "unstarted";
  data.issues = [entity({ id: "moved", projectId: "two", statusId: "done" })];
  const completion = {
    ...event("moved", "2026-01-05T12:00:00Z", {
      statusId: { from: "todo", to: "done" },
    }),
    id: "last-id",
    sequence: 20,
    entityVersion: 2,
    statusTypeBefore: "unstarted",
    statusTypeAfter: "completed",
  };
  const move = {
    ...event("moved", "2026-01-05T12:00:00Z", {
      projectId: { from: "one", to: "two" },
    }),
    id: "first-id",
    sequence: 22,
    entityVersion: 3,
    statusTypeBefore: "completed",
    statusTypeAfter: "completed",
  };
  for (const activities of [
    [completion, move],
    [move, completion],
  ]) {
    const graph = initiativeCompletionGraph(
      { ...data, activities },
      "root",
      false,
      at("2026-02-01"),
    );
    assert.equal(
      graph.series.find((row) => row.project.id === "one")!.total,
      1,
    );
    assert.equal(
      graph.series.find((row) => row.project.id === "two")!.total,
      0,
    );
  }
  // Historical status edits also provide category evidence for older issue events without snapshots.
  const legacy = { ...completion };
  delete (legacy as any).statusTypeBefore;
  delete (legacy as any).statusTypeAfter;
  const statusEdit = entity({
    id: "status-event",
    entityKind: "statuses",
    entityId: "done",
    createdAt: "2026-01-10T12:00:00Z",
    sequence: 30,
    changes: { type: { from: "completed", to: "unstarted" } },
  });
  const graph = initiativeCompletionGraph(
    { ...data, activities: [statusEdit, move, legacy] },
    "root",
    false,
    at("2026-02-01"),
  );
  assert.equal(graph.series.find((row) => row.project.id === "one")!.total, 1);
});
