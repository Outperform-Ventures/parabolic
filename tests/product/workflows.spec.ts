import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

let app: ReturnType<typeof createApp>;
let base: string;
let authState: Awaited<
  ReturnType<import("@playwright/test").APIRequestContext["storageState"]>
> | null = null;
test.beforeAll(async () => {
  app = createApp({
    databasePath: ":memory:",
    host: "127.0.0.1",
    port: 0,
    staticDir: resolve("dist"),
  });
  base = (await app.start()).url;
});
test.afterAll(async () => {
  await app.close();
});
test.beforeEach(async ({ page }) => {
  if (authState) {
    await page.context().addCookies(authState.cookies);
    return;
  }
  const setup = await page.request.post(base + "/auth/setup", {
    data: {
      name: "Product QA",
      email: "product-qa@example.test",
      password: "isolated-test-password",
      workspaceName: "Product QA",
    },
  });
  expect(setup.ok(), await setup.text()).toBeTruthy();
  authState = await page.request.storageState();
});
test("projects, milestones, documents, customer requests, archive, and scoped credentials persist through UI", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error("BROWSER", error.message);
  });
  const state = async () =>
    await (await page.request.get(`${base}/api/v1/state`)).json();
  await page.goto(`${base}/projects`);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Project name/).fill("Customer portal");
  await dialog
    .getByLabel("Summary", { exact: true })
    .fill("A measurable delivery plan");
  await dialog
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Customer portal",
  );
  await page
    .getByRole("button", { name: "Add milestone", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Private preview");
  await dialog
    .getByRole("button", { name: "Create milestone", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Private preview", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const data = await state();
      return data.milestones.some((m: any) => m.name === "Private preview");
    })
    .toBe(true);
  await page.getByRole("button", { name: "Target date", exact: true }).click();
  dialog = page.getByRole("dialog");
  await page.screenshot({ path: "artifacts/product-ui/target-date.png" });
  await dialog.getByRole("tab", { name: "Quarter", exact: true }).click();
  await dialog.getByRole("button", { name: "Q4 2027", exact: true }).click();
  await expect
    .poll(async () => {
      const data = await state();
      return data.projects.find((p: any) => p.name === "Customer portal")
        ?.targetDate;
    })
    .toBe("2027-12-31");
  await page.screenshot({ path: "artifacts/product-ui/project-overview.png" });
  await page.goto(`${base}/initiatives`);
  await page
    .getByRole("button", { name: "New initiative", exact: true })
    .first()
    .click();
  const initiativeForm = page.getByRole("form", {
    name: "New initiative",
    exact: true,
  });
  await initiativeForm
    .getByLabel("Name", { exact: true })
    .fill("Customer experience");
  await initiativeForm
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(/^Project/)
    .selectOption({ label: "Customer portal" });
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect
    .poll(async () => {
      const data = await state();
      const p = data.projects.find((p: any) => p.name === "Customer portal");
      return data.initiatives.find((i: any) => i.id === p?.initiativeId)?.name;
    })
    .toBe("Customer experience");
  await page
    .getByRole("button", { name: "Add sub-initiative", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Reduce support wait");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Reduce support wait/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/product-ui/initiative-overview.png",
  });
  await page.goto(`${base}/documents`);
  await page
    .getByRole("button", { name: "New document", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Title/).fill("Portal requirements");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Portal requirements",
  );
  await page
    .getByRole("textbox", {
      name: "Start writing, or type / for commands…",
      exact: true,
    })
    .fill("Customers can follow the status of their requests.");
  await expect
    .poll(async () => {
      const data = await state();
      return (
        data.documents.find((d: any) => d.title === "Portal requirements")
          ?.content || ""
      );
    })
    .toContain("Customers can follow");
  await page.reload();
  await expect(page.locator(".ProseMirror").first()).toContainText(
    "Customers can follow",
  );
  await page.screenshot({ path: "artifacts/product-ui/document.png" });
  await page
    .getByRole("textbox", {
      name: "Start writing, or type / for commands…",
      exact: true,
    })
    .fill("A second version with revised requirements.");
  await expect
    .poll(async () => {
      const data = await state();
      return (
        data.documents.find((d: any) => d.title === "Portal requirements")
          ?.content || ""
      );
    })
    .toContain("A second version");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.locator(".feature-history-version").first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore version", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await state();
      return (
        data.documents.find((d: any) => d.title === "Portal requirements")
          ?.content || ""
      );
    })
    .toContain("Customers can follow");
  await page.goto(`${base}/customers`);
  await page
    .getByRole("button", { name: "New customer", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Acme Studio");
  await dialog.getByLabel("Contact email").fill("team@acme.example");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acme Studio" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add request", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Title/).fill("Show request status");
  await dialog
    .getByRole("textbox", { name: "What does the customer need?", exact: true })
    .fill("We need visibility into work in progress.");
  await dialog
    .getByRole("button", { name: "Add request", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await state();
      const request = data.requests.find(
        (r: any) => r.title === "Show request status",
      );
      return !!data.issues.find(
        (i: any) =>
          i.id === request?.issueId && i.title === "Show request status",
      );
    })
    .toBe(true);
  await page.screenshot({ path: "artifacts/product-ui/customer.png" });
  await page.goto(`${base}/cycles`);
  await page
    .getByRole("button", { name: "New cycle", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Cycle name/).fill("Product iteration");
  await dialog
    .getByRole("button", { name: "Create cycle", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await state();
      return data.cycles.some((c: any) => c.name === "Product iteration");
    })
    .toBe(true);
  const cycle = (await state()).cycles.find(
    (c: any) => c.name === "Product iteration",
  );
  await page.goto(`${base}/cycles/${cycle.id}`);
  await page
    .getByRole("button", { name: "Add issues", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Show request status/).check();
  await dialog
    .getByRole("button", { name: "Add 1 issues", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await state();
      return data.issues.find((i: any) => i.title === "Show request status")
        ?.cycleId;
    })
    .toBe(cycle.id);
  await page.screenshot({ path: "artifacts/product-ui/cycle.png" });
  const project = (await state()).projects.find(
    (p: any) => p.name === "Customer portal",
  );
  await page.goto(`${base}/project/${project.id}`);
  await page
    .locator(".feature-header")
    .getByRole("button", { name: "More actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await expect
    .poll(
      async () =>
        !!(await state()).projects.find((p: any) => p.id === project.id)
          ?.archivedAt,
    )
    .toBe(true);
  await page.goto(`${base}/archive`);
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Customer portal" })
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        !!(await state()).projects.find((p: any) => p.id === project.id)
          ?.archivedAt,
    )
    .toBe(false);
  await page.request.delete(`${base}/api/v1/projects/${project.id}`);
  await page.goto(`${base}/archive`);
  await page
    .getByRole("button", { name: "Recently deleted", exact: true })
    .click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Customer portal" })
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        !!(await state()).projects.find((p: any) => p.id === project.id)
          ?.deletedAt,
    )
    .toBe(false);
  await page.goto(`${base}/settings/preferences`);
  await page
    .getByRole("switch", { name: "Reduce motion", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await state();
      return data.users.find((u: any) => u.email === "product-qa@example.test")
        ?.preferences?.reduceMotion;
    })
    .toBe(true);
  await page.screenshot({ path: "artifacts/product-ui/preferences.png" });
  await page.goto(`${base}/settings/api`);
  await page.getByRole("button", { name: "New API key", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Product read access");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  const credential = page.getByLabel("Credential", { exact: true });
  await expect(credential).toBeVisible();
  const token = await credential.inputValue();
  const read = await page.request.get(`${base}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(read.ok()).toBeTruthy();
  const write = await page.request.post(`${base}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Should be denied" },
  });
  expect(write.status()).toBe(403);
  expect(errors).toEqual([]);
});

test("direct request forms require login and bind intake to the signed-in requester", async ({
  page,
  browser,
}) => {
  page.setDefaultTimeout(10_000);
  await page.request.post(`${base}/auth/login`, {
    data: {
      email: "product-qa@example.test",
      password: "isolated-test-password",
    },
  });
  await page.goto(`${base}/asks`);
  await page
    .getByRole("button", { name: "New form", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Form name", { exact: true }).fill("Support intake");
  await dialog.getByRole("button", { name: "Add field", exact: true }).click();
  await dialog
    .getByLabel("Field 1 label", { exact: true })
    .fill("Business impact");
  await dialog
    .getByLabel("Field 1 type", { exact: true })
    .selectOption("textarea");
  await dialog.getByLabel("Required", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Create form", exact: true })
    .click();
  const state = async () =>
    await (await page.request.get(`${base}/api/v1/state`)).json();
  await expect
    .poll(async () => {
      const data = await state();
      return data.asksForms.some((f: any) => f.name === "Support intake");
    })
    .toBe(true);
  const form = (await state()).asksForms.find(
    (f: any) => f.name === "Support intake",
  );
  const anonymous = await browser.newContext();
  const requestPage = await anonymous.newPage();
  try {
    await requestPage.goto(`${base}/request/${form.id}`);
    await expect(
      requestPage.getByRole("heading", {
        name: "Log in to your workspace",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (
        await requestPage.request.get(`${base}/public/asks/${form.id}`)
      ).status(),
    ).toBe(401);
    await requestPage
      .getByLabel("Email", { exact: true })
      .fill("product-qa@example.test");
    await requestPage
      .getByLabel("Password", { exact: true })
      .fill("isolated-test-password");
    await requestPage
      .getByRole("button", { name: "Continue with email", exact: true })
      .click();
    await expect(
      requestPage.getByRole("heading", { name: "Support intake" }),
    ).toBeVisible();
    await requestPage
      .getByLabel("Title", { exact: true })
      .fill("Unable to view request history");
    await expect(requestPage.getByLabel("Email", { exact: true })).toHaveValue(
      "product-qa@example.test",
    );
    await expect(
      requestPage.getByLabel("Email", { exact: true }),
    ).toHaveAttribute("readonly", "");
    await requestPage
      .getByLabel("Description", { exact: true })
      .fill("The request history page is empty.");
    await requestPage
      .getByLabel("Business impact", { exact: true })
      .fill("Our support team cannot respond to customers.");
    await requestPage.screenshot({
      path: "artifacts/product-ui/public-request-form.png",
    });
    await requestPage
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    await expect(
      requestPage.getByRole("heading", { name: "Request received" }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const data = await state();
        const request = data.requests.find(
          (r: any) => r.title === "Unable to view request history",
        );
        return !!data.issues.find((i: any) => i.id === request?.issueId);
      })
      .toBe(true);
    const denied = await requestPage.request.get(`${base}/api/v1/state`);
    expect(denied.status()).toBe(200);
    const created = (await state()).requests.find(
      (r: any) => r.title === "Unable to view request history",
    );
    expect(created.requesterEmail).toBe("product-qa@example.test");
    await requestPage.screenshot({
      path: "artifacts/product-ui/public-request-receipt.png",
    });
  } finally {
    await anonymous.close();
  }
});

test("editor keyboard commands, mentions, tables, links and collapsible content survive persistence", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post(`${base}/auth/login`, {
    data: {
      email: "product-qa@example.test",
      password: "isolated-test-password",
    },
  });
  const response = await page.request.post(`${base}/api/v1/documents`, {
    data: { title: "Editor exercise", content: "", visibility: "workspace" },
  });
  const document = await response.json();
  await page.goto(`${base}/document/${document.id}`);
  const editable = page.getByRole("textbox", {
    name: "Start writing, or type / for commands…",
    exact: true,
  });
  const record = async () =>
    await (
      await page.request.get(`${base}/api/v1/documents/${document.id}`)
    ).json();
  await editable.fill("/heading 2");
  await expect(
    page.getByRole("option", { name: "Heading 2", exact: true }),
  ).toBeVisible();
  await editable.press("Enter");
  await page.keyboard.insertText("Requirements");
  await expect(editable.locator("h2")).toHaveText("Requirements");
  await editable.press("Enter");
  await page.keyboard.insertText("@Product QA");
  await page.getByRole("option", { name: /^Product QA/ }).click();
  await expect(editable.locator('[data-mention-kind="user"]')).toHaveText(
    "@Product QA",
  );
  await expect
    .poll(async () => {
      const d = await record();
      return d.mentionIds?.length || 0;
    })
    .toBe(1);
  await editable.press("Enter");
  await page.keyboard.insertText("/table");
  await editable.press("Enter");
  await expect(editable.locator("tr")).toHaveCount(3);
  await editable.locator("th").first().click();
  await page
    .getByRole("button", { name: "Table actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Add row below", exact: true })
    .click();
  await expect(editable.locator("tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Edit link", exact: true }).click();
  await page
    .getByLabel("Link URL", { exact: true })
    .fill("javascript:alert(1)");
  await page
    .getByRole("dialog", { name: "Edit link", exact: true })
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(
    page.getByText("Enter a valid web, email, telephone, or internal URL."),
  ).toBeVisible();
  await page
    .getByLabel("Link URL", { exact: true })
    .fill("https://example.com/requirements");
  await page
    .getByRole("dialog", { name: "Edit link", exact: true })
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(
    editable.locator('a[href="https://example.com/requirements"]'),
  ).toBeVisible();
  await editable.locator("p").last().click();
  await page.keyboard.insertText("Section notes");
  await editable
    .locator("p")
    .last()
    .evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      (element.closest('[contenteditable="true"]') as HTMLElement).focus();
      document.dispatchEvent(new Event("selectionchange"));
    });
  await page
    .getByRole("button", { name: "More formatting", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Collapsible section", exact: true })
    .click();
  await expect(editable.locator("details")).toBeVisible();
  await expect
    .poll(async () => {
      const d = await record();
      return d.content;
    })
    .toContain("<details");
  await editable.locator("summary").click();
  await expect(editable.locator("details")).not.toHaveAttribute("open", "");
  await expect
    .poll(async () => {
      const d = await record();
      return /<details[^>]*open/.test(d.content);
    })
    .toBe(false);
  await page.reload();
  await expect(page.locator(".rich-content").first().locator("h2")).toHaveText(
    "Requirements",
  );
  await expect(
    page.locator(".rich-content").first().locator("[data-mention-id]"),
  ).toHaveCount(1);
  await expect(page.locator(".rich-content").first().locator("tr")).toHaveCount(
    4,
  );
  await expect(
    page.locator(".rich-content").first().locator("details"),
  ).not.toHaveAttribute("open", "");
  const commentEditor = page.getByRole("textbox", {
    name: "Leave a comment…",
    exact: true,
  });
  await commentEditor.fill("Ready for review.");
  await commentEditor.press("Enter");
  await expect
    .poll(async () => {
      const state = await (
        await page.request.get(`${base}/api/v1/state`)
      ).json();
      return state.comments.some(
        (c: any) =>
          c.documentId === document.id && c.body.includes("Ready for review."),
      );
    })
    .toBe(true);
  await expect(commentEditor).toHaveText("");
  await page.screenshot({ path: "artifacts/product-ui/rich-editor.png" });
  expect(errors).toEqual([]);
});

test("Markdown paste, editable diagrams, date chips and emoji save as semantic content", async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post(`${base}/auth/login`, {
    data: {
      email: "product-qa@example.test",
      password: "isolated-test-password",
    },
  });
  const document = await (
    await page.request.post(`${base}/api/v1/documents`, {
      data: {
        title: "Rich format exercise",
        content: "",
        visibility: "workspace",
      },
    })
  ).json();
  const record = async () =>
    await (
      await page.request.get(`${base}/api/v1/documents/${document.id}`)
    ).json();
  await page.goto(`${base}/document/${document.id}`);
  const editable = page.getByRole("textbox", {
    name: "Start writing, or type / for commands…",
    exact: true,
  });
  await editable.click();
  const paste = async (text: string) => {
    await editable.evaluate((el, value) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", value);
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "clipboardData", { value: clipboardData });
      el.dispatchEvent(event);
    }, text);
  };
  await paste(
    "# Delivery plan\n\n**Customer feedback** informs the plan.\n\n- First preview\n- Gather feedback",
  );
  await expect(editable.locator("h1")).toHaveText("Delivery plan");
  await expect(editable.locator("strong")).toHaveText("Customer feedback");
  await expect(editable.locator("li")).toHaveCount(2);
  await editable.press("ControlOrMeta+End");
  await editable.press("ArrowDown");
  await editable.press("Enter");
  await editable.press("Enter");
  await paste("```mermaid\nflowchart LR\n  A[Request] --> B[Delivered]\n```");
  await expect(
    page.getByRole("img", { name: "Rendered Mermaid diagram" }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const d = await record();
      return d.content;
    })
    .toContain('data-type="mermaid"');
  expect((await record()).content).not.toContain("<svg");
  await page
    .locator(".editor-diagram")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByLabel("Mermaid source", { exact: true })
    .fill("flowchart LR\n  A[Request] --> B[Reviewed] --> C[Delivered]");
  await page.getByRole("button", { name: "Save diagram", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Rendered Mermaid diagram" }),
  ).toContainText("Reviewed");
  await editable.locator("p").last().click();
  await page.keyboard.insertText("@Oct 1 2027");
  await page.getByRole("option", { name: /Oct 1, 2027/ }).click();
  await expect(editable.locator('[data-date="2027-10-01"]')).toBeVisible();
  await editable.locator('[data-date="2027-10-01"]').click();
  await page
    .getByRole("dialog", { name: "Insert date" })
    .getByLabel("Choose date", { exact: true })
    .fill("2027-10-02");
  await page
    .getByRole("dialog", { name: "Insert date" })
    .getByRole("button", { name: "Insert date", exact: true })
    .click();
  await expect(editable.locator('[data-date="2027-10-02"]')).toBeVisible();
  await editable.press("End");
  await page.keyboard.insertText(" :rocket");
  await page.getByRole("option", { name: "🚀 :rocket:", exact: true }).click();
  await expect(editable).toContainText("🚀");
  await page.keyboard.insertText(" :100:");
  await expect(editable).toContainText("💯");
  await expect
    .poll(async () => {
      const d = await record();
      return d.content;
    })
    .toContain('data-date="2027-10-02"');
  await page.reload();
  await expect(
    page.getByRole("img", { name: "Rendered Mermaid diagram" }),
  ).toContainText("Reviewed");
  await expect(editable.locator('[data-date="2027-10-02"]')).toBeVisible();
  await expect(editable).toContainText("💯");
  await editable.press("ControlOrMeta+End");
  await editable.press("Enter");
  await page.keyboard.insertText("@Product QA");
  await page.getByRole("option", { name: /^Product QA/ }).click();
  await editable.locator('[data-mention-kind="user"]').click();
  await expect(
    page.getByRole("dialog", { name: "Mention details" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Mention details" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/product-ui/diagram-date-markdown.png",
  });
  expect(errors).toEqual([]);
});

test("timeline drag, resize, multiselection and keyboard zoom persist project dates", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000);
  const day = 86_400_000,
    now = Date.now(),
    iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  const first = await (
    await page.request.post(`${base}/api/v1/projects`, {
      data: {
        name: "Timeline first",
        startDate: iso(now),
        targetDate: iso(now + 7 * day),
      },
    })
  ).json();
  const second = await (
    await page.request.post(`${base}/api/v1/projects`, {
      data: {
        name: "Timeline second",
        startDate: iso(now + 3 * day),
        targetDate: iso(now + 10 * day),
      },
    })
  ).json();
  const record = async (id: string) =>
    await (await page.request.get(`${base}/api/v1/projects/${id}`)).json();
  await page.goto(`${base}/projects`);
  await page
    .getByRole("button", { name: "Project display options", exact: true })
    .click();
  await page.getByRole("button", { name: "Timeline layout" }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Timeline scale").selectOption("week");
  const firstBar = page.locator(`[data-project-id="${first.id}"]`),
    secondBar = page.locator(`[data-project-id="${second.id}"]`);
  await expect(firstBar).toBeVisible();
  await firstBar.click();
  await secondBar.click({ modifiers: ["Shift"] });
  await expect(firstBar).toHaveAttribute("aria-pressed", "true");
  await expect(secondBar).toHaveAttribute("aria-pressed", "true");
  const bounds = await firstBar.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2 + 45,
    bounds!.y + bounds!.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        Date.parse((await record(first.id)).startDate) -
        Date.parse(first.startDate),
    )
    .toBeGreaterThan(0);
  const movedFirst = await record(first.id);
  await expect
    .poll(
      async () =>
        Date.parse((await record(second.id)).startDate) -
        Date.parse(second.startDate),
    )
    .toBe(Date.parse(movedFirst.startDate) - Date.parse(first.startDate));
  await expect(firstBar).toHaveAttribute("aria-pressed", "true");
  await expect(secondBar).toHaveAttribute("aria-pressed", "true");
  const handle = firstBar.getByLabel("Resize end of Timeline first");
  const handleBounds = await handle.boundingBox();
  await page.mouse.move(
    handleBounds!.x + handleBounds!.width / 2,
    handleBounds!.y + handleBounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBounds!.x + handleBounds!.width / 2 + 35,
    handleBounds!.y + handleBounds!.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        Date.parse((await record(first.id)).targetDate) -
        Date.parse(movedFirst.targetDate),
    )
    .toBeGreaterThan(0);
  expect((await record(first.id)).startDate).toBe(movedFirst.startDate);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("workspace-command", {
        detail: { command: "timeline-zoom", value: "year" },
        cancelable: true,
      }),
    ),
  );
  await expect(page.getByLabel("Timeline scale")).toHaveValue("year");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("workspace-command", {
        detail: { command: "timeline-toggle-list" },
        cancelable: true,
      }),
    ),
  );
  await expect(page.locator(".feature-timeline")).toHaveClass(/hide-list/);
  await page.screenshot({ path: "artifacts/product-ui/timeline.png" });
});

