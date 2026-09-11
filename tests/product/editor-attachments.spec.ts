import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('documented attachment commands upload files at the cursor and preserve their bytes after reload',async({page})=>{
  test.setTimeout(60_000);
  page.setDefaultTimeout(10_000);
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    expect((await page.request.post(`${url}/auth/setup`,{data:{name:'Attachment Editor',email:'attachment-editor@example.test',password:'Attachment-editor-password'}})).ok()).toBeTruthy();
    const state=await(await page.request.get(`${url}/api/v1/state`)).json();
    const created=await page.request.post(`${url}/api/v1/issues`,{data:{title:'Documented attachment commands',teamId:state.teams[0].id,description:'<p>Keep this introduction.</p><p></p>'}});
    expect(created.ok()).toBeTruthy();const issue=await created.json();
    const record=async()=>await(await page.request.get(`${url}/api/v1/issues/${issue.id}`)).json();
    await page.goto(`${url}/issues/${issue.id}`);
    const editor=page.locator('.issue-detail-view .tiptap[contenteditable="true"]').first();
    await expect(editor).toContainText('Keep this introduction.');
    const attachments:{url:string;name:string;bytes:Buffer}[]=[];
    for(const [index,entry] of ['/file','/insert','shortcut'].entries()){
      await editor.locator('p').last().click();await page.keyboard.press('End');await page.keyboard.press('Enter');
      if(entry!=='shortcut'){
        await page.keyboard.insertText(entry);
        const command=page.getByRole('option',{name:/^Attach files…/});
        await expect(command).toBeVisible();
      }
      const [chooser]=await Promise.all([page.waitForEvent('filechooser'),entry==='shortcut'?editor.press('ControlOrMeta+Shift+u'):page.getByRole('option',{name:/^Attach files…/}).click()]);
      const bytes=Buffer.from(`File ${index+1}: ${entry}\nThe editor must preserve these bytes.\n\u0000\u0001\u007f`),name=`attachment-command-${index+1}.bin`;
      const uploaded=page.waitForResponse(response=>response.url()===`${url}/api/v1/attachments`&&response.request().method()==='POST');
      await chooser.setFiles({name,mimeType:'application/octet-stream',buffer:bytes});
      const response=await uploaded;expect(response.status()).toBe(201);const attachment=await response.json();
      expect(attachment.size).toBe(bytes.length);
      await expect(editor.getByRole('link',{name,exact:true})).toHaveAttribute('href',attachment.url);
      await expect.poll(async()=>(await record()).description).toContain(attachment.url);
      const downloaded=await page.request.get(url+attachment.url);expect(downloaded.status()).toBe(200);expect(await downloaded.body()).toEqual(bytes);
      attachments.push({url:attachment.url,name,bytes});
    }
    const saved=(await record()).description;
    expect(saved).toContain('Keep this introduction.');expect(saved).not.toContain('/file');expect(saved).not.toContain('/insert');
    await page.reload();await expect(editor).toContainText('Keep this introduction.');
    for(const attachment of attachments){
      await expect(editor.getByRole('link',{name:attachment.name,exact:true})).toHaveAttribute('href',attachment.url);
      expect(await(await page.request.get(url+attachment.url)).body()).toEqual(attachment.bytes);
    }
    expect(errors).toEqual([]);
  }finally{await page.close();await app.close();}
});
