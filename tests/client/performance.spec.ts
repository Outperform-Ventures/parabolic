import { test, expect } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { arch, cpus, platform, release, totalmem } from "node:os";

const issueCount = Number(process.env.PARABOLIC_PERF_ISSUES || 10000);
test(`${issueCount.toLocaleString()} issues hydrate progressively while the list remains virtualized and interactive`, async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(20_000);
  await page.setViewportSize({ width: 1777, height: 991 });
  const app = createApp({
    databasePath: ":memory:",
    host: "127.0.0.1",
    port: 0,
    staticDir: resolve("dist"),
  });
  const { url } = await app.start();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__parabolicInputFrames = [];
    document.addEventListener("pointerdown", event => {
      if (!(event.target instanceof Element) || !event.target.closest(".row-checkbox")) return;
      const start = performance.now();
      const hydrating = document.body.textContent?.includes("Loading workspace…") ?? false;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        (window as any).__parabolicInputFrames.push({
          pointerDownToSecondAnimationFrameMs: performance.now() - start,
          hydrating,
        });
      }));
    }, true);
  });
  try {
    const setup = await page.request.post(`${url}/auth/setup`, {
      data: {
        name: "Performance QA",
        email: "perf@example.test",
        password: "isolated-performance-test",
        workspaceName: "Parabolic",
      },
    });
    expect(setup.ok()).toBeTruthy();
    const state = await (await page.request.get(`${url}/api/v1/state`)).json();
    const team = state.teams[0];
    const status = state.statuses.find((s: any) => s.type === "unstarted");
    const actor = {
      userId: state.user.id,
      workspaceId: state.workspaceId,
      role: "owner",
      scopes: ["read", "write", "admin"],
    };
    const seedStart = performance.now();
    app.repo.transaction(() => {
      for (let i = 0; i < issueCount; i++)
        app.repo.create(actor, "issues", {
          title: `Task ${String(i + 1).padStart(String(issueCount).length, "0")} — ${["Improve keyboard navigation", "Review project milestones", "Resolve notification delivery", "Refine the request form"][i % 4]}`,
          teamId: team.id,
          statusId: status.id,
          priority: i % 5,
          estimate: i % 8,
          sortOrder: i,
        });
    });
    const seedMs = performance.now() - seedStart;
    const started = performance.now();
    await page.goto(`${url}/team/${team.id}/all`);
    await expect(page.getByTestId("issue-row").first()).toBeVisible();
    const firstRowMs = performance.now() - started;
    const interactionDuringHydration = await page
      .getByText("Loading workspace…", { exact: true })
      .isVisible();
    const firstRow = page.getByTestId("issue-row").first();
    const interactionStarted = performance.now();
    await firstRow.locator(".row-checkbox").click();
    await expect(page.locator(".issue-view")).toHaveAttribute(
      "data-selected-ids",
      /.+/,
    );
    const selectedIssueId = await page
      .locator(".issue-view")
      .getAttribute("data-selected-ids");
    const firstSelectionMs = performance.now() - interactionStarted;
    await expect(page.getByRole("table", { name: "Issues" })).toHaveAttribute(
      "aria-rowcount",
      String(issueCount),
      { timeout: 60_000 },
    );
    await expect(
      page.getByText("Loading workspace…", { exact: true }),
    ).toHaveCount(0, { timeout: 60_000 });
    const hydratedMs = performance.now() - started;
    await expect(page.locator(".issue-view")).toHaveAttribute(
      "data-selected-ids",
      selectedIssueId!,
    );
    await page.keyboard.press("Escape");
    // Measure inside the renderer, separately from Playwright actionability/network time.
    const sampleStart = await page.evaluate(() => (window as any).__parabolicInputFrames.length);
    for (let index = 0; index < 20; index++) {
      await page.getByTestId("issue-row").first().locator(".row-checkbox").click();
      await page.waitForFunction(count => (window as any).__parabolicInputFrames.length >= count, sampleStart + index + 1);
    }
    const inputFrames = await page.evaluate(() => (window as any).__parabolicInputFrames as { pointerDownToSecondAnimationFrameMs: number; hydrating: boolean }[]);
    const warmInputMs = inputFrames.slice(sampleStart).map(sample => sample.pointerDownToSecondAnimationFrameMs).sort((a, b) => a - b);
    await page.keyboard.press("Escape");
    const mounted = await page.getByTestId("issue-row").count();
    expect(mounted).toBeLessThan(100);
    await page.screenshot({
      path: `artifacts/performance/issues-${issueCount}.png`,
    });
    const scrollStart = performance.now();
    await page.locator(".issue-list-scroll").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(
      page.getByText(new RegExp(`Task ${issueCount}`)),
    ).toBeVisible();
    const scrollToLastMs = performance.now() - scrollStart;
    await page.locator(".issue-list-scroll").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page
      .getByRole("button", { name: "Filter issues", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Priority", exact: true }).click();
    await page.getByRole("menuitem", { name: "Urgent", exact: true }).click();
    await expect(page.getByRole("table", { name: "Issues" })).toHaveAttribute(
      "aria-rowcount",
      String(Math.floor(issueCount / 5)),
    );
    await page.getByRole("button", { name: "Remove Priority filter" }).click();
    await page
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page.getByLabel("Grouping", { exact: true }).selectOption("none");
    await page.getByRole("tab", { name: "Board", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".board-virtual-scroll")).toHaveAttribute(
      "data-total-issues",
      String(issueCount),
    );
    expect(await page.locator(".board-card").count()).toBeLessThan(100);
    await page
      .locator(".board-virtual-scroll")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(page.locator(".board-card").last()).toContainText(
      `Task ${issueCount}`,
    );
    await page.locator(".board-card").last().click();
    await expect(page.getByLabel("Issue title", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    mkdirSync("artifacts/performance", { recursive: true });
    writeFileSync(
      `artifacts/performance/ui-${issueCount}.json`,
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          environment: {
            platform: platform(),
            release: release(),
            arch: arch(),
            cpu: cpus()[0]?.model,
            cpuCount: cpus().length,
            memoryBytes: totalmem(),
            node: process.version,
            browserVersion: browser.version(),
            headless: true,
            rendererIndexSha256: createHash("sha256")
              .update(readFileSync(resolve("dist/index.html")))
              .digest("hex"),
          },
          viewport: { width: 1777, height: 991 },
          issueCount,
          seedMs,
          firstRowMs,
          interactionDuringHydration,
          firstSelectionMs,
          rendererInput: {
            metric: "Pointerdown capture to the second requestAnimationFrame callback; includes one paint opportunity, not an OS display measurement",
            samples: inputFrames,
            warmSampleCount: warmInputMs.length,
            warmP50Ms: warmInputMs[Math.ceil(warmInputMs.length * 0.5) - 1],
            warmP95Ms: warmInputMs[Math.ceil(warmInputMs.length * 0.95) - 1],
            warmMaxMs: warmInputMs.at(-1),
          },
          hydratedMs,
          mountedRows: mounted,
          scrollToLastMs,
          assertions: [
            "all records hydrated",
            "early selection survives progressive hydration",
            "fewer than 100 mounted rows",
            "last row reachable",
            `priority filter yields ${Math.floor(issueCount / 5)} issues`,
            `board also virtualizes ${issueCount} cards and reaches final item`,
            "issue opens",
            "no browser exceptions",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
});
