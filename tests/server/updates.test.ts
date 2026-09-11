import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../src/server/app";
import type { Actor } from "../../src/server/repository";
import { runUpdateReminders } from "../../src/server/updates";

async function fixture(now = "2026-09-01T10:00:00Z") {
  const app = createApp({ databasePath: ":memory:", port: 0 });
  const { url } = await app.start();
  const setup = await app.auth.setup({
      name: "Owner",
      email: "updates@example.test",
      password: "updates-owner-password",
    }),
    actor: Actor = {
      userId: setup.user.id,
      workspaceId: setup.workspaceId,
      role: "owner",
      scopes: ["read", "write", "admin"],
      now: new Date(now),
    };
  const cookie = `parabolic_session=${setup.token}`;
  const invitation = (await (
    await fetch(url + "/api/v1/invitations", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ email: "member@example.test" }),
    })
  ).json()) as any;
  const joined = (await (
    await fetch(url + "/auth/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: invitation.token,
        name: "Member",
        password: "member-update-password",
      }),
    })
  ).json()) as any;
  const member: Actor = {
    ...actor,
    userId: joined.user.id,
    role: "member",
    scopes: ["read", "write"],
  };
  return { app, repo: app.repo, actor, member };
}
test("updates enforce first lead authorship, own edits and reactions; discussion notifies participants", async () => {
  const f = await fixture();
  try {
    const { repo, actor, member } = f,
      project = repo.create(actor, "projects", {
        name: "Tracked project",
        leadId: actor.userId,
        status: "started",
      });
    repo.create(member, "subscriptions", { projectId: project.id });
    assert.throws(
      () =>
        repo.create(member, "updates", {
          projectId: project.id,
          body: "Before lead",
          health: "On track",
        }),
      /first update/,
    );
    const update = repo.create(actor, "updates", {
      projectId: project.id,
      body: "<p>First report</p>",
      health: "On track",
    });
    assert.equal(repo.raw("projects", project.id)!.lastUpdateId, update.id);
    assert.equal(repo.raw("projects", project.id)!.health, "On track");
    assert.equal(
      repo
        .all("notifications", actor.workspaceId)
        .filter(
          (n) => n.userId === member.userId && n.type === "projectUpdates",
        ).length,
      1,
    );
    assert.ok(update.progressSnapshot);
    assert.throws(
      () => repo.update(member, "updates", update.id, { body: "Overwritten" }),
      /author/,
    );
    const reaction = repo.update(member, "updates", update.id, {
      reactions: { "👍": [member.userId] },
    });
    assert.deepEqual(reaction.reactions["👍"], [member.userId]);
    assert.throws(
      () =>
        repo.update(actor, "updates", update.id, { reactions: { "👍": [] } }),
      /own reactions/,
    );
    const comment = repo.create(member, "comments", {
      updateId: update.id,
      body: "<p>A question for the lead</p>",
    });
    assert.equal(comment.projectId, project.id);
    assert.equal(
      repo
        .all("notifications", actor.workspaceId)
        .filter((n) => n.userId === actor.userId && n.type === "comments")
        .length,
      1,
    );
    repo.create(actor, "comments", {
      updateId: update.id,
      parentId: comment.id,
      body: "<p>Reply</p>",
    });
    assert.equal(
      repo
        .all("notifications", actor.workspaceId)
        .filter((n) => n.userId === member.userId && n.type === "comments")
        .length,
      1,
    );
    const followup = repo.create(
      { ...member, now: new Date("2026-09-02T12:00:00Z") },
      "updates",
      {
        projectId: project.id,
        body: "<p>Member follow-up</p>",
        health: "At risk",
      },
    );
    assert.equal(repo.raw("projects", project.id)!.lastUpdateId, followup.id);
    repo.remove(member, "updates", followup.id);
    assert.equal(repo.raw("projects", project.id)!.lastUpdateId, update.id);
    const privateTeam = repo.create(actor, "teams", {
        name: "Private",
        key: "HIDDEN",
        visibility: "private",
      }),
      privateProject = repo.create(actor, "projects", {
        name: "Secret",
        teamIds: [privateTeam.id],
      }),
      secret = repo.create(actor, "updates", {
        projectId: privateProject.id,
        body: "Private update",
        health: "On track",
      });
    assert.throws(
      () =>
        repo.create(member, "comments", {
          updateId: secret.id,
          projectId: project.id,
          body: "Forged parent",
        }),
      /not found/,
    );
  } finally {
    await f.app.close();
  }
});
test("update reminders follow owner local hour and working-day nudges, remain idempotent and stop after publication", async () => {
  const f = await fixture();
  try {
    const { repo, actor } = f;
    repo.update(actor,"users",actor.userId,{preferences:{notifications:{updateReminders:false}}});
    repo.update(actor, "workspaces", actor.workspaceId, {
      timezone: "America/New_York",
      projectUpdateSchedule: {
        enabled: true,
        frequency: "weekly",
        interval: 1,
        weekday: 1,
        hour: 9,
      },
    });
    const project = repo.create(actor, "projects", {
        name: "Needs updates",
        leadId: actor.userId,
        status: "started",
      }),
      never = repo.create(actor, "projects", {
        name: "No reminders",
        leadId: actor.userId,
        status: "started",
        updateSchedule: { mode: "never" },
      });
    const tick = (at: string) =>
      runUpdateReminders(
        repo,
        { ...actor, system: true },
        repo.raw("workspaces", actor.workspaceId)!,
        new Date(at),
      );
    const notifications = () =>
      repo
        .all("notifications", actor.workspaceId)
        .filter((n) => n.type === "updateReminders");
    tick("2026-09-07T12:59:00Z");
    assert.equal(notifications().length, 0);
    tick("2026-09-07T13:01:00Z");
    assert.equal(notifications().length, 1);
    tick("2026-09-07T14:00:00Z");
    assert.equal(notifications().length, 1);
    tick("2026-09-08T13:01:00Z");
    assert.equal(notifications().length, 2);
    tick("2026-09-09T13:01:00Z");
    assert.equal(notifications().length, 2);
    tick("2026-09-10T13:01:00Z");
    assert.equal(notifications().length, 3);
    assert.ok(notifications().every((n) => n.projectId === project.id));
    assert.equal(
      repo.raw("projects", never.id)!.updateHealthStatus,
      "notExpected",
    );
    repo.create(
      { ...actor, now: new Date("2026-09-10T14:00:00Z") },
      "updates",
      { projectId: project.id, body: "Weekly report", health: "On track" },
    );
    tick("2026-09-11T13:01:00Z");
    assert.equal(notifications().length, 3);
    assert.equal(
      repo.raw("projects", project.id)!.updateHealthStatus,
      "current",
    );
    tick("2026-09-14T13:01:00Z");
    assert.equal(notifications().length, 4);
    repo.update(actor, "projects", project.id, { status: "completed" });
    tick("2026-09-15T13:01:00Z");
    assert.equal(notifications().length, 4);
  } finally {
    await f.app.close();
  }
});
test("daily reminders retain 9 AM local time on the DST transition and downtime produces one current nudge", async () => {
  const f = await fixture("2026-03-08T06:00:00Z");
  try {
    const { repo, actor } = f;
    repo.update(actor, "workspaces", actor.workspaceId, {
      timezone: "America/New_York",
      projectUpdateSchedule: {
        enabled: true,
        frequency: "daily",
        interval: 1,
        weekday: 1,
        hour: 9,
      },
    });
    repo.create(actor, "projects", {
      name: "DST update",
      leadId: actor.userId,
      status: "started",
    });
    const tick = (at: string) =>
      runUpdateReminders(
        repo,
        { ...actor, system: true },
        repo.raw("workspaces", actor.workspaceId)!,
        new Date(at),
      );
    tick("2026-03-08T12:59:00Z");
    assert.equal(repo.all("notifications", actor.workspaceId).length, 0);
    tick("2026-03-08T13:01:00Z");
    assert.equal(repo.all("notifications", actor.workspaceId).length, 1);
    tick("2026-03-12T13:01:00Z");
    assert.equal(repo.all("notifications", actor.workspaceId).length, 2);
    tick("2026-03-12T14:01:00Z");
    assert.equal(repo.all("notifications", actor.workspaceId).length, 2);
  } finally {
    await f.app.close();
  }
});

