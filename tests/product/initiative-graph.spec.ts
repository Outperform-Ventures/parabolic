import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";
test("initiative project graph deduplicates descendants, retains historical membership and supports keyboard week inspection and project focus", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start(),
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        email: "initiative-graph@example.test",
        password: "isolated-graph-password",
        name: "Graph owner",
        workspaceName: "Initiative graphs",
      },
    });
    const initial = await (
        await page.request.get(url + "/api/v1/state")
      ).json(),
      team = initial.teams[0],
      done = initial.statuses.find(
        (row: any) => row.teamId === team.id && row.type === "completed",
      );
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(url + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const root = await create("initiatives", {
        name: "Graph initiative",
        status: "active",
      }),
      child = await create("initiatives", {
        name: "Child graph initiative",
        parentIds: [root.id],
        status: "active",
      });
    const first = await create("projects", {
        name: "Historical first project",
        teamIds: [team.id],
        initiativeIds: [root.id, child.id],
      }),
      second = await create("projects", {
        name: "Descendant second project",
        teamIds: [team.id],
        initiativeIds: [child.id],
      });
    const issue = await create("issues", {
      title: "Completed before moving",
      teamId: team.id,
      statusId: done.id,
      projectId: first.id,
    });
    await create("issues", {
      title: "Completed descendant work",
      teamId: team.id,
      statusId: done.id,
      projectId: second.id,
    });
    expect(
      (
        await page.request.patch(url + "/api/v1/issues/" + issue.id, {
          data: { projectId: second.id },
        })
      ).ok(),
    ).toBeTruthy();
    await page.goto(url + "/initiative/" + root.id);
    const graph = page.getByRole("region", {
        name: "Initiative project progress",
        exact: true,
      }),
      svg = graph.getByRole("group", {
        name: "Project completion activity by week",
        exact: true,
      });
    await expect(graph.locator("[data-initiative-graph-project]")).toHaveCount(
      2,
    );
    await expect(graph.locator("header")).toContainText("2 completed issues");
    await expect(
      graph.locator('[data-initiative-graph-project="' + first.id + '"] title'),
    ).toHaveText("Historical first project: 1 completed issue");
    await graph.locator("summary").click();
    await graph
      .getByRole("button", {
        name: "Focus Historical first project in graph",
        exact: true,
      })
      .click();
    await expect(
      graph.locator('[data-initiative-graph-project="' + first.id + '"]'),
    ).toHaveAttribute("data-focused", "true");
    await svg.focus();
    await page.keyboard.press("End");
    await expect(graph.locator(".initiative-graph-tooltip")).toContainText(
      "Historical first project",
    );
    await expect(graph.locator(".initiative-graph-tooltip")).toContainText(
      "1 completed",
    );
    await page.keyboard.press("Home");
    await expect(graph.locator(".initiative-graph-tooltip")).toContainText(
      "0 completed",
    );
    await page.keyboard.press("Escape");
    await expect(
      graph.getByRole("button", { name: "Clear project focus", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Only projects added directly", { exact: true })
      .check();
    await expect(graph.locator("[data-initiative-graph-project]")).toHaveCount(
      1,
    );
    await expect(graph.locator("header")).toContainText("1 completed issue");
    await page
      .getByLabel("Only projects added directly", { exact: true })
      .uncheck();
    await expect(graph.locator("[data-initiative-graph-project]")).toHaveCount(
      2,
    );
    await graph
      .getByLabel("Find project in progress graph", { exact: true })
      .fill("Descendant");
    await expect(graph.locator(".initiative-graph-project-row")).toHaveCount(1);
    await graph
      .getByRole("button", {
        name: "Focus Descendant second project in graph",
        exact: true,
      })
      .click();
    await svg.focus();
    await page.keyboard.press("End");
    const tooltip = graph.locator(".initiative-graph-tooltip"), tooltipBox = await tooltip.boundingBox(), projectLabelBox = await tooltip.getByText("Descendant second project", {exact: true}).boundingBox(), countBox = await tooltip.locator("b").boundingBox();
    expect(projectLabelBox!.width).toBeGreaterThan(40);
    expect(countBox!.x + countBox!.width).toBeLessThanOrEqual(tooltipBox!.x + tooltipBox!.width);
    await page.screenshot({
      path: "artifacts/product-ui/initiative-graph.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
