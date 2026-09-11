import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("project customer requests use the native requests route, picker, and inline composer", async ({ page }) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Project request owner",
        email: "project-request-batch057@example.test",
        password: "project-request-password",
      },
    });
    const state = await page.request.get(url + "/api/v1/state").then(response => response.json());
    const project = await page.request.post(url + "/api/v1/projects", {
      data: { name: "Customer request project", teamIds: [state.teams[0].id] },
    }).then(response => response.json());

    await page.goto(`${url}/project/${project.id}/overview`);
    await page.getByRole("button", { name: "Add customer request", exact: true }).click();
    await expect(page).toHaveURL(`${url}/project/${project.id}/requests?compose=1`);
    await expect(page.getByRole("button", { name: "Customers", exact: true })).toHaveClass(/active/);

    const picker = page.getByRole("dialog", { name: "Select customer", exact: true });
    await expect(picker.getByRole("textbox", { name: "Select customer…", exact: true })).toBeFocused();
    await expect(picker.getByRole("option", { name: "Unknown customer", exact: true })).toBeVisible();
    await page.keyboard.press("Enter");

    const composer = page.locator(".issue-request-composer");
    await expect(composer.locator("[contenteditable=true]")).toBeFocused();
    await expect(composer.getByRole("button", { name: "Add source", exact: true })).toBeVisible();
    await expect(composer.getByRole("button", { name: "Attach images, files, or videos", exact: true })).toBeVisible();
    await composer.locator("[contenteditable=true]").fill("Please support this project request.");
    await composer.getByRole("button", { name: "Create", exact: true }).click();

    await expect(composer).toHaveCount(0);
    await expect.poll(() => app.repo.all("requests", state.workspaceId).find(request => request.projectId === project.id)).toMatchObject({
      projectId: project.id,
      title: project.name,
    });
    expect(app.repo.all("requests", state.workspaceId).find(request => request.projectId === project.id)).not.toHaveProperty("issueId");
    await page.reload();
    await expect(page.getByRole("button", { name: "Customers", exact: true })).toHaveClass(/active/);
    await expect(page.getByText("Please support this project request.", { exact: true })).toBeVisible();

    await page.goto(`${url}/project/${project.id}/customer-requests`);
    await expect(page.getByRole("button", { name: "Customers", exact: true })).toHaveClass(/active/);
  } finally {
    await page.close();
    await app.close();
  }
});
