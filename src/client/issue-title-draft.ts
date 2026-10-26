import {DurableDraftStorage} from './durable-draft-storage';
import {pendingSaves, type PendingSaves} from './pending-saves';

const fields = (value: string | null): Record<string, unknown> => {
  try { const parsed = JSON.parse(value ?? '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
};

/** Typing journals locally; only an editing boundary commits an issue mutation.
 * Each instance belongs to one issue, including after its editor unmounts. */
export class IssueTitleDraft {
  private pending?: string;
  private running?: Promise<void>;
  private unregister?: () => void;
  private recovered = false;
  constructor(
    private readonly key: string,
    private readonly storage: DurableDraftStorage,
    private readonly currentTitle: () => string,
    private readonly save: (title: string) => Promise<unknown>,
    private readonly coordinator: PendingSaves = pendingSaves,
  ) {}
  get dirty() { return this.pending !== undefined || !!this.running; }
  recover() {
    if (this.recovered) return;
    this.recovered = true;
    const title = fields(this.storage.get(this.key)).title;
    if (typeof title === 'string') { this.change(title); return title; }
  }
  change(title: string) {
    this.pending = title;
    this.unregister ??= this.coordinator.register(() => this.flush());
    this.coordinator.changed();
    return this.storage.update(this.key, value => JSON.stringify({...fields(value), title}), 'title');
  }
  flush(): Promise<void> {
    // A second explicit commit waits for the first; typing alone never starts a
    // second write, even if it happens while the first commit is in flight.
    if (this.running) return this.running.then(() => this.flush());
    const title = this.pending;
    if (title === undefined) return Promise.resolve();
    const running = Promise.resolve().then(async () => {
      if (title.trim() && title !== this.currentTitle()) await this.save(title);
      if (this.pending === title) {
        this.pending = undefined;
        this.storage.update(this.key, value => {
          const next = fields(value);
          if (next.title === title) delete next.title;
          return JSON.stringify(next);
        }, 'title');
      }
    }).finally(() => {
      this.running = undefined;
      if (this.pending === undefined) { this.unregister?.(); this.unregister = undefined; }
    });
    this.running = running;
    return running;
  }
}
