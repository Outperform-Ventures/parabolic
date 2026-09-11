import {DESKTOP_CREATION_ACTIONS,normalizeCreationAvailability,type DesktopCreationAvailability} from '../shared/desktop-creation';
import { app, BrowserWindow, Menu, Notification, clipboard, dialog, ipcMain, nativeTheme, screen, session, shell, type IpcMainInvokeEvent, type IpcMainEvent, type MenuItemConstructorOptions } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {startEmbeddedService,type EmbeddedService} from './service-process';
import { desktopSessionPartition, NotificationDeduper, routeFromDeepLink, safeExternalUrl, safeRoute, safeServerUrl, trustedRendererUrl, validNotificationTag } from './security.js';
import {RendererCommandQueue} from './command-queue.js';
import {RestartCoordinator} from './restart-coordinator';
import type {RestartLease} from './restart-coordinator';
import {createDesktopUpdates} from './updates';
import {randomUUID} from 'node:crypto';
import {desktopBadgeText} from '../shared/desktop-badge';
import {restoredWindowBounds} from './window-bounds';
import {nextZoomFactor} from './zoom';
import {loadDesktopDevicePreferences,requestDisableHardwareAcceleration,saveDesktopDevicePreferences} from './hardware-acceleration';
import {editableContextMenu} from './editor-context-menu';
import {desktopHelpMenu} from './help-menu';

