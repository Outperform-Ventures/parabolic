import { test, expect, type Page } from "@playwright/test";
import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../src/server/app";

test.use({ serviceWorkers: "block" });
const latch = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };

async function fixture(page: Page) {
  const cache = await mkdtemp(join(tmpdir(), "parabolic-history-race-")), allowedOrigins: string[] = [];
  const app = createApp({ databasePath: ":memory:", port: 0, allowedOrigins });
  const api = await app.start();
  app.scheduler.close();
  // Import the production store source without exposing a testing interface in the app.
  const vite = await createServer({
    configFile: false, root: fileURLToPath(new URL("../../", import.meta.url)), cacheDir: cache, logLevel: "error",
    server: { host: "127.0.0.1", port: 0, watch: null, proxy: { "/api": api.url, "/auth": api.url } },
    plugins: [{ name: "history-race-harness", configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/__history-test.html") return next();
        res.setHeader("Content-Type", "text/html");
        res.end('<!doctype html><title>History race harness</title><script type="module">import * as store from "/src/client/store.ts";import * as clock from "/src/client/history-clock.ts";window.__historyStore=store;window.__historyClock=clock;await store.initialize();window.__historyReady=true;</script>');
      });
    } }],
  });
  await vite.listen();
  const url = `http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`;
  allowedOrigins.push(url);
  const setup = await page.request.post(`${url}/auth/setup`, { data: { name: "History races", email: "history-race@example.test", password: "isolated-history-race-password" } });
  expect(setup.ok(), await setup.text()).toBeTruthy();
  const state = async () => (await page.request.get(`${url}/api/v1/state`)).json();
  const initial = await state(), issues: any[] = [];
  for (const title of ["Request before undo", "Pending undo target", "History-free lock holder"]) {
    const response = await page.request.post(`${url}/api/v1/issues`, { data: { teamId: initial.teams[0].id, title, priority: 0 } });
    expect(response.ok(), await response.text()).toBeTruthy(); issues.push(await response.json());
  }
  await page.goto(`${url}/__history-test.html`);
  await page.waitForFunction(() => (window as any).__historyReady);
  const priority = async (id: string) => (await state()).issues.find((issue: any) => issue.id === id).priority;
  const update = async (id: string, priority: number) => page.evaluate(async ({ id, priority }) => { await (window as any).__historyStore.getAppSnapshot().update("issues", id, { priority }); }, { id, priority });
  return { issues, priority, update, async close() { await page.close(); await vite.close(); await app.close(); await rm(cache, { recursive: true, force: true }); } };
}

test("Undo prevents a pending write from starting while it waits for the history persistence lock", async ({ page }) => {
  test.setTimeout(60_000); page.setDefaultTimeout(12_000);
  const f = await fixture(page), [first, target, automatic] = f.issues;
  const firstGate = latch(), targetGate = latch(); let firstStarted = false, targetStarted = false;
  await page.route("**/api/v1/batch", async route => {
    const operations = route.request().postDataJSON()?.operations ?? [];
    if (!firstStarted && operations.some((op: any) => op.id === first.id)) { firstStarted = true; await firstGate.promise; }
    if (!targetStarted && operations.some((op: any) => op.id === target.id && op.data?.priority === 2)) { targetStarted = true; await targetGate.promise; }
    await route.continue();
  });
  try {
    await f.update(first.id, 1); await expect.poll(() => firstStarted).toBe(true);
    await f.update(target.id, 2);
    await page.evaluate(id => {
      const w = window as any, original = IDBTransaction.prototype.addEventListener;
      w.__idbGate = { held: false, claimed: false };
      IDBTransaction.prototype.addEventListener = function (type: any, listener: any, options?: any) {
        if (type === "complete" && !w.__idbGate.claimed && this.db.name === "parabolic-client" && this.objectStoreNames.contains("outbox")) {
          w.__idbGate.claimed = true;
          return original.call(this, type, function (this: IDBTransaction, event) {
            w.__idbGate.held = true;
            w.__idbGate.release = () => { IDBTransaction.prototype.addEventListener = original; listener.call(this, event); };
          }, options);
        }
        return original.call(this, type, listener, options);
      };
      w.__automaticSettled = false;
      void w.__historyStore.batch([{ kind: "issues", id, data: { priority: 3 } }], { history: false }).then(() => { w.__automaticSettled = true; });
    }, automatic.id);
    await page.waitForFunction(() => (window as any).__idbGate.held);
    await page.evaluate(() => { const w = window as any; w.__undoSettled = false; void w.__historyStore.undo().then((result: boolean) => { w.__undoResult = result; w.__undoSettled = true; }); });
    firstGate.release(); await expect.poll(() => f.priority(first.id)).toBe(1);
    await page.evaluate(async () => { await new Promise(resolve => setTimeout(resolve, 75)); });
    expect(targetStarted, "Acknowledgement must wait for the history lock instead of sending the pending Undo target").toBe(false);
    expect(await page.evaluate(() => (window as any).__undoSettled)).toBe(false);
    await page.evaluate(() => (window as any).__idbGate.release());
    await page.waitForFunction(() => (window as any).__automaticSettled);
    await page.waitForFunction(() => (window as any).__undoSettled);
    expect(await page.evaluate(() => (window as any).__undoResult)).toBe(true);
    await expect.poll(() => f.priority(target.id)).toBe(0);
    await expect.poll(() => f.priority(automatic.id)).toBe(3);
    expect(await f.priority(first.id)).toBe(1);
    expect(targetStarted).toBe(false);
  } finally { firstGate.release(); targetGate.release(); await page.evaluate(() => (window as any).__idbGate?.release?.()).catch(() => {}); await f.close(); }
});

