import {_electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

const output=resolve(process.env.PARABOLIC_SERVICE_REPORT??'artifacts/platform/native-utility-service');
const userData=await mkdtemp(join(tmpdir(),'parabolic-utility-lifecycle-'));
const executablePath=resolve('release/mac-arm64/Parabolic.app/Contents/MacOS/Parabolic');
await mkdir(output,{recursive:true});
const checks=[],errors=[],transportFailures=[],nativeLogs=[];let desktop;
const serviceMetric=()=>desktop.evaluate(({app})=>app.getAppMetrics().find(row=>row.name==='Parabolic Workspace Service'));
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
try{
 desktop=await _electron.launch({executablePath,env:{...process.env,PARABOLIC_USER_DATA:userData,PARABOLIC_HEADLESS:'1',PARABOLIC_RENDERER_URL:''},timeout:30000});
 desktop.process().stderr?.on('data',chunk=>nativeLogs.push(String(chunk)));
 const page=await desktop.firstWindow();page.on('requestfailed',request=>transportFailures.push({url:request.url(),error:request.failure()?.errorText}));page.on('pageerror',error=>errors.push(error.message));
 await page.getByRole('heading',{name:'Create your workspace'}).waitFor();
 const first=await serviceMetric(),mainPid=await desktop.evaluate(()=>process.pid);assert.ok(first);assert.notEqual(first.pid,mainPid);assert.equal(first.type,'Utility');checks.push('Embedded service runs in its own named utility process');
 await page.getByLabel('Full name').fill('Utility lifecycle');await page.getByLabel('Workspace name').fill('Utility lifecycle');await page.getByLabel('Email',{exact:true}).fill('utility@example.test');await page.getByLabel('Password',{exact:true}).fill('Utility-lifecycle-password');await page.getByRole('button',{name:'Create workspace',exact:true}).click();await page.locator('.workspace-shell.desktop').waitFor();
 const origin=new URL(page.url()).origin;
 // Fork the actual packaged service entry and exercise its parent-port protocol.
 const protocol=await desktop.evaluate(async({utilityProcess,app},{databasePath,port})=>{
  const entry=app.getAppPath()+'/dist-desktop/service.cjs',staticDir=app.getAppPath()+'/dist';
  const start=config=>{
   const child=utilityProcess.fork(entry,[],{serviceName:'Parabolic Service Protocol Test',stdio:'pipe'});let tail='';child.stdout?.on('data',()=>{});child.stderr?.on('data',chunk=>tail=(tail+String(chunk)).slice(-2000));
   const exit=new Promise(resolve=>child.once('exit',code=>resolve({code,tail})));const ready=new Promise(resolve=>{const timeout=setTimeout(()=>resolve({type:'timeout'}),10000);child.on('message',message=>{if(['ready','error'].includes(message?.type)){clearTimeout(timeout);resolve(message);}});child.once('exit',()=>{clearTimeout(timeout);resolve({type:'exit'});});});
   child.postMessage({type:'start',config});return {child,ready,exit};
  };
  const occupied=start({databasePath:databasePath+'-occupied',staticDir,port});const rejected=await occupied.ready,failedExit=await occupied.exit;
  const first=start({databasePath,staticDir,port:0}),listening=await first.ready;if(listening.type!=='ready')throw Error(JSON.stringify(listening));const health=await fetch(listening.url+'/health').then(response=>response.json());first.child.postMessage({type:'shutdown'});const stopped=await first.exit;
  const next=start({databasePath,staticDir,port:listening.port}),restarted=await next.ready;next.child.postMessage({type:'shutdown'});const secondStop=await next.exit;
  return {rejected,failedExit,listening,health,stopped,restarted,secondStop};
 },{databasePath:join(userData,'protocol.sqlite'),port:Number(new URL(origin).port)});
 assert.equal(protocol.rejected.type,'error');assert.match(protocol.rejected.message,/EADDRINUSE|address already in use/i);assert.notEqual(protocol.failedExit.code,0);checks.push('An occupied saved port reports startup failure and exits without leaking a service');
 assert.equal(protocol.health.status,'ok');assert.equal(protocol.stopped.code,0);assert.equal(protocol.secondStop.code,0);assert.equal(protocol.restarted.url,protocol.listening.url);assert.notEqual(protocol.restarted.pid,protocol.listening.pid);checks.push('Parent-port readiness, graceful shutdown, and same-port database restart work in the packaged entry');
 const issueId=await page.evaluate(async()=>{const state=await fetch('/api/v1/state').then(response=>response.json());return(await fetch('/api/v1/issues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Utility reconnect issue',teamId:state.teams[0].id,priority:0})}).then(response=>response.json())).id;});
 await page.evaluate(id=>window.desktop.newTab(`/issues/${id}`),issueId);await page.locator('.issue-properties-panel').waitFor();await page.locator('.issue-article>.rich-editor .tiptap').waitFor();
 // Load the composer before the service goes away: an unvisited lazy chunk is
 // not proof of the existing editor/outbox surviving a service restart.
 await desktop.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='File').submenu.items.find(item=>item.label==='New issue').click());await page.getByRole('dialog').getByRole('textbox',{name:'Issue title',exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.evaluate(()=>{window.__utilityRestartSentinel='renderer remained mounted';});
 await desktop.evaluate(({dialog})=>{globalThis.__recoveryDialogs=[];globalThis.__originalRecoveryDialog=dialog.showMessageBox;dialog.showMessageBox=(...args)=>{globalThis.__recoveryDialogs.push(args.at(-1));return new Promise(resolve=>{globalThis.__restartUtility=()=>resolve({response:0,checkboxChecked:false});});};});
 await desktop.evaluate((_electron,pid)=>process.kill(pid,'SIGKILL'),first.pid);
 await page.waitForFunction(async()=>{try{return !(await fetch('/health')).ok;}catch{return true;}});
 const deadline=Date.now()+10000;while((await desktop.evaluate(()=>globalThis.__recoveryDialogs.length))===0){if(Date.now()>deadline)throw Error('No recovery dialog after utility crash');await new Promise(resolve=>setTimeout(resolve,20));}
 await page.locator('.issue-properties-panel').getByRole('button',{name:'Change priority',exact:true}).click();await page.locator('.property-menu').getByRole('button',{name:/Urgent$/}).click();
 await page.waitForFunction(()=>document.querySelector('.issue-properties-panel')?.textContent.includes('Urgent'));
 await desktop.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='File').submenu.items.find(item=>item.label==='New issue').click());
 const title=page.getByRole('dialog').getByRole('textbox',{name:'Issue title',exact:true});await title.fill('Draft survives service restart');
 await desktop.evaluate(()=>globalThis.__restartUtility());
 await page.waitForFunction(async()=>{try{return(await fetch('/health')).ok;}catch{return false;}},{},{timeout:15000});
 const recovered=await serviceMetric();assert.ok(recovered);assert.notEqual(recovered.pid,first.pid);assert.equal(new URL(page.url()).origin,origin);assert.equal(await title.inputValue(),'Draft survives service restart');assert.equal(await page.evaluate(()=>window.__utilityRestartSentinel),'renderer remained mounted');await page.waitForFunction(async()=>{try{return(await fetch('/api/v1/state').then(response=>response.json())).user.name==='Utility lifecycle';}catch{return false;}},null,{timeout:15000});
 await page.waitForFunction(async id=>{try{return(await fetch(`/api/v1/issues/${id}`).then(response=>response.json())).priority===1;}catch{return false;}},issueId,{timeout:20000});checks.push('An edit queued while the service is down persists through the same-origin authenticated outbox after restart');
 await page.keyboard.press('Escape');await desktop.evaluate(({dialog})=>{dialog.showMessageBox=globalThis.__originalRecoveryDialog;});
 checks.push('Unexpected utility exit offers restart while native menus and unsaved editor state remain available');checks.push('Restart preserves the exact origin, authenticated session, SQLite workspace, and mounted renderer');
 const quitStarted=performance.now();await desktop.close();desktop=undefined;const shutdownMs=performance.now()-quitStarted;assert.equal(alive(recovered.pid),false);assert.ok(shutdownMs<10000);checks.push('Quitting the app waits for its service to exit');assert.deepEqual(errors,[]);
 const report={result:'passed',checkedAt:new Date().toISOString(),checks,mainPid,firstService:first,recoveredService:recovered,protocol,shutdownMs,errors,transportFailures,nativeLogs,asarSha256:createHash('sha256').update(await readFile(resolve('release/mac-arm64/Parabolic.app/Contents/Resources/app.asar'))).digest('hex'),rendererSha256:createHash('sha256').update(await readFile(resolve('dist/index.html'))).digest('hex')};await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:'passed',checks:checks.length,shutdownMs,output}));
}catch(error){await writeFile(join(output,'report.json'),JSON.stringify({result:'failed',checks,errors,transportFailures,nativeLogs,error:String(error)},null,2));throw error;}finally{await desktop?.close();await rm(userData,{recursive:true,force:true});}
