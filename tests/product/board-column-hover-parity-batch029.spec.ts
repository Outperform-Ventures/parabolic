import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("board column actions, hidden footer, and project hover match the native contract", async ({
  page,
}) => {
  const app = createApp({ databasePath: ":memory:", port: 0, staticDir: resolve("dist") });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Board parity owner",
        email: "board-parity@example.test",
        password: "test-password",
      },
    });
    const state = await page.request.get(url + "/api/v1/state").then((response) => response.json());
    const team = state.teams[0];
    const backlog = state.statuses.find(
      (status: any) => status.teamId === team.id && status.type === "backlog",
    );
    const completed = state.statuses.find(
      (status: any) => status.teamId === team.id && status.type === "completed",
    );
    const project = await page.request
      .post(url + "/api/v1/projects", {
        data: {
          name: "Native hover project",
          status: "backlog",
          priority: 0,
          teamIds: [team.id],
          icon: "Stadium",
          color: "#0baf8f",
        },
      })
      .then((response) => response.json());
    await page.request.post(url + "/api/v1/issues", {
      data: {
        title: "Visible project issue",
        teamId: team.id,
        statusId: backlog.id,
        projectId: project.id,
        estimate: 8,
      },
    });
    await page.request.post(url + "/api/v1/issues", {
      data: {
        title: "Completed hidden issue",
        teamId: team.id,
        statusId: completed.id,
      },
    });
    await page.goto(url + `/team/${team.id}/all`);
    await page.evaluate(({ workspaceId, userId, teamId }) => {
      localStorage.setItem(
        `display:${workspaceId}:${userId}:${teamId}:all`,
        JSON.stringify({
          layout: "board",
          groupBy: "statusId",
          subGroupBy: "none",
          orderBy: "priority",
          direction: "asc",
          groupCount: "estimate",
          showCompleted: false,
          showEmpty: true,
          showSubIssues: true,
          properties: [
            "identifier",
            "statusId",
            "priority",
            "assigneeId",
            "projectId",
            "estimate",
            "createdAt",
          ],
        }),
      );
    }, { workspaceId: state.workspaceId, userId: state.user.id, teamId: team.id });
    await page.reload();

    const header = page.locator(`.group-header[data-group-id="${backlog.id}"]`);
    await expect(header.getByRole("button", { name: "Create new issue", exact: true })).toBeVisible();
    await header.getByRole("button", { name: "Open menu", exact: true }).click();
    await expect(page.getByText("Showing all items", { exact: true })).toBeVisible();
    const actionFilter = page.getByRole("textbox", {
      name: `Filter ${backlog.name} column actions`,
      exact: true,
    });
    await expect(actionFilter).toBeFocused();
    await page.screenshot({
      path: resolve(
        "audit/non-settings-parity/batch-029/packaged/team-triage-column-menu-fixture.png",
      ),
    });
    await actionFilter.fill("select");
    await expect(page.getByRole("menuitem", { name: "Select all in column", exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Hide column", exact: true })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Select all in column", exact: true }).click();
    await expect(page.getByRole("toolbar", { name: "Selected issues" })).toBeVisible();

    await expect(page.getByText("1 issue hidden by display options", { exact: true })).toBeVisible();
    const footerBox = await page.locator(".issue-board-hidden-footer").boundingBox();
    const boardBox = await page.locator(".board-scroll").boundingBox();
    expect(
      Math.abs(
        footerBox!.x + footerBox!.width / 2 -
          (boardBox!.x + boardBox!.width / 2),
      ),
    ).toBeLessThan(1);
    await expect(page.getByRole("button", { name: "Show options", exact: true })).toBeVisible();
    await page.locator(".board-project-badge").hover();
    const hover = page.locator(".board-project-hover-card");
    await expect(hover).toBeVisible({ timeout: 900 });
    await expect(hover).toContainText("Backlog");
    await expect(hover).toContainText(team.name);
    await expect(hover).toContainText("No priority");
    await expect(hover).toContainText("0% of 8");
    expect(await hover.boundingBox()).toMatchObject({ width: 356, height: 78 });
    await page.screenshot({
      path: resolve(
        "audit/non-settings-parity/batch-029/packaged/team-triage-project-hover-fixture.png",
      ),
    });
  } finally {
    await app.close();
  }
});