test("dashboard filters, metric drilldown, widget editing and ordering persist", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000);
  const state = async () =>
    await (await page.request.get(`${base}/api/v1/state`)).json();
  const initial = await state();
  const teamId = initial.teams[0].id;
  for (const [title, estimate] of [
    ["Insight customer A", 3],
    ["Insight customer B", 5],
    ["Unrelated effort", 13],
  ])
    expect(
      (
        await page.request.post(`${base}/api/v1/issues`, {
          data: { title, estimate, teamId },
        })
      ).ok(),
    ).toBeTruthy();
  await page.goto(`${base}/dashboards`);
  await page
    .getByRole("button", { name: "New dashboard", exact: true })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Delivery metrics");
  await dialog
    .getByRole("button", { name: "Create dashboard", exact: true })
    .click();
  const global = page.locator(".feature-dashboard-filters");
  await global.getByRole("button", { name: "Add filter", exact: true }).click();
  await global
    .locator(".filter-condition select")
    .first()
    .selectOption("title");
  await global.locator(".filter-condition input").fill("Insight customer");
  await global
    .locator(".filter-condition select")
    .nth(1)
    .selectOption("contains");
  await page
    .getByRole("button", { name: "Add widget", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("Delivery effort");
  await dialog.getByLabel("Measure", { exact: true }).selectOption("Effort");
  await dialog
    .getByLabel("Insight display", { exact: true })
    .selectOption("Metric");
  await dialog
    .getByRole("button", { name: "Add insight", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Explore Effort", exact: true }),
  ).toContainText("8");
  await page
    .getByRole("button", { name: "Explore Effort", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Insight customer A");
  await expect(page.getByRole("dialog")).toContainText("Insight customer B");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplicate Delivery effort", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Delivery effort copy", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("Large effort");
  await dialog.getByRole("button", { name: "Add filter", exact: true }).click();
  await dialog
    .locator(".filter-condition select")
    .first()
    .selectOption("estimate");
  await dialog.locator(".filter-condition select").nth(1).selectOption("gte");
  await dialog.locator(".filter-condition input").fill("5");
  await dialog
    .getByRole("button", { name: "Save insight", exact: true })
    .click();
  const large = page.locator(".feature-chart-card").filter({
    has: page.getByRole("heading", { name: "Large effort", exact: true }),
  });
  await expect(
    large.getByRole("button", { name: "Explore Effort" }),
  ).toContainText("5");
  await page
    .getByRole("button", { name: "Move Large effort earlier", exact: true })
    .click();
  await expect(
    page
      .locator(".feature-dashboard-grid .feature-chart-card")
      .first()
      .getByRole("heading"),
  ).toHaveText("Large effort");
  await expect
    .poll(async () => {
      const data = await state();
      return data.dashboards.find((d: any) => d.name === "Delivery metrics")
        ?.widgets?.[0]?.name;
    })
    .toBe("Large effort");
  await page.reload();
  await expect(
    page
      .locator(".feature-dashboard-grid .feature-chart-card")
      .first()
      .getByRole("heading"),
  ).toHaveText("Large effort");
  await expect(
    page
      .locator(".feature-chart-card")
      .first()
      .getByRole("button", { name: "Explore Effort" }),
  ).toContainText("5");
  await page.screenshot({ path: "artifacts/product-ui/dashboard.png" });
  await page.goto(`${base}/insights`);
  await page.getByLabel("Measure", { exact: true }).selectOption("Effort");
  await page.getByLabel("Slice", { exact: true }).selectOption("Status");
  await page.getByLabel("Segment", { exact: true }).selectOption("Priority");
  await expect(page.locator(".feature-insight-bars")).toBeVisible();
  await page.screenshot({ path: "artifacts/product-ui/insights.png" });
});

test("project templates create milestones and nested issues through the native inline canvas", async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(10_000);
  const state = async () =>
    await (await page.request.get(`${base}/api/v1/state`)).json();
  await page.goto(`${base}/settings/project-templates`);
  await page.getByRole("button", { name: "New template", exact: true }).click();
  let dialog = page.getByRole("region", {
    name: "New project template",
    exact: true,
  });
  await dialog
    .getByLabel("Template name", { exact: true })
    .fill("Repeatable launch");
  await dialog
    .getByLabel("Template default title", { exact: true })
    .fill("Monthly launch");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByLabel("Milestone name", { exact: true }).fill("Preview");
  await dialog
    .getByRole("button", { name: "Add milestone", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Add issue", exact: true })
    .first()
    .click();
  await dialog
    .getByLabel("Issue title", { exact: true })
    .fill("Launch checklist");
  await dialog
    .getByRole("button", { name: "Add issue", exact: true })
    .last()
    .click();
  await dialog
    .getByRole("button", { name: "Open sub-issue menu", exact: true })
    .click();
  await dialog
    .getByRole("menuitem", { name: "Add sub-issue", exact: true })
    .click();
  await dialog.getByLabel("Issue title", { exact: true }).fill("Smoke test");
  await dialog
    .getByRole("button", { name: "Add issue", exact: true })
    .last()
    .click();
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect
    .poll(async () => {
      const data = await state();
      return data.templates.find((t: any) => t.name === "Repeatable launch")
        ?.projectPlan?.issues?.length;
    })
    .toBe(2);
  await page.goto(`${base}/projects?new=1`);
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Template", { exact: true })
    .selectOption({ label: "Repeatable launch" });
  await expect(dialog.getByLabel("Project name", { exact: true })).toHaveValue(
    "Monthly launch",
  );
  await expect(dialog).toContainText("1 milestones · 2 issues · 0 documents");
  await dialog
    .getByLabel("Project name", { exact: true })
    .fill("January launch");
  await dialog.getByLabel("Start date", { exact: true }).fill("2027-01-10");
  await page.screenshot({
    path: "artifacts/product-ui/project-template-preview.png",
  });
  await dialog
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await state();
      const project = data.projects.find(
        (p: any) => p.name === "January launch",
      );
      return data.issues.filter((i: any) => i.projectId === project?.id).length;
    })
    .toBe(2);
  const saved = await state(),
    project = saved.projects.find((p: any) => p.name === "January launch"),
    milestone = saved.milestones.find((m: any) => m.projectId === project.id),
    parent = saved.issues.find(
      (i: any) => i.projectId === project.id && i.title === "Launch checklist",
    ),
    child = saved.issues.find(
      (i: any) => i.projectId === project.id && i.title === "Smoke test",
    );
  expect(milestone.name).toBe("Preview");
  expect(child.parentId).toBe(parent.id);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/product-ui/project-template-created.png",
  });
});

test("team project views stay scoped and project boards update canonical status", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width: 1900, height: 900 });
  const state = async () =>
    await (await page.request.get(`${base}/api/v1/state`)).json();
  const initial = await state(),
    team = initial.teams[0];
  const other = await (
    await page.request.post(`${base}/api/v1/teams`, {
      data: { name: "Other product team", key: "OTH" },
    })
  ).json();
  const owned = await (
    await page.request.post(`${base}/api/v1/projects`, {
      data: {
        name: "Scoped project",
        teamId: team.id,
        teamIds: [team.id],
        status: "planned",
      },
    })
  ).json();
  await page.request.post(`${base}/api/v1/projects`, {
    data: {
      name: "Other scoped project",
      teamId: other.id,
      teamIds: [other.id],
      status: "planned",
    },
  });
  await page.goto(`${base}/team/${team.id}/projects`);
  await expect(
    page.getByRole("cell", { name: "Scoped project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Other scoped project", exact: true }),
  ).toHaveCount(0);
  await page.goto(`${base}/team/${team.id}/views`);
  await page
    .getByRole("button", { name: "Create new view", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Project delivery board");
  await dialog.getByLabel("Content", { exact: true }).selectOption("projects");
  await dialog.getByLabel("Layout", { exact: true }).selectOption("Board");
  await dialog
    .getByRole("button", { name: "Create view", exact: true })
    .click();
  await expect(
    page.getByRole("link").filter({
      has: page.getByRole("checkbox", {
        name: "Select project Scoped project",
        exact: true,
      }),
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Other scoped project/ }),
  ).toHaveCount(0);
  const card = page
      .locator(".feature-board-card")
      .filter({ hasText: "Scoped project" }),
    completed = page
      .locator(".feature-board-column")
      .filter({ has: page.getByRole("heading", { name: /^Completed/ }) });
  await card.dragTo(completed);
  await expect
    .poll(async () => {
      const data = await state();
      return data.projects.find((p: any) => p.id === owned.id)?.status;
    })
    .toBe("completed");
  await page.reload();
  await expect(completed.locator(".feature-board-card")).toContainText(
    "Scoped project",
  );
});

test("custom project statuses and project display settings apply to persisted work", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000);
  const state = async () =>
    await (await page.request.get(`${base}/api/v1/state`)).json();
  await page.goto(`${base}/settings/project-statuses`);
  await page
    .getByRole("button", { name: "Create new project status", exact: true })
    .nth(2)
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("In review");
  await dialog
    .getByLabel("Description", { exact: true })
    .fill("Stakeholders are reviewing the project.");
  await expect(dialog.getByLabel("Category", { exact: true })).toHaveValue(
    "started",
  );
  await dialog.getByLabel("Color", { exact: true }).fill("#a386ce");
  await dialog
    .getByRole("button", { name: "Create status", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await state();
      return data.workspaces.some((w: any) =>
        w.projectStatuses?.some((s: any) => s.name === "In review"),
      );
    })
    .toBe(true);
  const initial = await state(),
    status = initial.workspaces
      .flatMap((w: any) => w.projectStatuses || [])
      .find((s: any) => s.name === "In review");
  const project = await (
    await page.request.post(`${base}/api/v1/projects`, {
      data: {
        name: "Review ready project",
        teamId: initial.teams[0].id,
        status: "planned",
      },
    })
  ).json();
  await page.goto(`${base}/project/${project.id}`);
  await page
    .getByRole("complementary", { name: "Project details" })
    .getByLabel("Status", { exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Change Status" })
    .getByRole("option", { name: "In review", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await state();
      return data.projects.find((p: any) => p.id === project.id)?.status;
    })
    .toBe(status.id);
  await page.goto(`${base}/projects`);
  await page
    .getByRole("button", { name: "Filter projects", exact: true })
    .click();
  await page.getByRole("button", { name: "Add filter", exact: true }).click();
  await page
    .getByLabel("Project filter 1 property", { exact: true })
    .selectOption("status");
  await page
    .getByLabel("Project filter 1 value", { exact: true })
    .selectOption(status.id);
  await page
    .getByRole("button", { name: "Filter projects", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Review ready project", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Project display options", exact: true })
    .click();
  await page
    .getByLabel("Project grouping", { exact: true })
    .selectOption("status");
  await page
    .getByLabel("Project ordering", { exact: true })
    .selectOption("name");
  await page
    .getByLabel("Project order direction", { exact: true })
    .selectOption("desc");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", {
      name: "Toggle In review projects",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Toggle In review projects",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Project display options", exact: true })
    .click();
  await expect(
    page.getByLabel("Project grouping", { exact: true }),
  ).toHaveValue("status");
  await expect(
    page.getByLabel("Project order direction", { exact: true }),
  ).toHaveValue("desc");
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: "artifacts/product-ui/project-custom-statuses.png",
  });
});

test("editor attachments preserve bytes and inherit document and project access", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(10_000);
  const invitation = await (
    await page.request.post(`${base}/api/v1/invitations`, {
      data: { email: "attachment-reader@example.test", role: "member" },
    })
  ).json();
  const reader = await browser.newContext();
  const anonymous = await browser.newContext();
  try {
    expect(
      (
        await reader.request.post(`${base}/auth/join`, {
          data: {
            token: invitation.token,
            name: "Attachment reader",
            password: "attachment-reader-password",
          },
        })
      ).ok(),
    ).toBeTruthy();
    const cases = [
      {
        kind: "documents",
        path: "document",
        field: "content",
        placeholder: "Start writing, or type / for commands…",
        data: {
          title: "Attachment document",
          content: "",
          visibility: "workspace",
        },
      },
      {
        kind: "projects",
        path: "project",
        field: "description",
        placeholder: "Add description…",
        data: { name: "Attachment project", description: "" },
      },
    ];
    for (const fixture of cases) {
      const entity = await (
        await page.request.post(`${base}/api/v1/${fixture.kind}`, {
          data: fixture.data,
        })
      ).json();
      await page.goto(`${base}/${fixture.path}/${entity.id}`);
      const editable = page.getByRole("textbox", {
        name: fixture.placeholder,
        exact: true,
      });
      await expect(editable).toBeVisible();
      const bytes = Buffer.from([
        0, 1, 2, 13, 10, 45, 45, 255, 254, 128, 65, 66, 67,
      ]);
      const response = page.waitForResponse(
        (r) =>
          r.url() === `${base}/api/v1/attachments` &&
          r.request().method() === "POST",
      );
      await page
        .locator(".rich-editor")
        .filter({ has: editable })
        .locator("input[type=file]")
        .setInputFiles({
          name: `${fixture.kind}-sample.bin`,
          mimeType: "application/octet-stream",
          buffer: bytes,
        });
      const upload = await response;
      expect(upload.status()).toBe(201);
      const attachment = await upload.json();
      expect(attachment.size).toBe(bytes.length);
      await expect(editable.locator(`a[href="${attachment.url}"]`)).toHaveText(
        `${fixture.kind}-sample.bin`,
      );
      const download = await reader.request.get(`${base}${attachment.url}`);
      expect(download.status()).toBe(200);
      expect(await download.body()).toEqual(bytes);
      expect(
        (await anonymous.request.get(`${base}${attachment.url}`)).status(),
      ).toBe(401);
      await expect
        .poll(async () => {
          const stored = await (
            await page.request.get(
              `${base}/api/v1/${fixture.kind}/${entity.id}`,
            )
          ).json();
          return stored[fixture.field];
        })
        .toContain(attachment.url);
      await page.reload();
      await expect(
        editable.locator(`a[href="${attachment.url}"]`),
      ).toBeVisible();
    }
  } finally {
    await reader.close();
    await anonymous.close();
  }
});

