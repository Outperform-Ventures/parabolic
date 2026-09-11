import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY,
  dependencyChain,
  dependencyProblem,
  timelineWindow,
  timelineTicks,
  zoomTimeline,
} from "../../src/client/features/timeline-data";
import type { Entity } from "../../src/shared/types";
const project = (
  id: string,
  status: string,
  dependencyIds: string[] = [],
): Entity => ({
  id,
  status,
  dependencyIds,
  workspaceId: "w",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  version: 1,
});
test("project dependencies reject self, duplicate and transitive cycle while modifiers preserve selected scope", () => {
  const projects = [
    project("a", "started"),
    project("b", "planned", ["a"]),
    project("c", "completed", ["b"]),
    project("d", "backlog", ["c"]),
  ];
  assert.match(dependencyProblem("d", "a", projects)!, /cycle/);
  assert.match(dependencyProblem("a", "b", projects)!, /already exists/);
  assert.match(dependencyProblem("a", "a", projects)!, /itself/);
  assert.equal(dependencyProblem("a", "d", projects), null);
  assert.deepEqual(
    dependencyChain(projects, ["a"], "planned", (p) => p.status),
    ["a", "b", "d"],
  );
  assert.deepEqual(
    dependencyChain(projects, ["a"], "none", (p) => p.status),
    ["a"],
  );
  assert.deepEqual(
    dependencyChain(projects, ["a"], "all", (p) => p.status),
    ["a", "b", "c", "d"],
  );
});
test("timeline zoom keeps its anchored date and month ticks remain true across long panning", () => {
  const original = timelineWindow("month", Date.UTC(2026, 8, 5)),
    anchor = 0.72,
    zoomed = zoomTimeline(original, 2, anchor);
  assert.equal(
    original.start + original.span * anchor,
    zoomed.start + zoomed.span * anchor,
  );
  const panned = { ...zoomed, start: zoomed.start + 10000 * DAY },
    ticks = timelineTicks(panned);
  assert.ok(ticks.length > 1);
  assert.ok(ticks.every((t) => new Date(t.time).getUTCDate() === 1));
  assert.equal(zoomTimeline(original, 1e9).span, 7 * DAY);
});

test('timeline UTC windows preserve leap days and year boundaries across DST locales',()=>{
 const leap=timelineWindow('month',Date.parse('2028-02-29T23:30:00-08:00'));
 assert.equal(new Date(leap.start).toISOString(),'2028-02-01T00:00:00.000Z');
 const week=timelineWindow('week',Date.parse('2026-03-08T03:30:00-04:00'));
 assert.equal(week.span,28*DAY);assert.equal(new Date(week.start).getUTCDay(),1);
 const year=timelineWindow('year',Date.parse('2027-01-01T00:00:00Z'));
 assert.equal(new Date(year.start).toISOString(),'2026-01-01T00:00:00.000Z');
 const ticks=timelineTicks({start:Date.parse('2027-12-15'),span:120*DAY});
 assert.ok(ticks.some(t=>new Date(t.time).toISOString()==='2028-02-01T00:00:00.000Z'));
 assert.ok(ticks.every((tick,index)=>index===0||tick.time>ticks[index-1].time));
});
