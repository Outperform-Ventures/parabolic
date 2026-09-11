import { _electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { tsImport } from 'tsx/esm/api';
import {createHash} from 'node:crypto';

const executablePath = resolve(process.env.PARABOLIC_SMOKE_EXECUTABLE ?? 'release/mac-arm64/Parabolic.app/Contents/MacOS/Parabolic');
const userData = await mkdtemp(join(tmpdir(), 'parabolic-native-smoke-'));
const output = resolve('artifacts/platform'); await mkdir(output, { recursive: true });
const errors = [];
const launchTimings=[];
let desktop;
const {createApp}=await tsImport(resolve(process.env.PARABOLIC_SMOKE_SERVER_MODULE??'src/server/app.ts'),import.meta.url);
const remote=createApp({databasePath:':memory:',port:0,staticDir:resolve('dist')});const {url:remoteUrl}=await remote.start();
const launch = async (args=[]) => {
  const started=performance.now();
  const instance = await _electron.launch({ executablePath,args, env: { ...process.env, PARABOLIC_USER_DATA: userData, PARABOLIC_HEADLESS: '1', PARABOLIC_RENDERER_URL: '' }, timeout: 30_000 });
  const page = await instance.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await page.waitForLoadState('domcontentloaded');
  launchTimings.push(Math.round(performance.now()-started));
  return { instance, page };
};
try {
  let run = await launch(['parabolic://projects']); desktop = run.instance; let page = run.page;
  await page.getByRole('heading', { name: 'Create your workspace' }).waitFor();
  const security = await desktop.evaluate(({ BrowserWindow, Menu, app }) => {
    const window = BrowserWindow.getAllWindows()[0]; const preferences = window.webContents.getLastWebPreferences();
    const database=new(process.getBuiltinModule('node:sqlite').DatabaseSync)(':memory:'),sqlite=database.prepare('SELECT sqlite_version() version').get().version;database.close();
    return { appPath: app.getAppPath(), packaged: app.isPackaged, nodeIntegration: preferences.nodeIntegration, contextIsolation: preferences.contextIsolation, sandbox: preferences.sandbox, menus: Menu.getApplicationMenu().items.map(item => item.label), node: process.versions.node, electron: process.versions.electron,chrome:process.versions.chrome,arch:process.arch,platform:process.platform,osVersion:process.getSystemVersion(),sqlite };
  });
  assert.equal(security.packaged, true); assert.equal(security.nodeIntegration, false); assert.equal(security.contextIsolation, true); assert.equal(security.sandbox, true);
  assert.ok(security.menus.includes('File')); assert.ok(security.menus.includes('History'));
  const bridge = await page.evaluate(async () => ({ platform: window.desktop.platform, isDesktop: window.desktop.isDesktop, node: typeof require, process: typeof process, invalidExternalRejected: await window.desktop.openExternal('javascript:alert(1)').then(() => false, () => true), invalidRouteRejected: await window.desktop.newTab('//example.com').then(() => false, () => true),invalidServerRejected:await window.desktop.setConnection('http://example.com').then(()=>false,()=>true),invalidNotificationTagRejected:await window.desktop.notify({title:'Validation',body:'',tag:'invalid\nnotification'}).then(()=>false,()=>true) }));
  assert.equal(bridge.platform, 'darwin'); assert.equal(bridge.node, 'undefined'); assert.equal(bridge.process, 'undefined'); assert.equal(bridge.invalidExternalRejected, true); assert.equal(bridge.invalidRouteRejected, true);
  assert.equal(bridge.invalidServerRejected,true);assert.equal(bridge.invalidNotificationTagRejected,true);assert.equal((await page.evaluate(()=>window.desktop.getConnection())).mode,'embedded');
  await page.getByLabel('Full name').fill('Native Test'); await page.getByLabel('Workspace name').fill('Native verification');
  await page.getByLabel('Email', { exact: true }).fill('native@example.test'); await page.getByLabel('Password', { exact: true }).fill('Native-test-password-123');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click(); await page.locator('.workspace-shell.desktop').waitFor();
  await page.waitForURL('**/projects');
  const origin = new URL(page.url()).origin;
  const mcp=await page.evaluate(async()=>{
    const resource=await fetch('/.well-known/oauth-protected-resource/mcp').then(response=>response.json());
    const auth=await fetch('/.well-known/oauth-authorization-server').then(response=>response.json());
    const keyResponse=await fetch('/api/v1/api-keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Native MCP verification',scopes:['issues:read']})});if(!keyResponse.ok)throw Error('Unable to create native test key');const key=await keyResponse.json();
    const request={method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'native-test',version:'1'}}})};
    const denied=await fetch('/mcp',request),granted=await fetch('/mcp',{...request,headers:{...request.headers,Authorization:`Bearer ${key.token}`}});const result=await granted.json();await fetch(`/api/v1/api-keys/${key.id}`,{method:'DELETE'});
    return {resource:resource.resource,pkce:auth.code_challenge_methods_supported,unauthenticated:denied.status,authenticated:granted.status,protocol:result.result?.protocolVersion};
  });
  assert.equal(mcp.resource,`${origin}/mcp`);assert.deepEqual(mcp.pkce,['S256']);assert.equal(mcp.unauthenticated,401);assert.equal(mcp.authenticated,200);assert.equal(mcp.protocol,'2025-11-25');
  await desktop.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='Settings…').click());
  await page.getByLabel('Default home view',{exact:true}).selectOption('/projects');
  await page.waitForFunction(async()=>(await fetch('/api/v1/state').then(response=>response.json())).user.preferences.homeView==='/projects');
  await desktop.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='History').submenu.items.find(item=>item.label==='Home').click());
  await page.waitForURL('**/projects');
  const tabCount = await page.locator('.app-tab').count();
  await page.evaluate(() => window.desktop.newTab('/projects')); await page.waitForURL('**/projects');
  assert.equal(await page.locator('.app-tab').count(), tabCount + 1);
  const nativeMenu=async(menu,label)=>desktop.evaluate(({Menu},{menu,label})=>Menu.getApplicationMenu().items.find(item=>item.label===menu).submenu.items.find(item=>item.label===label).click(),{menu,label});
  await page.locator('.sidebar').getByRole('link',{name:'Inbox',exact:true}).click();await page.waitForURL('**/inbox');
  const waitTabRoute=async route=>{await page.waitForURL('**'+route);await page.waitForFunction(route=>{const id=document.querySelector('.app-tab.active')?.getAttribute('data-tab-id');return Object.entries(localStorage).some(([key,value])=>key.startsWith('workspace-tabs:')&&JSON.parse(value).some(tab=>tab.id===id&&tab.route===route&&tab.history[tab.historyIndex]===route));},route);};
  await page.locator('.inbox-page').waitFor();await waitTabRoute('/inbox');
  await nativeMenu('History','Back');await waitTabRoute('/projects');await nativeMenu('History','Forward');await waitTabRoute('/inbox');
  await page.keyboard.press('Meta+1');await waitTabRoute('/projects');await page.keyboard.press('Meta+9');await waitTabRoute('/inbox');
  await page.keyboard.press('Control+Shift+p');await page.locator('.app-tab.pinned').waitFor();
  await page.locator('.sidebar').getByRole('link',{name:'Projects',exact:true}).click();await page.waitForURL('**/projects');
  await page.waitForFunction(expected=>document.querySelectorAll('.app-tab').length===expected,tabCount+2);assert.match(await page.locator('.app-tab.pinned').innerText(),/Inbox/);
  await nativeMenu('File','Close tab');await page.waitForFunction(expected=>document.querySelectorAll('.app-tab').length===expected,tabCount+1);
  await page.evaluate(()=>document.activeElement.blur());await nativeMenu('Edit','Undo');await page.waitForFunction(expected=>document.querySelectorAll('.app-tab').length===expected,tabCount+2);
  await nativeMenu('Edit','Redo');await page.waitForFunction(expected=>document.querySelectorAll('.app-tab').length===expected,tabCount+1);
  await nativeMenu('File','Reopen closed tab');await page.waitForFunction(expected=>document.querySelectorAll('.app-tab').length===expected,tabCount+2);await page.waitForURL('**/projects');
  await desktop.evaluate(({ Menu }) => { Menu.getApplicationMenu().items.find(item => item.label === 'View').submenu.items.find(item => item.label === 'Command menu').click(); });
  await page.getByRole('textbox', { name: 'Command menu' }).waitFor(); await page.keyboard.press('Escape');
  await page.screenshot({ path: join(output, 'native-projects.png') });
  await desktop.evaluate(({ Menu }) => { Menu.getApplicationMenu().items.find(item => item.label === 'View').submenu.items.find(item => item.label === 'Find in page').click(); });
  await page.getByRole('textbox', { name: 'Find in page', exact: true }).fill('Projects');
  await page.waitForFunction(() => Number(document.querySelector('.shortcut-find small')?.textContent?.split(' of ')[1]) > 0);
  await page.getByRole('button', { name: 'Next match', exact: true }).click();
  await page.getByRole('button', { name: 'Close find', exact: true }).click();
  const issueId=await page.evaluate(async()=>{const state=await fetch('/api/v1/state').then(response=>response.json());const response=await fetch('/api/v1/issues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Native editor verification',teamId:state.teams[0].id,description:'<p>Editor link text</p>'})});if(!response.ok)throw Error('Failed to create native test issue');return (await response.json()).id;});
  await page.evaluate(id=>window.desktop.newTab(`/issues/${id}`),issueId);await page.waitForURL(`**/issues/${issueId}`);
  const editMenu=async label=>desktop.evaluate(({Menu},label)=>Menu.getApplicationMenu().items.find(item=>item.label==='Edit').submenu.items.find(item=>item.label===label).click(),label);
  const waitPriority=async value=>page.waitForFunction(async({id,value})=>(await fetch(`/api/v1/issues/${id}`).then(response=>response.json())).priority===value,{id:issueId,value});
  await page.locator('.issue-properties-panel').getByRole('button',{name:'Change priority',exact:true}).click();await page.locator('.property-menu').getByRole('button',{name:/Urgent$/}).click();await waitPriority(1);await page.evaluate(()=>document.activeElement.blur());await editMenu('Undo');await waitPriority(0);await editMenu('Redo');await waitPriority(1);
  const nativeEditor=page.locator('.issue-article>.rich-editor .tiptap');await page.waitForFunction(()=>document.querySelector('.issue-article>.rich-editor .tiptap')?.textContent.includes('Editor link text'));await nativeEditor.click();await nativeEditor.press('End');await nativeEditor.pressSequentially(' Native edit');await editMenu('Undo');await page.waitForFunction(()=>!document.querySelector('.issue-article>.rich-editor .tiptap')?.textContent.includes(' Native edit'));await editMenu('Redo');await page.waitForFunction(()=>document.querySelector('.issue-article>.rich-editor .tiptap')?.textContent.includes(' Native edit'));await waitPriority(1);
  await page.locator('.issue-article>.rich-editor .tiptap').click();
  await page.keyboard.press('Meta+k');
  assert.equal(await page.getByRole('textbox',{name:'Command menu',exact:true}).count(),0);
  await page.keyboard.press('Escape');
  for(const label of ['New issue','New project','New document']){
    await desktop.evaluate(({Menu},label)=>Menu.getApplicationMenu().items.find(item=>item.label==='File').submenu.items.find(item=>item.label===label).click(),label);
    await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  }
  const opened=desktop.waitForEvent('window');await desktop.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='File').submenu.items.find(item=>item.label==='New window').click());const extraWindow=await opened;await extraWindow.waitForLoadState('domcontentloaded');assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),2);
  // Exercise both renderer bridges while suppressing delivery to the user's OS.
  assert.equal(await desktop.evaluate(({Notification})=>{globalThis.__nativeNotificationShows=0;globalThis.__nativeNotificationShow=Notification.prototype.show;Notification.prototype.show=function(){globalThis.__nativeNotificationShows++};return Notification.isSupported();}),true);
  try{const details={title:'Native deduplication check',body:'Test delivery',tag:'native-test:workspace:user:notification'};assert.equal(await page.evaluate(details=>window.desktop.notify(details),details),true);assert.equal(await extraWindow.evaluate(details=>window.desktop.notify(details),details),false);assert.equal(await desktop.evaluate(()=>globalThis.__nativeNotificationShows),1);}finally{await desktop.evaluate(({Notification})=>{Notification.prototype.show=globalThis.__nativeNotificationShow;delete globalThis.__nativeNotificationShow;delete globalThis.__nativeNotificationShows;});}
  await extraWindow.close();
  await page.evaluate(() => { localStorage.setItem('native-restart-sentinel', 'persisted'); return window.desktop.setTheme('dark'); });
  const dbState = await page.evaluate(async () => { const state = await fetch('/api/v1/state').then(response => response.json()); return { user: state.user.name, teams: state.teams.length, workspaceId: state.workspaceId }; });
  assert.equal(dbState.user, 'Native Test'); assert.ok(dbState.teams > 0);
  await desktop.close(); desktop = undefined;
  const persisted = JSON.parse(await readFile(join(userData, 'window-state.json'), 'utf8')); assert.equal(persisted.servicePort, Number(new URL(origin).port));
  run = await launch([`parabolic://issues/${issueId}?focus=comments`]); desktop = run.instance; page = run.page;
  await page.locator('.workspace-shell.desktop').waitFor(); assert.equal(new URL(page.url()).origin, origin);
  await page.waitForURL(`**/issues/${issueId}?focus=comments`);
  assert.equal(await page.evaluate(() => localStorage.getItem('native-restart-sentinel')), 'persisted');
  assert.equal((await page.evaluate(() => fetch('/api/v1/state').then(response => response.json()))).user.name, 'Native Test');
  // Leave the local cache intact while invalidating only the server session.
  // Startup intents must wait through cached rendering and the subsequent login gate.
  await page.evaluate(()=>fetch('/auth/logout',{method:'POST'}));await desktop.close();desktop=undefined;
  run=await launch(['parabolic://projects?source=startup']);desktop=run.instance;page=run.page;
  await page.getByRole('heading',{name:'Log in to your workspace',exact:true}).waitFor();
  assert.notEqual(new URL(page.url()).searchParams.get('source'),'startup');
  await page.getByLabel('Email',{exact:true}).fill('native@example.test');await page.getByLabel('Password',{exact:true}).fill('Native-test-password-123');await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await page.waitForURL('**/projects?source=startup');await page.locator('.workspace-shell.desktop').waitFor();
  // Relaunch is driven explicitly by Playwright so the replacement app remains attached to this test.
  await desktop.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='Settings…').click());await page.getByLabel('Server address').fill('http://example.com');await page.getByRole('button',{name:'Restart and connect'}).click();await page.getByRole('alert').filter({hasText:'HTTPS'}).waitFor();
  await page.getByLabel('Server address').fill(remoteUrl);await page.screenshot({path:join(output,'native-connection-settings.png')});
  await desktop.evaluate(({app})=>{app.relaunch=()=>{};});let closed=desktop.waitForEvent('close');await page.getByRole('button',{name:'Restart and connect'}).click();await closed;desktop=undefined;
  assert.equal(JSON.parse(await readFile(join(userData,'connection.json'),'utf8')).serverUrl,remoteUrl);
  run=await launch();desktop=run.instance;page=run.page;await page.getByRole('heading',{name:'Create your workspace'}).waitFor();assert.equal(new URL(page.url()).origin,remoteUrl);assert.equal((await page.evaluate(()=>window.desktop.getConnection())).mode,'remote');assert.equal(await desktop.evaluate(({app})=>app.getAppMetrics().some(row=>row.name==='Parabolic Workspace Service')),false);
  await page.getByLabel('Full name').fill('Remote Native');await page.getByLabel('Workspace name').fill('Shared verification');await page.getByLabel('Email',{exact:true}).fill('remote-native@example.test');await page.getByLabel('Password',{exact:true}).fill('Remote-native-password');await page.getByRole('button',{name:'Create workspace',exact:true}).click();await page.locator('.workspace-shell.desktop').waitFor();
  await desktop.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='Settings…').click());await page.getByLabel('Server address').fill('');
  await desktop.evaluate(({app})=>{app.relaunch=()=>{};});closed=desktop.waitForEvent('close');await page.getByRole('button',{name:'Restart and connect'}).click();await closed;desktop=undefined;
  run=await launch();desktop=run.instance;page=run.page;await page.locator('.workspace-shell.desktop').waitFor();assert.equal(new URL(page.url()).origin,origin);assert.equal((await page.evaluate(()=>fetch('/api/v1/state').then(response=>response.json()))).user.name,'Native Test');
  assert.deepEqual(errors, []);
  const build={checkedAt:new Date().toISOString(),executablePath,asarSha256:createHash('sha256').update(await readFile(security.appPath)).digest('hex'),rendererSha256:createHash('sha256').update(await readFile(resolve('dist/index.html'))).digest('hex')};
  const report = { result: 'passed', checks: ['Packaged macOS arm64 launch', 'Queued startup deep links survive fresh login, expired cached sessions, and authenticated restart', 'Bundled SQLite service', 'Packaged MCP discovery and scoped authentication', 'Sandbox and context isolation', 'No renderer Node globals', 'IPC URL and route validation', 'Account setup and authenticated state', 'Native menu command dispatch', 'Native Home uses the saved home-view preference', 'Renderer tab IPC', 'Native Back and Forward preserve independent tab histories', 'Native pin navigation preserves content and closed tabs restore through Undo, Redo, and Reopen', 'Native find-in-page returns document matches', 'Native workspace Undo and Redo restore persisted issue properties','Native editor Undo and Redo preserve separate rich-text history','Native Cmd+K preserves rich-editor focus','Native issue/project/document creation menus open working dialogs','Native new-window menu creates an independent window', 'Native tagged notifications deduplicate across windows', 'Stable origin and persisted local storage after restart', 'Session cookie and SQLite data after restart','Settings form validates and persists a central server across restart','Settings form restores embedded workspace and login'], build,security, bridge,mcp,windowDomReadyMs:launchTimings, screenshots: ['native-projects.png','native-connection-settings.png'], errors };
  await writeFile(join(output, 'native-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ result: 'passed', checks: report.checks.length, output }));
} catch(error) {const page=desktop?.windows()[0];if(page)await page.screenshot({path:join(output,'native-failure.png')}).catch(()=>{});await writeFile(join(output,'native-smoke.json'),JSON.stringify({result:'failed',error:String(error),errors},null,2));throw error;} finally { await desktop?.close(); await remote.close();await rm(userData, { recursive: true, force: true }); }
