import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("issue duplication preserves a fresh subtree, conversion flattens it, and reciprocal relations and duplicate merges survive navigation", async ({
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
        name: "Lifecycle owner",
        email: "lifecycle@example.test",
        password: "isolated-lifecycle-test",
        workspaceName: "Lifecycle",
      },
    });
    const state = async () =>
        (await page.request.get(`${url}/api/v1/state`)).json(),
      initial = await state(),
      team = initial.teams[0],
      todo = initial.statuses.find((s: any) => s.type === "unstarted");
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const parent = await create("issues", {
        title: "Original hierarchy",
        teamId: team.id,
        statusId: todo.id,
        description: "<p>Project context survives conversion.</p>",
        priority: 2,
      }),
      child = await create("issues", {
        title: "Original child",
        parentId: parent.id,
      }),
      grandchild = await create("issues", {
        title: "Original grandchild",
        parentId: child.id,
      });
    await page.goto(`${url}/issues/${parent.id}`);
    const actions = () =>
      page
        .locator(".page-header")
        .getByRole("button", { name: "Issue options", exact: true });
    await actions().click();
    await page
      .getByRole("menuitem", { name: "Make a copy", exact: true })
      .click();
    await page.getByLabel("Duplicate issue title").fill("Copied hierarchy");
    await page.getByLabel("Include 2 sub-issues").check();
    await page
      .getByRole("button", { name: "Duplicate issue", exact: true })
      .click();
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Copied hierarchy",
    );
    const copied = (await state()).issues.find(
      (i: any) => i.title === "Copied hierarchy",
    );
    expect(copied.id).not.toBe(parent.id);
    const copiedChild = (await state()).issues.find(
      (i: any) => i.parentId === copied.id,
    );
    expect(copiedChild.title).toBe("Original child");
    expect(
      (await state()).issues.find((i: any) => i.parentId === copiedChild.id)
        .title,
    ).toBe("Original grandchild");
    await actions().click();
    await page
      .getByRole("menuitem", { name: "Convert to project", exact: true })
      .click();
    await page.getByLabel("Converted project name").fill("Converted plan");
    await page
      .getByRole("button", { name: "Convert to project", exact: true })
      .click();
    await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
      "Converted plan",
    );
    const converted = (await state()).projects.find(
        (p: any) => p.name === "Converted plan",
      ),
      convertedIssues = (await state()).issues.filter(
        (i: any) => i.projectId === converted.id,
      );
    expect(convertedIssues).toHaveLength(3);
    expect(convertedIssues.every((i: any) => !i.parentId)).toBe(true);
    expect(
      (await state()).issues.find((i: any) => i.id === child.id).parentId,
    ).toBe(parent.id);
    expect(converted.description).toContain("context survives");
    const blocking = await create("issues", {
        title: "Blocking dependency",
        teamId: team.id,
        statusId: todo.id,
      }),
      blocked = await create("issues", {
        title: "Blocked delivery",
        teamId: team.id,
        statusId: todo.id,
      });
    await page.goto(`${url}/issues/${blocking.id}`);
    await actions().click();
    await page
      .getByRole("menuitem", { name: "Add relation", exact: true })
      .click();
    await page
      .locator(".relation-option")
      .filter({ hasText: "Blocked delivery" })
      .locator("select")
      .selectOption("blocks");
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === blocked.id)
            .blockedByIds,
      )
      .toEqual([blocking.id]);
    await expect(
      page.locator(".issue-relation-group.relation-blocks"),
    ).toContainText("Blocked delivery");
    await page
      .locator(".issue-properties-panel")
      .getByRole("button", { name: "Change status", exact: true })
      .click();
    await page
      .locator(".property-menu")
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(
      page.locator(".issue-relation-group.relation-related"),
    ).toContainText("Blocked delivery");
    await page.goto(`${url}/issues/${blocked.id}`);
    await expect(
      page.locator(".issue-relation-group.relation-related"),
    ).toContainText("Blocking dependency");
    await page
      .getByRole("button", {
        name: "Remove relation to Blocking dependency",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === blocking.id)
            .relations,
      )
      .toEqual([]);
    const duplicate = await create("issues", {
        title: "Duplicate customer feedback",
        teamId: team.id,
        statusId: todo.id,
      }),
      comment = await create("comments", {
        issueId: duplicate.id,
        body: "<p>Customer detail moves with merge.</p>",
      }),
      customer = await create("customers", { name: "Lifecycle customer" }),
      request = await create("requests", {
        title: "Customer feedback",
        customerId: customer.id,
        issueId: duplicate.id,
      });
    await page.goto(`${url}/issues/${duplicate.id}`);
    await actions().click();
    await page
      .getByRole("menuitem", { name: "Add relation", exact: true })
      .click();
    await page
      .locator(".relation-option")
      .filter({ hasText: "Blocked delivery" })
      .locator("select")
      .selectOption("duplicateOf");
    await expect(page.locator(".issue-article .banner")).toContainText(
      "Duplicate of",
    );
    const merged = await state();
    expect(merged.comments.find((c: any) => c.id === comment.id).issueId).toBe(
      blocked.id,
    );
    expect(merged.requests.find((r: any) => r.id === request.id).issueId).toBe(
      blocked.id,
    );
    expect(
      merged.statuses.find(
        (s: any) =>
          s.id ===
          merged.issues.find((i: any) => i.id === duplicate.id).statusId,
      ).type,
    ).toBe("duplicate");
    await page.screenshot({
      path: "artifacts/verification/issue-duplicate-merge.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
  }
});
