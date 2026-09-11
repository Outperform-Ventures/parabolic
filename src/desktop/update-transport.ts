import type { AppUpdater } from 'electron-updater';
import type { EventEmitter } from 'node:events';
import type { UpdateTransport } from './update-controller';

type MacNativeUpdater = EventEmitter & { checkForUpdates(): void };
type Updater = Pick<AppUpdater, 'autoDownload' | 'autoInstallOnAppQuit' | 'autoRunAppAfterInstall' | 'allowDowngrade' | 'checkForUpdates' | 'downloadUpdate' | 'quitAndInstall'> & {
  on(event: string, listener: (...args: any[]) => void): unknown;
  removeListener(event: string, listener: (...args: any[]) => void): unknown;
};

/** Adapts electron-updater without letting Squirrel restart before local saves.
 * Download verifies the archive; stage separately asks Squirrel to validate it.
 * Only the controller's final commit is allowed to invoke quitAndInstall. */
export class MacUpdateTransport implements UpdateTransport {
  private staged = false;
  private downloaded = false;
  private disposed = false;
  private staging?: Promise<void>;
  private nativePreparing = false;
  private cancelStage?: () => void;
  private readonly logError: (error: Error) => void;
  constructor(private readonly updater: Updater, private readonly native: MacNativeUpdater, log: (error: unknown) => void, private readonly stageTimeout = 180_000) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.autoRunAppAfterInstall = true;
    updater.allowDowngrade = false;
    this.logError = error => log(error);
    updater.on('error', this.logError);
  }
  async check() {
    this.assertActive();
    const result = await this.updater.checkForUpdates();
    return result ? { available: result.isUpdateAvailable, version: result.updateInfo.version } : null;
  }
  async download(progress: (percent: number) => void) {
    this.assertActive();
    if (this.staging || this.nativePreparing) throw new Error('An update is already being prepared.');
    this.staged = false; this.downloaded = false;
    const listener = (value: { percent: number }) => progress(value.percent);
    this.updater.on('download-progress', listener);
    try { await this.updater.downloadUpdate(); this.assertActive(); this.downloaded = true; }
    finally { this.updater.removeListener('download-progress', listener); }
  }
  stage(): Promise<void> {
    this.assertActive();
    if (!this.downloaded) return Promise.reject(new Error('Download an update before installing.'));
    if (this.staged) return Promise.resolve();
    if (this.staging) return this.staging;
    if (this.nativePreparing) return Promise.reject(new Error('The operating system is still preparing the update. Try again shortly.'));
    // Defer execution so synchronous transport callbacks also see the lock.
    const pending = Promise.resolve().then(() => new Promise<void>((resolve, reject) => {
      this.assertActive();
      const done = (error?: Error) => {
        clearTimeout(timer); this.native.removeListener('update-downloaded', downloaded); this.native.removeListener('error', failed);
        this.cancelStage = undefined; this.nativePreparing = false;
        if (error) reject(error); else { this.staged = true; resolve(); }
      };
      const downloaded = () => done(), failed = (error: Error) => done(error);
      // Timeout ends the UI wait, not the native operation. Keep its listeners
      // and block replacement downloads so a late old-version event cannot
      // accidentally certify a newer archive.
      const timer = setTimeout(() => reject(new Error('Preparing the update timed out. Try installing again shortly.')), this.stageTimeout);
      this.cancelStage = () => done(new Error('The updater has stopped.'));
      this.nativePreparing = true;
      this.native.once('update-downloaded', downloaded); this.native.once('error', failed);
      try { this.native.checkForUpdates(); } catch (error) { done(error instanceof Error ? error : new Error(String(error))); }
    })).finally(() => { if (this.staging === pending) this.staging = undefined; });
    this.staging = pending;
    return pending;
  }
  quitAndInstall() {
    this.assertActive();
    if (!this.staged) throw new Error('The operating system has not verified the update yet.');
    this.updater.quitAndInstall();
  }
  dispose() {
    this.disposed = true; this.cancelStage?.();
    this.updater.removeListener('error', this.logError);
  }
  private assertActive() { if (this.disposed) throw new Error('The updater has stopped.'); }
}
