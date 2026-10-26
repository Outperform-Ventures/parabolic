import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../../src/server/app';

test.use({ serviceWorkers: 'block' });

test('issue contents survive repeated Fast Refresh updates with columns open and closed', async ({ page }, info) => {
  test.setTimeout(60000);
  const cache = await mkdtemp(join(tmpdir(), 'parabolic-column-refresh-'));
  const allowedOrigins: string[] = [];
  const app = createApp({ databasePath: ':memory:', port: 0, allowedOrigins });
  const api = await app.start();
  const vite = await createServer({
    configFile: false, root: resolve('.'), cacheDir: cache, logLevel: 'error', plugins: [react()],
    server: { host: '127.0.0.1', port: 0, watch: null, proxy: { '/api': api.url, '/auth': api.url, '/collaboration': { target: api.url, ws: true } } },
  });
  try {
    await vite.listen();
    const url = `http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`;
    allowedOrigins.push(url);
    const setup = await page.request.post(url + '/auth/setup', { data: { name: 'Refresh Example', email: 'refresh@example.test', password: 'isolated-refresh-test' } });
    expect(setup.ok()).toBe(true);
    const state = await (await page.request.get(url + '/api/v1/state')).json();
    const actor = { userId: state.user.id, workspaceId: state.workspaceId, role: 'owner', scopes: ['admin'] };
    const issue = app.repo.create(actor, 'issues', { title: 'Keep this issue visible during hot reload', teamId: state.teams[0].id, priority: 2, estimate: 4 });
    const view = app.repo.create(actor, 'views', { name: 'Hot reload columns', entityType: 'issues', filters: { match: 'all', conditions: [] }, display: {
      groupBy: 'none', summaryOpen: false, properties: ['identifier', 'priority', 'statusId', 'estimate'], columnOrder: ['identifier', 'priority', 'statusId', 'estimate', 'title'],
    } });
    await page.goto(url + '/view/' + view.id);
    const row = page.locator(`[data-issue-id="${issue.id}"]`);
    await expect(row.locator('.issue-row-title')).toHaveText(issue.title);
    const documentId = await page.evaluate(() => ((window as any).__refreshDocument = crypto.randomUUID()));
    await page.getByRole('button', { name: 'Edit columns', exact: true }).click();
    for (const [index, editing] of [true, true, false].entries()) {
      if (index === 1) {
        await page.getByRole('separator', { name: 'Resize Priority column', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('[data-column-header="priority"]')).toHaveCSS('width', '96px');
      }
      if (!editing) await page.getByRole('button', { name: 'Save to View', exact: true }).click();
      const module = vite.moduleGraph.getModuleById(resolve('src/client/issue-column-editor.tsx'));
      expect(module).toBeTruthy();
      const refreshed = page.waitForEvent('console', message => message.text().includes('hot updated: /src/client/issue-column-editor.tsx'));
      await vite.reloadModule(module!);
      await refreshed;
      // Wait for React's refresh commit, not just receipt of the websocket update.
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
      expect(await page.evaluate(() => (window as any).__refreshDocument)).toBe(documentId);
      await expect(page.locator('.issue-column-headers')).toHaveCount(editing ? 1 : 0);
      await expect(row.locator('.issue-row-title')).toHaveText(issue.title);
      await expect(row.locator('.issue-identifier')).toHaveText(issue.identifier);
      await expect(row.locator('[data-property="priority"]')).toBeVisible();
      await expect(row.locator('[data-property="estimate"]')).toBeVisible();
      if (index > 0) await expect(row.locator('[data-column-cell="priority"]')).toHaveCSS('width', '96px');
      await page.screenshot({ path: info.outputPath(`columns-after-refresh-${editing ? 'open' : 'closed'}.png`) });
    }
    expect(app.repo.raw('issues', issue.id)!.version).toBe(issue.version);
    await expect.poll(() => app.repo.raw('views', view.id)!.display.columnWidths?.priority).toBe(96);
  } finally {
    await page.close(); await vite.close(); await app.close();
    await rm(cache, { recursive: true, force: true });
  }
});
