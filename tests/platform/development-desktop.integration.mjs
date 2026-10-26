import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,unlink,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {_electron as electron} from '@playwright/test';
import {createApp} from '../../src/server/app.ts';
import {waitForHealth} from '../../scripts/dev-workspace.mjs';

async function freePort(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('desktop uses isolated Vite, live CSS reload, server watch, persistent auth and clean shutdown', {timeout:120_000}, async()=>{
 const root=await mkdtemp(join(tmpdir(),'parabolic-dev-smoke-')),source=join(root,'source','parabolic.sqlite'),directory=join(root,'development');
 const app=createApp({databasePath:source,port:0,backgroundJobs:false}),{url}=await app.start();
 await fetch(url+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Dev tester',email:'dev@example.test',password:'fixture-password-only'})});await app.close();
 const port=await freePort(),apiPort=await freePort(),origin=`http://127.0.0.1:${port}`;
 const env={...process.env,PARABOLIC_DEV_SOURCE:source,PARABOLIC_DEV_DATA_DIR:directory,PARABOLIC_DEV_PORT:String(port),PARABOLIC_DEV_API_PORT:String(apiPort)};delete env.ELECTRON_RUN_AS_NODE;
 const launcher=spawn(process.execPath,['scripts/dev-desktop.mjs','--web-only'],{cwd:process.cwd(),env,stdio:['pipe','pipe','pipe']});
 let output='';for(const stream of [launcher.stdout,launcher.stderr])stream.on('data',chunk=>{output+=chunk;});
 const css=resolve(`src/client/.dev-hmr-probe-${process.pid}.css`),serverProbe=resolve(`src/server/.dev-watch-probe-${process.pid}.ts`);
 let desktop;
 try{
  await waitForHealth(`${origin}/api/v1/health`,()=>launcher.exitCode===null,60_000);
  desktop=await electron.launch({args:[resolve('.local/dev-desktop')],env:{...env,PARABOLIC_DEV:'1',PARABOLIC_RENDERER_URL:origin,PARABOLIC_USER_DATA:join(directory,'electron'),PARABOLIC_HEADLESS:'1'}});
  const page=await desktop.firstWindow();page.setDefaultTimeout(20_000);await page.waitForLoadState('domcontentloaded');
  await page.getByLabel('Email',{exact:true}).fill('dev@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password-only');await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await page.getByRole('link',{name:'My issues',exact:true}).waitFor();
  assert.match(await page.title(),/My issues/);
  assert.equal(await desktop.evaluate(({app})=>app.getName()),'Parabolic Dev');
  assert.equal(await desktop.evaluate(({app})=>app.getPath('userData')),join(directory,'electron'));
  assert.match(await page.locator('.development-badge').innerText(),/Isolated workspace/);
  await page.evaluate(()=>{window.__devSmokeMarker='same-document';});
  await writeFile(css,':root{--parabolic-hmr-probe:before;}');
  await page.evaluate(path=>import(/* @vite-ignore */ path),'/src/client/'+css.split('/').at(-1));
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--parabolic-hmr-probe')==='before');
  await writeFile(css,':root{--parabolic-hmr-probe:after;}');
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--parabolic-hmr-probe')==='after');
  assert.equal(await page.evaluate(()=>window.__devSmokeMarker),'same-document');
  const readyCount=output.split('API ready').length;
  await writeFile(serverProbe,'// Isolated watch probe; no production behavior.\n');
  for(let i=0;i<100&&output.split('API ready').length===readyCount;i++)await pause(100);
  assert.ok(output.split('API ready').length>readyCount,'server source change restarted the API');
  await waitForHealth(`${origin}/api/v1/health`);
  await page.reload();await page.getByRole('link',{name:'My issues',exact:true}).waitFor();
  assert.equal(await page.evaluate(async()=>{const r=await fetch('/auth/status');return !!(await r.json()).user;}),true);
  await page.screenshot({path:resolve('artifacts/verification/parabolic-dev-smoke.png')});
  await desktop.close();desktop=undefined;
  await unlink(css);await unlink(serverProbe);
  const exited=new Promise(resolve=>launcher.once('exit',resolve));launcher.stdin.write('q\n');await exited;
  assert.equal(launcher.exitCode,0,output);
  assert.equal(await access(join(directory,'launcher.lock')).then(()=>true,()=>false),false);
  await assert.rejects(()=>fetch(`${origin}/api/v1/health`,{signal:AbortSignal.timeout(1000)}));
  await assert.rejects(()=>fetch(`http://127.0.0.1:${apiPort}/api/v1/health`,{signal:AbortSignal.timeout(1000)}));
 }catch(error){console.error(error);console.error(output);if(desktop){const p=desktop.windows()[0];if(p)console.error((await p.locator('body').innerText().catch(()=>'' )).slice(0,1600));}throw error;}
 finally{
  await desktop?.close();
  if(launcher.exitCode===null){const exited=new Promise(resolve=>launcher.once('exit',resolve));launcher.stdin.write('q\n');await exited;}
  await unlink(css).catch(()=>{});await unlink(serverProbe).catch(()=>{});await rm(root,{recursive:true,force:true});
 }
});
