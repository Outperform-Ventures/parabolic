import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
test("cached web app restarts offline, loads unvisited feature code, retains edits across reload and synchronizes without caching API responses", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const app = createApp({
      databasePath: ":memory:",
      port: 0,
      staticDir: resolve("dist"),
    }),
    { url } = await app.start(),
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let disconnected=false;
  const requestListeners=app.server.listeners('request');
  if(browserName==='webkit'){
    // Simulate an actual unreachable service. WebKit's setOffline automation
    // prevents its worker from fulfilling a cached navigation on this runtime.
    app.server.removeAllListeners('request');
    app.server.on('request',(request,response)=>{if(disconnected)request.socket.destroy();else for(const listener of requestListeners)listener.call(app.server,request,response);});
  }
  const setOffline=async(value:boolean)=>{if(browserName==='webkit'){disconnected=value;if(value)app.server.closeAllConnections();}else await context.setOffline(value);};
  try {
    await page.request.post(url + "/auth/setup", {
      data: {
        name: "Offline owner",
        email: "offline@example.test",
        password: "isolated-offline-test",
        workspaceName: "Offline workspace",
      },
    });
    const state = async () =>
        await (await page.request.get(url + "/api/v1/state")).json(),
      initial = await state();
    const issue = await (
      await page.request.post(url + "/api/v1/issues", {
        data: {
          teamId: initial.teams[0].id,
          title: "Offline continuity",
          description: "<p>Persistent issue content</p>",
        },
      })
    ).json();
    await page.goto(url + "/issues/" + issue.id);
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Offline continuity",
    );
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cached = await page.evaluate(async () => {
      const names = (await caches.keys()).filter((name) =>
        name.startsWith("parabolic-shell-"),
      );
      return (
        await Promise.all(
          names.map(async (name) =>
            (await (await caches.open(name)).keys()).map(
              (request) => new URL(request.url).pathname,
            ),
          ),
        )
      ).flat();
    });
    expect(cached).toContain("/index.html");
    expect(
      cached.some(
        (path) => path.startsWith("/assets/") && path.endsWith(".js"),
      ),
    ).toBe(true);
    expect(cached.some((path) => /^\/(api|auth|oauth)(\/|$)/.test(path))).toBe(
      false,
    );
    await expect(
      page.getByText("Loading workspace…", { exact: true }),
    ).toHaveCount(0);
    await setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Offline continuity",
    );
    await page
      .getByLabel("Issue title", { exact: true })
      .fill("Edited after offline restart");
    await page.getByLabel("Issue title", { exact: true }).blur();
    await expect(page.getByText(/1 syncing/)).toBeVisible();
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Edited after offline restart",
    );
    await page
      .getByRole("button", { name: "Search workspace", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Search workspace content", exact: true })
      .fill("offline continuity");
    await expect(
      page.getByRole("listbox", { name: "Search results" }).getByRole("option"),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Search workspace content", exact: true })
      .fill("Edited after offline restart");
    await expect(
      page.getByRole("listbox", { name: "Search results" }).getByRole("option"),
    ).toHaveCount(1);
    await setOffline(false);
    await expect
      .poll(
        async () =>
          (await state()).issues.find((row: any) => row.id === issue.id).title,
      )
      .toBe("Edited after offline restart");
    await expect(page.getByText(/1 syncing/)).toHaveCount(0);
    await page.goto(url + "/issues/" + issue.id);
    await expect(page.getByLabel("Issue title", { exact: true })).toHaveValue(
      "Edited after offline restart",
    );
    expect(errors).toEqual([]);
  } finally {
    await setOffline(false);
    await page.close();
    await app.close();
  }
});
