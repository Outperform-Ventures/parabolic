import {chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export interface DesktopDevicePreferences {
  hardwareAccelerationDisabled:boolean;
}

const defaults:DesktopDevicePreferences={hardwareAccelerationDisabled:false};
export const desktopDevicePreferencesFile=(userData:string)=>join(userData,'desktop-preferences.json');

export function parseDesktopDevicePreferences(value:unknown):DesktopDevicePreferences {
  if(!value||typeof value!=='object'||typeof (value as Record<string,unknown>).hardwareAccelerationDisabled!=='boolean')return {...defaults};
  return {hardwareAccelerationDisabled:(value as Record<string,unknown>).hardwareAccelerationDisabled as boolean};
}

export function loadDesktopDevicePreferences(userData:string):DesktopDevicePreferences {
  try{return parseDesktopDevicePreferences(JSON.parse(readFileSync(desktopDevicePreferencesFile(userData),'utf8')));}
  catch{return {...defaults};}
}

/** Device preferences are deliberately separate from workspace/window state because
 * acceleration must be known before Electron is ready and before a renderer exists. */
export function saveDesktopDevicePreferences(userData:string,value:DesktopDevicePreferences){
  mkdirSync(userData,{recursive:true,mode:0o700});
  const file=desktopDevicePreferencesFile(userData),temporary=file+'.tmp';
  writeFileSync(temporary,JSON.stringify(parseDesktopDevicePreferences(value)),{mode:0o600});
  chmodSync(temporary,0o600);
  renameSync(temporary,file);
  chmodSync(file,0o600);
}

export interface DisableHardwareAccelerationDependencies {
  disabled:()=>boolean;
  confirm:()=>Promise<boolean>;
  prepareRestart:()=>Promise<{assertReady():void;cancel():void}>;
  beforeRelaunch:()=>Promise<void>|void;
  persist:()=>Promise<void>|void;
  relaunch:()=>void;
}

export async function requestDisableHardwareAcceleration(dependencies:DisableHardwareAccelerationDependencies){
  if(dependencies.disabled())return {accepted:false,reason:'already-disabled' as const};
  if(!await dependencies.confirm())return {accepted:false,reason:'cancelled' as const};
  const lease=await dependencies.prepareRestart();
  try{
    lease.assertReady();
    await dependencies.beforeRelaunch();
    lease.assertReady();
    await dependencies.persist();
    lease.assertReady();
    dependencies.relaunch();
    return {accepted:true,reason:'relaunching' as const};
  }catch(error){lease.cancel();throw error;}
}