type WindowState = { x?: number; y?: number; width: number; height: number; maximized?: boolean; fullscreen?: boolean; route?: string };
type SavedState = { alwaysShowTabs?:boolean; windows: WindowState[]; theme: 'system' | 'light' | 'dark'; servicePort?: number };
const windows = new Set<BrowserWindow>();
const restartCoordinator=new RestartCoordinator((id,channel,requestId)=>{
  const win=[...windows].find(window=>window.id===id);
  if(!win||win.isDestroyed())throw Error('A workspace window is no longer available.');
  win.webContents.send(channel,requestId);
});
export function prepareDesktopRestart(){return restartCoordinator.prepare([...windows].filter(win=>!win.isDestroyed()).map(win=>win.id));}
const editorFocused = new Set<number>();
const notificationDeduper=new NotificationDeduper();
const activeNotifications=new Map<string,Notification>();
const rendererCommands=new RendererCommandQueue();
const creationReady=new Set<number>();
const creationCommands=DESKTOP_CREATION_ACTIONS;
const creationAvailability=new Map<number,DesktopCreationAvailability>();
function refreshCreationMenu(){
  const current=focused(),enabled=!!current&&creationReady.has(current.webContents.id),availability=current?creationAvailability.get(current.webContents.id):undefined,menu=Menu.getApplicationMenu();
  for(const name of creationCommands){const item=menu?.getMenuItemById('native-create-'+name);if(item){const state=availability?.[name]??'disabled';item.enabled=enabled&&state==='enabled';if(name!=='contextual')item.visible=state!=='hidden';}}
}
let rendererUrl = ''; let rendererOrigin = ''; let rendererPartition = 'persist:parabolic'; let service: EmbeddedService | undefined;let serviceStarting:Promise<EmbeddedService>|undefined;
let localServicePort: number | undefined;
let configuredServerUrl:string|null=null;let connectionChanged=false;
let shutdownComplete=false,shutdownPromise:Promise<void>|undefined,serviceRecovery=false,pendingServiceFailure:Error|undefined;
let quitting = false; let saveTimer: ReturnType<typeof setTimeout> | undefined;
let desktopUpdates:ReturnType<typeof createDesktopUpdates>|undefined,updateLease:RestartLease|undefined,updateServiceClosed=false;
const pendingRoutes: string[] = [];
const cacheRequests=new Map<number,{requestId:string;resolve:()=>void;reject:(error:Error)=>void}>();
let clearingData=false,alwaysShowTabs=true;
let hardwareAccelerationDisabled=false;
function clearRendererCache(win:BrowserWindow){
  return new Promise<void>((resolve,reject)=>{
    const requestId=randomUUID(),timer=setTimeout(()=>finish(Error('A window could not clear its application cache.')),30_000);
    const finish=(error?:Error)=>{clearTimeout(timer);cacheRequests.delete(win.id);error?reject(error):resolve();};
    cacheRequests.set(win.id,{requestId,resolve:()=>finish(),reject:finish});
    win.webContents.send('desktop:clear-cache',requestId);
  });
}
export async function clearApplicationData(){
  if(clearingData||restartCoordinator.busy)return;
  clearingData=true;let lease:RestartLease|undefined;let clearing=false;
  try{
    const options={type:'question' as const,message:'Clear application data?',detail:'All your sessions will be logged out.',buttons:['Clear data','Cancel'],defaultId:0,cancelId:1};
    const win=focused(),answer=win?await dialog.showMessageBox(win,options):await dialog.showMessageBox(options);
    if(answer.response!==0)return;
    lease=await prepareDesktopRestart();lease.assertReady();
    const current=[...windows].filter(win=>!win.isDestroyed());clearing=true;
    await Promise.all(current.map(clearRendererCache));lease.assertReady();
    for(const partition of new Set([session.fromPartition(rendererPartition),...current.map(win=>win.webContents.session)])){
      await Promise.all([partition.clearStorageData({storages:['cookies','serviceworkers','cachestorage']}),partition.clearAuthCache(),partition.clearCache()]);
    }
  }catch(error){
    await dialog.showMessageBox({type:'error',message:'Unable to clear application data',detail:error instanceof Error?error.message:String(error),buttons:['OK']});
  }finally{
    lease?.cancel();clearingData=false;
    if(clearing)for(const win of windows)if(!win.isDestroyed())win.webContents.reloadIgnoringCache();
  }
}
const stateFile = () => join(app.getPath('userData'), 'window-state.json');
const connectionFile=()=>join(app.getPath('userData'),'connection.json');
function loadConnection(){try{const value=JSON.parse(readFileSync(connectionFile(),'utf8'));return safeServerUrl(value.serverUrl);}catch{return null;}}
function loadState(): SavedState {
  try {
    const raw = JSON.parse(readFileSync(stateFile(), 'utf8'));
    return { alwaysShowTabs:raw.alwaysShowTabs!==false, windows: Array.isArray(raw.windows) ? raw.windows.slice(0, 12).filter((state: any) => Number.isFinite(state.width) && Number.isFinite(state.height)) : [], theme: ['system', 'dark', 'light'].includes(raw.theme) ? raw.theme : 'system', servicePort: Number.isInteger(raw.servicePort) && raw.servicePort > 1023 && raw.servicePort < 65536 ? raw.servicePort : undefined };
  } catch { return { windows: [], theme: 'system' }; }
}
function saveState() {
  if (quitting && !windows.size) return;
  const saved = { alwaysShowTabs, theme: nativeTheme.themeSource, servicePort: localServicePort, windows: [...windows].filter(win => !win.isDestroyed()).map(win => ({ ...win.getNormalBounds(), maximized: win.isMaximized(), fullscreen: win.isFullScreen(), route: connectionChanged?'/my-issues':safeRoute(win.webContents.getURL().slice(rendererOrigin.length)) ?? '/my-issues' })) };
  mkdirSync(app.getPath('userData'), { recursive: true });
  const temporary = `${stateFile()}.tmp`;
  try { writeFileSync(temporary, JSON.stringify(saved), { mode: 0o600 }); renameSync(temporary, stateFile()); } catch (error) { process.stderr.write(`Unable to save window position: ${String(error)}\n`); }
}
function queueSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 250); }
function focused() { return BrowserWindow.getFocusedWindow() ?? [...windows][0]; }
function companionWindow(route?:string){
  const owner=focused();if(!owner)return createWindow({width:1280,height:800,route});
  const bounds=owner.getBounds(),offset=owner.isMaximized()?0:22;
  return createWindow({...bounds,x:bounds.x+offset,y:bounds.y+offset,route});
}
function command(name: string, extra: Record<string, unknown> = {}, target = focused()) {
  if(restartCoordinator.busy)return;
  if(!target||target.isDestroyed())return;
  for(const item of rendererCommands.enqueue(target.webContents.id,{command:name,...extra}))target.webContents.send('desktop:command',item);
}
function navigate(route: string, preferred?:BrowserWindow) {
  if(!rendererOrigin){pendingRoutes.push(route);return;}
  const target = preferred&&!preferred.isDestroyed()?preferred:focused();
  if (!target) return createWindow({ width: 1280, height: 800, route });
  if (target.isMinimized()) target.restore(); target.show(); target.focus();
  command('navigate', { route }, target);
}
function validSender(event: IpcMainInvokeEvent | IpcMainEvent) {
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!owner || !windows.has(owner) || event.senderFrame !== event.sender.mainFrame || !trustedRendererUrl(event.senderFrame.url, rendererOrigin)) throw new Error('Untrusted IPC sender');
  return owner;
}
function createWindow(state: WindowState = { width: 1280, height: 800 }) {
  restartCoordinator.windowAdded();
  const bounds = restoredWindowBounds(state, screen.getAllDisplays().map(display=>display.workArea));
  const win = new BrowserWindow({ ...bounds, fullscreenable: true, minWidth: 500, minHeight: 520, show: false, title: 'Parabolic', backgroundColor: nativeTheme.shouldUseDarkColors ? '#090909' : '#ffffff', titleBarStyle: process.platform==='darwin'?'hidden':'default', trafficLightPosition: process.platform==='darwin'?{ x: 17, y: 12 }:undefined, autoHideMenuBar: process.platform !== 'darwin', webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, spellcheck: true, partition: rendererPartition } });
  windows.add(win);
  rendererCommands.reset(win.webContents.id);
  win.on('focus',refreshCreationMenu);
  win.webContents.on('did-start-navigation',details=>{if(details.isMainFrame)restartCoordinator.invalidate(win.id);if(details.isMainFrame&&!details.isSameDocument&&trustedRendererUrl(details.url,rendererOrigin)){rendererCommands.reset(win.webContents.id);creationReady.delete(win.webContents.id);creationAvailability.delete(win.webContents.id);refreshCreationMenu();}});
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (trustedRendererUrl(url, rendererOrigin)) { const parsed = new URL(url); command('new-tab', { route: parsed.pathname + parsed.search + parsed.hash }, win); }
    else { const route = routeFromDeepLink(url); if (route) command('navigate', { route }, win); else { const safe = safeExternalUrl(url); if (safe) void shell.openExternal(safe); } }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => { if (!trustedRendererUrl(url, rendererOrigin)) { event.preventDefault(); const route = routeFromDeepLink(url); if (route) command('navigate', { route }, win); else { const safe = safeExternalUrl(url); if (safe) void shell.openExternal(safe); } } });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('context-menu',(event,params)=>{
    const template=editableContextMenu(params);
    if(!template.length)return;
    event.preventDefault();
    Menu.buildFromTemplate(template).popup({window:win});
  });
  win.webContents.on('before-input-event', (_event, input) => win.webContents.setIgnoreMenuShortcuts(editorFocused.has(win.webContents.id) && input.key.toLowerCase() === 'k' && (input.meta || input.control)));
  win.webContents.on('found-in-page', (_event, result) => win.webContents.send('desktop:find-result', result));
  win.webContents.on('render-process-gone', (_event, details) => { if (!quitting && details.reason !== 'clean-exit') void dialog.showMessageBox(win, { type: 'error', message: 'This window stopped responding', detail: 'Your saved workspace data is safe. Reload to continue.', buttons: ['Reload', 'Close'], defaultId: 0 }).then(result => result.response === 0 ? win.reload() : win.close()); });
  win.webContents.on('did-fail-load', (_event, errorCode, description, _url, isMainFrame) => { if (isMainFrame && errorCode !== -3 && !quitting) void dialog.showMessageBox(win, { type: 'error', message: 'Unable to open the workspace', detail: description, buttons: ['Try again', 'Close'], defaultId: 0 }).then(result => result.response === 0 ? win.reload() : win.close()); });
  win.webContents.on('did-navigate-in-page', queueSave);
  win.once('ready-to-show', () => { if (state.maximized) win.maximize(); if (process.env.PARABOLIC_HEADLESS !== '1') win.show(); if(state.fullscreen===true)win.setFullScreen(true); });
  win.on('enter-full-screen', queueSave); win.on('leave-full-screen', queueSave);
  win.on('maximize', queueSave); win.on('unmaximize', queueSave);
  win.on('resize', queueSave); win.on('move', queueSave); win.on('close', () => { if (!quitting) saveState(); });
  const contentsId=win.webContents.id;
  win.on('closed', () => { restartCoordinator.invalidate(win.id);windows.delete(win);editorFocused.delete(contentsId);creationReady.delete(contentsId);creationAvailability.delete(contentsId);rendererCommands.remove(contentsId);refreshCreationMenu(); });
  void win.loadURL(`${rendererOrigin}${safeRoute(state.route) ?? '/my-issues'}`);
  return win;
}
function installIpc() {
  ipcMain.handle('desktop:navigation-tabs',event=>{validSender(event);return alwaysShowTabs;});
  ipcMain.handle('desktop:hardware-acceleration',event=>{validSender(event);const enabled=app.isHardwareAccelerationEnabled();return {enabled,canDisable:enabled&&!hardwareAccelerationDisabled};});
  ipcMain.handle('desktop:disable-hardware-acceleration',async event=>{
    const owner=validSender(event);
    try{return await requestDisableHardwareAcceleration({
      disabled:()=>hardwareAccelerationDisabled,
      confirm:async()=>{
        const answer=await dialog.showMessageBox(owner,{type:'question',message:'Disable hardware acceleration?',detail:'Parabolic will restart to apply this change.',buttons:['Disable and restart','Cancel'],defaultId:0,cancelId:1});
        return answer.response===0;
      },
      prepareRestart:prepareDesktopRestart,
      beforeRelaunch:async()=>{saveState();await Promise.all([...new Set([...windows].filter(win=>!win.isDestroyed()).map(win=>win.webContents.session))].map(partition=>partition.flushStorageData()));},
      persist:()=>{saveDesktopDevicePreferences(app.getPath('userData'),{hardwareAccelerationDisabled:true});hardwareAccelerationDisabled=true;},
      relaunch:()=>setTimeout(()=>{app.relaunch();app.quit();},100),
    });}catch(error){
      await dialog.showMessageBox(owner,{type:'error',message:'Unable to disable hardware acceleration',detail:error instanceof Error?error.message:String(error),buttons:['OK']});
      throw error;
    }
  });
  ipcMain.handle('desktop:diagnostics',async event=>{validSender(event);return {version:app.getVersion(),electron:process.versions.electron,chromium:process.versions.chrome,architecture:process.arch,windows:windows.size,theme:nativeTheme.themeSource,mode:configuredServerUrl?'remote':'embedded',memory:await process.getProcessMemoryInfo(),cpu:process.getCPUUsage()};});
  ipcMain.handle('desktop:developer-tools',event=>{validSender(event);event.sender.openDevTools({mode:'detach'});});
  ipcMain.on('desktop:cache-cleared',(event,result)=>{try{const win=validSender(event),request=cacheRequests.get(win.id);if(!request||result?.requestId!==request.requestId||typeof result.ok!=='boolean')return;result.ok?request.resolve():request.reject(Error(String(result.error||'Unable to clear application cache').slice(0,1000)));}catch{/* Only the requested live main frame can acknowledge clearing. */}});
  ipcMain.on('desktop:restart-prepared',(event,result)=>{try{restartCoordinator.acknowledge(validSender(event).id,result);}catch{/* Detached and foreign frames cannot acknowledge a save. */}});
  ipcMain.on('desktop:creation-availability',(event,value)=>{try{validSender(event);creationAvailability.set(event.sender.id,normalizeCreationAvailability(value));refreshCreationMenu();}catch{/* Ignore untrusted renderer frames. */}});
  ipcMain.on('desktop:renderer-ready',(event,ready)=>{try{validSender(event);if(typeof ready!=='boolean')return;if(!ready){rendererCommands.reset(event.sender.id);creationReady.delete(event.sender.id);creationAvailability.delete(event.sender.id);refreshCreationMenu();return;}creationReady.add(event.sender.id);refreshCreationMenu();for(const item of rendererCommands.ready(event.sender.id))event.sender.send('desktop:command',item);}catch{/* Detached, child, and foreign frames cannot receive queued commands. */}});
  ipcMain.handle('desktop:get-connection',event=>{validSender(event);return {serverUrl:configuredServerUrl,activeUrl:rendererOrigin,mode:service?'embedded':'remote'};});
  ipcMain.handle('desktop:set-connection',async(event,value)=>{
    validSender(event);const url=value===null||value===''?null:safeServerUrl(value);if(value!==null&&value!==''&&!url)throw Error('Enter an HTTPS server origin, or a loopback HTTP origin, without a path or credentials');
    if(url){const response=await fetch(`${url}/health`,{signal:AbortSignal.timeout(8000),redirect:'error',headers:{Accept:'application/json'}});if(!response.ok)throw Error('The workspace server did not respond successfully');const health=await response.json() as {status?:string;version?:string};if(health.status!=='ok'||typeof health.version!=='string')throw Error('This address is not a compatible workspace server');}
    mkdirSync(app.getPath('userData'),{recursive:true});const file=connectionFile();writeFileSync(`${file}.tmp`,JSON.stringify({serverUrl:url}),{mode:0o600});renameSync(`${file}.tmp`,file);configuredServerUrl=url;connectionChanged=true;delete process.env.PARABOLIC_RENDERER_URL;
    setTimeout(()=>{app.relaunch();app.quit();},100);
  });
  ipcMain.on('desktop:editor-focus', (event, focused) => { try { validSender(event);if(typeof focused!=='boolean')return;if(focused)editorFocused.add(event.sender.id);else editorFocused.delete(event.sender.id); } catch { /* Reject messages from detached or foreign frames. */ } });
  ipcMain.handle('desktop:find', (event, text, options) => { validSender(event); if (typeof text !== 'string' || !text.length || text.length > 10_000) throw new Error('Invalid find text'); return event.sender.findInPage(text, { forward: options?.forward !== false, findNext: options?.findNext !== false }); });
  ipcMain.handle('desktop:stop-find', event => { validSender(event); event.sender.stopFindInPage('clearSelection'); });
  ipcMain.handle('desktop:open-external', async (event, input) => { validSender(event); const url = safeExternalUrl(input); if (!url) throw new Error('Unsupported external URL'); await shell.openExternal(url); });
  ipcMain.handle('desktop:new-window', (event, input) => { validSender(event); const route = safeRoute(input); if (!route) throw new Error('Invalid route'); companionWindow(route); });
  ipcMain.handle('desktop:new-tab', (event, input) => { const win = validSender(event); const route = safeRoute(input); if (!route) throw new Error('Invalid route'); command('new-tab', { route }, win); });
  ipcMain.handle('desktop:copy-text', (event, text) => { validSender(event); if (typeof text !== 'string' || text.length > 1_000_000) throw new Error('Invalid clipboard text'); clipboard.writeText(text); });
  ipcMain.handle('desktop:set-badge', (event, count,mode='count') => { validSender(event); if (!Number.isInteger(count) || count < 0 || count > 1_000_000 || !['off','indicator','count'].includes(mode)) throw new Error('Invalid badge count'); if(process.platform==='darwin')app.dock?.setBadge(desktopBadgeText(count,mode));else app.setBadgeCount(mode==='off'?0:count); });
  ipcMain.handle('desktop:notification-settings',async event=>{validSender(event);if(process.platform==='darwin')await shell.openExternal('x-apple.systempreferences:com.apple.Notifications-Settings.extension');});
  ipcMain.handle('desktop:set-theme', (event, theme) => { validSender(event); if (!['system', 'dark', 'light'].includes(theme)) throw new Error('Invalid theme'); nativeTheme.themeSource = theme; queueSave(); });
  ipcMain.handle('desktop:notify', (event, details) => {
    const owner=validSender(event);
    if (!details || typeof details.title !== 'string' || typeof details.body !== 'string' || details.title.length > 250 || details.body.length > 4000 || !validNotificationTag(details.tag) || (details.route !== undefined && !safeRoute(details.route))) throw new Error('Invalid notification');
    if (!Notification.isSupported()) return false;
    if(!notificationDeduper.accept(details.tag))return false;
    const notification = new Notification({ id:details.tag,title: details.title, body: details.body, silent: false });
    activeNotifications.set(details.tag,notification);
    if(activeNotifications.size>2000)activeNotifications.delete(activeNotifications.keys().next().value!);
    if (details.route) notification.on('click', () => {navigate(details.route,owner);activeNotifications.delete(details.tag);});
    notification.on('close',()=>activeNotifications.delete(details.tag));
    return new Promise<boolean>(resolve=>{let settled=false;const finish=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timeout);if(!ok)activeNotifications.delete(details.tag);resolve(ok);};const timeout=setTimeout(()=>finish(false),10000);timeout.unref();notification.once('show',()=>finish(true));notification.once('failed',()=>finish(false));try{notification.show();}catch{finish(false);}});
  });
}
function installMenu() {
  const mac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about' }, ...(desktopUpdates?[desktopUpdates.menuItem()]:[]), { type: 'separator' }, { label: 'Preferences', accelerator: 'CmdOrCtrl+,', click: () => command('settings') }, { label: 'Clear application data…', click: () => {void clearApplicationData();} }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] } as MenuItemConstructorOptions] : []),
    { label: 'File', submenu: [{ id:'native-create-contextual',label: 'New…', visible:false, accelerator: 'CmdOrCtrl+N', click: () => command('new-contextual') }, { label:'New',submenu:[{id:'native-create-issue',label:'Issue…',click:()=>command('new-issue')},{id:'native-create-project',label:'Project…',click:()=>command('new-project')},{id:'native-create-initiative',label:'Initiative…',click:()=>command('new-initiative')},{id:'native-create-document',label:'Document…',click:()=>command('new-document')},{id:'native-create-customer-request',label:'Customer request…',click:()=>command('new-customer-request')}] }, { type: 'separator' }, { label: 'New Tab',visible:false, accelerator: 'CmdOrCtrl+T', click: () => command('new-tab') }, { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => companionWindow() }, {type:'separator'}, { label: 'Reopen Closed Tab', accelerator: 'CmdOrCtrl+Shift+T', click: () => command('reopen-tab') }, { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => command('close-tab') }, { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', role: 'close' }, { type: 'separator' }, { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => focused()?.webContents.print({ silent: false }) }] },
    { label: 'Edit', submenu: [{label:'Undo',accelerator:'CmdOrCtrl+Z',click:()=>command('undo')},{label:'Redo',accelerator:'CmdOrCtrl+Shift+Z',click:()=>command('redo')}, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [
      {role:'reload'},
      {id:'always-show-navigation-tabs',label:'Always Show Navigation Tabs',type:'checkbox',checked:alwaysShowTabs,click:()=>{alwaysShowTabs=!alwaysShowTabs;for(const win of windows)command('navigation-tabs',{value:alwaysShowTabs},win);queueSave();installMenu();}},
      {label:'Enter Full Screen',accelerator:mac?'Ctrl+Command+F':'F11',click:(_item,win)=>{const target=win??focused();if(target)target.setFullScreen(!target.isFullScreen());}},
      {role:'toggleDevTools'}, {type:'separator'},
      {label:'Actual Size',accelerator:'CmdOrCtrl+0',click:(_item,win)=>(win instanceof BrowserWindow?win:focused())?.webContents.setZoomFactor(1)},
      {label:'Zoom In',accelerator:'CmdOrCtrl+Plus',click:(_item,win)=>{const contents=(win instanceof BrowserWindow?win:focused())?.webContents;if(contents)contents.setZoomFactor(nextZoomFactor(contents.getZoomFactor(),1));}},
      {label:'Zoom In',visible:false,accelerator:'CmdOrCtrl+=',click:(_item,win)=>{const contents=(win instanceof BrowserWindow?win:focused())?.webContents;if(contents)contents.setZoomFactor(nextZoomFactor(contents.getZoomFactor(),1));}},
      {label:'Zoom Out',accelerator:'CmdOrCtrl+-',click:(_item,win)=>{const contents=(win instanceof BrowserWindow?win:focused())?.webContents;if(contents)contents.setZoomFactor(nextZoomFactor(contents.getZoomFactor(),-1));}},
      {label:'Command menu',visible:false,accelerator:'CmdOrCtrl+K',click:()=>command('command-menu')},
      {label:'Find in page',visible:false,accelerator:'CmdOrCtrl+F',click:()=>command('find-in-page')},
      {label:'Next tab',visible:false,accelerator:'Ctrl+Tab',click:()=>command('next-tab')},
      {label:'Previous tab',visible:false,accelerator:'Ctrl+Shift+Tab',click:()=>command('previous-tab')},
      {role:'forceReload',visible:false},
    ] },
    { label: 'History', submenu: [{ label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: () => command('navigate', { route: '/' }) }, { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => command('back') }, { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => command('forward') }] },
    { label: 'Window', role: 'windowMenu', submenu: [{ role: 'minimize' }, { type: 'separator' }, { role: 'front' },{role:'zoom'}] },
    { label: 'Help', role: 'help', submenu: desktopHelpMenu(name => command(name)) },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  refreshCreationMenu();
}

async function launchEmbeddedService(port:number){
  const starting=startEmbeddedService({databasePath:join(app.getPath('userData'),'parabolic.sqlite'),staticDir:join(app.getAppPath(),'dist'),port},error=>void recoverService(error));serviceStarting=starting;
  try{return service=await starting;}finally{if(serviceStarting===starting)serviceStarting=undefined;}
}
export async function prepareUpdateInstallation(){
  if(serviceRecovery)throw Error('Finish restoring the workspace service before updating.');
  updateLease=await prepareDesktopRestart();updateLease.assertReady();saveState();
  for(const partition of new Set([...windows].map(win=>win.webContents.session)))partition.flushStorageData();
  if(service){updateServiceClosed=true;await service.close();service=undefined;}
  updateLease.assertReady();shutdownComplete=true;quitting=true;
  if(saveTimer)clearTimeout(saveTimer);
}
export async function rollbackUpdateInstallation(){
  quitting=false;shutdownComplete=false;
  try{
    if(updateServiceClosed){await service?.close();service=undefined;await launchEmbeddedService(localServicePort??0);updateServiceClosed=false;}
  }finally{updateLease?.cancel();updateLease=undefined;}
}
async function recoverService(error:Error){
  if(quitting)return;if(serviceRecovery){pendingServiceFailure=error;return;}serviceRecovery=true;
  try{
    let detail=error.message;
    while(!quitting){
      const options={type:'error' as const,message:'The workspace service stopped',detail:detail+' Your saved workspace and local drafts are preserved.',buttons:['Restart workspace service','Quit'],defaultId:0,cancelId:1};
      const win=focused(),answer=win?await dialog.showMessageBox(win,options):await dialog.showMessageBox(options);
      if(quitting)return;if(answer.response!==0){app.quit();return;}
      try{await launchEmbeddedService(localServicePort!);return;}
      catch(restartError){detail=restartError instanceof Error?restartError.message:String(restartError);}
    }
  }catch(recoveryError){
    process.stderr.write(`Workspace service recovery failed: ${recoveryError instanceof Error?recoveryError.message:String(recoveryError)}\n`);
    if(!quitting)app.quit();
  }finally{serviceRecovery=false;const failure=pendingServiceFailure;pendingServiceFailure=undefined;if(failure&&!quitting)void recoverService(failure);}
}

export async function startDesktop() {
  app.setName('Parabolic');
  if (process.env.PARABOLIC_USER_DATA) { if (!isAbsolute(process.env.PARABOLIC_USER_DATA)) throw new Error('PARABOLIC_USER_DATA must be an absolute directory'); mkdirSync(process.env.PARABOLIC_USER_DATA, { recursive: true, mode: 0o700 }); app.setPath('userData', process.env.PARABOLIC_USER_DATA); }
  hardwareAccelerationDisabled=loadDesktopDevicePreferences(app.getPath('userData')).hardwareAccelerationDisabled;
  if(hardwareAccelerationDisabled)app.disableHardwareAcceleration();
  const lock = app.requestSingleInstanceLock();
  if (!lock) { app.quit(); return; }
  app.on('second-instance', (_event, argv) => { const route = argv.map(routeFromDeepLink).find(Boolean); if (route) navigate(route); else focused()?.show(); });
  app.on('open-url', (event, url) => { event.preventDefault(); const route = routeFromDeepLink(url); if (!route) return; if (rendererUrl) navigate(route); else pendingRoutes.push(route); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (rendererUrl && !windows.size) createWindow(); });
  app.on('before-quit',event=>{
    desktopUpdates?.stop();
    if(!quitting){saveState();quitting=true;if(saveTimer)clearTimeout(saveTimer);}
    if(shutdownComplete||!service&&!serviceStarting&&!shutdownPromise)return;
    event.preventDefault();shutdownPromise??=(async()=>{try{await serviceStarting?.catch(()=>{});await service?.close();}catch(error){process.stderr.write('Workspace shutdown failed during quit: '+(error instanceof Error?error.message:String(error))+'\n');}finally{shutdownComplete=true;app.quit();}})();
  });
  await app.whenReady();
  if(quitting)return;
  if (process.env.PARABOLIC_HEADLESS === '1') app.dock?.hide();
  if (app.isPackaged) app.setAsDefaultProtocolClient('parabolic');
  const state = loadState(); alwaysShowTabs=state.alwaysShowTabs!==false; nativeTheme.themeSource = state.theme; localServicePort = state.servicePort;configuredServerUrl=loadConnection();
  app.setAboutPanelOptions({ applicationName: 'Parabolic', applicationVersion: app.getVersion(), version: '', copyright: 'Internal workspace' });
  if (process.env.PARABOLIC_RENDERER_URL||configuredServerUrl) {
    const url = new URL(process.env.PARABOLIC_RENDERER_URL||configuredServerUrl!);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid renderer URL');
    rendererUrl = url.href;
  } else {
    const staticDir = join(app.getAppPath(), 'dist');
    if (!existsSync(join(staticDir, 'index.html'))) throw new Error('Renderer build is missing. Run the build command first.');
    // A saved port is part of the renderer's storage origin. Retry it instead
    // of silently opening an empty cache under a different origin.
    while(!quitting){
      try{service=await launchEmbeddedService(state.servicePort??0);break;}
      catch(error){
        const answer=await dialog.showMessageBox({type:'error',message:'Unable to start the workspace',detail:(error instanceof Error?error.message:String(error))+' Your saved workspace and drafts have not been removed. Close any application using the saved workspace port, then try again.',buttons:['Try again','Quit'],defaultId:0,cancelId:1});
        if(answer.response!==0){app.quit();return;}
      }
    }
    if(!service)return;
    rendererUrl=service.url;localServicePort=service.port;
  }
  if(quitting)return;
  rendererOrigin = new URL(rendererUrl).origin;
  rendererPartition=desktopSessionPartition(rendererOrigin,!!service);
  session.fromPartition(rendererPartition).setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.fromPartition(rendererPartition).setPermissionCheckHandler(() => false);
  installIpc();
  desktopUpdates=createDesktopUpdates({focused,refreshMenu:installMenu,prepareInstall:prepareUpdateInstallation,rollbackInstall:rollbackUpdateInstallation});
  installMenu();
  for (const windowState of state.windows.length ? state.windows : [{ width: 1280, height: 800 }]) createWindow(windowState);
  queueSave();
  const startupRoute = process.argv.map(routeFromDeepLink).find(Boolean);
  if (startupRoute) pendingRoutes.push(startupRoute);
  for (const route of pendingRoutes.splice(0)) navigate(route);
  desktopUpdates.start();
}
void startDesktop().catch(error => { process.stderr.write(`${error instanceof Error ? error.stack : error}\n`); if (app.isReady()) dialog.showErrorBox('Parabolic could not start', error instanceof Error ? error.message : String(error)); app.exit(1); });
