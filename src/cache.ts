interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly values = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.values.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs): void {
    this.values.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  take(key: string): T | undefined {
    const value = this.get(key);
    this.values.delete(key);
    return value;
  }

  delete(key: string): void {
    this.values.delete(key);
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.values.entries()) {
      if (entry.expiresAt <= now) {
        this.values.delete(key);
      }
    }
  }
}
