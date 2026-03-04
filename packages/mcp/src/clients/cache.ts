// ─── Multi-Tier Cache ───────────────────────────────────────────────
// Tier 1: In-memory Map (fast, ephemeral)
// Tier 2: PostgreSQL market_data_cache table (persistent across restarts)

import type { CacheEntry } from '../types.js';

interface MemoryCacheItem {
  value: unknown;
  expiresAt: number; // epoch ms
}

export class MarketDataCache {
  private memory = new Map<string, MemoryCacheItem>();
  private hits = 0;
  private misses = 0;
  private dbQuery?: (key: string) => Promise<CacheEntry<unknown> | null>;
  private dbWrite?: (entry: CacheEntry<unknown>) => Promise<void>;

  /** Optionally connect DB tier for persistent caching */
  connectDB(
    query: (key: string) => Promise<CacheEntry<unknown> | null>,
    write: (entry: CacheEntry<unknown>) => Promise<void>,
  ): void {
    this.dbQuery = query;
    this.dbWrite = write;
  }

  async get<T>(key: string): Promise<T | null> {
    // Tier 1: Memory
    const mem = this.memory.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      this.hits++;
      return mem.value as T;
    }
    if (mem) this.memory.delete(key); // expired

    // Tier 2: DB
    if (this.dbQuery) {
      try {
        const row = await this.dbQuery(key);
        if (row && new Date(row.expiresAt).getTime() > Date.now()) {
          // Promote to memory
          this.memory.set(key, {
            value: row.value,
            expiresAt: new Date(row.expiresAt).getTime(),
          });
          this.hits++;
          return row.value as T;
        }
      } catch {
        // DB tier failure is non-fatal
      }
    }

    this.misses++;
    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number, source: string): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const fetchedAt = new Date().toISOString();
    const expiresAtISO = new Date(expiresAt).toISOString();

    // Tier 1: Memory
    this.memory.set(key, { value, expiresAt });

    // Tier 2: DB (fire and forget)
    if (this.dbWrite) {
      this.dbWrite({
        key,
        value: value as unknown,
        source,
        fetchedAt,
        expiresAt: expiresAtISO,
      }).catch(() => {}); // non-fatal
    }
  }

  async invalidate(key: string): Promise<void> {
    this.memory.delete(key);
  }

  getStats(): { hits: number; misses: number; hitRate: number; memorySize: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      memorySize: this.memory.size,
    };
  }

  /** Clear all caches (useful for testing or forced refresh) */
  clear(): void {
    this.memory.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
