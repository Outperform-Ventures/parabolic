import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import type { Actor } from "../../src/server/repository";

for (const shared of [false, true])
  test(`${shared ? "Shared guest" : "Team member"} subscription toggle clears direct and duplicate records without clearing comment threads`, async ({
    page,
  }) => {
    const app = createApp({
        databasePath: ":memory:",
        port: 0,
        staticDir: resolve("dist"),
      }),
      { url } = await app.start();
    try {
      await page.request.post(url + "/auth/setup", {
        data: {
          name: "Owner",
          email: "subscription-owner@example.test",
          password: "owner-password",
        },
      });
      const initial = await (
        await page.request.get(url + "/api/v1/state")
      ).json();
      const owner: Actor = {
        userId: initial.user.id,
        workspaceId: initial.workspaceId,
        role: "owner",
        scopes: ["admin"],
      };
      const role = shared ? "guest" : "member";
      const invite = await (
        await page.request.post(url + "/api/v1/invitations", {
          data: { email: "subscriber@example.test", role },
        })
      ).json();
      const joined = await (
        await page.request.post(url + "/auth/join", {
          data: {
            token: invite.token,
            name: "Subscriber",
            password: "member-password",
          },
        })
      ).json();
      const actor: Actor = {
        userId: joined.user.id,
        workspaceId: initial.workspaceId,
        role,
        scopes: ["read", "write"],
      };
      const team = shared
        ? app.repo.create(owner, "teams", {
            name: "Private subscription team",
            key: "SUB",
            private: true,
            issueSharingEnabled: true,
          })
        : initial.teams[0];
      const issue = app.repo.create(owner, "issues", {
        title: "Mixed subscription sources",
        teamId: team.id,
        ...(shared ? { sharedWithIds: [actor.userId] } : {}),
        assigneeId: actor.userId,
      });
      const comment = app.repo.create(owner, "comments", {
        issueId: issue.id,
        body: "Separate comment thread",
      });
      await page.goto(url + "/issues/" + issue.id);
      await expect(
        page.getByRole("button", {
          name: "Unsubscribe from issue",
          exact: true,
        }),
      ).toBeVisible();
      app.repo.create(actor, "subscriptions", {
        issueId: issue.id,
        entityKind: "issues",
        entityId: issue.id,
      });
      app.repo.create(actor, "subscriptions", { issueId: issue.id });
      const thread = app.repo.create(actor, "subscriptions", {
        entityKind: "comments",
        entityId: comment.id,
      });
      await page.goto(url + "/issues/" + issue.id);
      await expect(
        page.getByRole("button", {
          name: "Unsubscribe from issue",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Unsubscribe from issue", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Subscribe to issue", exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => ({
          direct: app.repo
            .raw("issues", issue.id)!
            .subscriberIds.includes(actor.userId),
          records: app.repo
            .all("subscriptions", actor.workspaceId)
            .filter(
              (s) =>
                s.userId === actor.userId &&
                (s.issueId === issue.id || s.entityId === issue.id),
            ).length,
        }))
        .toEqual({ direct: false, records: 0 });
      expect(app.repo.raw("subscriptions", thread.id)?.deletedAt).toBeFalsy();
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Subscribe to issue", exact: true }),
      ).toBeVisible();
      await page.goto(url + "/my-issues?tab=Subscribed");
      await expect(page.locator(".issue-row")).toHaveCount(0);
      await page.goto(url + "/issues/" + issue.id);
      await page
        .getByRole("button", { name: "Subscribe to issue", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Unsubscribe from issue",
          exact: true,
        }),
      ).toBeVisible();
      await expect
        .poll(
          () =>
            app.repo
              .raw("issues", issue.id)!
              .subscriberIds.includes(actor.userId) ||
            app.repo
              .all("subscriptions", actor.workspaceId)
              .some((s) => s.userId === actor.userId && s.issueId === issue.id),
        )
        .toBe(true);
      await page.goto(url + "/my-issues?tab=Subscribed");
      await expect(page.locator(".issue-row")).toHaveCount(1);
    } finally {
      await page.close();
      await app.close();
    }
  });
