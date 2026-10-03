/**
 * Tiny in-memory TTL cache with:
 *  - in-flight de-duplication (100 users asking for IHSG = 1 upstream call)
 *  - stale-on-error (if upstream fails we keep serving the last good value)
 *
 * This is what keeps the free upstream sources happy and the app fast.
 * Swap for Redis only if you run more than one server process.
 */

interface Entry<T> {
  value: T;
  expires: number;
  storedAt: number;
}

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private maxEntries = 5000) {}

  async get<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key) as Entry<T> | undefined;
    if (hit && hit.expires > now) return hit.value;

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const p = (async () => {
      try {
        const value = await loader();
        this.set(key, value, ttlMs);
        return value;
      } catch (err) {
        if (hit) return hit.value; // stale-on-error
        throw err;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + ttlMs, storedAt: Date.now() });
  }

  peek<T>(key: string): T | undefined {
    return (this.store.get(key) as Entry<T> | undefined)?.value;
  }

  get size() {
    return this.store.size;
  }
}

export const cache = new TtlCache();

/** Run async tasks with a concurrency cap — polite to free upstreams. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
