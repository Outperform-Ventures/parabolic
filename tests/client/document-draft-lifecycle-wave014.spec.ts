import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createApp } from "../../src/server/app";

async function fixture(page: any) {
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve(process.env.PARABOLIC_TEST_DIST ?? "dist"),
  });
  const { url } = await app.start();
  await page.request.post(`${url}/auth/setup`, {
    data: {
      name: "Document draft lifecycle",
      email: "document-draft-wave014@example.test",
      password: "document-draft-password",
    },
  });
  const state = await page.request.get(`${url}/api/v1/state`).then((response: any) => response.json());
  return { app, url, state, team: state.teams[0] };
}

test("untouched route-first document drafts are discarded by browser Back", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(`${f.url}/team/${f.team.id}/documents`);
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Document title", exact: true })).toBeFocused();
    const draft = f.app.repo
      .all("documents", f.state.workspaceId)
      .find((document: any) => document.isNewDocumentDraft);
    expect(draft).toBeTruthy();
    await page.goBack();
    await expect.poll(() => f.app.repo.raw("documents", draft!.id, true)?.deletedAt).toBeTruthy();
  } finally {
    await page.close();
    await f.app.close();
  }
});

test("a named route-first document is retained after browser Back", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(`${f.url}/team/${f.team.id}/documents`);
    await page.getByRole("button", { name: "New document", exact: true }).click();
    const title = page.getByRole("textbox", { name: "Document title", exact: true });
    await title.fill("Saved route-first document");
    await title.press("Tab");
    await expect
      .poll(() =>
        f.app.repo
          .all("documents", f.state.workspaceId)
          .find((document: any) => document.title === "Saved route-first document"),
      )
      .toBeTruthy();
    const document = f.app.repo
      .all("documents", f.state.workspaceId)
      .find((row: any) => row.title === "Saved route-first document")!;
    expect(document.isNewDocumentDraft).toBeFalsy();
    await page.goBack();
    await page.waitForTimeout(250);
    expect(f.app.repo.raw("documents", document.id)?.deletedAt).toBeFalsy();
  } finally {
    await page.close();
    await f.app.close();
  }
});
