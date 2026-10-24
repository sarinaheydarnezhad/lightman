type Entry = {
  pending?: Promise<unknown>;
  value?: unknown;
  expiresAt: number;
};

export class RequestCache {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  clear(): void {
    this.entries.clear();
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  get<Result>(
    key: string,
    load: () => Promise<Result>,
    lifetimeMs = 0,
    force = false,
  ): Promise<Result> {
    const previous = this.entries.get(key);
    if (previous?.pending) return previous.pending as Promise<Result>;
    if (!force && previous && previous.expiresAt > this.now())
      return Promise.resolve(previous.value as Result);
    const entry: Entry = { expiresAt: 0 };
    const pending = Promise.resolve()
      .then(load)
      .then(
        (value) => {
          if (this.entries.get(key) === entry) {
            if (lifetimeMs > 0) {
              entry.value = value;
              entry.expiresAt = this.now() + lifetimeMs;
              entry.pending = undefined;
            } else this.entries.delete(key);
          }
          return value;
        },
        (error: unknown) => {
          if (this.entries.get(key) === entry) this.entries.delete(key);
          throw error;
        },
      );
    entry.pending = pending;
    this.entries.set(key, entry);
    return pending;
  }
}