test("code languages, syntax highlighting, image sizing and attachment previews survive reload", async ({
  page,
}) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const document = await (
    await page.request.post(`${base}/api/v1/documents`, {
      data: {
        title: "Code and images",
        content:
          '<pre><code class="language-javascript">const answer = 42;\nconsole.log(answer);</code></pre><p>Example image</p>',
        visibility: "workspace",
      },
    })
  ).json();
  const record = async () =>
    await (
      await page.request.get(`${base}/api/v1/documents/${document.id}`)
    ).json();
  await page.goto(`${base}/document/${document.id}`);
  const editable = page.getByRole("textbox", {
    name: "Start writing, or type / for commands…",
    exact: true,
  });
  await expect(page.getByLabel("Code language", { exact: true })).toHaveValue(
    "javascript",
  );
  await expect(editable.locator(".hljs-keyword")).toHaveText("const");
  await page
    .getByLabel("Code language", { exact: true })
    .selectOption("typescript");
  await expect
    .poll(async () => (await record()).content)
    .toContain("language-typescript");
  await page
    .getByRole("button", { name: "Wrap code lines", exact: true })
    .click();
  await expect(page.locator(".editor-code-block")).toHaveClass(/wrapped/);
  await editable.locator("p").last().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 160;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#7775df";
    context.fillRect(0, 0, 320, 160);
    context.fillStyle = "#e9e8ff";
    context.fillRect(30, 30, 260, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const upload = page
    .locator(".rich-editor")
    .filter({ has: editable })
    .locator("input[type=file]");
  await upload.setInputFiles({
    name: "Diagram example.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  const img = editable.getByRole("img", {
    name: "Diagram example.png",
    exact: true,
  });
  await expect(img).toBeVisible();
  await img.click();
  await page.getByLabel("Image width", { exact: true }).fill("240");
  await page.getByLabel("Image width", { exact: true }).press("Enter");
  await expect
    .poll(async () => (await record()).content)
    .toContain('width="240"');
  await expect
    .poll(async () => (await record()).content)
    .toContain('height="120"');
  const handle = editable.locator('[data-resize-handle="bottom-right"]');
  await handle.scrollIntoViewIfNeeded();
  const bounds = await handle.boundingBox();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2 + 40,
    bounds!.y + bounds!.height / 2 + 20,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number((await record()).content.match(/width="(\d+)"/)?.[1] || 0),
    )
    .toBeGreaterThan(240);
  const resized = (await record()).content.match(/width="(\d+)"/)![1];
  await img.dblclick();
  let preview = page.getByRole("dialog", {
    name: "Preview Diagram example.png",
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(
    preview.getByRole("img", { name: "Diagram example.png" }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    preview.getByRole("button", { name: "Fit image", exact: true }),
  ).toHaveText("125%");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await upload.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Preview keeps <script> literal and preserves text.\nNext line.",
    ),
  });
  const file = editable.getByRole("link", { name: "notes.txt", exact: true });
  await file.click();
  preview = page.getByRole("dialog", {
    name: "Preview notes.txt",
    exact: true,
  });
  await expect(preview.locator("pre")).toContainText(
    "Preview keeps <script> literal",
  );
  await expect(
    preview.getByRole("link", { name: "Download attachment", exact: true }),
  ).toHaveAttribute("download", "notes.txt");
  await page.screenshot({
    path: "artifacts/product-ui/attachment-preview.png",
  });
  await preview
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await expect
    .poll(async () => (await record()).content)
    .toContain("notes.txt");
  await page.reload();
  await expect(editable).toBeVisible();
  await expect(page.getByLabel("Code language", { exact: true })).toHaveValue(
    "typescript",
  );
  await expect
    .poll(async () => Math.round((await img.boundingBox())?.width || 0))
    .toBe(Number(resized));
  expect((await record()).content).toContain(`width="${resized}"`);
  await expect(editable.locator(".hljs-keyword")).toHaveText("const");
  await page.screenshot({ path: "artifacts/product-ui/code-image-editor.png" });
  expect(errors).toEqual([]);
});

test("inline comments stay attached through edits, retain drafts and resolve their thread", async ({
  page,
}) => {
  test.setTimeout(60_000);
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const document = await (
    await page.request.post(`${base}/api/v1/documents`, {
      data: {
        title: "Inline review",
        content: "<p>Discuss the launch scope with everyone.</p>",
        visibility: "workspace",
      },
    })
  ).json();
  const comments = async () => {
    const state = await (await page.request.get(`${base}/api/v1/state`)).json();
    return state.comments.filter((c: any) => c.documentId === document.id);
  };
  await page.goto(`${base}/document/${document.id}`);
  const editable = page.getByRole("textbox", {
    name: "Start writing, or type / for commands…",
    exact: true,
  });
  await expect(editable).toBeVisible();
  const select = async () => {
    await editable
      .locator("p")
      .first()
      .evaluate((el) => {
        const node = el.firstChild!;
        const start = node.textContent!.indexOf("launch scope");
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + "launch scope".length);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        (el.closest("[contenteditable=true]") as HTMLElement).focus();
        document.dispatchEvent(new Event("selectionchange"));
      });
  };
  await select();
  await page
    .getByRole("button", { name: "Comment on selection", exact: true })
    .click();
  let panel = page.getByRole("dialog", {
    name: "New inline comment",
    exact: true,
  });
  let body = panel.getByRole("textbox", {
    name: "Comment on selected text…",
    exact: true,
  });
  await body.fill("Keep this draft");
  await panel
    .getByRole("button", { name: "Close comment", exact: true })
    .click();
  await select();
  await page
    .getByRole("button", { name: "Comment on selection", exact: true })
    .click();
  panel = page.getByRole("dialog", { name: "New inline comment", exact: true });
  await expect(
    panel.getByRole("textbox", { name: "Comment on selected text…" }),
  ).toHaveText("Keep this draft");
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await select();
  await page.keyboard.press("ControlOrMeta+Alt+m");
  panel = page.getByRole("dialog", { name: "New inline comment", exact: true });
  body = panel.getByRole("textbox", {
    name: "Comment on selected text…",
    exact: true,
  });
  await expect(body).toHaveText("");
  await body.fill("Please confirm this scope.");
  await body.press("Enter");
  await expect
    .poll(async () => (await comments()).filter((c: any) => c.anchor).length)
    .toBe(1);
  const original = (await comments()).find((c: any) => c.anchor);
  expect(original.anchor.quote).toBe("launch scope");
  await page
    .getByRole("dialog", { name: "Document comment thread" })
    .getByRole("button", { name: "Close comment", exact: true })
    .click();
  const highlight = editable.locator(
    `[data-inline-comment-id="${original.id}"]`,
  );
  await expect(highlight).toHaveText("launch scope");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.insertText("Updated: ");
  await expect(editable).toContainText(
    "Updated: Discuss the launch scope with everyone.",
  );
  await expect(highlight).toHaveText("launch scope");
  await page.reload();
  await expect(highlight).toHaveText("launch scope");
  await highlight.click();
  panel = page.getByRole("dialog", {
    name: "Document comment thread",
    exact: true,
  });
  await expect(panel).toContainText("Please confirm this scope.");
  await panel
    .getByRole("textbox", { name: "Reply to thread…", exact: true })
    .fill("Confirmed by the team.");
  await panel.getByRole("button", { name: "Reply", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await comments()).filter((c: any) => c.parentId === original.id)
          .length,
    )
    .toBe(1);
  await page.screenshot({
    path: "artifacts/product-ui/inline-document-comment.png",
  });
  await panel
    .getByRole("button", { name: "Resolve thread", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await comments()).find((c: any) => c.id === original.id)?.resolved,
    )
    .toBe(true);
  await expect(highlight).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show resolved", exact: true })
    .click();
  await page.getByRole("button", { name: "launch scope", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Document comment thread" })
    .getByRole("button", { name: "Reopen thread", exact: true })
    .click();
  await expect(highlight).toHaveText("launch scope");
  expect(errors).toEqual([]);
});

test("project customer requests create from any tab and retain project linkage", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000);
  const customer = await (
    await page.request.post(`${base}/api/v1/customers`, {
      data: { name: "Project stakeholder" },
    })
  ).json();
  const project = await (
    await page.request.post(`${base}/api/v1/projects`, {
      data: { name: "Requested customer outcome" },
    })
  ).json();
  await page.goto(`${base}/project/${project.id}`);
  await expect(
    page.getByRole("button", { name: "Customer requests", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Customer request", exact: true })
    .click();
  let dialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: "New customer request",
      exact: true,
    }),
  });
  await dialog
    .getByLabel("Customer", { exact: true })
    .selectOption(customer.id);
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Track progress on the outcome");
  await dialog
    .getByLabel("Important to this customer", { exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Add request", exact: true })
    .click();
  await expect
    .poll(async () => {
      const state = await (
        await page.request.get(`${base}/api/v1/state`)
      ).json();
      return state.requests.find(
        (r: any) => r.title === "Track progress on the outcome",
      )?.projectId;
    })
    .toBe(project.id);
  await page
    .getByRole("button", { name: "Customer requests", exact: true })
    .click();
  await expect(page.locator(".entity-customer-requests")).toContainText(
    "Track progress on the outcome",
  );
  await expect(page.locator(".entity-customer-requests")).toContainText(
    "Project stakeholder",
  );
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/overview$/);
  await expect(page.locator(".entity-customer-requests")).toHaveCount(0);
  await page.keyboard.press(
    (await page.evaluate(() => /Mac/.test(navigator.platform)))
      ? "Control+r"
      : "Control+Alt+r",
  );
  dialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: "New customer request",
      exact: true,
    }),
  });
  await expect(dialog).toHaveCount(1);
  await expect(
    dialog.getByLabel("Link to project", { exact: true }),
  ).toHaveValue(project.id);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Customer requests", exact: true })
    .click();
  await page.keyboard.press(
    (await page.evaluate(() => /Mac/.test(navigator.platform)))
      ? "Control+r"
      : "Control+Alt+r",
  );
  await expect(
    page.getByRole("dialog").filter({
      has: page.getByRole("heading", {
        name: "New customer request",
        exact: true,
      }),
    }),
  ).toHaveCount(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".entity-customer-requests")).toContainText(
    "Track progress on the outcome",
  );
});

test("dashboard pointer and keyboard placement, resize and narrow layouts persist without losing charts", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const initial = await (await page.request.get(`${base}/api/v1/state`)).json();
  await page.request.post(`${base}/api/v1/issues`, {
    data: { title: "Dashboard layout metric", teamId: initial.teams[0].id },
  });
  const widgets = [
    {
      id: crypto.randomUUID(),
      name: "Layout first",
      measure: "Issue count",
      chartType: "Metric",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    },
    {
      id: crypto.randomUUID(),
      name: "Layout second",
      measure: "Effort",
      chartType: "Metric",
      layout: { x: 6, y: 0, w: 6, h: 4 },
    },
  ];
  const dashboard = await (
    await page.request.post(`${base}/api/v1/dashboards`, {
      data: { name: "Gesture dashboard", widgets },
    })
  ).json();
  const current = async () =>
    (
      await (
        await page.request.get(`${base}/api/v1/dashboards/${dashboard.id}`)
      ).json()
    ).widgets;
  await page.goto(`${base}/dashboards/${dashboard.id}`);
  const grid = page.locator(".feature-dashboard-layout"),
    first = page.locator(`[data-widget-id="${widgets[0].id}"]`);
  await expect(first).toBeVisible();
  const bounds = await grid.boundingBox();
  if (!bounds) throw Error("Grid is not visible");
  const step = (bounds.width + 12) / 12;
  const move = page.getByRole("button", {
    name: "Move Layout first",
    exact: true,
  });
  await move.hover();
  let handle = await move.boundingBox();
  if (!handle) throw Error("Move handle is not visible");
  await page.mouse.move(handle.x + 10, handle.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle.x + 10 + step * 6, handle.y + 10, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const w = (await current()).find((w: any) => w.id === widgets[0].id);
      return [w.layout.x, w.layout.y];
    })
    .toEqual([6, 0]);
  await expect
    .poll(
      async () =>
        (await current()).find((w: any) => w.id === widgets[1].id).layout.y,
    )
    .toBe(4);
  const resize = page.getByRole("button", {
    name: "Resize Layout first",
    exact: true,
  });
  await resize.hover();
  handle = await resize.boundingBox();
  if (!handle) throw Error("Resize handle is not visible");
  await page.mouse.move(handle.x + 10, handle.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle.x + 10 - step * 2, handle.y + 10 + 76, {
    steps: 10,
  });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const w = (await current()).find((w: any) => w.id === widgets[0].id);
      return [w.layout.w, w.layout.h];
    })
    .toEqual([4, 5]);
  await resize.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(
      async () =>
        (await current()).find((w: any) => w.id === widgets[0].id).layout.w,
    )
    .toBe(5);
  await move.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(
      async () =>
        (await current()).find((w: any) => w.id === widgets[0].id).layout.x,
    )
    .toBe(5);
  const saved = await current();
  await page.setViewportSize({ width: 720, height: 991 });
  await expect(first).toHaveAttribute("data-grid-width", "12");
  await expect(first).toHaveAttribute("data-grid-x", "0");
  expect(await current()).toEqual(saved);
  await page.setViewportSize({ width: 1777, height: 991 });
  await expect(first).toHaveAttribute("data-grid-width", "5");
  await expect(first).toHaveAttribute("data-grid-x", "5");
  await move.hover();
  handle = await move.boundingBox();
  if (!handle) throw Error("Missing move handle");
  await page.mouse.move(handle.x + 10, handle.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle.x + 10 - step * 2, handle.y + 10, { steps: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await current()).toEqual(saved);
  await page.reload();
  await expect(first).toHaveAttribute("data-grid-width", "5");
  await expect(first).toHaveAttribute("data-grid-x", "5");
  await expect(
    first.getByRole("button", { name: "Explore Issue count", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/product-ui/dashboard-layout.png" });
});

test("scatter plots include every issue beyond 1,000 and retain keyboard exploration and virtual drilldown", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const initial = await (await page.request.get(`${base}/api/v1/state`)).json(),
    actor = {
      userId: initial.user.id,
      workspaceId: initial.workspaceId,
      role: "owner",
      scopes: ["read", "write", "admin"],
    };
  app.repo.transaction(() => {
    for (let i = 0; i < 1205; i++)
      app.repo.create(actor, "issues", {
        title: `Scatter completeness ${i + 1}`,
        teamId: initial.teams[0].id,
        estimate: i % 13,
      });
  });
  const config = {
    measure: "Effort",
    group: "Team",
    segment: "Priority",
    chartType: "Scatter",
    filters: {
      conditions: [
        {
          field: "title",
          operator: "contains",
          value: "Scatter completeness ",
        },
      ],
      match: "all",
    },
  };
  await page.goto(
    `${base}/insights?config=${encodeURIComponent(JSON.stringify(config))}`,
  );
  const canvas = page.getByRole("img", {
    name: /Issue scatterplot, 1205 plotted issues/,
  });
  await expect(canvas).toHaveAttribute("data-point-count", "1205");
  await page
    .getByRole("button", { name: "Explore all 1,205 issues", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator(".feature-insight-drilldown")).toHaveAttribute(
    "data-issue-count",
    "1205",
  );
  expect(
    await dialog.locator(".feature-insight-drilldown a").count(),
  ).toBeLessThan(40);
  await dialog
    .locator(".feature-insight-drilldown")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    dialog.locator(".feature-insight-drilldown a").last(),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Zoom to 50th percentile", exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-point-count")),
    )
    .toBeLessThan(1205);
  await page
    .getByRole("button", { name: "Reset percentile zoom", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-point-count", "1205");
  await page.screenshot({
    path: "artifacts/product-ui/scatter-all-points.png",
  });
  await canvas.focus();
  await page.keyboard.press("End");
  await expect(page.locator(".feature-insight-tooltip")).toContainText(
    "Scatter completeness",
  );
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
    /Scatter completeness/,
  );
});

