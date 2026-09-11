import {app,autoUpdater as nativeUpdater,dialog,systemPreferences,type BrowserWindow,type MenuItemConstructorOptions} from 'electron';
import {autoUpdater} from 'electron-updater';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {UpdateController,updateMenu} from './update-controller';
import {MacUpdateTransport} from './update-transport';
import {updateDisabledReason} from './update-policy';

export function createDesktopUpdates(options:{focused:()=>BrowserWindow|undefined;refreshMenu:()=>void;prepareInstall:()=>Promise<void>;rollbackInstall:()=>Promise<void>}){
  const log=(error:unknown)=>process.stderr.write(`Desktop update: ${error instanceof Error?error.message:String(error)}\n`);
  const transport=new MacUpdateTransport(autoUpdater,nativeUpdater,log);
  const disabledReason=updateDisabledReason({platform:process.platform,packaged:app.isPackaged,
    managedDisabled:process.platform==='darwin'&&systemPreferences.getUserDefault('AutoUpdateDisabled','boolean'),
    configured:existsSync(join(process.resourcesPath,'app-update.yml'))});
  const controller=new UpdateController({transport,disabledReason,prepareInstall:options.prepareInstall,rollbackInstall:options.rollbackInstall,
    changed:options.refreshMenu,log,notify:(kind,detail)=>{
      const message=kind==='current'?'No Updates Available':kind==='disabled'?'Updates Unavailable':'Unable to Update';
      const config={type:kind==='error'?'error' as const:'info' as const,message,detail:kind==='current'?`Parabolic ${app.getVersion()} is the latest version.`:detail,buttons:['OK']};
      const win=options.focused();void(win&&!win.isDestroyed()?dialog.showMessageBox(win,config):dialog.showMessageBox(config)).catch(log);
    }});
  return {
    start:()=>controller.start(),
    stop:()=>{controller.stop();transport.dispose();},
    menuItem:():MenuItemConstructorOptions=>({id:'parabolic-check-updates',...updateMenu(controller.state),click:()=>{void controller.activate();}}),
  };
}
