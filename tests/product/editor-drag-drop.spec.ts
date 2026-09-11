import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

test('comment editor accepts a dropped attachment and preserves its bytes after posting and reload',async({page})=>{
  const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
  try{
    expect((await page.request.post(url+'/auth/setup',{data:{name:'Drop author',email:'editor-drop@example.test',password:'editor-drop-password'}})).ok()).toBeTruthy();
    const state=await(await page.request.get(url+'/api/v1/state')).json();
    const issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Dropped comment attachment',teamId:state.teams[0].id}})).json();
    await page.goto(url+'/issues/'+issue.id);
    const editor=page.getByRole('textbox',{name:'Leave a comment…',exact:true});
    const bytes=Array.from(Buffer.from('Dropped through the documented comment editor path.\n\u0000\u0001\u007f'));
    const transfer=await page.evaluateHandle(({bytes})=>{const value=new DataTransfer();value.items.add(new File([new Uint8Array(bytes)],'dropped-comment.bin',{type:'application/octet-stream'}));return value},{bytes});
    const uploaded=page.waitForResponse(response=>response.url()===url+'/api/v1/attachments'&&response.request().method()==='POST');
    await editor.dispatchEvent('dragover',{dataTransfer:transfer});
    await editor.dispatchEvent('drop',{dataTransfer:transfer});
    const response=await uploaded;expect(response.status()).toBe(201);const attachment=await response.json();
    await expect(editor.getByRole('link',{name:'dropped-comment.bin',exact:true})).toHaveAttribute('href',attachment.url);
    expect(await(await page.request.get(url+attachment.url)).body()).toEqual(Buffer.from(bytes));
    await page.getByRole('button',{name:'Submit comment',exact:true}).click();
    await expect.poll(async()=>{const latest=await(await page.request.get(url+'/api/v1/state')).json();return latest.comments.find((comment:any)=>comment.issueId===issue.id)?.body}).toContain(attachment.url);
    const saved=(await(await page.request.get(url+'/api/v1/state')).json()).comments.find((comment:any)=>comment.issueId===issue.id);
    await page.reload();
    await expect(page.locator('#comment-'+saved.id).getByRole('link',{name:'dropped-comment.bin',exact:true})).toHaveAttribute('href',attachment.url);
    expect(await(await page.request.get(url+attachment.url)).body()).toEqual(Buffer.from(bytes));
    await transfer.dispose();
  }finally{await page.close();await app.close()}
});