test("Undo reserves cancelled outbox writes until its IndexedDB transaction completes", async ({ page }) => {
  test.setTimeout(60_000); page.setDefaultTimeout(12_000);
  const f = await fixture(page), [first, target] = f.issues, firstGate = latch();
  let firstStarted = false, targetStarted = false;
  await page.route("**/api/v1/batch", async route => {
    const operations = route.request().postDataJSON()?.operations ?? [];
    if (!firstStarted && operations.some((op: any) => op.id === first.id)) { firstStarted = true; await firstGate.promise; }
    if (operations.some((op: any) => op.id === target.id)) targetStarted = true;
    await route.continue();
  });
  try {
    await f.update(first.id, 1); await expect.poll(() => firstStarted).toBe(true);
    await f.update(target.id, 2);
    await page.evaluate(() => {
      const w = window as any, original = IDBTransaction.prototype.addEventListener;
      w.__idbGate = { held: false, claimed: false };
      IDBTransaction.prototype.addEventListener = function (type: any, listener: any, options?: any) {
        if (type === "complete" && !w.__idbGate.claimed && this.db.name === "parabolic-client" && this.objectStoreNames.contains("outbox")) {
          w.__idbGate.claimed = true;
          return original.call(this, type, function (this: IDBTransaction, event) {
            w.__idbGate.held = true;
            w.__idbGate.release = () => { IDBTransaction.prototype.addEventListener = original; listener.call(this, event); };
          }, options);
        }
        return original.call(this, type, listener, options);
      };
      w.__undoSettled = false;
      void w.__historyStore.undo().then((result: boolean) => { w.__undoResult = result; w.__undoSettled = true; });
    });
    await page.waitForFunction(() => (window as any).__idbGate.held);
    firstGate.release(); await expect.poll(() => f.priority(first.id)).toBe(1);
    await page.evaluate(async () => { await new Promise(resolve => setTimeout(resolve, 75)); });
    expect(targetStarted, "flush must not send IDs claimed by an unfinished cancellation transaction").toBe(false);
    expect(await page.evaluate(() => (window as any).__undoSettled)).toBe(false);
    await page.evaluate(() => (window as any).__idbGate.release());
    await page.waitForFunction(() => (window as any).__undoSettled);
    expect(await page.evaluate(() => (window as any).__undoResult)).toBe(true);
    await page.waitForFunction(() => (window as any).__historyStore.getAppSnapshot().pending === 0);
    expect(targetStarted).toBe(false);
    expect(await f.priority(target.id)).toBe(0);
    // The unrelated acknowledgement must not persist a stale pre-cancellation history.
    // Inspect the durable state after a real reload, rather than trusting the live map.
    await page.reload();
    await page.waitForFunction(() => (window as any).__historyReady);
    const history = await page.evaluate(async () => {
      const snapshot = (window as any).__historyStore.getAppSnapshot();
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("parabolic-client");
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<any>((resolve, reject) => {
          const request = database.transaction("cache").objectStore("cache").get(`history:${snapshot.user.id}/${snapshot.data.workspaceId}`);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
      } finally { database.close(); }
    });
    expect(history.past.flatMap((frame: any) => frame.changes.map((change: any) => change.entityId))).toEqual([first.id]);
    expect(history.future.flatMap((frame: any) => frame.changes.map((change: any) => change.entityId))).toEqual([target.id]);
    expect(await page.evaluate(() => (window as any).__historyStore.getAppSnapshot().canRedo)).toBe(true);
    expect(await page.evaluate(() => (window as any).__historyStore.undo())).toBe(true);
    await expect.poll(() => f.priority(first.id)).toBe(0);
    expect(await f.priority(target.id)).toBe(0);
  } finally { firstGate.release(); await page.evaluate(() => (window as any).__idbGate?.release?.()).catch(() => {}); await f.close(); }
});

test("a new tab-close boundary invalidates Redo while it waits for an in-flight inverse", async ({ page }) => {
  test.setTimeout(60_000); page.setDefaultTimeout(12_000);
  const f = await fixture(page), target = f.issues[0], inverseGate = latch(); let inverseStarted = false;
  try {
    await f.update(target.id, 1); await expect.poll(() => f.priority(target.id)).toBe(1);
    await page.waitForFunction(() => (window as any).__historyStore.getAppSnapshot().pending === 0);
    await page.route("**/api/v1/batch", async route => {
      const operations = route.request().postDataJSON()?.operations ?? [];
      if (!inverseStarted && operations.some((op: any) => op.id === target.id && op.data?.priority === 0)) { inverseStarted = true; await inverseGate.promise; }
      await route.continue();
    });
    expect(await page.evaluate(() => (window as any).__historyStore.undo())).toBe(true);
    await expect.poll(() => inverseStarted).toBe(true);
    await page.evaluate(() => { const w = window as any; w.__redoSettled = false; void w.__historyStore.redo().then((result: boolean) => { w.__redoResult = result; w.__redoSettled = true; }); });
    await page.evaluate(() => {
      const w = window as any, snapshot = w.__historyStore.getAppSnapshot();
      const scope = `${snapshot.user.id}/${snapshot.data.workspaceId}`;
      // This is the exact clock boundary committed by a deliberate shell tab close.
      w.__historyClock.commitHistoryAction(scope, w.__historyClock.reserveHistoryTime(scope));
    });
    inverseGate.release();
    await page.waitForFunction(() => (window as any).__redoSettled);
    expect(await page.evaluate(() => (window as any).__redoResult)).toBe(false);
    await expect.poll(() => f.priority(target.id)).toBe(0);
    await page.waitForFunction(() => (window as any).__historyStore.getAppSnapshot().pending === 0);
    expect(await page.evaluate(() => (window as any).__historyStore.getAppSnapshot().canRedo)).toBe(false);
  } finally { inverseGate.release(); await f.close(); }
});
