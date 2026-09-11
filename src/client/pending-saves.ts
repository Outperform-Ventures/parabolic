/** Local durability barrier used before a desktop restart. Registrations are
 * retained until their owner can prove its current edits have been saved. */
export class PendingSaves {
  private callbacks = new Set<() => Promise<void>>();
  private revision = 0;
  private running?: Promise<void>;
  changed() { this.revision++; }
  register(callback: () => Promise<void>) {
    this.callbacks.add(callback); this.changed();
    return () => { if (this.callbacks.delete(callback)) this.changed(); };
  }
  /** Register before starting work so a restart sees uploads already in flight.
   * Changes produced by completion are flushed on the barrier's next pass. */
  track<T>(operation:()=>Promise<T>):Promise<T>{
    const pending=Promise.resolve().then(operation);
    const unregister=this.register(async()=>{await pending;});
    return pending.finally(unregister);
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    const pending = Promise.resolve().then(async () => {
      let revision: number;
      do {
        revision = this.revision;
        const results = await Promise.allSettled([...this.callbacks].map(callback => Promise.resolve().then(callback)));
        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Some changes could not be saved on this device.');
      } while (revision !== this.revision);
    }).finally(() => { if (this.running === pending) this.running = undefined; });
    this.running = pending;
    return pending;
  }
}

export const pendingSaves = new PendingSaves();

/** Debounced edits remain registered through errors and component unmounts.
 * Writes are ordered, so a slower older save cannot overwrite a newer edit. */
export class DeferredSave<T> {
  private pending?: { value: T; revision: number };
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private unregister?: () => void;
  constructor(private readonly save: (value: T) => Promise<unknown> | unknown, private readonly onError: (error: unknown) => void, private readonly delay = 600, private readonly coordinator = pendingSaves) {}
  get dirty() { return !!this.pending || !!this.running; }
  queue(value: T) {
    this.pending = { value, revision: ++this.revision };
    this.unregister ??= this.coordinator.register(() => this.flush());
    this.coordinator.changed();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush().catch(this.onError); }, this.delay);
  }
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer); this.timer = undefined;
    if (this.running) return this.running;
    const pending = Promise.resolve().then(async () => {
      while (this.pending) {
        const current = this.pending;
        await this.save(current.value);
        if (this.pending?.revision === current.revision) this.pending = undefined;
      }
    }).finally(() => {
      if (this.running === pending) this.running = undefined;
      if (!this.pending) {
        if (this.timer) clearTimeout(this.timer); this.timer = undefined;
        this.unregister?.(); this.unregister = undefined;
      }
    });
    this.running = pending;
    return pending;
  }
  release() { void this.flush().catch(this.onError); }
}
