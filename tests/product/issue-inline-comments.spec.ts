import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('issue description comments follow edits, bind attachments and reopen their canonical thread after reload',async({page,browser})=>{
  test.setTimeout(60_000);page.setDefaultTimeout(10_000);
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),reader=await browser.newContext();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.request.post(`${url}/auth/setup`,{data:{name:'Issue Reviewer',email:'issue-reviewer@example.test',password:'issue-reviewer-password'}});
    const invite=await(await page.request.post(`${url}/api/v1/invitations`,{data:{email:'issue-reader@example.test',role:'member'}})).json();
    expect((await reader.request.post(`${url}/auth/join`,{data:{token:invite.token,name:'Issue Reader',password:'issue-reader-password'}})).ok()).toBeTruthy();
    const state=async()=>await(await page.request.get(`${url}/api/v1/state`)).json(),initial=await state();
    const response=await page.request.post(`${url}/api/v1/issues`,{data:{title:'Review the issue description',teamId:initial.teams[0].id,description:'<p>Discuss the launch scope with everyone.</p>'}});expect(response.ok()).toBeTruthy();const issue=await response.json();
    const comments=async()=>(await state()).comments.filter((comment:any)=>comment.issueId===issue.id&&!comment.deletedAt);
    await page.goto(`${url}/issues/${issue.id}`);const editor=page.locator('.issue-detail-view .tiptap[contenteditable="true"]').first();await expect(editor).toContainText('launch scope');
    const select=async()=>{await editor.locator('p').first().evaluate(element=>{const node=element.firstChild!,start=node.textContent!.indexOf('launch scope'),range=document.createRange();range.setStart(node,start);range.setEnd(node,start+'launch scope'.length);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);(element.closest('[contenteditable="true"]') as HTMLElement).focus();document.dispatchEvent(new Event('selectionchange'))});await expect(page.getByRole('button',{name:'Comment on selection',exact:true})).toBeVisible()};
    await select();await page.getByRole('button',{name:'Comment on selection',exact:true}).click();
    let panel=page.getByRole('dialog',{name:'New inline comment',exact:true});await panel.getByRole('textbox',{name:'Comment on selected text…',exact:true}).fill('Cancel this unsent annotation');
    await panel.getByRole('button',{name:'Cancel',exact:true}).focus();await page.keyboard.press('Enter');await expect(panel).toHaveCount(0);expect(await comments()).toHaveLength(0);
    await select();await editor.press('ControlOrMeta+Alt+m');panel=page.getByRole('dialog',{name:'New inline comment',exact:true});
    const composer=panel.getByRole('textbox',{name:'Comment on selected text…',exact:true});await expect(composer).toHaveText('');await composer.fill('Please confirm this scope. ');await composer.press('End');
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),composer.press('ControlOrMeta+Shift+u')]);
    const uploaded=page.waitForResponse(result=>result.url()===`${url}/api/v1/attachments`&&result.request().method()==='POST'),bytes=Buffer.from('Issue annotation evidence\nExact preserved bytes.');
    await chooser.setFiles({name:'scope-notes.txt',mimeType:'text/plain',buffer:bytes});const upload=await uploaded;expect(upload.status()).toBe(201);const attachment=await upload.json();await expect(composer.getByRole('link',{name:'scope-notes.txt',exact:true})).toBeVisible();
    const immediateRead=await reader.request.get(url+attachment.url);expect(immediateRead.status()).toBe(200);expect(await immediateRead.body()).toEqual(bytes);
    await panel.getByRole('button',{name:'Comment',exact:true}).click();await expect.poll(async()=>(await comments()).filter((comment:any)=>comment.anchor).length).toBe(1);
    const root=(await comments()).find((comment:any)=>comment.anchor);expect(root.anchor.quote).toBe('launch scope');expect(root.body).toContain(attachment.url);expect(root.parentId).toBeNull();
    panel=page.getByRole('dialog',{name:'Issue comment thread',exact:true});await panel.getByRole('button',{name:'Close comment',exact:true}).click();const highlight=editor.locator(`[data-inline-comment-id="${root.id}"]`);await expect(highlight).toHaveText('launch scope');
    await editor.click();await editor.press('ControlOrMeta+a');await editor.press('ArrowLeft');await page.keyboard.insertText('Updated: ');await expect(editor).toContainText('Updated: Discuss the launch scope with everyone.');await expect(highlight).toHaveText('launch scope');
    await page.reload();await expect(highlight).toHaveText('launch scope');await highlight.click();panel=page.getByRole('dialog',{name:'Issue comment thread',exact:true});await expect(panel).toContainText('Please confirm this scope.');
    await panel.getByRole('textbox',{name:'Reply to thread…',exact:true}).fill('Scope confirmed.');await panel.getByRole('button',{name:'Reply',exact:true}).click();await expect.poll(async()=>(await comments()).filter((comment:any)=>comment.parentId===root.id).length).toBe(1);
    await panel.getByRole('button',{name:'Resolve thread',exact:true}).click();await expect.poll(async()=>(await comments()).find((comment:any)=>comment.id===root.id)?.resolved).toBe(true);await expect(highlight).toHaveCount(0);
    await page.getByRole('button',{name:'launch scope',exact:true}).click();panel=page.getByRole('dialog',{name:'Issue comment thread',exact:true});await expect(panel).toContainText('Scope confirmed.');await panel.getByRole('button',{name:'Reopen thread',exact:true}).click();await expect.poll(async()=>(await comments()).find((comment:any)=>comment.id===root.id)?.resolved).toBe(false);await expect(highlight).toHaveText('launch scope');
    await page.reload();await expect(highlight).toHaveText('launch scope');expect((await comments()).filter((comment:any)=>comment.parentId===root.id)).toHaveLength(1);expect(errors).toEqual([]);
  }finally{await page.close();await reader.close();await app.close()}
});
