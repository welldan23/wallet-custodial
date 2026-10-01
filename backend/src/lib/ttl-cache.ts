type Entry<T> = { expiresAt: number; value: Promise<T> };

/**
 * Cache di memori dengan masa berlaku. Menyimpan Promise, jadi permintaan
 * yang datang bersamaan untuk kunci yang sama cukup memicu satu pemuatan.
 * Pemuatan yang gagal langsung dibuang supaya bisa dicoba lagi.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 5_000,
    private readonly now: () => number = Date.now,
  ) {}

  getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;

    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { expiresAt: this.now() + this.ttlMs, value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    this.prune();
    return value;
  }

  get size(): number {
    return this.entries.size;
  }

  private prune(): void {
    if (this.entries.size <= this.maxEntries) return;
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    // Masih kebanyakan → buang yang paling lama dimasukkan.
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(key);
    }
  }
}
