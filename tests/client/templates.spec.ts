import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test("templates enforce forms, create child work, apply defaults and replace grouped labels", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(12_000);
  const app = createApp({
    databasePath: ":memory:",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Template QA",
        email: "templates@example.test",
        password: "isolated-template-password",
        workspaceName: "Templates",
      },
    });
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    const first = await state(),
      team = first.teams[0];
    for (const name of ["Frontend", "Backend"])
      expect(
        (
          await page.request.post(`${url}/api/v1/labels`, {
            data: {
              name,
              group: "Component",
              teamId: team.id,
              entityType: "issues",
            },
          })
        ).ok(),
      ).toBeTruthy();
    await page.goto(`${url}/settings/templates`);
    await page
      .getByRole("button", { name: "New template", exact: true })
      .click();
    await page.getByRole('button',{name:/Custom Form Define structured/}).click();
    let dialog = page.getByRole("region",{name:'New template',exact:true});
    await dialog
      .getByLabel("Template name", { exact: true })
      .fill("Bug report");
    await dialog
      .getByLabel("Template team", { exact: true })
      .selectOption(team.id);
    await dialog
      .getByRole("button", { name: "Add field", exact: true })
      .click();
    await dialog
      .getByLabel("Field 1 label", { exact: true })
      .fill("Reproduction steps");
    await dialog.getByLabel("Field 1 description", {exact:true}).fill("Explain each step and the result.");
    await dialog
      .getByLabel("Field 1 type", { exact: true })
      .selectOption("textarea");
    await dialog.getByLabel("Required", { exact: true }).check();
    await dialog.getByRole('button',{name:'Open menu',exact:true}).click();
    await dialog
      .getByRole("button", { name: "Add template sub-issue", exact: true })
      .click();
    await dialog
      .getByLabel("Sub-issue 1 title", { exact: true })
      .fill("Add regression coverage");
    await dialog
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect.poll(async () => (await state()).templates.length).toBe(1);
    const template = (await state()).templates[0];
    expect(template.formFields[0].description).toBe("Explain each step and the result.");
    await page.goto(`${url}/team/${team.id}/new?template=${template.id}`);
    await expect(page.getByText("Explain each step and the result.",{exact:true})).toBeVisible();
    await page.getByLabel("Issue title", { exact: true }).fill("Investigate reported bug");
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect(page.locator(".composer-footer")).toContainText(
      "Complete required fields",
    );
    expect((await state()).issues).toHaveLength(0);
    await expect(page.getByLabel("Reproduction steps", {exact:true})).toBeFocused();
    await page
      .getByLabel("Reproduction steps", { exact: true })
      .fill("Open settings, then change the theme.");
    await page
      .getByRole("button", { name: "Change label", exact: true })
      .click();
    await page
      .locator(".property-menu")
      .getByRole("button", { name: "Component", exact: true })
      .click();
    await page
      .locator(".property-menu")
      .getByRole("button", { name: "Frontend", exact: true })
      .click();
    await page
      .locator(".property-menu")
      .getByRole("button", { name: "Backend", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect.poll(async () => (await state()).issues.length).toBe(2);
    const current = await state(),
      parent = current.issues.find((i: any) => !i.parentId);
    expect(parent.templateId).toBe(template.id);
    expect(parent.description).toContain("Open settings");
    expect(parent.labelIds).toEqual([
      current.labels.find((l: any) => l.name === "Backend").id,
    ]);
    expect(
      current.issues.find((i: any) => i.parentId === parent.id).title,
    ).toBe("Add regression coverage");
    await page.goto(`${url}/settings/templates`);
    await page
      .getByRole("button", { name: "New template", exact: true })
      .click();
    await page.getByRole('button',{name:/Standard Basic template/}).click();
    dialog = page.getByRole("region",{name:'New template',exact:true});
    await dialog
      .getByLabel("Template name", { exact: true })
      .fill("Standard task");
    await dialog
      .getByLabel("Template team", { exact: true })
      .selectOption(team.id);
    await dialog
      .getByLabel("Template default title", { exact: true })
      .fill("Default task title");
    await dialog
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect.poll(async () => (await state()).templates.length).toBe(2);
    const standard = (await state()).templates.find(
      (t: any) => t.name === "Standard task",
    );
    await page.goto(`${url}/settings/team-${team.id}`);
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await page
      .getByLabel("Team members default template", { exact: true })
      .selectOption(standard.id);
    await expect
      .poll(async () => (await state()).teams[0].defaultTemplateId)
      .toBe(standard.id);
    await page.goto(`${url}/team/${team.id}/all`);
    await expect(
      page.getByRole("button", { name: / Workspace Menu$/ }),
    ).toBeVisible();
    await page.keyboard.press("c");
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Default task title",
    );
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect.poll(async () => (await state()).issues.length).toBe(3);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
