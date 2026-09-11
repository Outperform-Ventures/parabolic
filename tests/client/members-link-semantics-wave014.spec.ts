import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("Members rows and profile tabs retain native link semantics", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Directory owner",
        email: "directory-owner@example.test",
        password: "directory-owner-password",
      },
    });
    const state = await page.request.get(url + "/api/v1/state").then((response) => response.json());
    const actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner",
      scopes: ["admin"],
    };
    const memberId = randomUUID();
    const now = new Date().toISOString();
    app.repo.save("users", {
      id: memberId,
      workspaceId: state.workspaceId,
      name: "Member Person",
      username: "member-person",
      email: "member@example.test",
      createdAt: now,
      updatedAt: now,
      version: 1,
    }, "create", actor);
    app.repo.save("memberships", {
      id: randomUUID(),
      workspaceId: state.workspaceId,
      userId: memberId,
      role: "member",
      createdAt: now,
      updatedAt: now,
      version: 1,
    }, "create", actor);
    app.repo.create(actor, "memberships", {
      teamId: state.teams[0].id,
      userId: memberId,
      role: "member",
    });

    await page.goto(url + "/members");
    const memberLink = page.getByRole("link", {
      name: new RegExp(`Member Person\\s+member-person\\s+Member.*${state.teams[0].name}`),
    });
    await expect(memberLink).toHaveAttribute("href", `/profiles/${memberId}`);
    await memberLink.hover();
    await expect(page.getByRole("button", { name: "Member Person actions", exact: true })).toHaveCount(0);
    await memberLink.focus();
    await expect(memberLink).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(url + `/profiles/${memberId}`);
    await page.goBack();
    await expect(memberLink).toBeVisible();
    await memberLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(url + `/profiles/${memberId}`);

    const assigned = page.getByRole("link", { name: "Assigned", exact: true });
    const created = page.getByRole("link", { name: "Created", exact: true });
    await expect(assigned).toHaveAttribute("href", `/profiles/${memberId}`);
    await expect(assigned).toHaveAttribute("aria-current", "page");
    await expect(created).toHaveAttribute("href", `/profiles/${memberId}/created`);
    await expect(page.getByRole("button", { name: /^(Assigned|Created)$/ })).toHaveCount(0);

    await created.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(url + `/profiles/${memberId}/created`);
    await expect(created).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page.getByRole("link", { name: "Created", exact: true })).toHaveAttribute("aria-current", "page");
  } finally {
    await app.close();
  }
});
