import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
test('custom emoji shortcodes and suggestions remain inline across collaborative editing, copy and reload',async({browser})=>{
 test.setTimeout(60_000);const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start(),alice=await browser.newContext(),bob=await browser.newContext();const errors:string[]=[];
 try{
  await alice.request.post(`${url}/auth/setup`,{data:{name:'Emoji Alice',email:'emoji-alice@example.test',password:'Emoji-alice-password'}});
  const invite=await(await alice.request.post(`${url}/api/v1/invitations`,{data:{email:'emoji-bob@example.test',role:'member'}})).json();await bob.request.post(`${url}/auth/join`,{data:{token:invite.token,name:'Emoji Bob',password:'Emoji-bob-password'}});
  const uploaded=await alice.request.post(`${url}/api/v1/custom-emojis`,{multipart:{name:'ship_it',file:{name:'ship.png',mimeType:'image/png',buffer:png}}});expect(uploaded.ok(),await uploaded.text()).toBeTruthy();const emoji=await uploaded.json(),state=await(await alice.request.get(`${url}/api/v1/state`)).json();
  const issue=await(await alice.request.post(`${url}/api/v1/issues`,{data:{title:'Inline workspace emoji',teamId:state.teams[0].id,description:'<p>Before </p>'}})).json();
  const pages=await Promise.all([alice.newPage(),bob.newPage()]);for(const page of pages)page.on('pageerror',error=>errors.push(error.message));await Promise.all(pages.map(page=>page.goto(`${url}/issues/${issue.id}`)));
  const editors=pages.map(page=>page.locator('.issue-detail-view .tiptap[contenteditable="true"]').first());for(const editor of editors)await expect(editor).toContainText('Before');
  await editors[0].click();await pages[0].keyboard.press('End');await pages[0].keyboard.insertText(' :ship_it:');
  for(const editor of editors)await expect(editor.locator('p > img[data-type="custom-emoji"]')).toHaveCount(1);
  await pages[0].keyboard.insertText(' after :shi');const suggestion=pages[0].getByRole('option',{name:':ship_it: Custom',exact:true});await expect(suggestion).toBeVisible();await suggestion.click();
  for(const editor of editors){await expect(editor.locator('p > img[data-type="custom-emoji"]')).toHaveCount(2);await expect(editor.locator('p')).toHaveCount(1);await expect(editor).toContainText('Before');await expect(editor).toContainText('after');}
  const image=editors[0].locator('img[data-type="custom-emoji"]').first();await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBe(1);expect(await image.getAttribute('src')).toBe(emoji.url);expect(await image.evaluate(element=>getComputedStyle(element).display)).toBe('inline-block');expect((await image.boundingBox())!.height).toBeLessThan(25);
  const saved=async()=>await(await alice.request.get(`${url}/api/v1/issues/${issue.id}`)).json();await expect.poll(async()=>(await saved()).description.match(/data-emoji-id=/g)?.length).toBe(2);
  await pages[0].evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).__copied=text;}}});(document.activeElement as HTMLElement)?.blur();});const mod=await pages[0].evaluate(()=>/Mac/.test(navigator.platform)?'Meta':'Control');await pages[0].keyboard.press(`${mod}+Alt+c`);await expect.poll(()=>pages[0].evaluate(()=>(window as any).__copied)).toContain('Before :ship_it: after :ship_it:');
  await pages[1].reload();await expect(editors[1].locator('p > img[data-type="custom-emoji"]')).toHaveCount(2);await expect.poll(()=>editors[1].locator('img[data-type="custom-emoji"]').first().evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBe(1);
  expect((await alice.request.delete(`${url}/api/v1/custom-emojis/${emoji.id}`)).ok()).toBeTruthy();await expect.poll(async()=>(await(await alice.request.get(`${url}/api/v1/custom-emojis`)).json()).nodes.length).toBe(0);
  await pages[0].reload();await expect(editors[0].locator('img[data-type="custom-emoji"]')).toHaveCount(2);await editors[0].click();await pages[0].keyboard.press('End');await pages[0].keyboard.insertText(' :shi');await expect(pages[0].getByRole('option',{name:':ship_it: Custom',exact:true})).toHaveCount(0);await pages[0].keyboard.press('Escape');expect((await alice.request.get(url+emoji.url)).ok()).toBeTruthy();
  await pages[0].screenshot({path:'artifacts/platform/inline-custom-emoji.png'});expect(errors).toEqual([]);
 }finally{await alice.close();await bob.close();await app.close();}
});