test('missing health follows public client aging including absent and At risk health and malformed cadence anchors fail at configuration',async()=>{const f=await fixture('2026-09-01T00:00:00Z');try{const {repo,actor}=f;assert.throws(()=>repo.update(actor,'workspaces',actor.workspaceId,{projectUpdateSchedule:{enabled:true,anchorDate:'2026-02-31'}}),/anchor date/);repo.update(actor,'workspaces',actor.workspaceId,{projectUpdateSchedule:{enabled:true,frequency:'weekly',interval:1,weekday:1,hour:9}});const project=repo.create(actor,'projects',{name:'No first update',leadId:actor.userId,status:'started'});const tick=(date:string)=>runUpdateReminders(repo,{...actor,system:true},repo.raw('workspaces',actor.workspaceId)!,new Date(date));tick('2026-09-30T12:00:00Z');assert.equal(repo.raw('projects',project.id)!.updateHealthStatus,'missing');repo.create({...actor,now:new Date('2026-09-02T12:00:00Z')},'updates',{projectId:project.id,body:'On track update',health:'On track'});tick('2026-09-30T12:00:00Z');assert.equal(repo.raw('projects',project.id)!.updateHealthStatus,'missing');repo.create({...actor,now:new Date('2026-09-03T12:00:00Z')},'updates',{projectId:project.id,body:'Risk update',health:'At risk'});tick('2026-09-30T12:00:00Z');assert.equal(repo.raw('projects',project.id)!.updateHealthStatus,'missing');repo.update(actor,'projects',project.id,{updateSchedule:{mode:'never'}});tick('2026-09-30T12:00:00Z');assert.equal(repo.raw('projects',project.id)!.updateHealthStatus,'notExpected');}finally{await f.app.close();}});
test('initiative reminders use the owner timezone over workspace time and skip ownerless or inactive initiatives',async()=>{const f=await fixture('2026-09-01T00:00:00Z');try{const {repo,actor}=f;repo.update(actor,'workspaces',actor.workspaceId,{timezone:'UTC',initiativeUpdateSchedule:{enabled:true,frequency:'weekly',interval:1,weekday:1,hour:9}});repo.update(actor,'users',actor.userId,{preferences:{timezone:'America/Los_Angeles'}});const live=repo.create(actor,'initiatives',{name:'Owner local cadence',ownerId:actor.userId,status:'active'});repo.create(actor,'initiatives',{name:'No owner',status:'active'});repo.create(actor,'initiatives',{name:'Planned only',ownerId:actor.userId,status:'planned'});const tick=(date:string)=>runUpdateReminders(repo,{...actor,system:true},repo.raw('workspaces',actor.workspaceId)!,new Date(date));const notices=()=>repo.all('notifications',actor.workspaceId).filter(n=>n.type==='updateReminders');tick('2026-09-07T09:01:00Z');assert.equal(notices().length,0);tick('2026-09-07T15:59:00Z');assert.equal(notices().length,0);tick('2026-09-07T16:01:00Z');assert.equal(notices().length,1);assert.equal(notices()[0].userId,actor.userId);assert.equal(notices()[0].initiativeId,live.id);tick('2026-09-08T16:01:00Z');assert.equal(notices().length,2);repo.create({...actor,now:new Date('2026-09-09T17:00:00Z')},'updates',{initiativeId:live.id,body:'Current initiative update',health:'On track'});tick('2026-09-10T16:01:00Z');assert.equal(notices().length,2);}finally{await f.app.close();}});
