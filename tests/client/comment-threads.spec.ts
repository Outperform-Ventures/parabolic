import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("participants resolve a thread with a selected reply, reopen it, and manage a thread-only subscription", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const context = await browser.newContext(),
    member = await context.newPage();
  const errors: string[] = [];
  member.on("pageerror", (error) => errors.push(error.message));
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Thread author",
        email: "thread-owner@example.test",
        password: "isolated-thread-owner",
        workspaceName: "Threads",
      },
    });
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state();
    const create = async (kind: string, data: any) => {
      const response = await page.request.post(`${url}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const invite = await create("invitations", {
      email: "thread-member@example.test",
    });
    const joined = await (
      await member.request.post(`${url}/auth/join`, {
        data: {
          token: invite.token,
          name: "Thread participant",
          password: "isolated-thread-participant",
        },
      })
    ).json();
    const issue = await create("issues", {
      title: "Resolution review",
      teamId: initial.teams[0].id,
    });
    const root = await create("comments", {
      issueId: issue.id,
      body: "<p>Which approach should we use?</p>",
    });
    const earlier = await create("comments", {
      issueId: issue.id,
      parentId: root.id,
      body: "<p>First suggestion</p>",
    });
    const chosen = await create("comments", {
      issueId: issue.id,
      parentId: root.id,
      body: "<p>Agreed resolution</p>",
    });
    const comment = (id: string) => member.locator(`#comment-${id}`);
    const options = async (id: string) => {
      await comment(id).hover();
      await comment(id)
        .getByRole("button", { name: "Comment options", exact: true })
        .click();
    };
    await member.goto(`${url}/issues/${issue.id}`);
    await expect(comment(chosen.id)).toBeVisible();
    await options(chosen.id);
    await expect(
      member.getByRole("menuitem", { name: "Edit comment", exact: true }),
    ).toHaveCount(0);
    await member
      .getByRole("menuitem", { name: "Resolve thread", exact: true })
      .click();
    await expect
      .poll(async () => {
        const saved = (await state()).comments.find(
          (row: any) => row.id === root.id,
        );
        return {
          resolved: saved.resolved,
          reply: saved.resolutionCommentId,
          resolver: saved.resolvedById,
        };
      })
      .toEqual({ resolved: true, reply: chosen.id, resolver: joined.user.id });
    await expect(comment(earlier.id)).toHaveCount(0);
    await expect(
      comment(chosen.id).getByText("Resolution", { exact: true }),
    ).toBeVisible();
    await member.reload();
    await expect(comment(chosen.id)).toBeVisible();
    await expect(comment(earlier.id)).toHaveCount(0);
    await member
      .getByRole("button", { name: "Show 1 reply", exact: true })
      .click();
    await expect(comment(earlier.id)).toBeVisible();
    await member
      .getByRole("button", { name: "Hide replies", exact: true })
      .click();
    await options(chosen.id);
    await member
      .getByRole("menuitem", { name: "Reopen thread", exact: true })
      .click();
    await expect(comment(earlier.id)).toBeVisible();
    await expect
      .poll(
        async () =>
          (await state()).comments.find((row: any) => row.id === root.id)
            .resolved,
      )
      .toBe(false);
    await options(root.id);
    await member
      .getByRole("menuitem", { name: "Subscribe to thread", exact: true })
      .click();
    const memberState = async () =>
      (await member.request.get(`${url}/api/v1/state`)).json();
    await expect
      .poll(async () =>
        (await memberState()).subscriptions.filter(
          (row: any) =>
            row.entityKind === "comments" &&
            row.entityId === root.id &&
            !row.deletedAt,
        ),
      )
      .toHaveLength(1);
    const subscription = (await memberState()).subscriptions.find(
      (row: any) =>
        row.entityKind === "comments" &&
        row.entityId === root.id &&
        !row.deletedAt,
    );
    expect(subscription.issueId).toBeFalsy();
    await comment(chosen.id)
      .getByRole("button", { name: "Reply", exact: true })
      .click();
    await member
      .locator('.comment-composer [contenteditable="true"]')
      .fill("Reply targets the root thread");
    await member
      .getByRole("button", { name: "Submit comment", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).comments.find((row: any) =>
            row.body.includes("Reply targets the root thread"),
          )?.parentId,
      )
      .toBe(root.id);
    await options(root.id);
    await member
      .getByRole("menuitem", { name: "Unsubscribe from thread", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await memberState()).subscriptions.filter(
          (row: any) =>
            row.entityKind === "comments" &&
            row.entityId === root.id &&
            !row.deletedAt,
        ),
      )
      .toHaveLength(0);
    await options(chosen.id);
    await member
      .getByRole("menuitem", { name: "Resolve thread", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).comments.find((row: any) => row.id === root.id)
            .resolutionCommentId,
      )
      .toBe(chosen.id);
    const resolvedRoot = (await state()).comments.find(
      (row: any) => row.id === root.id,
    );
    await page.goto(`${url}/issues/${issue.id}`);
    const deleteRoot = async () => {
      const rootComment = page.locator(`#comment-${root.id}`);
      await rootComment.hover();
      await rootComment
        .getByRole("button", { name: "Comment options", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Delete comment", exact: true })
        .click();
    };
    const activeComments = async () =>
      (await state()).comments.filter(
        (row: any) => row.issueId === issue.id && !row.deletedAt,
      );
    await deleteRoot();
    const confirmation = page.getByRole("dialog", {
      name: "Delete this comment?",
      exact: true,
    });
    await expect(confirmation).toContainText("3 replies");
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect(await activeComments()).toHaveLength(4);
    await deleteRoot();
    await confirmation
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(confirmation).toHaveCount(0);
    await expect.poll(activeComments).toHaveLength(0);
    await expect(page.locator(".comment-thread")).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(activeComments).toHaveLength(4);
    const restoredRoot = (await state()).comments.find(
      (row: any) => row.id === root.id,
    );
    expect(restoredRoot.resolutionCommentId).toBe(chosen.id);
    expect(restoredRoot.resolvedAt).toBe(resolvedRoot.resolvedAt);
    await page.reload();
    await expect(
      page
        .locator(`#comment-${chosen.id}`)
        .getByText("Resolution", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(`#comment-${earlier.id}`)).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await app.close();
  }
});
