import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import type { Actor } from "../../src/server/repository";

test("explicit-team guest creates team views but has no workspace/initiative directory or dashboard creation", async ({
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
        email: "directory-guest-owner@example.test",
        password: "owner-password",
        workspaceName: "Guest directory",
      },
    });
    const initial = await (
        await page.request.get(url + "/api/v1/state")
      ).json(),
      owner: Actor = {
        userId: initial.user.id,
        workspaceId: initial.workspaceId,
        role: "owner",
        scopes: ["admin"],
      },
      team = initial.teams[0];
    const unrelated = app.repo.create(owner, "teams", {
      name: "Other team",
      key: "OTHER",
    });
    const invite = await (
      await page.request.post(url + "/api/v1/invitations", {
        data: { email: "directory-guest@example.test", role: "guest" },
      })
    ).json();
    const joined = await (
      await page.request.post(url + "/auth/join", {
        data: {
          token: invite.token,
          name: "Team Guest",
          password: "guest-password",
        },
      })
    ).json();
    app.repo.create(owner, "memberships", {
      teamId: team.id,
      userId: joined.user.id,
      role: "member",
    });
    app.repo.create(owner, "views", {
      name: "Shared eligible view",
      entityType: "issues",
      teamId: team.id,
      visibility: "workspace",
    });
    app.repo.create(owner, "views", {
      name: "Forbidden workspace view",
      entityType: "issues",
      visibility: "workspace",
    });
    const dashboard = app.repo.create(owner, "dashboards", {
      name: "Readable team dashboard",
      teamId: team.id,
      visibility: "workspace",
      widgets: [],
    });
    app.repo.create(owner, "dashboards", {
      name: "Personal team dashboard",
      teamId: team.id,
      ownerId: joined.user.id,
      visibility: "private",
      widgets: [],
    });
    await page.goto(url + "/team/" + team.id + "/views");
    const tabs = page.getByRole("navigation", { name: "View models" });
    await expect(tabs.getByRole("link")).toHaveCount(3);
    await expect(
      tabs.getByRole("link", { name: "Initiatives", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".views-directory-row")).toHaveCount(1);
    await expect(page.locator(".views-directory-row")).toContainText(
      "Shared eligible view",
    );
    await page
      .getByRole("button", { name: "Create new view", exact: true })
      .click();
    const form = page.getByRole("dialog", { name: "New view" });
    await expect(
      form.getByLabel("Content", { exact: true }).locator("option"),
    ).toHaveCount(2);
    await expect(
      form.getByLabel("Location", { exact: true }).locator("option"),
    ).toHaveCount(1);
    await expect(form.getByLabel("Location", { exact: true })).toHaveValue(
      "team:" + team.id,
    );
    await form
      .getByLabel("Name", { exact: true })
      .fill("Guest created team view");
    await form
      .getByRole("button", { name: "Create view", exact: true })
      .click();
    await expect
      .poll(
        () =>
          app.repo
            .all("views", owner.workspaceId)
            .find((view) => view.name === "Guest created team view")?.teamId,
      )
      .toBe(team.id);
    await page.goto(url + "/team/" + team.id + "/views?type=projects&new=1");
    await expect(form.getByLabel("Content", { exact: true })).toHaveValue(
      "projects",
    );
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await tabs.getByRole("link", { name: "Dashboards", exact: true }).click();
    const sharedRow = page
        .locator(".views-directory-row")
        .filter({ hasText: "Readable team dashboard" }),
      personalRow = page
        .locator(".views-directory-row")
        .filter({ hasText: "Personal team dashboard" });
    await expect(sharedRow).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New dashboard", exact: true }),
    ).toHaveCount(0);
    await expect(
      sharedRow.getByRole("button", { name: "More actions", exact: true }),
    ).toHaveCount(1);
    await expect(
      sharedRow.locator('[data-directory-column="owner"] button'),
    ).toHaveCount(1);
    await expect(
      personalRow.locator('[data-directory-column="owner"] button'),
    ).toHaveCount(0);
    await page.goto(url + "/team/" + team.id + "/views?type=dashboards&new=1");
    await expect(
      page.getByRole("dialog", { name: "New dashboard" }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Readable team dashboard", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add widget", exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "More actions", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    const edit = page.getByRole("dialog", { name: "Edit dashboard" });
    await expect(
      edit.getByLabel("Team", { exact: true }).locator("option"),
    ).toHaveCount(1);
    await edit
      .getByLabel("Name", { exact: true })
      .fill("Guest updated dashboard");
    await edit
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect
      .poll(() => app.repo.raw("dashboards", dashboard.id)?.name)
      .toBe("Guest updated dashboard");
    expect(
      (
        await page.request.post(url + "/api/v1/dashboards", {
          data: {
            name: "Forbidden guest creation",
            teamId: team.id,
            visibility: "workspace",
          },
        })
      ).status(),
    ).toBe(403);
    await page.goto(url + "/team/" + team.id + "/views?type=dashboards");
    const updatedRow = page
      .locator(".views-directory-row")
      .filter({ hasText: "Guest updated dashboard" });
    await updatedRow
      .getByRole("button", { name: "More actions", exact: true })
      .click();
    await updatedRow
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Delete Guest updated dashboard?" })
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect
      .poll(() => !!app.repo.raw("dashboards", dashboard.id, true)?.deletedAt)
      .toBe(true);
    await page.goto(url + "/views");
    await expect(
      page.getByText(/^(?:Page|View directory) unavailable$/),
    ).toBeVisible();
    await expect(page.locator(".views-directory-row")).toHaveCount(0);
    await page.goto(url + "/team/" + unrelated.id + "/views");
    await expect(
      page.getByText(/^(?:Page|View directory) unavailable$/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create new view", exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.close();
    await app.close();
  }
});
