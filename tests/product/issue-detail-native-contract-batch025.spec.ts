import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

const staticDir = process.env.PARABOLIC_TEST_DIST ?? resolve("dist");

test("issue detail exposes the retained native header, entry points, and full options inventory", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir,
  });
  const { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Issue detail owner",
        email: "batch025-detail@example.test",
        password: "batch025-password",
      },
    });
    const state = await page.request
      .get(`${url}/api/v1/state`)
      .then((r) => r.json());
    const issue = await page.request
      .post(`${url}/api/v1/issues`, {
        data: {
          title: "Native issue contract",
          description: "<p>Evidence-backed description.</p>",
          teamId: state.teams[0].id,
        },
      })
      .then((r) => r.json());

    await page.goto(`${url}/issues/${issue.id}`);

    const favorite = page.getByRole("switch", {
      name: "Add to favorites",
      exact: true,
    });
    await expect(favorite).toHaveAttribute("aria-checked", "false");
    await favorite.click();
    await expect(
      page.getByRole("switch", {
        name: "Remove from favorites",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");

    await expect(
      page.getByRole("button", { name: "Issue options", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Toggle properties", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByLabel("Issue reactions")
        .getByRole("button", { name: "Add reaction", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".issue-article")
        .getByRole("button", {
          name: "Attach images, files, or videos",
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Create new sub-issue",
        exact: true,
      }),
    ).toBeVisible();

    const submit = page.getByRole("button", {
      name: "Submit comment",
      exact: true,
    });
    await expect(submit).toBeDisabled();
    await page
      .locator('.comment-composer [contenteditable="true"]')
      .fill("Ready for review");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect
      .poll(async () => {
        const latest = await page.request
          .get(`${url}/api/v1/state`)
          .then((r) => r.json());
        return latest.comments.some(
          (row: any) =>
            row.issueId === issue.id && row.body.includes("Ready for review"),
        );
      })
      .toBe(true);

    const activitySubscription = page
      .locator(".activity-heading")
      .getByRole("button", {
        name: /^(?:Subscribe to|Unsubscribe from) issue$/,
      });
    const priorSubscriptionLabel =
      await activitySubscription.getAttribute("aria-label");
    await activitySubscription.click();
    await expect(
      page.locator(".activity-heading").getByRole("button", {
        name:
          priorSubscriptionLabel === "Subscribe to issue"
            ? "Unsubscribe from issue"
            : "Subscribe to issue",
        exact: true,
      }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Issue options", exact: true })
      .click();
    const menu = page.locator(".issue-detail-action-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText([
      /Team/,
      /Due date/,
      /Add link…/,
      /Add customer request…/,
      /Add document…/,
      /Create related/,
      /Mark as/,
      /Copy/,
      /Convert to/,
      /Make a copy…/,
      /[Ff]avorite/,
      /Remind me/,
      /Show description history/,
      /Delete/,
    ]);
    await expect(menu.getByRole("menuitem", { name: /^Open in/ })).toHaveCount(
      0,
    );
    await expect(
      menu.getByRole("menuitem", { name: /^(?:Subscribe|Unsubscribe)/ }),
    ).toHaveCount(0);
  } finally {
    await page.close();
    await app.close();
  }
});

test("comment options match the retained native action order and copy Markdown", async ({
  page,
  context,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir,
  });
  const { url } = await app.start();
  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: url,
    });
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Comment owner",
        email: "batch025-comment@example.test",
        password: "batch025-password",
      },
    });
    const state = await page.request
      .get(`${url}/api/v1/state`)
      .then((r) => r.json());
    const issue = await page.request
      .post(`${url}/api/v1/issues`, {
        data: { title: "Comment contract", teamId: state.teams[0].id },
      })
      .then((r) => r.json());
    const comment = await page.request
      .post(`${url}/api/v1/comments`, {
        data: {
          issueId: issue.id,
          body: "<p>One <strong>important</strong> note</p>",
        },
      })
      .then((r) => r.json());

    await page.goto(`${url}/issues/${issue.id}`);
    const card = page.locator(`#comment-${comment.id}`);
    await card.hover();
    await card
      .getByRole("button", { name: "Comment options", exact: true })
      .click();
    const menu = page.locator(".dropdown-content:visible");
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Edit",
      /^(?:Subscribe to|Unsubscribe from) thread$/,
      "Resolve thread",
      "Copy link to comment",
      "Copy content as Markdown",
      "New issue from comment…",
      "New sub-issue from comment…",
      "Delete",
    ]);
    await expect(
      menu.getByRole("menuitem", { name: "Reply to thread", exact: true }),
    ).toHaveCount(0);
    await menu
      .getByRole("menuitem", { name: "Copy content as Markdown", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("One **important** note");
  } finally {
    await page.close();
    await app.close();
  }
});

test("project issue navigation retains the native team and project breadcrumbs", async ({
  page,
}) => {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir,
  });
  const { url } = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Project context owner",
        email: "batch033-project-context@example.test",
        password: "batch033-password",
      },
    });
    const state = await page.request
      .get(`${url}/api/v1/state`)
      .then((response) => response.json());
    const team = state.teams[0];
    const project = await page.request
      .post(`${url}/api/v1/projects`, {
        data: {
          name: "Honey Rock Group",
          teamId: team.id,
          teamIds: [team.id],
        },
      })
      .then((response) => response.json());
    const issue = await page.request
      .post(`${url}/api/v1/issues`, {
        data: {
          title: "Project breadcrumb contract",
          teamId: team.id,
          projectId: project.id,
        },
      })
      .then((response) => response.json());

    await page.goto(`${url}/project/${project.id}/issues`);
    await page.locator(`[data-issue-id="${issue.id}"]`).click();

    const header = page.locator(".issue-detail-view > .page-header");
    await expect(
      header.getByRole("link", { name: "Team overview", exact: true }),
    ).toHaveAttribute("href", `/team/${team.id}/overview`);
    await expect(
      header.getByRole("link", { name: project.name, exact: true }),
    ).toHaveAttribute("href", `/project/${project.id}/issues`);
    await expect(header.locator(".issue-header-title")).toContainText(
      `${issue.identifier} ${issue.title}`,
    );
  } finally {
    await page.close();
    await app.close();
  }
});
