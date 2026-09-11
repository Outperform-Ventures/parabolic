import {test,expect} from '@playwright/test';
import {createApp} from '../../src/server/app';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const nativeWidths:Record<number,number>={12:100.79995727539062,13:109.1998291015625,14:117.59991455078125};
test('rich code loads the exact native Berkeley font while app text retains bundled Inter',async({page})=>{
 const app=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')}),{url}=await app.start();
 try{
  await page.request.post(url+'/auth/setup',{data:{name:'Font owner',email:'mono@example.test',password:'font-password'}});
  const state=await(await page.request.get(url+'/api/v1/state')).json(),issue=await(await page.request.post(url+'/api/v1/issues',{data:{title:'Font asset check',teamId:state.teams[0].id,description:'<p>Inline <code>const result = 1</code></p><pre><code>const block = 2</code></pre>'}})).json();
  await page.goto(url+'/issues/'+issue.id);const editor=page.locator('.issue-article>.rich-editor .tiptap');await expect(editor).toContainText('const block = 2');
  const families=await editor.locator('code').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).fontFamily.replaceAll('"','')));expect(families.length).toBeGreaterThanOrEqual(2);for(const family of families)expect(family).toBe('Berkeley Mono, SFMono Regular, Consolas, Liberation Mono, Menlo, Courier, monospace');
  expect(await page.getByLabel('Issue title',{exact:true}).evaluate(element=>getComputedStyle(element).fontFamily)).toContain('Inter Variable');
  const metrics=await page.evaluate(async()=>{await document.fonts.load('13px "Berkeley Mono"');await document.fonts.ready;const face=Array.from(document.fonts).find(font=>font.family.replaceAll('"','')==='Berkeley Mono'),canvas=document.createElement('canvas'),context=canvas.getContext('2d')!,widths=[];for(const size of [12,13,14])for(const weight of [400,450,500]){context.font=weight+' '+size+'px "Berkeley Mono"';widths.push({size,weight,width:context.measureText('Il1 O0 {}[] =>').width})}return {family:face?.family,status:face?.status,weight:face?.weight,widths,url:performance.getEntriesByType('resource').map(entry=>entry.name).find(name=>name.includes('Berkeley-Mono-Variable'))}});
  expect(metrics.status).toBe('loaded');expect(metrics.weight).toBe('100 900');expect(metrics.url).toBeTruthy();const response=await page.request.get(metrics.url!);expect(response.ok()).toBe(true);expect(createHash('sha256').update(await response.body()).digest('hex')).toBe('8fdf6ce1312d8a4230f30d90e7758500d6574311bce306ff1433e90f5ba0c094');
  for(const measurement of metrics.widths)expect(Math.abs(measurement.width-nativeWidths[measurement.size])).toBeLessThan(test.info().project.name==='chromium'?0.00001:0.03);
  writeFileSync('artifacts/verification/berkeley-'+test.info().project.name+'.json',JSON.stringify(metrics,null,2));
 }finally{await page.close();await app.close()}
});
