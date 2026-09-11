import { gt, valid } from 'semver';

export const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;
export type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'ready' | 'installing' | 'disabled';
export type UpdateState = Readonly<{ phase: UpdatePhase; version?: string; percent?: number; error?: string; disabledReason?: string }>;

/** The transport must verify the archive before download resolves, and stage it
 * with the operating system before stage resolves. Neither operation may quit. */
export interface UpdateTransport {
  check(): Promise<{ available: boolean; version: string } | null>;
  download(progress: (percent: number) => void): Promise<void>;
  stage(): Promise<void>;
  quitAndInstall(): void;
}
export interface UpdateControllerOptions {
  transport: UpdateTransport;
  disabledReason?: string;
  /** A failed save must reject, leaving the application open. */
  prepareInstall(): Promise<void>;
  rollbackInstall?():Promise<void>;
  changed(state: UpdateState): void;
  notify(kind: 'current' | 'error' | 'disabled', detail?: string): void;
  log(error: unknown): void;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}

export function updateMenu(state: UpdateState) {
  const labels: Record<UpdatePhase, string> = {
    idle: 'Check for Updates', checking: 'Checking for Updates',
    downloading: 'Downloading update', ready: 'Update ready, click to install',
    installing: 'Installing update', disabled: 'Check for Updates',
  };
  return { label: labels[state.phase], enabled: !['checking', 'downloading', 'installing'].includes(state.phase) };
}

/** Serializes background checks, explicit checks, downloads and installation.
 * All public operations settle after reporting failures; timer/menu callers
 * cannot accidentally create an unhandled rejection. */
export class UpdateController {
  private value: UpdateState;
  private downloaded?: string;
  private running?: Promise<void>;
  private manual = false;
  private stopped = false;
  private started = false;
  private cancelSchedule?: () => void;
  constructor(private readonly options: UpdateControllerOptions) {
    this.value = options.disabledReason ? { phase: 'disabled', disabledReason: options.disabledReason } : { phase: 'idle' };
  }
  get state(): UpdateState { return { ...this.value }; }
  private set(phase: UpdatePhase, extra: Partial<UpdateState> = {}) {
    if (this.stopped) return;
    this.value = { phase, ...(this.downloaded ? { version: this.downloaded } : {}), ...extra };
    this.options.changed(this.state);
  }
  start() {
    if (this.started || this.stopped || this.value.phase === 'disabled') return;
    this.started = true;
    const schedule = this.options.schedule ?? ((callback, milliseconds) => {
      const timer = setInterval(callback, milliseconds); timer.unref();
      return () => clearInterval(timer);
    });
    this.cancelSchedule = schedule(() => { void this.check(); }, UPDATE_CHECK_INTERVAL);
    void this.check();
  }
  stop() { this.stopped = true; this.cancelSchedule?.(); this.cancelSchedule = undefined; }
  activate(): Promise<void> {
    if (this.value.phase === 'ready') return this.install();
    if (['downloading', 'installing'].includes(this.value.phase)) return this.running ?? Promise.resolve();
    return this.check(true);
  }
  check(manual = false): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.value.phase === 'disabled') {
      if (manual) this.options.notify('disabled', this.value.disabledReason);
      return Promise.resolve();
    }
    if (this.value.phase === 'installing') return this.running ?? Promise.resolve();
    if (manual) this.manual = true;
    if (this.running) return this.running;
    return this.exclusive(async () => {
      const found = await this.findUpdate();
      if (this.stopped) return;
      if (found) await this.download(found);
      else {
        this.set(this.downloaded ? 'ready' : 'idle');
        if (this.manual && !this.downloaded) this.options.notify('current');
      }
    });
  }
  install(): Promise<void> {
    if (this.stopped || this.running || this.value.phase !== 'ready' || !this.downloaded) return this.running ?? Promise.resolve();
    this.manual = true;
    return this.exclusive(async () => {
      // A failed recheck can still use the verified cached version. A failed
      // replacement download cannot: transports may have replaced their cache.
      let newer: string | undefined;
      try { newer = await this.findUpdate(); }
      catch (error) { this.options.log(error); }
      if (this.stopped) return;
      if (newer) await this.download(newer);
      if (this.stopped || !this.downloaded) return;
      this.set('installing');
      await this.options.transport.stage();
      if (this.stopped) return;
      await this.options.prepareInstall();
      if (this.stopped) return;
      this.options.transport.quitAndInstall();
    });
  }
  private async findUpdate() {
    this.set('checking');
    const result = await this.options.transport.check();
    // A null result means the updater isn't active, not that it is current.
    if (!result) throw new Error('Updates are unavailable for this application build.');
    if (!valid(result.version)) throw new Error('The update server returned an invalid version.');
    return result.available && (!this.downloaded || gt(result.version, this.downloaded)) ? result.version : undefined;
  }
  private async download(version: string) {
    this.downloaded = undefined;
    this.set('downloading', { version, percent: 0 });
    await this.options.transport.download(percent => {
      if (this.value.phase === 'downloading' && Number.isFinite(percent)) {
        this.set('downloading', { version, percent: Math.max(this.value.percent ?? 0, Math.min(100, Math.max(0, percent))) });
      }
    });
    if (this.stopped) return;
    this.downloaded = version;
    this.set('ready');
  }
  private exclusive(operation: () => Promise<void>) {
    // Start on a microtask so reentrant menu/timer events see the same lock.
    const pending = Promise.resolve().then(() => this.stopped ? undefined : operation()).catch(async error => {
      this.options.log(error);
      if (this.stopped) return;
      if(this.value.phase==='installing'&&this.options.rollbackInstall){
        try{await this.options.rollbackInstall();}catch(rollbackError){this.options.log(rollbackError);error=new AggregateError([error,rollbackError],'The update failed and the workspace service could not be restarted.');}
      }
      const detail = error instanceof Error ? error.message : 'Unable to update the application.';
      this.set(this.downloaded ? 'ready' : 'idle', { error: detail });
      if (this.manual) this.options.notify('error', detail);
    }).finally(() => { if (this.running === pending) this.running = undefined; this.manual = false; });
    this.running = pending;
    return pending;
  }
}
