import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import type { Actor } from "../../src/server/repository";

for (const choice of ["Use server version", "Keep my edit"])
  test(`subscriber conflict preserves remote membership until choosing ${choice}`, async ({
    page,
    context,
    browserName,
  }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(15000);
    const app = createApp({
        databasePath: ":memory:",
        port: 0,
        staticDir: resolve("dist"),
      }),
      { url } = await app.start();
    let disconnected = false;
    const listeners = app.server.listeners("request");
    if (browserName === "webkit") {
      app.server.removeAllListeners("request");
      app.server.on("request", (request, response) => {
        if (disconnected) {
          request.socket.destroy();
          return;
        }
        for (const listener of listeners)
          listener.call(app.server, request, response);
      });
    }
    const offline = async (value: boolean) => {
      if (browserName === "webkit") {
        disconnected = value;
        if (value) app.server.closeAllConnections();
      } else await context.setOffline(value);
    };
    try {
      await page.request.post(url + "/auth/setup", {
        data: {
          name: "Local follower",
          email: "concurrent-owner@example.test",
          password: "owner-password",
        },
      });
      const state = await (
          await page.request.get(url + "/api/v1/state")
        ).json(),
        actor: Actor = {
          userId: state.user.id,
          workspaceId: state.workspaceId,
          role: "owner",
          scopes: ["admin"],
        };
      const invite = await (
        await page.request.post(url + "/api/v1/invitations", {
          data: { email: "concurrent-member@example.test" },
        })
      ).json();
      const joined = await (
          await fetch(url + "/auth/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              token: invite.token,
              name: "Remote follower",
              password: "member-password",
            }),
          })
        ).json(),
        member: Actor = {
          ...actor,
          userId: joined.user.id,
          role: "member",
          scopes: ["read", "write"],
        };
      const issue = app.repo.create(actor, "issues", {
        title: "Concurrent followers",
        teamId: state.teams[0].id,
      });
      await page.goto(url + "/issues/" + issue.id);
      await expect(page.locator(".activity-heading")).toBeVisible();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await offline(true);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      await page.keyboard.press("ControlOrMeta+Shift+s");
      const dialog = page.getByRole("dialog", {
        name: "Manage subscribers",
        exact: true,
      });
      await dialog
        .getByRole("checkbox", { name: "Local follower", exact: true })
        .uncheck();
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Subscribe to issue", exact: true }),
      ).toBeVisible();
      app.repo.create(member, "subscriptions", { issueId: issue.id });
      const remote = [actor.userId, member.userId].sort();
      expect(app.repo.raw("issues", issue.id)!.subscribers).toEqual(remote);
      await offline(false);
      await page
        .getByRole("button", { name: "Review conflicts", exact: true })
        .click();
      const review = page.getByRole("dialog", {
        name: "Review conflicting changes",
        exact: true,
      });
      await expect(review.locator(".conflict-field h4")).toHaveText(
        "subscribers",
      );
      expect(app.repo.raw("issues", issue.id)!.subscribers).toEqual(remote);
      await review.getByRole("button", { name: choice, exact: true }).click();
      await expect(review).toHaveCount(0);
      const expected = choice === "Use server version" ? remote : [];
      await expect
        .poll(() => app.repo.raw("issues", issue.id)!.subscribers)
        .toEqual(expected);
      await page.reload();
      await expect(
        page.getByRole("button", {
          name:
            choice === "Use server version"
              ? "Unsubscribe from issue"
              : "Subscribe to issue",
          exact: true,
        }),
      ).toBeVisible();
      if (choice === "Keep my edit") {
        await page.evaluate(() =>
          (document.activeElement as HTMLElement)?.blur(),
        );
        await page.keyboard.press("ControlOrMeta+z");
        await expect
          .poll(() => app.repo.raw("issues", issue.id)!.subscribers)
          .toEqual(remote);
        await page.keyboard.press("ControlOrMeta+Shift+z");
        await expect
          .poll(() => app.repo.raw("issues", issue.id)!.subscribers)
          .toEqual([]);
        await offline(true);
        await page.keyboard.press("ControlOrMeta+z");
        await expect(
          page.getByRole("button", {
            name: "Unsubscribe from issue",
            exact: true,
          }),
        ).toBeVisible();
        app.repo.update(actor, "issues", issue.id, {
          subscriberIds: [member.userId],
        });
        await offline(false);
        await page
          .getByRole("button", { name: "Review conflicts", exact: true })
          .click();
        await review
          .getByRole("button", { name: "Keep my edit", exact: true })
          .click();
        await expect(review).toHaveCount(0);
        await expect
          .poll(() => app.repo.raw("issues", issue.id)!.subscribers)
          .toEqual(remote);
        await page.reload();
        await page.evaluate(() =>
          (document.activeElement as HTMLElement)?.blur(),
        );
        await page.keyboard.press("ControlOrMeta+Shift+z");
        await expect
          .poll(() => app.repo.raw("issues", issue.id)!.subscribers)
          .toEqual([member.userId]);
      }
    } finally {
      await offline(false);
      await page.close();
      await app.close();
    }
  });
