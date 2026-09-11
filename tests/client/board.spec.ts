import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";

test('manual drag preserves multi-selection order and display properties apply to boards',async({page})=>{
 test.setTimeout(90_000);page.setDefaultTimeout(12_000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url}=await app.start();
 try{
  await page.request.post(`${url}/auth/setup`,{data:{name:'Ordering QA',email:'ordering@example.test',password:'isolated-ordering-password',workspaceName:'Ordering'}});const state=async()=>(await page.request.get(`${url}/api/v1/state`)).json();const initial=await state(),team=initial.teams[0],items:any[]=[];
  for(let index=0;index<3;index++)items.push(await(await page.request.post(`${url}/api/v1/issues`,{data:{title:`Ordered item ${index+1}`,teamId:team.id,sortOrder:(index+1)*100,priority:3}})).json());
  await page.goto(`${url}/team/${team.id}/all`);await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByLabel('Grouping',{exact:true}).selectOption('none');await page.keyboard.press('Escape');await page.getByRole('button',{name:`Select ${items[1].identifier}`,exact:true}).click();await page.getByRole('button',{name:`Select ${items[2].identifier}`,exact:true}).click();await page.locator(`[data-testid="issue-row"][data-issue-id="${items[1].id}"]`).dragTo(page.locator(`[data-testid="issue-row"][data-issue-id="${items[0].id}"]`));await expect.poll(async()=>(await state()).issues.sort((a:any,b:any)=>a.sortOrder-b.sortOrder).map((i:any)=>i.title)).toEqual(['Ordered item 2','Ordered item 3','Ordered item 1']);await expect(page.getByTestId('issue-row').first()).toContainText('Ordered item 2');
  await page.getByRole('button',{name:'Display options',exact:true}).click();await page.getByRole('button',{name:'Display identifier',exact:true}).click();await page.getByRole('button',{name:'Display statusId',exact:true}).click();await page.getByRole('button',{name:'Board',exact:true}).click();await page.keyboard.press('Escape');await expect(page.locator('.board-card')).toHaveCount(3);await expect(page.locator('.board-card').first()).not.toContainText(items[1].identifier);await page.reload();await expect(page.locator('.board-card').first()).toContainText('Ordered item 2');await expect(page.locator('.board-card').first()).not.toContainText(items[1].identifier);
 }finally{await page.close();await app.close()}
});

test("issue groups and boards move typed properties, create in groups and retain display defaults", async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(12_000);
  await page.setViewportSize({ width: 1777, height: 991 });
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
        name: "Board QA",
        email: "board@example.test",
        password: "isolated-board-password",
        workspaceName: "Board",
      },
    });
    const state = async () =>
      (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state(),
      team = initial.teams[0];
    const issue = await (
      await page.request.post(`${url}/api/v1/issues`, {
        data: {
          title: "Move across groups",
          teamId: team.id,
          statusId: initial.statuses.find(
            (s: any) => s.teamId === team.id && s.type === "unstarted",
          ).id,
          priority: 2,
          estimate: 3,
          assigneeId: initial.user.id,
        },
      })
    ).json();
    await page.goto(`${url}/team/${team.id}/all`);
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByLabel("Grouping", { exact: true }).selectOption("priority");
    await page.keyboard.press("Escape");
    await page
      .locator(`[data-testid="issue-row"][data-issue-id="${issue.id}"]`)
      .dragTo(
        page
          .locator(".group-header")
          .filter({ has: page.getByText("Urgent", { exact: true }) }),
      );
    await expect.poll(async () => (await state()).issues[0].priority).toBe(1);
    await page
      .getByRole("button", { name: "Add issue to No priority", exact: true })
      .click();
    await page
      .getByLabel("Issue title", { exact: true })
      .fill("New from empty priority");
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    await expect.poll(async () => (await state()).issues.length).toBe(2);
    expect(
      (await state()).issues.find(
        (i: any) => i.title === "New from empty priority",
      ).priority,
    ).toBe(0);
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page
      .getByRole("button", { name: "Set as default", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".board-card")).toHaveCount(2);
    await page.locator(`.board-card[data-issue-id="${issue.id}"]`).dragTo(
      page
        .locator(".board-column")
        .filter({ has: page.getByText("Medium", { exact: true }) })
        .locator(".group-header"),
    );
    await expect
      .poll(
        async () =>
          (await state()).issues.find((i: any) => i.id === issue.id).priority,
      )
      .toBe(3);
    await page.reload();
    await expect(page.locator(".board-card")).toHaveCount(2);
    expect((await state()).teams[0].displayDefaults.all.layout).toBe("board");
    await page.goto(`${url}/my-issues`);
    await expect(
      page
        .locator(".group-header")
        .filter({ has: page.getByText("Other active", { exact: true }) }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Created", exact: true }).click();
    await expect(page.getByTestId("issue-row")).toHaveCount(2);
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    await expect(page.getByTestId("issue-row")).toHaveCount(2);
    await page.keyboard.press("ControlOrMeta+f");
    await page
      .getByRole("textbox", { name: "Filter issue titles", exact: true })
      .fill("Move across");
    await expect(page.getByTestId("issue-row")).toHaveCount(1);
    await page
      .getByRole("textbox", { name: "Filter issue titles", exact: true })
      .press("Escape");
    await expect(page.getByTestId("issue-row")).toHaveCount(2);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
