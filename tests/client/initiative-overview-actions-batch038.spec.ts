import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("initiative overview exposes the captured header actions and functional favorite, copy, and add-project controls", async ({
  page,
}) => {
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start();
  try {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as any).__copied = value;
          },
        },
      }),
    );
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Initiative QA",
        email: "initiative-batch038@example.test",
        password: "initiative-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      actor = {
        userId: state.user.id,
        workspaceId: state.workspaceId,
        role: "owner",
        scopes: ["admin"],
      },
      initiative = app.repo.create(actor, "initiatives", {
        name: "2.0 Launch",
        status: "active",
      });
    app.repo.create(actor, "projects", {
      name: "Unattached project",
      teamIds: [state.teams[0].id],
    });
    await page.goto(url + "/initiative/" + initiative.id + "/overview");
    const updatePrompt = page.getByRole("button", {
        name: "Write first initiative update",
        exact: true,
      }),
      description = page.getByRole("heading", {
        name: "Description",
        exact: true,
      });
    await expect(updatePrompt).toBeVisible();
    await expect(description).toBeVisible();
    expect((await updatePrompt.boundingBox())!.y).toBeLessThan(
      (await description.boundingBox())!.y,
    );
    const header = page.locator(".feature-header");
    await expect(
      header.getByRole("switch", { name: "Add to favorites", exact: true }),
    ).toHaveAttribute("aria-checked", "false");
    await expect(
      header.getByRole("button", { name: "Initiative actions", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Copy page URL", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", {
        name: "Setup initiative notifications",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Add project", exact: true }),
    ).toBeVisible();
    await header
      .getByRole("switch", { name: "Add to favorites", exact: true })
      .click();
    await expect(
      header.getByRole("switch", {
        name: "Remove from favorites",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await header
      .getByRole("button", { name: "Copy page URL", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__copied))
      .toBe(url + "/initiative/" + initiative.id + "/overview");
    await header
      .getByRole("button", { name: "Add project", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Add project", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await header
      .getByRole("button", { name: "Initiative actions", exact: true })
      .click();
    const menu = page.getByRole("menu");
    for (const name of [
      "Copy",
      "Unfavorite",
      "Subscribe",
      "Remind me",
      "New initiative update",
      "Change update schedule…",
      "Configure Slack notifications…",
      "Show description history",
      "Show updates and activity",
      "Hide comments",
      "Delete",
    ])
      await expect(
        menu.getByRole("menuitem").filter({ hasText: name }),
      ).toBeVisible();
  } finally {
    await page.close();
    await app.close();
  }
});

test("initiative navigation uses the captured Overview, Activity, Projects, and Add new view contract", async ({
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
        name: "Initiative tabs",
        email: "initiative-tabs-batch038@example.test",
        password: "initiative-tabs-password",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      actor = {
        userId: state.user.id,
        workspaceId: state.workspaceId,
        role: "owner",
        scopes: ["admin"],
      },
      initiative = app.repo.create(actor, "initiatives", {
        name: "Launch tabs",
        status: "active",
      });
    await page.goto(url + "/initiative/" + initiative.id + "/overview");
    const tabs = page.getByRole("navigation", { name: "Initiative views" });
    await expect(tabs.getByRole("link")).toHaveText([
      "Overview",
      "Activity",
      "Projects",
    ]);
    await expect(
      tabs.getByRole("button", { name: "Add new view", exact: true }),
    ).toBeVisible();
    await tabs.getByRole("link", { name: "Activity", exact: true }).click();
    await expect(page).toHaveURL(
      url + "/initiative/" + initiative.id + "/activity",
    );
    await expect(
      page.getByRole("button", {
        name: "Write first initiative update",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await page.close();
    await app.close();
  }
});
