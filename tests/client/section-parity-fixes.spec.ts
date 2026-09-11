import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import {
  myIssueActivity,
  myActivityVerb,
} from "../../src/client/my-issues-state";
import {
  projectManualDrop,
  projectManualRank,
} from "../../src/client/features/project-manual-order";

test("activity provenance keeps source summaries separate and newer local work wins", () => {
  const issue: any = {
    id: "i",
    assigneeId: "u",
    sourceActivitySummary: {
      userId: "u",
      at: "2026-09-07T17:09:05Z",
      verb: "changed status",
    },
  };
  const created: any = {
    id: "a",
    entityKind: "issues",
    entityId: "i",
    actorId: "u",
    action: "create",
    createdAt: "2026-09-07T17:08:52Z",
  };
  const removed: any = {
    ...created,
    id: "deleted",
    createdAt: "2026-09-08T00:00:00Z",
    deletedAt: "2026-09-08T00:00:01Z",
  };
  expect(myIssueActivity([issue], [], [created, removed], "u").get("i")).toBe(
    issue.sourceActivitySummary.at,
  );
  expect(
    myIssueActivity(
      [issue],
      [],
      [{ ...created, action: "update", createdAt: "2026-09-09T00:00:00Z" }],
      "u",
    ).get("i"),
  ).toBe("2026-09-09T00:00:00Z");
  expect(
    myActivityVerb(
      {
        ...created,
        action: "update",
        sourceAnchor: "update-native-state-change",
      },
      "u",
      "u",
    ),
  ).toBe("changed status");
  expect(
    myActivityVerb(
      {
        ...created,
        action: "update",
        changes: { statusId: { from: "todo", to: "done" } },
      },
      "u",
      "u",
    ),
  ).toBe("changed status");
  const observed: any = {
    ...issue,
    deletedAt: "2026-09-09",
    sourceActivitySummary: {
      userId: "u",
      date: "2026-09-04",
      verb: "created",
      precision: "day",
    },
  };
  expect(
    myIssueActivity(
      [observed],
      [],
      [
        {
          ...created,
          sourceAnchor: "source-history",
          createdAt: "2026-09-05T18:00:00Z",
        },
      ],
      "u",
    ).get("i"),
  ).toBe("2026-09-04T12:00:00");
  expect(myActivityVerb(created, "u")).toBe("created");
  expect(
    myActivityVerb(
      {
        ...created,
        action: "update",
        sourceAnchor: "update-native-state-change",
      },
      "u",
      null,
    ),
  ).toBe("updated");
  const rows: any[] = [
    { id: "a", createdAt: "2026-09-01" },
    { id: "b", createdAt: "2026-09-02" },
    { id: "c", createdAt: "2026-09-03" },
  ];
  expect(projectManualDrop(rows, "c", "b")!.sortOrder).toBeGreaterThan(
    projectManualRank(rows[0]),
  );
  expect(projectManualDrop(rows, "c", "b")!.sortOrder).toBeLessThan(
    projectManualRank(rows[1]),
  );
});

test("compact directories retain creation, filtering and secondary model access", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "section@example.test",
        password: "section-parity-test",
        workspaceName: "Parity",
      },
    });
    await page.goto(url + "/views?type=projects");
    await expect(page.locator(".directory-empty h2")).toHaveText("Views");
    await expect(
      page.getByRole("navigation", { name: "View models" }).getByRole("link"),
    ).toHaveCount(2);
    await page.getByRole("button", { name: "More directory options" }).click();
    await page
      .getByRole("menuitem", { name: "Initiatives", exact: true })
      .click();
    await expect(page).toHaveURL(/type=initiatives/);
    await page.goto(url + "/initiatives");
    await expect(page.locator(".directory-empty h2")).toHaveText("Initiatives");
    await expect(page.getByLabel("Group initiatives")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Initiative display options" })
      .click();
    await page.getByLabel("Group initiatives").selectOption("status");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Filter initiatives", exact: true })
      .click();
    await expect(
      page.locator(".initiative-options input").first(),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Create new initiative", exact: true })
      .click();
    await expect(
      page.getByRole("form", { name: "New initiative" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("issue detail preserves resource access and navigates its originating list", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Owner",
        email: "issue-parity@example.test",
        password: "section-parity-test",
        workspaceName: "Parity",
      },
    });
    const state = await (await page.request.get(url + "/api/v1/state")).json(),
      team = state.teams[0],
      user = state.users[0];
    for (const title of ["First issue", "Second issue"])
      await page.request.post(url + "/api/v1/issues", {
        data: { title, teamId: team.id, assigneeId: user.id, estimate: 2 },
      });
    await page.goto(url + "/my-issues?tab=Activity");
    await expect(
      page.getByRole("button", { name: "Shared", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".page-header")).not.toContainText("New issue");
    await page.getByText("Second issue", { exact: true }).first().click();
    await expect(page.locator(".issue-context-link")).toHaveText("My issues");
    await expect(
      page.getByRole("button", { name: "Navigate down", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".entity-documents")).toHaveCount(0);
    await expect(page.locator(".issue-links")).toHaveCount(0);
    await expect(page.locator(".issue-properties-panel h3")).not.toContainText([
      "Due date",
    ]);
    await page.getByRole("button", { name: "Issue options" }).click();
    await page
      .getByRole("menuitem", { name: "Add document", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Navigate down", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Issue title", exact: true }),
    ).toHaveValue("First issue");
    await page.goto(url + "/search?q=First");
    await expect(page.locator(".search-controls .page-tabs>button")).toHaveText(
      ["All", "Issues", "Projects", "Initiatives", "Documents"],
    );
    await expect(page.locator("#search-results")).toContainText("First issue");
  } finally {
    await app.close();
  }
});