test("timeline dependency gestures enforce cycles, move planned chains, reveal conflicts and support continuous pan and anchored zoom", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const day = 86400000,
    today = new Date().toISOString().slice(0, 10),
    baseDay = Date.parse(today),
    date = (offset: number) =>
      new Date(baseDay + offset * day).toISOString().slice(0, 10),
    create = async (data: any) =>
      (await page.request.post(`${base}/api/v1/projects`, { data })).json();
  const a = await create({
      name: "Dependency gesture Alpha",
      startDate: date(2),
      targetDate: date(4),
      status: "started",
    }),
    b = await create({
      name: "Dependency gesture Beta",
      startDate: date(6),
      targetDate: date(8),
      status: "planned",
    }),
    c = await create({
      name: "Dependency gesture Gamma",
      startDate: date(10),
      targetDate: date(12),
      status: "started",
    });
  const current = async (id: string) =>
    await (await page.request.get(`${base}/api/v1/projects/${id}`)).json();
  await page.goto(`${base}/projects`);
  await page
    .getByRole("button", { name: "Project display options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Timeline layout", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Timeline scale", { exact: true }).selectOption("week");
  const timeline = page.locator(".feature-timeline"),
    bar = (id: string) =>
      page.locator(`.feature-timeline-bar[data-project-id="${id}"]`);
  const connect = async (source: any, target: any) => {
    await bar(source.id).hover();
    const handle = page.getByRole("button", {
        name: `Create dependency from ${source.name}`,
        exact: true,
      }),
      from = await handle.boundingBox(),
      to = await bar(target.id).boundingBox();
    if (!from || !to) throw Error("Dependency handles are offscreen");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 10,
    });
    await page.mouse.up();
  };
  await connect(a, b);
  await expect
    .poll(async () => (await current(b.id)).dependencyIds)
    .toEqual([a.id]);
  await connect(b, c);
  await expect
    .poll(async () => (await current(c.id)).dependencyIds)
    .toEqual([b.id]);
  await connect(c, a);
  await expect(
    page.getByText("This dependency would create a cycle.", { exact: true }),
  ).toBeVisible();
  expect((await current(a.id)).dependencyIds || []).toEqual([]);
  const drag = async (project: any, days: number, modifier?: string) => {
    const from = await bar(project.id).boundingBox(),
      track = await bar(project.id).locator("..").boundingBox();
    if (!from || !track) throw Error("Project is offscreen");
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      from.x + from.width / 2 + (days / 28) * track.width,
      from.y + from.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
    if (modifier) await page.keyboard.up(modifier);
  };
  await drag(a, 2);
  await expect.poll(async () => (await current(a.id)).startDate).toBe(date(4));
  await expect.poll(async () => (await current(b.id)).startDate).toBe(date(8));
  expect((await current(c.id)).startDate).toBe(date(10));
  await drag(a, 2, "ControlOrMeta");
  await expect.poll(async () => (await current(a.id)).startDate).toBe(date(6));
  expect((await current(b.id)).startDate).toBe(date(8));
  await drag(a, 2, "Shift");
  await expect.poll(async () => (await current(a.id)).startDate).toBe(date(8));
  await expect.poll(async () => (await current(b.id)).startDate).toBe(date(10));
  await expect.poll(async () => (await current(c.id)).startDate).toBe(date(12));
  await drag(a, 5, "ControlOrMeta");
  await expect.poll(async () => (await current(a.id)).startDate).toBe(date(13));
  const edge = page.locator(
    `[data-dependency-from="${a.id}"][data-dependency-to="${b.id}"]`,
  );
  await expect(edge).toHaveAttribute("data-violated", "true");
  await edge.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog", {
    name: "Project dependency",
    exact: true,
  });
  await expect(menu).toContainText("Dates conflict");
  await menu
    .getByRole("button", { name: "Remove dependency", exact: true })
    .click();
  await expect
    .poll(async () => (await current(b.id)).dependencyIds)
    .toEqual([]);
  const rect = await timeline
    .locator(".feature-timeline-track")
    .first()
    .boundingBox();
  if (!rect) throw Error("Timeline track missing");
  const initialStart = Number(
    await timeline.getAttribute("data-timeline-start"),
  );
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + 20);
  await page.mouse.wheel(rect.width * 4, 0);
  await expect
    .poll(
      async () =>
        Number(await timeline.getAttribute("data-timeline-start")) -
        initialStart,
    )
    .toBeGreaterThan(100 * day);
  const before = {
    start: Number(await timeline.getAttribute("data-timeline-start")),
    span: Number(await timeline.getAttribute("data-timeline-span")),
  };
  await timeline.evaluate((el) =>
    el.addEventListener(
      "wheel",
      (event) => {
        const e = event as WheelEvent,
          rect = el
            .querySelector(".feature-timeline-track")!
            .getBoundingClientRect();
        (el as HTMLElement).dataset.testZoomAnchor = String(
          (e.clientX - rect.left) / rect.width,
        );
      },
      { once: true },
    ),
  );
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -80);
  await page.keyboard.up("Control");
  await expect
    .poll(async () => Number(await timeline.getAttribute("data-timeline-span")))
    .toBeLessThan(before.span);
  const after = {
    start: Number(await timeline.getAttribute("data-timeline-start")),
    span: Number(await timeline.getAttribute("data-timeline-span")),
  };
  const zoomAnchor = Number(
    await timeline.getAttribute("data-test-zoom-anchor"),
  );
  expect(
    Math.abs(
      before.start +
        before.span * zoomAnchor -
        (after.start + after.span * zoomAnchor),
    ),
  ).toBeLessThan(2);
  await page.reload();
  await expect(timeline).toHaveAttribute(
    "data-timeline-start",
    String(after.start),
  );
  await expect(timeline).toHaveAttribute(
    "data-timeline-span",
    String(after.span),
  );
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(bar(c.id)).toBeVisible();
  await page.screenshot({
    path: "artifacts/product-ui/timeline-dependencies.png",
  });
});

test("project context duplication copies a scheduled issue tree and documents, and team reassignment leaves issue ownership intact", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = async () =>
      await (await page.request.get(`${base}/api/v1/state`)).json(),
    create = async (kind: string, data: any) => {
      const response = await page.request.post(`${base}/api/v1/${kind}`, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    },
    initial = await state(),
    team = initial.teams[0],
    destination = await create("teams", {
      name: "Project destination",
      identifier: "PDST",
    }),
    source = await create("projects", {
      name: "Copy project schedule source",
      teamIds: [team.id],
      startDate: "2026-09-01",
      targetDate: "2026-09-21",
      description: "<h2>Preserved specification</h2><p>Original scope</p>",
    }),
    milestone = await create("milestones", {
      projectId: source.id,
      name: "First delivery",
      targetDate: "2026-09-10",
    }),
    parent = await create("issues", {
      title: "Copied parent scope",
      teamId: team.id,
      projectId: source.id,
      milestoneId: milestone.id,
      dueDate: "2026-09-07",
    }),
    child = await create("issues", {
      title: "Copied child scope",
      teamId: team.id,
      projectId: source.id,
      parentId: parent.id,
    }),
    document = await create("documents", {
      title: "Copied specification",
      projectId: source.id,
      content: "<p>Durable document content</p>",
    });
  await create("comments", {
    projectId: source.id,
    body: "Original history stays on the original",
  });
  await page.goto(`${base}/projects`);
  await page.getByText(source.name, { exact: true }).click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Duplicate project…", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Duplicate project",
    exact: true,
  });
  await dialog
    .getByLabel("Project name", { exact: true })
    .fill("Copy project schedule result");
  await dialog.getByLabel("Start date", { exact: true }).fill("2026-10-01");
  await dialog
    .getByRole("button", { name: "Duplicate project", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Copy project schedule result",
  );
  let saved = await state();
  const copy = saved.projects.find(
      (p: any) => p.name === "Copy project schedule result",
    ),
    copiedIssues = saved.issues.filter((i: any) => i.projectId === copy.id),
    copiedParent = copiedIssues.find((i: any) => i.title === parent.title),
    copiedChild = copiedIssues.find((i: any) => i.title === child.title),
    copiedMilestone = saved.milestones.find(
      (m: any) => m.projectId === copy.id,
    ),
    copiedDocument = saved.documents.find((d: any) => d.projectId === copy.id);
  expect(copy.id).not.toBe(source.id);
  expect(copy.targetDate).toBe("2026-10-21");
  expect(copy.description).toContain("Preserved specification");
  expect(copiedIssues).toHaveLength(2);
  expect(copiedParent.id).not.toBe(parent.id);
  expect(copiedChild.parentId).toBe(copiedParent.id);
  expect(copiedParent.milestoneId).toBe(copiedMilestone.id);
  expect(copiedParent.dueDate).toBe("2026-10-07");
  expect(copiedMilestone.targetDate).toBe("2026-10-10");
  expect(copiedDocument.id).not.toBe(document.id);
  expect(copiedDocument.content).toContain("Durable document content");
  expect(
    saved.comments.filter((c: any) => c.projectId === copy.id),
  ).toHaveLength(0);
  await page
    .getByRole("button", { name: "More actions", exact: true })
    .first()
    .click();
  await page
    .getByRole("menuitem", { name: "Move to teams…", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Move project to teams",
    exact: true,
  });
  await expect(dialog).toContainText(
    "existing issues keep their current teams",
  );
  await dialog.getByRole("button", { name: "Teams", exact: true }).click();
  let picker = page.getByRole("dialog", { name: "Change Teams", exact: true });
  await picker
    .getByRole("option", { name: destination.name, exact: true })
    .click();
  await picker.getByRole("option", { name: team.name, exact: true }).click();
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Save teams", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await state()).projects.find((p: any) => p.id === copy.id).teamIds,
    )
    .toEqual([destination.id]);
  saved = await state();
  expect(
    saved.issues
      .filter((i: any) => i.projectId === copy.id)
      .every((i: any) => i.teamId === team.id),
  ).toBe(true);
  expect(saved.projects.find((p: any) => p.id === source.id).startDate).toBe(
    "2026-09-01",
  );
  await page
    .getByRole("button", { name: "More actions", exact: true })
    .first()
    .click();
  await page
    .getByRole("menuitem", { name: "Duplicate project…", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Duplicate project", exact: true });
  await dialog
    .getByLabel("Project name", { exact: true })
    .fill("Copy project shell only");
  await dialog.getByLabel(/^Include issues/).uncheck();
  await dialog.getByLabel(/^Include milestones/).uncheck();
  await dialog.getByLabel(/^Include documents/).uncheck();
  await dialog
    .getByRole("button", { name: "Duplicate project", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Copy project shell only",
  );
  saved = await state();
  const shell = saved.projects.find(
    (p: any) => p.name === "Copy project shell only",
  );
  for (const kind of ["issues", "documents", "milestones"])
    expect(
      saved[kind].filter((r: any) => r.projectId === shell.id),
    ).toHaveLength(0);
  await page.reload();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Copy project shell only",
  );
});

