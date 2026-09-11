import type {DesktopCreationAvailability} from '../shared/desktop-creation';
import { contextBridge, ipcRenderer } from 'electron';
import {RestartRenderer} from './restart-renderer';
import {freezeRestartInput} from './restart-input';

export interface DesktopCommand { command: string; route?: string; [key: string]: unknown }
const desktop = {
  isDesktop: true,
  setCreationAvailability: (availability:DesktopCreationAvailability) => ipcRenderer.send('desktop:creation-availability',availability),
  platform: process.platform,
  getNavigationTabs: () => ipcRenderer.invoke('desktop:navigation-tabs') as Promise<boolean>,
  getHardwareAcceleration: () => ipcRenderer.invoke('desktop:hardware-acceleration') as Promise<{enabled:boolean;canDisable:boolean}>,
  disableHardwareAcceleration: () => ipcRenderer.invoke('desktop:disable-hardware-acceleration') as Promise<{accepted:boolean;reason:'already-disabled'|'cancelled'|'relaunching'}>,
  getDiagnostics: () => ipcRenderer.invoke('desktop:diagnostics') as Promise<Record<string,unknown>>,
  openDeveloperTools: () => ipcRenderer.invoke('desktop:developer-tools') as Promise<void>,
  onClearApplicationData(callback: () => Promise<void>) {
    const handler=(_event:unknown,requestId:string)=>void Promise.resolve().then(callback).then(()=>ipcRenderer.send('desktop:cache-cleared',{requestId,ok:true}),error=>ipcRenderer.send('desktop:cache-cleared',{requestId,ok:false,error:String(error?.message||error)}));
    ipcRenderer.on('desktop:clear-cache',handler);
    return ()=>ipcRenderer.removeListener('desktop:clear-cache',handler);
  },
  onPrepareRestart(callback: () => Promise<void>) {
    const restart=new RestartRenderer(()=>freezeRestartInput(document),callback,result=>ipcRenderer.send('desktop:restart-prepared',result));
    const handler=(_event:unknown,requestId:unknown)=>restart.prepare(requestId);
    const cancel=(_event:unknown,requestId:unknown)=>restart.cancel(requestId);
    ipcRenderer.on('desktop:prepare-restart', handler);
    ipcRenderer.on('desktop:cancel-restart',cancel);
    return () => {restart.dispose();ipcRenderer.removeListener('desktop:prepare-restart',handler);ipcRenderer.removeListener('desktop:cancel-restart',cancel);};
  },
  onCommand(callback: (event: DesktopCommand) => void) {
    const handler = (_event: unknown, command: DesktopCommand) => callback(command);
    ipcRenderer.on('desktop:command', handler);
    ipcRenderer.send('desktop:renderer-ready',true);
    return () => {ipcRenderer.removeListener('desktop:command',handler);if(!ipcRenderer.listenerCount('desktop:command'))ipcRenderer.send('desktop:renderer-ready',false);};
  },
  notify: (details: { title: string; body: string; route?: string; tag?:string }) => ipcRenderer.invoke('desktop:notify', details) as Promise<boolean>,
  openExternal: (url: string) => ipcRenderer.invoke('desktop:open-external', url) as Promise<void>,
  newWindow: (route = '/my-issues') => ipcRenderer.invoke('desktop:new-window', route) as Promise<void>,
  newTab: (route = '/my-issues') => ipcRenderer.invoke('desktop:new-tab', route) as Promise<void>,
  setBadge: (count: number,mode:'off'|'indicator'|'count'='count') => ipcRenderer.invoke('desktop:set-badge', count,mode) as Promise<void>,
  openNotificationSettings: () => ipcRenderer.invoke('desktop:notification-settings') as Promise<void>,
  copyText: (text: string) => ipcRenderer.invoke('desktop:copy-text', text) as Promise<void>,
  setTheme: (theme: 'system' | 'dark' | 'light') => ipcRenderer.invoke('desktop:set-theme', theme) as Promise<void>,
  getConnection: () => ipcRenderer.invoke('desktop:get-connection') as Promise<{serverUrl:string|null;activeUrl:string;mode:'embedded'|'remote'}>,
  setConnection: (serverUrl:string|null) => ipcRenderer.invoke('desktop:set-connection',serverUrl).catch(error=>{throw new Error(String(error?.message??error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}) as Promise<void>,
  findInPage: (text: string, options: {forward?: boolean; findNext?: boolean} = {}) => ipcRenderer.invoke('desktop:find', text, options) as Promise<number>,
  stopFindInPage: () => ipcRenderer.invoke('desktop:stop-find') as Promise<void>,
  onFindResult(callback: (result: {requestId:number;activeMatchOrdinal:number;matches:number;finalUpdate:boolean}) => void) {
    const handler = (_event: unknown, result: Parameters<typeof callback>[0]) => callback(result);
    ipcRenderer.on('desktop:find-result', handler);
    return () => ipcRenderer.removeListener('desktop:find-result', handler);
  },
};
contextBridge.exposeInMainWorld('desktop', desktop);
// Keep the rich editor's Cmd+K link binding ahead of the native command-menu accelerator.
window.addEventListener('focusin', () => ipcRenderer.send('desktop:editor-focus', !!document.activeElement?.closest('[contenteditable="true"]')));
