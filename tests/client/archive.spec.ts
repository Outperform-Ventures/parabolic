import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("team archives filter related records, restore selections and deleted records, and virtualize long history", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Archive owner",
        email: "archive@example.test",
        password: "isolated-archive-test",
        workspaceName: "Archives",
      },
    });
    const state = async () =>
        (await page.request.get(`${url}/api/v1/state`)).json(),
      initial = await state(),
      team = initial.teams[0];
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const other = await create("teams", {
        name: "Other archive team",
        key: "OAT",
      }),
      stamp = "2026-07-01T12:00:00.000Z";
    const first = await create("issues", {
        title: "First archived item",
        teamId: team.id,
        archivedAt: stamp,
      }),
      second = await create("issues", {
        title: "Second archived item",
        teamId: team.id,
        archivedAt: stamp,
      }),
      foreign = await create("issues", {
        title: "Other team hidden by filter",
        teamId: other.id,
        archivedAt: stamp,
      });
    const project = await create("projects", {
        name: "Archived project",
        teamIds: [team.id],
        archivedAt: stamp,
      }),
      doc = await create("documents", {
        title: "Archived project document",
        projectId: project.id,
        content: "<p>Restore this history</p>",
        archivedAt: stamp,
      });
    await page.goto(`${url}/archive?team=${team.id}`);
    await expect(page.locator("[data-archive-id]")).toHaveCount(2);
    await expect(
      page.getByText("Other team hidden by filter", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Select First archived item", { exact: true })
      .check();
    await page
      .getByLabel("Select Second archived item", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Restore 2 selected", exact: true })
      .click();
    await expect(
      page.getByText("No archived issues", { exact: true }),
    ).toBeVisible();
    const restored = await state();
    expect(
      restored.issues.find((i: any) => i.id === first.id).archivedAt,
    ).toBeNull();
    expect(
      restored.issues.find((i: any) => i.id === second.id).archivedAt,
    ).toBeNull();
    expect(
      restored.issues.find((i: any) => i.id === foreign.id).archivedAt,
    ).toBe(stamp);
    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Archived project document",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(
      page.getByText("No archived documents", { exact: true }),
    ).toBeVisible();
    await page.request.delete(`${url}/api/v1/issues/${first.id}`);
    await page.request.delete(`${url}/api/v1/issues/${second.id}`);
    await page.getByRole("button", { name: "Issues", exact: true }).click();
    await page
      .getByRole("button", { name: "Recently deleted", exact: true })
      .click();
    await expect(page.locator("[data-archive-id]")).toHaveCount(2);
    await page.getByLabel("Select all archived items").check();
    await page.keyboard.press("#");
    await expect(
      page.getByText("No deleted issues", { exact: true }),
    ).toBeVisible();
    expect(
      (await state()).issues
        .filter((i: any) => [first.id, second.id].includes(i.id))
        .every((i: any) => !i.deletedAt),
    ).toBe(true);
    await page
      .getByRole("button", { name: "View archive", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Clear team filter", exact: true })
      .click();
    await expect(
      page.getByText("Other team hidden by filter", { exact: true }),
    ).toBeVisible();
    const actor = {
      userId: initial.user.id,
      workspaceId: initial.workspaceId,
      role: "owner",
      scopes: ["read", "write", "admin"],
    };
    app.repo.transaction(() => {
      for (let index = 0; index < 1250; index++)
        app.repo.create(actor, "issues", {
          title: `History item ${index}`,
          teamId: other.id,
          archivedAt: stamp,
        });
    });
    await expect(
      page.getByRole("table", { name: "Archived issues", exact: true }),
    ).toHaveAttribute("aria-rowcount", "1251");
    expect(await page.locator("[data-archive-id]").count()).toBeLessThan(100);
    await page
      .locator(".archive-scroll")
      .evaluate((element) => (element.scrollTop = element.scrollHeight));
    await expect(page.locator("[data-archive-id]").last()).toContainText(
      "History item",
    );
    await page.screenshot({ path: "artifacts/verification/team-archive.png" });
    await page.request.patch(`${url}/api/v1/users/${initial.user.id}`, {
      data: { preferences: { theme: "light" } },
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page
      .getByRole("button", { name: `${team.name} menu`, exact: true })
      .click();
    const contrast = await page
      .locator(".dropdown-content")
      .evaluate((element) => {
        const style = getComputedStyle(element),
          canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        const luminance = (color: string) => {
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const rgb = context.getImageData(0, 0, 1, 1).data;
          const values = [rgb[0], rgb[1], rgb[2]].map((v) =>
            v / 255 <= 0.04045
              ? v / 255 / 12.92
              : ((v / 255 + 0.055) / 1.055) ** 2.4,
          );
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        };
        const foreground = luminance(style.color),
          background = luminance(style.backgroundColor);
        return (
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05)
        );
      });
    expect(contrast).toBeGreaterThan(4.5);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+k");
    await expect(page.locator(".command-palette")).toBeVisible();
    await expect(page.locator(".command-palette")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await page.screenshot({
      path: "artifacts/verification/light-command-menu.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