test("profile usernames and writing, assignment, contrast and desktop preferences change their real consumers", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  const state = async () =>
    await (await page.request.get(`${base}/api/v1/state`)).json();
  const initial = await state(),
    me = initial.users.find((u: any) => u.email === "product-qa@example.test"),
    team = initial.teams[0],
    prefs = async () =>
      (await state()).users.find((u: any) => u.id === me.id).preferences || {};
  await page.goto(`${base}/settings/profile`);
  await page.getByLabel("Username", { exact: true }).fill("product.qa");
  await page.getByLabel("Username", { exact: true }).press("Tab");
  await expect
    .poll(
      async () =>
        (await state()).users.find((u: any) => u.id === me.id).username,
    )
    .toBe("product.qa");
  await page.goto(`${base}/settings/preferences`);
  await page
    .getByLabel("Display names", { exact: true })
    .selectOption("Username");
  await expect.poll(async () => (await prefs()).displayNames).toBe("Username");
  await page
    .getByRole("switch", { name: "Check spelling", exact: true })
    .click();
  await expect.poll(async () => (await prefs()).spellcheck).toBe(false);
  await page
    .getByRole("switch", {
      name: "Convert text emoticons into emojis",
      exact: true,
    })
    .click();
  await expect.poll(async () => (await prefs()).convertEmoticons).toBe(false);
  await page
    .getByRole("switch", { name: "Auto-assign to self", exact: true })
    .click();
  await expect.poll(async () => (await prefs()).autoAssign).toBe(true);
  await page
    .getByRole("switch", {
      name: "On move to started status, assign to yourself",
      exact: true,
    })
    .click();
  await expect.poll(async () => (await prefs()).autoAssignStarted).toBe(true);
  const project = await (
    await page.request.post(`${base}/api/v1/projects`, {
      data: { name: "Preference consumers", leadId: me.id, teamIds: [team.id] },
    })
  ).json();
  await page.goto(`${base}/project/${project.id}`);
  const lead = page.getByRole("button", { name: "Lead", exact: true }).first();
  await expect(lead).toContainText("product.qa");
  await lead.click();
  await expect(
    page.getByRole("option", { name: "product.qa", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  let editor = page.getByRole("textbox", {
    name: "Add description…",
    exact: true,
  });
  await expect(editor).toHaveJSProperty("spellcheck", false);
  await editor.click();
  await page.keyboard.type("No conversion :) ");
  await expect(editor).toContainText("No conversion :) ");
  await page.goto(`${base}/settings/preferences`);
  await page
    .getByRole("switch", { name: "Check spelling", exact: true })
    .click();
  await expect.poll(async () => (await prefs()).spellcheck).toBe(true);
  await page
    .getByRole("switch", {
      name: "Convert text emoticons into emojis",
      exact: true,
    })
    .click();
  await expect.poll(async () => (await prefs()).convertEmoticons).toBe(true);
  await page
    .getByLabel("Interface theme", { exact: true })
    .selectOption("custom");
  await page.getByLabel("Background", { exact: true }).fill("#ffffff");
  await page.getByLabel("Background", { exact: true }).press("Enter");
  await expect.poll(async () => (await prefs()).theme).toBe("custom");
  await expect
    .poll(async () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim(),
      ),
    )
    .toBe("#2f3130");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("switch", { name: "Open in desktop app", exact: true })
    .click();
  await expect.poll(async () => (await prefs()).openDesktop).toBe(true);
  await page.addInitScript(() => {
    (window as any).__desktopLaunches = [];
    window.addEventListener("workspace-desktop-open", (event) => {
      event.preventDefault();
      (window as any).__desktopLaunches.push((event as CustomEvent).detail.url);
    });
  });
  await page.goto(`${base}/project/${project.id}`);
  await expect
    .poll(async () => page.evaluate(() => (window as any).__desktopLaunches))
    .toEqual([`parabolic://project/${project.id}`]);
  editor = page.getByRole("textbox", { name: "Add description…", exact: true });
  await expect(editor).toHaveJSProperty("spellcheck", true);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("Converted :) ");
  await expect(editor).toContainText("Converted 🙂 ");
  await page.keyboard.type("@product.qa");
  await expect(page.getByRole("option", { name: /product\.qa/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(editor.locator("[data-mention-id]")).toContainText(
    "@product.qa",
  );
  await page
    .getByRole("button", { name: "Create new issue", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Issue title", exact: true })
    .fill("Auto assigned preference consumer");
  await dialog
    .getByRole("button", { name: "Create issue", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state()).issues.find(
          (i: any) => i.title === "Auto assigned preference consumer",
        )?.assigneeId,
    )
    .toBe(me.id);
  const started = (await state()).statuses.find(
      (s: any) => s.teamId === team.id && s.type === "started",
    ),
    unstarted = (await state()).statuses.find(
      (s: any) => s.teamId === team.id && s.type === "unstarted",
    ),
    issue = await (
      await page.request.post(`${base}/api/v1/issues`, {
        data: {
          teamId: team.id,
          title: "Started auto assignment preference",
          assigneeId: null,
          statusId: unstarted.id,
        },
      })
    ).json();
  await page.goto(`${base}/issues/${issue.id}`);
  await page
    .getByRole("button", { name: "Change status", exact: true })
    .click();
  await page.getByRole("button", { name: started.name, exact: true }).click();
  await expect
    .poll(
      async () =>
        (await state()).issues.find((i: any) => i.id === issue.id)?.assigneeId,
    )
    .toBe(me.id);
  await page.goto(`${base}/settings/preferences`);
  await page
    .getByLabel("Display names", { exact: true })
    .selectOption("Full name");
  await expect.poll(async () => (await prefs()).displayNames).toBe("Full name");
  await page.goto(`${base}/project/${project.id}`);
  await expect(
    page.getByRole("button", { name: "Lead", exact: true }).first(),
  ).toContainText(me.name);
  await page.screenshot({
    path: "artifacts/product-ui/preference-consumers.png",
  });
  await page.request.patch(base + "/api/v1/users/" + me.id, {
    data: { preferences: me.preferences || {} },
  });
});

test("project, initiative, team and view icon pickers persist preset symbols and validated custom colors", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    current = await state(),
    team = current.teams[0],
    create = async (kind: string, data: any) =>
      (await page.request.post(base + "/api/v1/" + kind, { data })).json(),
    project = await create("projects", {
      name: "Visual identity project",
      teamIds: [team.id],
    }),
    initiative = await create("initiatives", {
      name: "Visual identity initiative",
      status: "active",
    });
  const pick = async (label: string, icon: string, color: string) => {
    await page.getByRole("button", { name: label, exact: true }).click();
    const popup = page.getByRole("dialog", { name: label, exact: true });
    await popup
      .getByRole("textbox", { name: "Search icons", exact: true })
      .fill(icon);
    await popup
      .getByRole("textbox", { name: "Search icons", exact: true })
      .press("Enter");
    await expect(
      popup.getByRole("button", {
        name: "Choose " + icon + " icon",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await popup
      .getByLabel("Custom icon color", { exact: true })
      .fill("invalid");
    await popup.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(popup.getByRole("alert")).toContainText("hexadecimal");
    await popup.getByLabel("Custom icon color", { exact: true }).fill(color);
    await popup.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(popup.getByRole("alert")).toHaveCount(0);
    if (label === "Project icon")
      await page.screenshot({
        path: "artifacts/product-ui/entity-icon-picker.png",
      });
    await popup
      .getByRole("textbox", { name: "Search icons", exact: true })
      .focus();
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
  };
  await page.goto(base + "/project/" + project.id);
  await pick("Project icon", "Target", "#32a8a0");
  await expect
    .poll(async () => {
      const row = (await state()).projects.find(
        (p: any) => p.id === project.id,
      );
      return [row.icon, row.color];
    })
    .toEqual(["Target", "#32a8a0"]);
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: "Project icon", exact: true })
      .locator("svg"),
  ).toHaveCSS("color", "rgb(50, 168, 160)");
  await page.goto(base + "/projects");
  await expect(
    page.getByText(project.name, { exact: true }).locator("..").locator("svg"),
  ).toHaveCSS("color", "rgb(50, 168, 160)");
  await page.goto(base + "/initiative/" + initiative.id);
  await pick("Initiative icon", "Flag", "#df64a5");
  await expect
    .poll(async () => {
      const row = (await state()).initiatives.find(
        (p: any) => p.id === initiative.id,
      );
      return [row.icon, row.color];
    })
    .toEqual(["Flag", "#df64a5"]);
  await page.goto(base + "/settings/team-" + team.id);
  await pick("Team icon", "Code2", "#ed9253");
  await expect
    .poll(async () => {
      const row = (await state()).teams.find((p: any) => p.id === team.id);
      return [row.icon, row.color];
    })
    .toEqual(["Code2", "#ed9253"]);
  await page.goto(base + "/views?new=1");
  let dialog = page.getByRole("dialog", { name: "New view", exact: true });
  await dialog.getByLabel("Name", { exact: true }).fill("Visual identity view");
  await dialog.getByLabel("Content", { exact: true }).selectOption("projects");
  await pick("View icon", "LayoutDashboard", "#6eb57c");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Create view", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => {
      const row = (await state()).views.find(
        (p: any) => p.name === "Visual identity view",
      );
      return [row?.icon, row?.color];
    })
    .toEqual(["LayoutDashboard", "#6eb57c"]);
  await page.goto(base + "/views");
  await expect(
    page
      .getByRole("link", { name: "Visual identity view", exact: true })
      .locator("svg"),
  ).toHaveCSS("color", "rgb(110, 181, 124)");
  await page.screenshot({ path: "artifacts/product-ui/entity-icons-list.png" });
});

test("desktop notification badge preference reaches the native bridge and clears the badge immediately", async ({
  page,
}) => {
  test.setTimeout(45000);
  const state = await (await page.request.get(base + "/api/v1/state")).json(),
    user = state.users.find((u: any) => u.email === "product-qa@example.test");
  await page.request.patch(base + "/api/v1/users/" + user.id, {
    data: {
      preferences: { ...(user.preferences || {}), notificationBadge: true },
    },
  });
  const notification = await page.request.post(base + "/api/v1/notifications", {
    data: { title: "Badge consumer check", userId: user.id, readAt: null },
  });
  expect(notification.ok(), await notification.text()).toBeTruthy();
  await page.addInitScript(() => {
    (window as any).__badgeCounts = [];
    Object.defineProperty(window, "desktop", {
      value: {
        isDesktop: true,
        platform: "darwin",
        setBadge: (count: number) => {
          (window as any).__badgeCounts.push(count);
          return Promise.resolve();
        },
        setTheme: () => Promise.resolve(),
        onCommand: () => () => {},
        notify: () => Promise.resolve(true),
        getConnection: () =>
          Promise.resolve({
            mode: "embedded",
            serverUrl: null,
            activeUrl: location.origin,
          }),
        onFindResult: () => () => {},
      },
    });
  });
  await page.goto(base + "/settings/preferences");
  await expect
    .poll(async () => page.evaluate(() => (window as any).__badgeCounts.at(-1)))
    .toBeGreaterThan(0);
  const toggle = page.getByRole("switch", {
    name: "Notification badge",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect
    .poll(async () => page.evaluate(() => (window as any).__badgeCounts.at(-1)))
    .toBe(0);
  await toggle.click();
  await expect
    .poll(async () => page.evaluate(() => (window as any).__badgeCounts.at(-1)))
    .toBeGreaterThan(0);
  await page.request.patch(base + "/api/v1/users/" + user.id, {
    data: { preferences: user.preferences || {} },
  });
});

test("triage review keyboard decisions require priority, retain comments, merge duplicates and wake snoozed work", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1550, height: 950 });
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    create = async (kind: string, data: any) => {
      const response = await page.request.post(base + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
  const team = await create("teams", {
      name: "Triage review QA",
      key: "TRQ",
      triageEnabled: true,
    }),
    initial = await state(),
    status = (type: string) =>
      initial.statuses.find((s: any) => s.teamId === team.id && s.type === type)
        .id;
  await page.request.patch(base + "/api/v1/teams/" + team.id, {
    data: { triageRequirePriority: true, defaultStatusId: status("backlog") },
  });
  const accept = await create("issues", {
      title: "Accept incoming triage request",
      teamId: team.id,
      statusId: status("triage"),
    }),
    decline = await create("issues", {
      title: "Decline unprioritized triage request",
      teamId: team.id,
      statusId: status("triage"),
    }),
    sleep = await create("issues", {
      title: "Snooze until more information",
      teamId: team.id,
      statusId: status("triage"),
    }),
    duplicate = await create("issues", {
      title: "Duplicate incoming triage request",
      teamId: team.id,
      statusId: status("triage"),
    }),
    canonical = await create("issues", {
      title: "Canonical triage request",
      teamId: team.id,
      statusId: status("backlog"),
    });
  const record = async (id: string) =>
    (await state()).issues.find((issue: any) => issue.id === id);
  await page.goto(base + "/team/" + team.id + "/triage?issue=" + accept.id);
  const queue = page.getByRole("listbox", { name: "Triage issues" });
  await expect(
    queue.getByRole("option", { name: accept.title, exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const queueBox = await queue.boundingBox(),
    reviewBox = await page.locator(".triage-review").boundingBox();
  expect(reviewBox!.x).toBeGreaterThan(queueBox!.x + queueBox!.width - 2);
  await queue.getByRole("option", { name: accept.title, exact: true }).click();
  await page.keyboard.press("1");
  let dialog = page.getByRole("dialog", { name: "Accept issue", exact: true });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Accept issue", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Set a priority");
  await dialog.getByLabel("Priority", { exact: true }).selectOption("2");
  await dialog
    .getByRole("textbox", {
      name: "Add a comment before accepting…",
      exact: true,
    })
    .fill("Ready after customer clarification.");
  await dialog
    .getByRole("button", { name: "Accept issue", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(async () => (await record(accept.id)).statusId)
    .toBe(status("backlog"));
  await expect
    .poll(
      async () =>
        (await state()).comments.filter(
          (comment: any) =>
            comment.issueId === accept.id &&
            comment.body.includes("Ready after customer clarification"),
        ).length,
    )
    .toBe(1);
  await expect(
    queue.getByRole("option", { name: accept.title, exact: true }),
  ).toHaveCount(0);
  await queue.getByRole("option", { name: decline.title, exact: true }).click();
  await page.keyboard.press("3");
  dialog = page.getByRole("dialog", { name: "Decline issue", exact: true });
  await dialog
    .getByRole("textbox", {
      name: "Explain why this issue is declined…",
      exact: true,
    })
    .fill("Outside this team’s scope.");
  await dialog
    .getByRole("button", { name: "Decline issue", exact: true })
    .click();
  await expect
    .poll(async () => (await record(decline.id)).statusId)
    .toBe(status("canceled"));
  expect((await record(decline.id)).priority).toBe(0);
  await queue.getByRole("option", { name: sleep.title, exact: true }).click();
  await page.keyboard.press("h");
  dialog = page.getByRole("dialog", { name: "Snooze issue", exact: true });
  await dialog.getByRole("button", { name: "Next week", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Snooze issue", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(
      async () =>
        Date.parse((await record(sleep.id)).snoozedUntil) > Date.now(),
    )
    .toBe(true);
  await expect(
    queue.getByRole("option", { name: sleep.title, exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Triage view options", exact: true })
    .click();
  await page.getByLabel("Show snoozed issues", { exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(
    queue.getByRole("option", { name: sleep.title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    queue.getByRole("option", { name: sleep.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Triage view options", exact: true })
    .click();
  await page.getByLabel("Show snoozed issues", { exact: true }).uncheck();
  await page.keyboard.press("Escape");
  await create("comments", {
    issueId: sleep.id,
    body: "<p>Customer supplied the missing details.</p>",
  });
  await expect
    .poll(async () => (await record(sleep.id)).snoozedUntil)
    .toBeNull();
  await expect(
    queue.getByRole("option", { name: sleep.title, exact: true }),
  ).toBeVisible();
  await queue
    .getByRole("option", { name: duplicate.title, exact: true })
    .click();
  await page.keyboard.press("2");
  dialog = page.getByRole("dialog", { name: "Add relation", exact: true });
  await dialog
    .getByRole("textbox", { name: "Add relation", exact: true })
    .fill(canonical.title);
  await dialog
    .getByRole("button", { name: new RegExp(canonical.title) })
    .click();
  await expect
    .poll(async () => (await record(duplicate.id)).duplicateOfId)
    .toBe(canonical.id);
  await expect(
    queue.getByRole("option", { name: duplicate.title, exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "artifacts/product-ui/triage-review.png" });
  await page.goto(base + "/team/" + team.id + "/all");
  await expect(
    page.locator(".issue-row").filter({ hasText: sleep.title }),
  ).toHaveCount(0);
  await expect(
    page.locator(".issue-row").filter({ hasText: accept.title }),
  ).toBeVisible();
  const view = await create("views", {
    name: "Explicit triage status view",
    entityType: "issues",
    filter: {
      match: "all",
      conditions: [
        { field: "statusId", operator: "eq", value: status("triage") },
      ],
    },
  });
  await page.goto(base + "/view/" + view.id);
  await expect(
    page.locator(".issue-row").filter({ hasText: sleep.title }),
  ).toBeVisible();
});

test("triage responsibility and ordered rule editing drive routing, conflicts and destination rule chains", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    create = async (kind: string, data: any) => {
      const response = await page.request.post(base + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    },
    initial = await state(),
    owner = initial.user;
  const invited = await (
      await page.request.post(base + "/api/v1/invitations", {
        data: { email: "triage-colleague@example.test", role: "member" },
      })
    ).json(),
    context = await browser.newContext();
  try {
    const joined = await context.request.post(base + "/auth/join", {
      data: {
        token: invited.token,
        name: "Triage colleague",
        password: "triage-colleague-password",
      },
    });
    expect(joined.ok(), await joined.text()).toBeTruthy();
    const colleague = (await joined.json()).user;
    const team = await create("teams", {
        name: "Routing source QA",
        key: "RSQ",
        triageEnabled: true,
        memberIds: [owner.id, colleague.id],
      }),
      destination = await create("teams", {
        name: "Routing destination QA",
        key: "RDQ",
        triageEnabled: true,
      });
    await page.goto(base + "/settings/team-" + team.id + "?section=Triage");
    await page
      .getByLabel("Require priority before accepting", { exact: true })
      .check();
    await page
      .getByLabel("Enable triage responsibility", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Responsible members", exact: true })
      .click();
    const members = page.getByRole("dialog", {
      name: "Change Responsible members",
      exact: true,
    });
    await members
      .getByRole("option", { name: "Triage colleague", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await page
      .getByLabel("Responsibility mode", { exact: true })
      .selectOption("assign");
    await page
      .getByLabel("Rotate triage responsibility", { exact: true })
      .check();
    await page
      .getByLabel("Rotation start date", { exact: true })
      .fill("2026-01-01");
    await page
      .getByLabel("Rotation interval", { exact: true })
      .selectOption("14");
    await expect
      .poll(async () => {
        const current = (await state()).teams.find(
          (t: any) => t.id === team.id,
        );
        return [
          current?.triageRequirePriority,
          current?.triageResponsibility?.mode,
          current?.triageResponsibility?.memberIds?.length,
          current?.triageResponsibility?.rotation?.intervalDays,
        ];
      })
      .toEqual([true, "assign", 2, 14]);
    await page
      .getByLabel("Rotate triage responsibility", { exact: true })
      .uncheck();
    await page
      .getByLabel("Responsibility mode", { exact: true })
      .selectOption("notify");
    const addRule = async (name: string, priority: string, target?: string) => {
      await page
        .getByRole("button", { name: "Add triage rule", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "New triage rule",
        exact: true,
      });
      await dialog.getByLabel("Rule name", { exact: true }).fill(name);
      await dialog
        .getByRole("button", { name: "Add filter", exact: true })
        .click();
      const condition = dialog.locator(".filter-condition");
      await condition.locator("select").nth(0).selectOption("title");
      await condition.locator("select").nth(1).selectOption("contains");
      await condition.locator("input").fill("billing");
      await dialog.getByLabel("Priority", { exact: true }).check();
      await dialog
        .getByLabel("Rule priority", { exact: true })
        .selectOption(priority);
      if (target) {
        await dialog.getByLabel("Team", { exact: true }).check();
        await dialog
          .getByLabel("Rule team", { exact: true })
          .selectOption(target);
      }
      await dialog
        .getByRole("button", { name: "Create rule", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
    };
    await addRule("Billing first priority", "1");
    await addRule("Billing later conflict", "4");
    const triage = (await state()).statuses.find(
        (s: any) => s.teamId === team.id && s.type === "triage",
      ),
      incoming = await create("issues", {
        title: "billing owner notification",
        teamId: team.id,
        statusId: triage.id,
      });
    expect(incoming.priority).toBe(1);
    expect(incoming.triageResponsibleIds.slice().sort()).toEqual(
      [owner.id, colleague.id].sort(),
    );
    await page.goto(base + "/team/" + team.id + "/triage?issue=" + incoming.id);
    await expect(
      page.getByRole("alert").filter({ hasText: "Routing rule conflict" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Review triage rules", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Move Billing later conflict up",
        exact: true,
      })
      .click();
    await expect
      .poll(async () => {
        const rules = (await state()).automations
          .filter((r: any) => r.teamId === team.id)
          .sort((a: any, b: any) => a.position - b.position);
        return rules[0]?.name;
      })
      .toBe("Billing later conflict");
    const changed = await create("issues", {
      title: "billing priority after reordering",
      teamId: team.id,
      statusId: triage.id,
    });
    expect(changed.priority).toBe(4);
    await page
      .getByLabel("Enable Billing later conflict", { exact: true })
      .uncheck();
    await expect
      .poll(
        async () =>
          (await state()).automations.find(
            (r: any) => r.name === "Billing later conflict",
          ).enabled,
      )
      .toBe(false);
    await create("automations", {
      name: "Destination assignment",
      type: "routing",
      teamId: destination.id,
      set: { assigneeId: colleague.id },
      position: 0,
    });
    await addRule("Billing transfer", "1", destination.id);
    const routed = await create("issues", {
      title: "billing chained destination",
      teamId: team.id,
      statusId: triage.id,
    });
    expect(routed.teamId).toBe(destination.id);
    expect(routed.assigneeId).toBe(colleague.id);
    expect(routed.priority).toBe(1);
    const card = page
      .locator(".triage-rule-card")
      .filter({ hasText: "Billing first priority" });
    await card.getByRole("button", { name: "Edit rule", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Edit triage rule",
      exact: true,
    });
    await dialog.getByLabel("Rule priority", { exact: true }).selectOption("2");
    await dialog
      .getByRole("button", { name: "Save rule", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).automations.find(
            (r: any) => r.name === "Billing first priority",
          ).set.priority,
      )
      .toBe(2);
    await page.screenshot({ path: "artifacts/product-ui/triage-rules.png" });
  } finally {
    await context.close();
  }
});

test("document emoji commands load the full catalog and reactions use canonical persisted users", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(12000);
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    document = await (
      await page.request.post(base + "/api/v1/documents", {
        data: { title: "Complete emoji support", visibility: "workspace" },
      })
    ).json();
  await page.goto(base + "/document/" + document.id);
  const editor = page.getByRole("textbox", {
    name: "Start writing, or type / for commands…",
    exact: true,
  });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.insertText(":otter");
  const suggestions = page.getByRole("listbox", {
    name: "Emoji suggestions",
    exact: true,
  });
  await expect(
    suggestions.getByRole("option", { name: /otter/ }),
  ).toBeVisible();
  await editor.press("Enter");
  await expect(editor).toContainText("🦦");
  await page.keyboard.insertText(" :orca:");
  await expect(editor).toContainText("🫍");
  await expect
    .poll(
      async () =>
        (await state()).documents.find((item: any) => item.id === document.id)
          .content,
    )
    .toContain("🫍");
  const comments = page.getByRole("textbox", {
    name: "Leave a comment…",
    exact: true,
  });
  await comments.fill("A reaction beyond the quick list.");
  await comments.press("Enter");
  const row = page
    .locator(".feature-comment")
    .filter({ hasText: "A reaction beyond the quick list." });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Add reaction", exact: true }).click();
  const picker = page.getByRole("dialog", {
    name: "Choose emoji",
    exact: true,
  });
  await picker
    .getByRole("textbox", { name: "Search emoji", exact: true })
    .fill("otter");
  await picker.getByRole("button", { name: "otter", exact: true }).click();
  await expect(picker).not.toBeVisible();
  await expect(
    row.getByRole("button", { name: "🦦 1", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const current = await state();
      return current.comments.find(
        (item: any) => item.documentId === document.id,
      ).reactions?.["🦦"];
    })
    .toEqual([(await state()).user.id]);
  await page.reload();
  await expect(
    row.getByRole("button", { name: "🦦 1", exact: true }),
  ).toBeVisible();
  await row.getByRole("button", { name: "🦦 1", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "🦦 1", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".editor-collaboration-status")).toHaveCount(0);
});

test("cycle configuration, early starts, capacity, historical snapshots and end-today actions persist through UI", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    create = async (kind: string, data: any) => {
      const response = await page.request.post(base + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
  const team = await create("teams", {
      name: "Cycle scheduling QA",
      key: "CSQ",
      cyclesEnabled: false,
      cycleEnabled: false,
      timezone: "America/New_York",
    }),
    initial = await state(),
    status = (type: string) =>
      initial.statuses.find(
        (item: any) => item.teamId === team.id && item.type === type,
      ).id;
  await page.goto(base + "/settings/team-" + team.id + "?section=Cycles");
  await page.getByLabel("Enable cycles", { exact: true }).check();
  await expect
    .poll(
      async () =>
        (await state()).cycles.filter(
          (cycle: any) => cycle.teamId === team.id && !cycle.deletedAt,
        ).length,
    )
    .toBeGreaterThan(2);
  await page.getByLabel("Cycle duration", { exact: true }).selectOption("8");
  await page
    .getByLabel("Cycle cooldown days", { exact: true })
    .selectOption("2");
  await page
    .getByLabel("Cycle starting day", { exact: true })
    .selectOption("3");
  await page
    .getByLabel("Upcoming cycle count", { exact: true })
    .selectOption("4");
  await expect
    .poll(async () => {
      const current = (await state()).teams.find(
        (item: any) => item.id === team.id,
      );
      return [
        current.cycleDuration,
        current.cycleCooldownDays,
        current.cycleStartDay,
        current.cycleUpcomingCount,
      ];
    })
    .toEqual([8, 2, 3, 4]);
  await expect(page.getByLabel("Cycle rollover", { exact: true })).toHaveCount(
    0,
  );
  const active = await create("issues", {
    title: "Cycle active automation carry-forward",
    teamId: team.id,
    statusId: status("started"),
    estimate: 3,
  });
  await page.getByLabel("Auto-add active issues", { exact: true }).click();
  let dialog = page.getByRole("dialog", {
    name: "Enable active issue automation",
    exact: true,
  });
  await dialog
    .getByLabel("Existing active issues without a cycle", { exact: true })
    .selectOption("keep");
  await dialog
    .getByRole("button", { name: "Enable automation", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Auto-add completed issues", { exact: true }).check();
  await expect
    .poll(
      async () =>
        (await state()).teams.find((item: any) => item.id === team.id)
          .autoAddCompletedToCycle,
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        (await state()).issues.find((issue: any) => issue.id === active.id)
          .cycleId,
    )
    .toBeTruthy();
  let cycles = (await state()).cycles
    .filter((cycle: any) => cycle.teamId === team.id && !cycle.deletedAt)
    .sort(
      (a: any, b: any) => Date.parse(a.startDate) - Date.parse(b.startDate),
    );
  const current = cycles.find(
      (cycle: any) =>
        Date.parse(cycle.startDate) <= Date.now() &&
        Date.parse(cycle.endDate) > Date.now(),
    ),
    next = cycles.find(
      (cycle: any) => Date.parse(cycle.startDate) > Date.now(),
    );
  expect(current).toBeTruthy();
  expect(
    cycles.filter((cycle: any) => Date.parse(cycle.startDate) > Date.now()),
  ).toHaveLength(4);
  expect(
    Math.round(
      (Date.parse(next.endDate) - Date.parse(next.startDate)) / 86400000,
    ),
  ).toBe(56);
  expect(next.capacitySource).toBe("members");
  expect(next.capacityEstimated).toBe(true);
  const complete = await create("issues", {
    title: "Completed during cycle",
    teamId: team.id,
    statusId: status("completed"),
    estimate: 5,
  });
  expect(complete.cycleId).toBe(current.id);
  await page.goto(base + "/cycles/" + current.id);
  await expect(page.locator(".cycle-issues .page-header")).toHaveCount(0);
  await expect(
    page
      .locator(".cycle-issues")
      .getByRole("button", { name: "New issue", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Cycle actions: " + current.name,
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Change cycle dates…", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Change cycle dates",
    exact: true,
  });
  await expect(dialog.getByLabel("Start date", { exact: true })).toHaveCount(0);
  const inclusiveEnd = new Date(Date.now() + 3 * 86400000)
      .toISOString()
      .slice(0, 10),
    exclusiveEnd = new Date(Date.parse(inclusiveEnd + "T12:00:00Z") + 86400000)
      .toISOString()
      .slice(0, 10);
  await dialog.getByLabel("End date", { exact: true }).fill(inclusiveEnd);
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(async () =>
      (await state()).cycles
        .find((cycle: any) => cycle.id === current.id)
        .endDate.slice(0, 10),
    )
    .toBe(exclusiveEnd);
  await page.goto(base + "/team/" + team.id + "/cycles");
  const row = page.locator('[data-cycle-id="' + next.id + '"]');
  await expect(row.locator(".cycle-capacity")).toBeVisible();
  await row
    .getByRole("button", { name: "Cycle actions: " + next.name, exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Start cycle today", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Start cycle today?",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Start cycle today", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(
      async () =>
        (await state()).issues.find((issue: any) => issue.id === active.id)
          .cycleId,
    )
    .toBe(next.id);
  const closed = (await state()).cycles.find(
    (cycle: any) => cycle.id === current.id,
  );
  expect(closed.completionSnapshot.issueCount).toBe(2);
  expect(closed.completionSnapshot.scope).toBe(8);
  expect(closed.completionSnapshot.success).toBe(62.5);
  await page.goto(base + "/cycles/" + current.id);
  await expect(page.locator(".cycle-success strong")).toHaveText("63%");
  await expect(page.locator(".feature-graph-legend")).toContainText("Scope 8");
  await expect(page.locator(".feature-graph-legend")).toContainText(
    "Completed 5",
  );
  await expect(page.locator(".cycle-snapshot-note")).toBeVisible();
  await page.request.patch(base + "/api/v1/issues/" + complete.id, {
    data: { estimate: 1, cycleId: next.id },
  });
  await expect(page.locator(".feature-graph-legend")).toContainText("Scope 8");
  await page.reload();
  await expect(page.locator(".feature-graph-legend")).toContainText(
    "Completed 5",
  );
  await page
    .getByRole("button", { name: "Cycle options", exact: true })
    .click();
  await page
    .getByRole("menuitem", {
      name: "Edit cycle name and description…",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog", { name: "Edit cycle", exact: true });
  await dialog
    .getByLabel("Cycle name", { exact: true })
    .fill("Historical cycle focus");
  await dialog
    .getByRole("textbox", {
      name: "What is the focus of this cycle?",
      exact: true,
    })
    .fill("Preserved planning context.");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(page.locator(".cycle-detail-sidebar")).toContainText(
    "Preserved planning context.",
  );
  await page
    .getByRole("button", {
      name: "Cycle options",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Change cycle dates…", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "artifacts/product-ui/cycle-history.png" });
  await page.goto(base + "/cycles/" + next.id);
  await page
    .getByRole("button", { name: "Cycle actions: " + next.name, exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "End cycle today", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "End cycle today?", exact: true });
  await dialog
    .getByRole("button", { name: "End cycle today", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(
      async () =>
        Date.parse(
          (await state()).cycles.find((cycle: any) => cycle.id === next.id)
            .endDate,
        ) - Date.now(),
    )
    .toBeLessThan(86400000);
  await page
    .locator(".cycle-workspace>header")
    .getByRole("button", { name: "Close cycle details", exact: true })
    .click();
  await expect(page.locator(".cycle-detail-sidebar")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+i");
  await expect(page.locator(".cycle-detail-sidebar")).toBeVisible();
});

test("timeline milestone overlays support grouped date drags, context creation, filtering and cycle navigation", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    create = async (kind: string, data: any) => {
      const response = await page.request.post(base + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    },
    initial = await state(),
    team = initial.teams[0],
    at = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const project = await create("projects", {
      name: "Milestone overlay project",
      teamId: team.id,
      startDate: at(0),
      targetDate: at(16),
    }),
    first = await create("milestones", {
      name: "Overlay first gate",
      projectId: project.id,
      targetDate: at(2),
      position: 0,
    }),
    second = await create("milestones", {
      name: "Overlay second gate",
      projectId: project.id,
      targetDate: at(5),
      position: 1,
    }),
    third = await create("milestones", {
      name: "Overlay third gate",
      projectId: project.id,
      targetDate: at(8),
      position: 2,
    });
  const firstIssue = await create("issues", {
      title: "First gate scoped issue",
      teamId: team.id,
      projectId: project.id,
      milestoneId: first.id,
    }),
    otherIssue = await create("issues", {
      title: "Other gate scoped issue",
      teamId: team.id,
      projectId: project.id,
      milestoneId: second.id,
    });
  await create("cycles", {
    name: "Overlapping overlay review cycle",
    teamId: team.id,
    startDate: at(-1),
    endDate: at(10),
  });
  await page.goto(base + "/projects");
  await page
    .getByRole("button", { name: "Project display options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Timeline layout", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Timeline scale", { exact: true }).selectOption("week");
  const marker = (id: string) =>
      page.locator('[data-milestone-id="' + id + '"]'),
    record = async (id: string) =>
      (await state()).milestones.find((item: any) => item.id === id);
  await expect(marker(first.id)).toBeVisible();
  await marker(first.id).click({ modifiers: ["ControlOrMeta"] });
  await marker(second.id).click({ modifiers: ["ControlOrMeta"] });
  await expect(marker(first.id)).toHaveAttribute("aria-pressed", "true");
  await expect(marker(second.id)).toHaveAttribute("aria-pressed", "true");
  const move = async (id: string, days: number, shift = false) => {
    const track = await page
        .locator(
          '[data-timeline-project="' +
            project.id +
            '"] .feature-timeline-track',
        )
        .boundingBox(),
      box = await marker(id).boundingBox(),
      span = Number(
        await page
          .locator(".feature-timeline")
          .getAttribute("data-timeline-span"),
      );
    if (shift) await page.keyboard.down("Shift");
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + ((days * 86400000) / span) * track!.width,
      box!.y + box!.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    if (shift) await page.keyboard.up("Shift");
  };
  await move(first.id, 2);
  await expect
    .poll(
      async () =>
        Date.parse((await record(first.id)).targetDate) -
        Date.parse(first.targetDate),
    )
    .toBe(2 * 86400000);
  await expect
    .poll(
      async () =>
        Date.parse((await record(second.id)).targetDate) -
        Date.parse(second.targetDate),
    )
    .toBe(2 * 86400000);
  expect((await record(third.id)).targetDate).toBe(third.targetDate);
  await move(first.id, 1, true);
  await expect
    .poll(
      async () =>
        Date.parse((await record(third.id)).targetDate) -
        Date.parse(third.targetDate),
    )
    .toBe(86400000);
  await marker(first.id).click({ button: "right" });
  let panel = page.getByRole("dialog", {
    name: "Milestone details",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Edit milestone…", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Edit milestone",
    exact: true,
  });
  await dialog.getByLabel("Target date", { exact: true }).fill(at(6));
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect
    .poll(async () => (await record(first.id)).targetDate)
    .toBe(at(6));
  await marker(first.id).dblclick();
  await expect(page).toHaveURL(
    new RegExp("/project/" + project.id + "/issues\\?milestone=" + first.id),
  );
  await expect(
    page.locator(".issue-row").filter({ hasText: firstIssue.title }),
  ).toBeVisible();
  await expect(
    page.locator(".issue-row").filter({ hasText: otherIssue.title }),
  ).toHaveCount(0);
  await page.goto(base + "/projects");
  await expect(marker(first.id)).toBeVisible();
  const track = page.locator(
    '[data-timeline-project="' + project.id + '"] .feature-timeline-track',
  );
  await track.click({ button: "right", position: { x: 70, y: 7 } });
  panel = page.getByRole("dialog", { name: "Timeline date", exact: true });
  await panel
    .getByRole("button", { name: "Add milestone on this date…", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "New milestone", exact: true });
  const clickedDate = await dialog
    .getByLabel("Target date", { exact: true })
    .inputValue();
  await dialog
    .getByLabel("Milestone name", { exact: true })
    .fill("Created on timeline date");
  await dialog
    .getByRole("button", { name: "Create milestone", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state()).milestones.find(
          (item: any) => item.name === "Created on timeline date",
        )?.targetDate,
    )
    .toBe(clickedDate);
  await page
    .getByRole("button", { name: "Timeline display options", exact: true })
    .click();
  await page.getByLabel("Milestones", { exact: true }).uncheck();
  await expect(marker(first.id)).toHaveCount(0);
  await page.getByLabel("Milestones", { exact: true }).check();
  await page
    .getByRole("button", { name: "Show team cycles", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Change Show team cycles", exact: true })
    .getByRole("option", { name: team.name, exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(marker(first.id)).toBeVisible();
  const cycle = (await state()).cycles.find(
    (item: any) =>
      item.teamId === team.id &&
      !item.deletedAt &&
      Date.parse(item.startDate) < Date.now() + 14 * 86400000 &&
      Date.parse(item.endDate) > Date.now() - 7 * 86400000,
  );
  expect(cycle).toBeTruthy();
  const cycleChip = page.locator('[data-cycle-overlay-id="' + cycle.id + '"]');
  await expect(cycleChip).toBeVisible();
  await page.screenshot({
    path: "artifacts/product-ui/timeline-milestones-cycles.png",
  });
  await cycleChip.click();
  await expect(page).toHaveURL(base + "/cycles/" + cycle.id);
});

test("timeline milestone cancellation, concurrent edits, keyboard deletion and conversion preserve linked work", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    create = async (kind: string, data: any) => {
      const response = await page.request.post(base + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    },
    team = (await state()).teams[0],
    at = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString().slice(0, 10),
    project = await create("projects", {
      name: "Milestone conflict and conversion project",
      teamId: team.id,
      startDate: at(0),
      targetDate: at(14),
    }),
    first = await create("milestones", {
      name: "Cancel and concurrent date",
      projectId: project.id,
      targetDate: at(2),
    }),
    second = await create("milestones", {
      name: "Delete alongside first",
      projectId: project.id,
      targetDate: at(5),
    }),
    convert = await create("milestones", {
      name: "Convert linked delivery",
      projectId: project.id,
      targetDate: at(10),
      description: "<p>A deliverable that needs its own project.</p>",
    }),
    keep = await create("issues", {
      title: "Retain original project after milestone deletion",
      teamId: team.id,
      projectId: project.id,
      milestoneId: first.id,
    }),
    parent = await create("issues", {
      title: "Converted delivery parent",
      teamId: team.id,
      projectId: project.id,
      milestoneId: convert.id,
    }),
    child = await create("issues", {
      title: "Converted delivery child",
      teamId: team.id,
      projectId: project.id,
      milestoneId: convert.id,
      parentId: parent.id,
    });
  await page.goto(base + "/projects");
  await page
    .getByRole("button", { name: "Project display options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Timeline layout", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Timeline scale", { exact: true }).selectOption("week");
  const marker = (id: string) =>
      page.locator('[data-milestone-id="' + id + '"]'),
    record = async (id: string) =>
      (await state()).milestones.find((item: any) => item.id === id);
  const beginDrag = async (id: string) => {
    const track = await page
        .locator(
          '[data-timeline-project="' +
            project.id +
            '"] .feature-timeline-track',
        )
        .boundingBox(),
      box = await marker(id).boundingBox(),
      span = Number(
        await page
          .locator(".feature-timeline")
          .getAttribute("data-timeline-span"),
      );
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + ((2 * 86400000) / span) * track!.width,
      box!.y + box!.height / 2,
      { steps: 8 },
    );
  };
  await expect(marker(first.id)).toBeVisible();
  await beginDrag(first.id);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await record(first.id)).targetDate).toBe(at(2));
  await beginDrag(first.id);
  const changed = await page.request.patch(
    base + "/api/v1/milestones/" + first.id,
    { data: { name: "Concurrent date received", targetDate: at(3) } },
  );
  expect(changed.ok(), await changed.text()).toBeTruthy();
  await expect(marker(first.id)).toContainText("Concurrent date received");
  await page.mouse.up();
  await expect(
    page.getByText(
      "A milestone changed while you were dragging. Review its date and try again.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await record(first.id)).targetDate).toBe(at(3));
  await page.keyboard.press("Escape");
  await marker(first.id).click({ modifiers: ["ControlOrMeta"] });
  await marker(second.id).click({ modifiers: ["ControlOrMeta"] });
  await expect(marker(first.id)).toHaveAttribute("aria-pressed", "true");
  await expect(marker(second.id)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ControlOrMeta+Backspace");
  let dialog = page.getByRole("dialog", {
    name: "Delete 2 milestones?",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Delete milestones", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(async () => {
      const current = await state(),
        issue = current.issues.find((item: any) => item.id === keep.id);
      return [
        current.milestones.filter(
          (item: any) =>
            [first.id, second.id].includes(item.id) && !!item.deletedAt,
        ).length,
        issue.projectId,
        issue.milestoneId,
        !!issue.deletedAt,
      ];
    })
    .toEqual([2, project.id, null, false]);
  await expect(marker(first.id)).toHaveCount(0);
  await marker(convert.id).click({ button: "right" });
  await page
    .getByRole("dialog", { name: "Milestone details", exact: true })
    .getByRole("button", { name: "Convert to project…", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Convert milestone to project",
    exact: true,
  });
  await dialog
    .getByLabel("Project name", { exact: true })
    .fill("Converted standalone delivery");
  await dialog
    .getByRole("button", { name: "Convert to project", exact: true })
    .click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Converted standalone delivery",
  );
  const current = await state(),
    result = current.projects.find(
      (item: any) => item.name === "Converted standalone delivery",
    ),
    movedParent = current.issues.find((item: any) => item.id === parent.id),
    movedChild = current.issues.find((item: any) => item.id === child.id);
  expect(result.description).toContain(
    "A deliverable that needs its own project",
  );
  expect([
    movedParent.projectId,
    movedChild.projectId,
    movedChild.parentId,
    movedParent.milestoneId,
    movedChild.milestoneId,
  ]).toEqual([result.id, result.id, parent.id, null, null]);
  expect(
    current.issues.find((item: any) => item.id === keep.id).projectId,
  ).toBe(project.id);
  expect(
    current.milestones.find((item: any) => item.id === convert.id).deletedAt,
  ).toBeTruthy();
});

test("project overview proportions match the reference panel and keep controls usable at narrower widths", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  await page.addInitScript(() => {
    Object.defineProperty(window, "desktop", {
      value: {
        isDesktop: true,
        platform: "darwin",
        setBadge: () => Promise.resolve(),
        setTheme: () => Promise.resolve(),
        onCommand: () => () => {},
        notify: () => Promise.resolve(true),
        getConnection: () =>
          Promise.resolve({
            mode: "embedded",
            serverUrl: null,
            activeUrl: location.origin,
          }),
        onFindResult: () => () => {},
      },
    });
  });
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    initial = await state(),
    team = initial.teams[0],
    created = await page.request.post(base + "/api/v1/projects", {
      data: {
        name: "Reference project overview",
        summary: "A readable project plan at every window width",
        teamId: team.id,
        leadId: initial.user.id,
        description:
          "<p>Plan the scope, review the milestones, and keep ownership visible alongside the work.</p>",
      },
    });
  expect(created.ok(), await created.text()).toBeTruthy();
  const project = await created.json();
  await page.request.post(base + "/api/v1/milestones", {
    data: { projectId: project.id, name: "First usable delivery" },
  });
  await page.setViewportSize({ width: 1777, height: 991 });
  await page.goto(base + "/project/" + project.id);
  const title = page.getByRole("textbox", {
      name: "Project name",
      exact: true,
    }),
    aside = page.locator(".project-overview-layout>.feature-properties-panel"),
    layout = page.locator(".project-overview-layout");
  await expect(title).toHaveValue(project.name);
  const geometry = async () => {
    const panel = await page.locator(".main-panel").boundingBox(),
      name = await title.boundingBox(),
      properties = await aside.boundingBox();
    return {
      inset: name!.x - panel!.x,
      aside: properties!.width,
      titleWidth: name!.width,
    };
  };
  let measured = await geometry();
  expect(measured.aside).toBeCloseTo(388, 0);
  expect(measured.inset).toBeGreaterThanOrEqual(159);
  expect(measured.inset).toBeLessThanOrEqual(162);
  expect(measured.titleWidth).toBeGreaterThan(800);
  await expect(
    page.getByRole("textbox", { name: "Add description…", exact: true }),
  ).toContainText("Plan the scope");
  await page.screenshot({
    path: "artifacts/product-ui/project-overview-reference-1777.png",
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  measured = await geometry();
  expect(measured.aside).toBeGreaterThan(295);
  expect(measured.aside).toBeLessThan(305);
  expect(measured.inset).toBeGreaterThan(80);
  expect(measured.inset).toBeLessThan(87);
  expect(measured.titleWidth).toBeGreaterThan(500);
  await page.setViewportSize({ width: 1024, height: 800 });
  measured = await geometry();
  expect(measured.aside).toBeGreaterThanOrEqual(260);
  expect(measured.titleWidth).toBeGreaterThan(350);
  await page.getByRole("button", { name: "Lead", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Change Lead", exact: true })
    .getByRole("option", { name: "Add lead", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state()).projects.find((item: any) => item.id === project.id)
          .leadId,
    )
    .toBe("");
  await page.setViewportSize({ width: 900, height: 800 });
  const main = await layout.locator("main").boundingBox(),
    details = await aside.boundingBox();
  expect(details!.y).toBeGreaterThanOrEqual(main!.y + main!.height);
  await page
    .getByRole("button", { name: "Status", exact: true })
    .scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Status", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Change Status", exact: true })
    .getByRole("option", { name: "In Progress", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state()).projects.find((item: any) => item.id === project.id)
          .status,
    )
    .toBe("started");
  await page.setViewportSize({ width: 600, height: 800 });
  await page
    .getByRole("button", { name: "Target date", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Target date", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".project-detail-page")
      .evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: "artifacts/product-ui/project-overview-compact.png",
  });
});

test("project planning sidebar edits resources, orders milestones and assigns issue drags across both tabs", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    create = async (kind: string, data: any) => {
      const response = await page.request.post(base + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    },
    initial = await state(),
    team = initial.teams[0];
  const project = await create("projects", {
      name: "Sidebar planning workflow",
      teamId: team.id,
    }),
    first = await create("milestones", {
      name: "Planning first milestone",
      projectId: project.id,
      position: 0,
    }),
    second = await create("milestones", {
      name: "Planning second milestone",
      projectId: project.id,
      position: 1,
    }),
    issue = await create("issues", {
      title: "Assign this scoped issue by dragging",
      teamId: team.id,
      projectId: project.id,
    }),
    other = await create("issues", {
      title: "Keep this issue in all project work",
      teamId: team.id,
      projectId: project.id,
    });
  await page.goto(base + "/project/" + project.id);
  const sidebar = page.getByRole("complementary", {
    name: "Project details",
    exact: true,
  });
  await expect(sidebar).toBeVisible();
  await sidebar
    .getByRole("button", { name: "Add project resource", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Add resource", exact: true });
  await dialog.getByLabel("Title", { exact: true }).fill("Planning reference");
  await dialog
    .getByLabel("Link (leave empty to create a document)", { exact: true })
    .fill("https://example.test/project-plan");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    sidebar.getByRole("link", { name: "Planning reference", exact: true }),
  ).toHaveAttribute("href", "https://example.test/project-plan");
  await sidebar
    .getByRole("button", {
      name: "Resource actions: Planning reference",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Edit resource", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Edit project resource",
    exact: true,
  });
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Updated planning reference");
  await dialog
    .getByRole("button", { name: "Save resource", exact: true })
    .click();
  await expect(
    sidebar.getByRole("link", {
      name: "Updated planning reference",
      exact: true,
    }),
  ).toBeVisible();
  await sidebar
    .getByRole("button", { name: "Add sidebar milestone", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "New milestone", exact: true });
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Planning third milestone");
  await dialog.getByLabel("Target date", { exact: true }).fill("2026-12-15");
  await dialog
    .getByRole("button", { name: "Create milestone", exact: true })
    .click();
  await expect(
    sidebar.getByRole("link", {
      name: "Planning third milestone",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await expect(sidebar).toBeVisible();
  const row = page.locator(".issue-row").filter({ hasText: issue.title }),
    drop = sidebar.locator('[data-planning-milestone="' + second.id + '"]');
  await row.dragTo(drop);
  await expect
    .poll(
      async () =>
        (await state()).issues.find((item: any) => item.id === issue.id)
          ?.milestoneId,
    )
    .toBe(second.id);
  await sidebar.getByRole("link", { name: second.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp("milestone=" + second.id));
  await expect(row).toBeVisible();
  await expect(
    page.locator(".issue-row").filter({ hasText: other.title }),
  ).toHaveCount(0);
  await sidebar
    .getByRole("link", { name: "Clear milestone filter", exact: true })
    .click();
  await expect(
    page.locator(".issue-row").filter({ hasText: other.title }),
  ).toBeVisible();
  await sidebar
    .getByRole("button", { name: "Reorder " + second.name, exact: true })
    .dragTo(sidebar.locator('[data-planning-milestone="' + first.id + '"]'));
  const order = async () =>
    (await state()).milestones
      .filter((item: any) => item.projectId === project.id)
      .sort((a: any, b: any) => a.position - b.position)
      .map((item: any) => item.name);
  await expect
    .poll(order)
    .toEqual([second.name, first.name, "Planning third milestone"]);
  const grip = sidebar.getByRole("button", {
    name: "Reorder " + second.name,
    exact: true,
  });
  await grip.focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect
    .poll(order)
    .toEqual([first.name, second.name, "Planning third milestone"]);
  await page
    .getByRole("button", { name: "Toggle insights", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "View insights", exact: true }),
  ).toBeVisible();
  await expect(sidebar).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+i");
  await expect(
    page.getByRole("complementary", { name: "View insights", exact: true }),
  ).toHaveCount(0);
  await expect(sidebar).toBeVisible();
  await page
    .getByRole("button", { name: "Toggle project details", exact: true })
    .click();
  await expect(sidebar).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+i");
  await expect(sidebar).toBeVisible();
  await page.reload();
  await expect(sidebar).toBeVisible();
  await expect(
    sidebar.getByRole("link", {
      name: "Updated planning reference",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Project overview milestones", exact: true })
      .getByRole("button", { name: first.name, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/product-ui/project-planning-sidebar.png",
  });
});

test("project descriptions keep anchored review threads and restore version history into the live editor", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const response = await page.request.post(base + "/api/v1/projects", {
    data: {
      name: "Project description review workflow",
      description: "<p>Review this delivery scope with the team.</p>",
    },
  });
  expect(response.ok()).toBeTruthy();
  const project = await response.json(),
    state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    record = async () =>
      (await state()).projects.find((item: any) => item.id === project.id),
    comments = async () =>
      (await state()).comments.filter(
        (item: any) => item.projectId === project.id,
      );
  await page.goto(base + "/project/" + project.id);
  const editable = page.getByRole("textbox", {
    name: "Add description…",
    exact: true,
  });
  await expect(editable).toContainText("Review this delivery scope");
  await editable
    .locator("p")
    .first()
    .evaluate((element) => {
      const node = element.firstChild!,
        start = node.textContent!.indexOf("delivery scope"),
        range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + "delivery scope".length);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      (element.closest("[contenteditable=true]") as HTMLElement).focus();
      document.dispatchEvent(new Event("selectionchange"));
    });
  await page.keyboard.press("ControlOrMeta+Alt+m");
  let panel = page.getByRole("dialog", {
    name: "New inline comment",
    exact: true,
  });
  await panel
    .getByRole("textbox", { name: "Comment on selected text…", exact: true })
    .fill("Please confirm the project scope.");
  await panel.getByRole("button", { name: "Comment", exact: true }).click();
  await expect
    .poll(
      async () => (await comments()).filter((item: any) => item.anchor).length,
    )
    .toBe(1);
  const anchored = (await comments()).find((item: any) => item.anchor);
  expect(anchored.anchor.quote).toBe("delivery scope");
  panel = page.getByRole("dialog", {
    name: "Project comment thread",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Close comment", exact: true })
    .click();
  const highlight = editable.locator(
    '[data-inline-comment-id="' + anchored.id + '"]',
  );
  await expect(highlight).toHaveText("delivery scope");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.insertText("Updated: ");
  await expect
    .poll(async () => (await record()).description)
    .toContain("Updated: Review");
  await expect(highlight).toHaveText("delivery scope");
  await expect
    .poll(async () =>
      (await record()).history?.some(
        (entry: any) =>
          entry.content.includes("Review this delivery scope") &&
          !entry.content.includes("Updated:"),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Project description history", exact: true })
    .click();
  const history = page.getByRole("complementary", {
    name: "Project description history",
    exact: true,
  });
  await history
    .locator(".feature-history-version")
    .filter({ hasText: "Review this delivery scope" })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Restore project description?",
    exact: true,
  });
  await expect(dialog).toContainText("Review this delivery scope");
  await dialog
    .getByRole("button", { name: "Restore version", exact: true })
    .click();
  await expect
    .poll(async () => (await record()).description)
    .toBe("<p>Review this delivery scope with the team.</p>");
  await expect(editable).toHaveText(
    "Review this delivery scope with the team.",
  );
  await expect
    .poll(async () =>
      (await record()).history.some((entry: any) =>
        entry.content.includes("Updated:"),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(editable).toHaveText(
    "Review this delivery scope with the team.",
  );
  await expect(
    page.getByRole("button", { name: "delivery scope", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "delivery scope", exact: true })
    .click();
  panel = page.getByRole("dialog", {
    name: "Project comment thread",
    exact: true,
  });
  await expect(panel).toContainText("Please confirm the project scope.");
  await panel
    .getByRole("textbox", { name: "Reply to thread…", exact: true })
    .fill("Confirmed for this project.");
  await panel.getByRole("button", { name: "Reply", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await comments()).filter((item: any) => item.parentId === anchored.id)
          .length,
    )
    .toBe(1);
  await page.screenshot({
    path: "artifacts/product-ui/project-description-review.png",
  });
  await panel
    .getByRole("button", { name: "Resolve thread", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await comments()).find((item: any) => item.id === anchored.id)
          .resolved,
    )
    .toBe(true);
});

test("milestone double-click remains available when its popover opens at the bottom viewport edge", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1440, height: 800 });
  const create = async (kind: string, data: any) => {
    const response = await page.request.post(base + "/api/v1/" + kind, {
      data,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  for (let index = 0; index < 22; index++)
    await create("projects", {
      name: "A bottom edge spacer " + String(index).padStart(2, "0"),
    });
  const today = new Date().toISOString().slice(0, 10),
    project = await create("projects", {
      name: "Z bottom edge milestone project",
      startDate: today,
      targetDate: today,
    }),
    milestone = await create("milestones", {
      name: "Bottom edge milestone",
      projectId: project.id,
      targetDate: today,
    });
  await page.goto(base + "/projects");
  await page
    .getByRole("button", { name: "Project display options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Timeline layout", exact: true })
    .click();
  await page.keyboard.press("Escape");
  const marker = page.locator('[data-milestone-id="' + milestone.id + '"]');
  await marker.evaluate((element) => element.scrollIntoView({ block: "end" }));
  await marker.click();
  const panel = page.getByRole("dialog", {
    name: "Milestone details",
    exact: true,
  });
  await expect(panel).toBeVisible();
  const anchor = await marker.boundingBox(),
    popup = await panel.boundingBox();
  expect(anchor).toBeTruthy();
  expect(popup).toBeTruthy();
  expect(
    popup!.y + popup!.height <= anchor!.y ||
      popup!.y >= anchor!.y + anchor!.height,
  ).toBe(true);
  await page.keyboard.press("Escape");
  await marker.dblclick();
  await expect(page).toHaveURL(
    new RegExp(
      "/project/" + project.id + "/issues\\?milestone=" + milestone.id,
    ),
  );
});

test("initiative drag reorders siblings, Alt nests and outdent preserves unrelated parents and saved positions", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const create = async (data: any) => {
      const response = await page.request.post(base + "/api/v1/initiatives", {
        data: { status: "active", ...data },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    },
    state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    record = async (id: string) =>
      (await state()).initiatives.find((item: any) => item.id === id);
  const parentA = await create({ name: "Drag planning A", position: 0 }),
    parentB = await create({ name: "Drag planning B", position: 100 }),
    moving = await create({ name: "Drag planning moving", position: 200 }),
    child = await create({
      name: "Drag planning shared child",
      parentIds: [parentA.id, parentB.id],
      parentPositions: { [parentA.id]: 100, [parentB.id]: 700 },
    }),
    sibling = await create({
      name: "Drag planning sibling",
      parentIds: [parentA.id],
      parentPositions: { [parentA.id]: 200 },
    });
  await page.goto(base + "/initiatives");
  await page
    .getByRole("button", { name: "All initiatives", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search…", exact: true })
    .fill("Drag planning");
  const row = (id: string, parentId = "") =>
    page.locator(
      '.initiative-tree-row[data-initiative-id="' +
        id +
        '"][data-parent-id="' +
        parentId +
        '"]',
    );
  await row(moving.id).dragTo(row(parentA.id), {
    targetPosition: { x: 140, y: 3 },
  });
  await expect
    .poll(async () => (await record(moving.id)).position)
    .toBeLessThan((await record(parentA.id)).position);
  expect((await record(moving.id)).parentIds || []).toEqual([]);
  await expect(row(moving.id)).toBeVisible();
  await page.keyboard.down("Alt");
  await row(moving.id).dragTo(row(parentA.id));
  await page.keyboard.up("Alt");
  await expect
    .poll(async () => (await record(moving.id)).parentIds)
    .toEqual([parentA.id]);
  await expect(row(moving.id, parentA.id)).toBeVisible();
  await page.keyboard.down("Alt");
  await row(moving.id, parentA.id).dragTo(row(parentB.id));
  await page.keyboard.up("Alt");
  await expect
    .poll(async () => (await record(moving.id)).parentIds)
    .toEqual([parentB.id]);
  expect((await record(moving.id)).parentPositions[parentA.id]).toBeUndefined();
  await expect(row(moving.id, parentB.id)).toBeVisible();
  await page.keyboard.down("Alt");
  await row(moving.id, parentB.id).dragTo(row(parentA.id));
  await page.keyboard.up("Alt");
  await expect
    .poll(async () => (await record(moving.id)).parentIds)
    .toEqual([parentA.id]);
  expect((await record(moving.id)).parentPositions[parentB.id]).toBeUndefined();
  await expect(row(moving.id, parentA.id)).toBeVisible();
  const siblingBox = await row(sibling.id, parentA.id).boundingBox();
  await row(child.id, parentA.id).dragTo(row(sibling.id, parentA.id), {
    targetPosition: { x: 150, y: siblingBox!.height - 3 },
  });
  await expect
    .poll(async () => (await record(child.id)).parentPositions[parentA.id])
    .toBeGreaterThan((await record(sibling.id)).parentPositions[parentA.id]);
  expect((await record(child.id)).parentPositions[parentB.id]).toBe(700);
  await row(child.id, parentA.id).dragTo(
    page.getByLabel("Move to top level", { exact: true }),
  );
  await expect
    .poll(async () => (await record(child.id)).parentIds)
    .toEqual([parentB.id]);
  await expect(row(child.id, parentA.id)).toHaveCount(0);
  await expect(row(child.id, parentB.id)).toBeVisible();
  await row(moving.id, parentA.id).dragTo(row(parentB.id), {
    targetPosition: { x: 140, y: 3 },
  });
  await expect
    .poll(async () => (await record(moving.id)).parentIds)
    .toEqual([]);
  await expect(row(moving.id)).toBeVisible();
  await row(moving.id).focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect
    .poll(async () => (await record(moving.id)).position)
    .toBeGreaterThan((await record(parentB.id)).position);
  const sourceBox = await row(parentB.id).boundingBox(),
    targetBox = await row(parentA.id).boundingBox();
  await page.keyboard.down("Alt");
  await page.mouse.move(sourceBox!.x + 150, sourceBox!.y + 20);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + 150, targetBox!.y + 20, { steps: 10 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.keyboard.up("Alt");
  expect((await record(parentB.id)).parentIds || []).toEqual([]);
  await expect(page).toHaveURL(/initiatives/);
  await page.keyboard.down("Alt");
  await row(parentA.id).dragTo(row(sibling.id, parentA.id));
  await page.keyboard.up("Alt");
  await expect(
    page.getByText(
      "An initiative cannot be nested inside itself or its descendants.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await record(parentA.id)).parentIds || []).toEqual([]);
  await page.reload();
  await page
    .getByRole("textbox", { name: "Search…", exact: true })
    .fill("Drag planning");
  await expect(row(child.id, parentB.id)).toBeVisible();
  await expect(row(moving.id)).toBeVisible();
  expect((await record(child.id)).parentPositions[parentB.id]).toBe(700);
  await page.screenshot({
    path: "artifacts/product-ui/initiative-ordered-hierarchy.png",
  });
});

test("saved initiative views retain filters, search, grouping and workspace or scoped tabs", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const create = async (kind: string, data: any) => {
      const response = await page.request.post(base + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    },
    state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json();
  const root = await create("initiatives", {
      name: "View planning parent",
      status: "active",
    }),
    planned = await create("initiatives", {
      name: "View planning planned",
      status: "planned",
      priority: 1,
      parentIds: [root.id],
    }),
    completed = await create("initiatives", {
      name: "View planning completed",
      status: "completed",
      priority: 1,
      parentIds: [root.id],
    }),
    outside = await create("initiatives", {
      name: "View planning outside",
      status: "planned",
      priority: 1,
    });
  await page.goto(base + "/initiatives");
  await page
    .getByRole("button", { name: "All initiatives", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search…", exact: true })
    .fill("View planning");
  await page
    .getByLabel("Filter initiative priority", { exact: true })
    .selectOption("1");
  await page
    .getByLabel("Group initiatives", { exact: true })
    .selectOption("status");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "New view", exact: true });
  await expect(dialog.getByLabel("Content", { exact: true })).toHaveValue(
    "initiatives",
  );
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Priority initiative planning");
  await dialog.getByLabel("Save to", { exact: true }).selectOption("workspace");
  await dialog
    .getByRole("button", { name: "Create view", exact: true })
    .click();
  await expect(page).toHaveURL(/\/view\//);
  const view = (await state()).views.find(
    (item: any) => item.name === "Priority initiative planning",
  );
  expect(view.entityType).toBe("initiatives");
  expect(view.display.grouping).toBe("status");
  expect(view.searchQuery).toBe("View planning");
  await expect(
    page.getByRole("button", {
      name: "Priority initiative planning",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(".initiative-context").filter({ hasText: root.name }),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByLabel("Group initiatives", { exact: true }),
  ).toHaveValue("status");
  await expect(
    page.getByRole("textbox", { name: "Search…", exact: true }),
  ).toHaveValue("View planning");
  await page
    .getByRole("button", {
      name: "View actions: Priority initiative planning",
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: "Edit view", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit view", exact: true });
  await dialog.getByRole("button", { name: "Add filter", exact: true }).click();
  await dialog
    .getByLabel("Initiative filter 2 property", { exact: true })
    .selectOption("status");
  await dialog
    .getByLabel("Initiative filter 2 value", { exact: true })
    .selectOption("planned");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.locator(
      '.initiative-tree-row[data-initiative-id="' + completed.id + '"]',
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(
      '.initiative-tree-row[data-initiative-id="' + planned.id + '"]',
    ),
  ).toBeVisible();
  await page.goto(base + "/initiative/" + root.id);
  await page
    .getByRole("button", { name: "Add initiative view", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "New view", exact: true });
  await dialog.getByLabel("Name", { exact: true }).fill("Planned children");
  await dialog.getByRole("button", { name: "Add filter", exact: true }).click();
  await dialog
    .getByLabel("Initiative filter 1 property", { exact: true })
    .selectOption("status");
  await dialog
    .getByLabel("Initiative filter 1 value", { exact: true })
    .selectOption("planned");
  await dialog
    .getByRole("button", { name: "Create view", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("/initiative/" + root.id + "/view-"));
  await expect(
    page.locator(
      '.initiative-tree-row[data-initiative-id="' + planned.id + '"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '.initiative-tree-row[data-initiative-id="' + outside.id + '"]',
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(
      '.initiative-tree-row[data-initiative-id="' + completed.id + '"]',
    ),
  ).toHaveCount(0);
  const scoped = (await state()).views.find(
    (item: any) => item.name === "Planned children",
  );
  expect(scoped.initiativeId).toBe(root.id);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Planned children", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Planned children", exact: true })
    .click();
  await page.screenshot({
    path: "artifacts/product-ui/initiative-scoped-view.png",
  });
  await page.goto(base + "/views");
  await page
    .getByRole("link", { name: "Planned children", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp("/initiative/" + root.id + "/view-" + scoped.id),
  );
  await page
    .getByRole("button", {
      name: "View actions: Planned children",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Delete view", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Delete Planned children?",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Planned children", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await state()).views.find((item: any) => item.id === scoped.id)
          ?.deletedAt,
    )
    .toBeTruthy();
  expect(
    (await state()).initiatives.find((item: any) => item.id === planned.id)
      ?.deletedAt,
  ).toBeFalsy();
});

test("workflow status categories are chosen on creation and stay read-only while editing metadata", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    initial = await state(),
    team = initial.teams[0];
  await page.goto(base + "/settings/team-" + team.id + "?section=Workflow");
  await page
    .getByRole("button", { name: "New workflow status", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "New workflow status",
    exact: true,
  });
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Workflow custom review");
  await dialog
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("started");
  await dialog.getByLabel("Color", { exact: true }).fill("#9f7aea");
  await dialog
    .getByLabel("Description", { exact: true })
    .fill("Waiting for a code review.");
  await dialog
    .getByRole("button", { name: "Create status", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(
      async () =>
        (await state()).statuses.find(
          (item: any) => item.name === "Workflow custom review",
        )?.type,
    )
    .toBe("started");
  const status = (await state()).statuses.find(
    (item: any) => item.name === "Workflow custom review",
  );
  const row = page.locator('[data-workflow-status-id="' + status.id + '"]');
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  dialog = page.getByRole("dialog", {
    name: "Edit workflow status",
    exact: true,
  });
  await expect(
    dialog.getByRole("combobox", { name: "Category", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("textbox", { name: "Category", exact: true }),
  ).toHaveValue("Started");
  await expect(
    dialog.getByRole("textbox", { name: "Category", exact: true }),
  ).toHaveJSProperty("readOnly", true);
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Workflow reviewed delivery");
  await dialog.getByLabel("Color", { exact: true }).fill("#f2994a");
  await dialog
    .getByLabel("Description", { exact: true })
    .fill("Implementation reviewed, ready for verification.");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(async () => {
      const saved = (await state()).statuses.find(
        (item: any) => item.id === status.id,
      );
      return [saved?.name, saved?.color, saved?.description, saved?.type];
    })
    .toEqual([
      "Workflow reviewed delivery",
      "#f2994a",
      "Implementation reviewed, ready for verification.",
      "started",
    ]);
  await page.reload();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  dialog = page.getByRole("dialog", {
    name: "Edit workflow status",
    exact: true,
  });
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
    "Workflow reviewed delivery",
  );
  await expect(dialog.getByLabel("Color", { exact: true })).toHaveValue(
    "#f2994a",
  );
  await expect(dialog.getByLabel("Description", { exact: true })).toHaveValue(
    "Implementation reviewed, ready for verification.",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Category", exact: true }),
  ).toHaveValue("Started");
  await expect(
    dialog.getByRole("textbox", { name: "Category", exact: true }),
  ).toHaveJSProperty("readOnly", true);
  await page.screenshot({
    path: "artifacts/product-ui/workflow-category-readonly.png",
  });
});

test("workflow groups constrain reordering, protect Duplicate and apply explicit or first-Backlog defaults to new issues", async ({
  page,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  const state = async () =>
      await (await page.request.get(base + "/api/v1/state")).json(),
    create = async (kind: string, data: any) => {
      const response = await page.request.post(base + "/api/v1/" + kind, {
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
  const team = await create("teams", {
      name: "Workflow grouping QA",
      key: "WFG",
      triageEnabled: true,
    }),
    initial = await state(),
    teamStatuses = initial.statuses.filter(
      (item: any) => item.teamId === team.id,
    ),
    backlog = teamStatuses.find((item: any) => item.type === "backlog");
  const first = await create("statuses", {
      teamId: team.id,
      name: "Workflow review first",
      type: "started",
      position: 100,
      color: "#9f7aea",
    }),
    second = await create("statuses", {
      teamId: team.id,
      name: "Workflow review second",
      type: "started",
      position: 200,
      color: "#f2994a",
    }),
    customBacklog = await create("statuses", {
      teamId: team.id,
      name: "Workflow first intake",
      type: "backlog",
      position: 300,
      color: "#858699",
    }),
    todo = await create("statuses", {
      teamId: team.id,
      name: "Workflow selected default",
      type: "unstarted",
      position: 300,
      color: "#858699",
    });
  await page.goto(base + "/settings/team-" + team.id + "?section=Workflow");
  await expect(
    page.locator('[data-system-workflow-status="duplicate"]'),
  ).toContainText("Duplicate");
  await expect(
    page
      .locator('[data-system-workflow-status="duplicate"]')
      .getByRole("button"),
  ).toHaveCount(0);
  const canonical = await create("issues", {
    teamId: team.id,
    title: "Workflow canonical request",
  });
  await create("issues", {
    teamId: team.id,
    title: "Workflow duplicate request",
    duplicateOfId: canonical.id,
  });
  await page.goto(base + "/settings/team-" + team.id + "?section=Workflow");
  const row = (id: string) =>
      page.locator('[data-workflow-status-id="' + id + '"]'),
    record = async (id: string) =>
      (await state()).statuses.find((item: any) => item.id === id);
  const positionDifference = async (leftId: string, rightId: string) => {
    const statuses = (await state()).statuses;
    return (
      statuses.find((item: any) => item.id === leftId)?.position -
      statuses.find((item: any) => item.id === rightId)?.position
    );
  };
  await expect(page.locator("[data-workflow-category]")).toHaveCount(7);
  expect(
    await page
      .locator("[data-workflow-category]")
      .evaluateAll((elements) =>
        elements.map((element) =>
          element.getAttribute("data-workflow-category"),
        ),
      ),
  ).toEqual([
    "triage",
    "backlog",
    "unstarted",
    "started",
    "completed",
    "canceled",
    "duplicate",
  ]);
  await expect(row(backlog.id)).toContainText("Default");
  await row(second.id).dragTo(row(first.id), {
    targetPosition: { x: 100, y: 3 },
  });
  await expect
    .poll(() => positionDifference(second.id, first.id))
    .toBeLessThan(0);
  await row(second.id).focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect
    .poll(() => positionDifference(second.id, first.id))
    .toBeGreaterThan(0);
  const positions = [
    (await record(first.id)).position,
    (await record(backlog.id)).position,
  ];
  await row(first.id).dragTo(row(backlog.id), {
    targetPosition: { x: 100, y: 3 },
  });
  expect([
    (await record(first.id)).position,
    (await record(backlog.id)).position,
  ]).toEqual(positions);
  expect((await record(first.id)).type).toBe("started");
  const duplicate = (await state()).statuses.find(
    (item: any) => item.teamId === team.id && item.type === "duplicate",
  );
  await expect(row(duplicate.id)).toContainText("System managed");
  await expect(row(duplicate.id).getByRole("button")).toHaveCount(0);
  await expect(row(duplicate.id)).toHaveAttribute("draggable", "false");
  await expect(
    row(first.id).getByRole("button", { name: "Make default", exact: true }),
  ).toHaveCount(0);
  await row(todo.id).hover();
  await row(todo.id)
    .getByRole("button", { name: "Make default", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state()).teams.find((item: any) => item.id === team.id)
          ?.defaultStatusId,
    )
    .toBe(todo.id);
  await expect(row(todo.id)).toContainText("Default");
  const compose = async (title: string, expectedStatus: string) => {
    await page.goto(
      base + "/team/" + team.key + "/new?title=" + encodeURIComponent(title),
    );
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      title,
    );
    await expect(page.locator(".composer-properties")).toContainText(
      expectedStatus,
    );
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).issues.find((item: any) => item.title === title)
            ?.statusId,
      )
      .toBe(expectedStatus === todo.name ? todo.id : customBacklog.id);
  };
  await compose("Workflow explicit default issue", todo.name);
  await page.goto(base + "/settings/team-" + team.id + "?section=Workflow");
  await row(todo.id)
    .getByRole("button", {
      name: "Workflow status actions: " + todo.name,
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Use first Backlog status", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state()).teams.find((item: any) => item.id === team.id)
          ?.defaultStatusId ?? null,
    )
    .toBeNull();
  await row(customBacklog.id).dragTo(row(backlog.id), {
    targetPosition: { x: 100, y: 3 },
  });
  await expect
    .poll(() => positionDifference(customBacklog.id, backlog.id))
    .toBeLessThan(0);
  await expect(row(customBacklog.id)).toContainText("Default");
  await page.reload();
  await expect(row(customBacklog.id)).toContainText("Default");
  const backlogOrder = await page
    .locator('[data-workflow-category="backlog"] [data-workflow-status-id]')
    .evaluateAll((elements) =>
      elements.map((element) =>
        element.getAttribute("data-workflow-status-id"),
      ),
    );
  expect(backlogOrder[0]).toBe(customBacklog.id);
  await page.screenshot({
    path: "artifacts/product-ui/workflow-grouped-defaults.png",
  });
  await compose("Workflow first backlog issue", customBacklog.name);
});
