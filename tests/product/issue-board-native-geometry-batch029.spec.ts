import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

test("issue board cards retain native column, metadata, parent, and progress geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Board geometry QA",
        email: "board-geometry@example.test",
        password: "isolated-board-geometry-password",
        workspaceName: "Board geometry",
      },
    });
    const state = await (await page.request.get(`${url}/api/v1/state`)).json();
    const team = state.teams[0];
    const backlog = state.statuses.find(
      (status: any) => status.teamId === team.id && status.type === "backlog",
    );
    const todo = state.statuses.find(
      (status: any) => status.teamId === team.id && status.type === "unstarted",
    );
    const project = await (
      await page.request.post(`${url}/api/v1/projects`, {
        data: { name: "Native board project", teamId: team.id },
      })
    ).json();
    const parent = await (
      await page.request.post(`${url}/api/v1/issues`, {
        data: {
          title: "Parent issue with child progress",
          teamId: team.id,
          statusId: backlog.id,
          projectId: project.id,
          priority: 2,
          estimate: 4,
        },
      })
    ).json();
    const child = await (
      await page.request.post(`${url}/api/v1/issues`, {
        data: {
          title: "Child issue with parent breadcrumb",
          teamId: team.id,
          statusId: backlog.id,
          projectId: project.id,
          parentId: parent.id,
          priority: 3,
          estimate: 2,
        },
      })
    ).json();
    for (let index = 0; index < 2; index += 1)
      await page.request.post(`${url}/api/v1/issues`, {
        data: {
          title: `Additional child ${index + 1}`,
          teamId: team.id,
          statusId: backlog.id,
          parentId: parent.id,
        },
      });
    await page.request.post(`${url}/api/v1/issues`, {
      data: {
        title: "Second native column",
        teamId: team.id,
        statusId: todo.id,
      },
    });
    const view = await (
      await page.request.post(`${url}/api/v1/views`, {
        data: {
          name: "Triage",
          teamId: team.id,
          layout: "board",
          display: {
            layout: "board",
            groupBy: "statusId",
            subGroupBy: "none",
            orderBy: "priority",
            direction: "asc",
            showCompleted: false,
            showSubIssues: true,
            showEmpty: false,
            summaryOpen: true,
            groupCount: "estimate",
            properties: [
              "identifier",
              "statusId",
              "assigneeId",
              "priority",
              "projectId",
              "estimate",
              "createdAt",
            ],
          },
        },
      })
    ).json();

    const displayKey = `display:${state.workspaceId}:${state.user.id}:${view.id}`;
    await page.addInitScript(
      ({ key }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            layout: "board",
            groupCount: "estimate",
            groupBy: "statusId",
            subGroupBy: "none",
            orderBy: "priority",
            direction: "asc",
            showCompleted: false,
            showEmpty: false,
            showSubIssues: true,
            properties: [
              "identifier",
              "statusId",
              "assigneeId",
              "priority",
              "projectId",
              "createdAt",
            ],
          }),
        );
      },
      { key: displayKey },
    );
    await page.goto(`${url}/view/${view.id}`);
    await expect(page.locator(".board-column")).toHaveCount(2);
    const columns = await page.locator(".board-column").evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, width: rect.width };
      }),
    );
    expect(columns[0].width).toBe(324);
    expect(columns[1].x - columns[0].x - columns[0].width).toBe(24);

    const parentCard = page.locator(
      `.board-card[data-issue-id="${parent.id}"]`,
    );
    const childCard = page.locator(`.board-card[data-issue-id="${child.id}"]`);
    await expect(parentCard.locator(".board-card-estimate")).toContainText("4");
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).properties,
        displayKey,
      ),
    ).toContain("estimate");
    await expect(
      parentCard.locator(".board-card-sub-issue-progress"),
    ).toHaveText("0/3");
    await expect(childCard.locator(".board-card-parent")).toContainText(
      parent.title,
    );
    await expect(parentCard.locator(".board-project-badge")).toContainText(
      project.name,
    );
    const geometry = await parentCard.evaluate((node) => {
      const card = getComputedStyle(node);
      const metadata = node.querySelector<HTMLElement>(
        ".board-card-properties",
      )!;
      const chip = metadata.querySelector<HTMLElement>(".badge")!;
      return {
        cardHeight: node.getBoundingClientRect().height,
        paddingLeft: card.paddingLeft,
        metadataHeight: metadata.getBoundingClientRect().height,
        chipHeight: chip.getBoundingClientRect().height,
      };
    });
    expect(geometry.cardHeight).toBeGreaterThanOrEqual(118);
    expect(geometry.cardHeight).toBeLessThanOrEqual(120);
    expect(geometry).toMatchObject({
      paddingLeft: "10px",
      metadataHeight: 24,
      chipHeight: 24,
    });
  } finally {
    await app.close();
  }
});
