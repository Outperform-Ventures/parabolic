import {test, expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

// Native evidence: batch 140 converted selected description text immediately,
// replaced it with an issue reference, and Undo restored the original text.
test('description selection converts immediately and undo restores parent and child together', async ({page}) => {
  const app = createApp({databasePath: ':memory:', port: 0, staticDir: resolve('dist')});
  const {url} = await app.start();
  try {
    await page.request.post(`${url}/auth/setup`, {data: {
      name: 'Conversion owner', email: 'conversion@example.test', password: 'Conversion-test-password',
    }});
    const state = async () => (await page.request.get(`${url}/api/v1/state`)).json();
    const initial = await state();
    const source = '<p>Before. Convert this selected work. After.</p>';
    const issue = await (await page.request.post(`${url}/api/v1/issues`, {data: {
      title: 'Selection conversion parent', teamId: initial.teams[0].id, description: source,
    }})).json();
    await page.goto(`${url}/issues/${issue.id}`);
    const peer = await page.context().newPage();
    await peer.goto(`${url}/issues/${issue.id}`);
    const peerEditor = peer.locator('.issue-article > .rich-editor .tiptap');
    await expect(peerEditor).toContainText('Convert this selected work.');
    await page.bringToFront();
    const editor = page.locator('.issue-article > .rich-editor .tiptap');
    await expect(editor).toContainText('Convert this selected work.');
    await editor.evaluate(element => {
      (element as HTMLElement).focus();
      const text = element.querySelector('p')!.firstChild!;
      const range = document.createRange();
      range.setStart(text, 8); range.setEnd(text, 35);
      const selection = getSelection()!;
      selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    const convertButton=page.getByRole('button', {name: 'Create sub-issues from selection', exact: true});
    await expect(convertButton).toBeVisible();
    await convertButton.evaluate(element=>{(element as HTMLButtonElement).click();(element as HTMLButtonElement).click();});
    await expect(page.locator('.issue-composer')).toHaveCount(0);
    const children = async () => (await state()).issues.filter((row: any) => row.parentId === issue.id && !row.deletedAt);
    await expect.poll(async () => (await children()).length).toBe(1);
    const child = (await children())[0];
    expect(child.title).toBe('Convert this selected work.');
    const reference = editor.locator(`[data-mention-id="${child.id}"], a[href$="/issues/${child.id}"]`);
    await expect(reference).toHaveCount(1);
    await expect(peerEditor.locator(`a[href$="/issues/${child.id}"]`)).toHaveCount(1);
    await expect(editor).toContainText('Before.');
    await expect(editor).toContainText('After.');
    const mod = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
    await editor.focus();
    await editor.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);range.collapse(false);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);});
    await page.keyboard.type(' Extra');
    await expect(editor).toContainText(' Extra');
    await page.keyboard.press(`${mod}+z`);
    await expect(editor).not.toContainText(' Extra');
    expect((await children()).length).toBe(1);
    await page.keyboard.press(`${mod}+z`);
    await expect.poll(async () => (await children()).length).toBe(0);
    await expect(editor).toHaveText('Before. Convert this selected work. After.');
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect.poll(async () => (await children()).length).toBe(1);
    await expect(reference).toHaveCount(1);
    await page.screenshot({path: 'artifacts/verification/issue-filter-parity/selection-conversion-172.png'});
    await page.reload();
    await expect(reference).toHaveCount(1);
    await editor.focus();
    await page.keyboard.press(`${mod}+z`);
    await expect.poll(async () => (await children()).length).toBe(0);
    await expect(editor).toHaveText('Before. Convert this selected work. After.');
    await expect.poll(()=>peerEditor.evaluate(element=>{const clone=element.cloneNode(true) as HTMLElement;clone.querySelectorAll('.collaboration-carets__caret').forEach(caret=>caret.remove());return clone.textContent;})).toBe('Before. Convert this selected work. After.');
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect.poll(async () => (await children()).length).toBe(1);
    await expect(reference).toHaveCount(1);
    await peer.close();
  } finally {
    await page.close(); await app.close();
  }
});
