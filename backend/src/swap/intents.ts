import { randomUUID } from 'node:crypto';

import type { SwapQuote, SwapQuoteRequest } from './types.js';
import type { PreparedEvmCall } from './verify.js';

/** Swap yang sudah disiapkan dan menunggu ditandatangani di HP. */
export type SwapIntent = {
  id: string;
  request: SwapQuoteRequest & { fromAddress: string };
  quote: SwapQuote;
  /** Router agregator (EVM: tujuan transaksi; Solana: program router). */
  router: string;
  prepared:
    | {
        chainType: 'evm';
        call: PreparedEvmCall;
        gasLimit: bigint | null;
        approval: PreparedEvmCall | null;
      }
    | { chainType: 'solana'; transaction: string };
  expiresAt: number;
};

/**
 * Simpanan sementara di memori. Sengaja tidak di database: intent cuma
 * berlaku sebentar, dan kalau server restart cukup siapkan ulang.
 * Sekali pakai — `take` menghapusnya supaya swap tidak dieksekusi dua kali.
 */
export class SwapIntentStore {
  private readonly intents = new Map<string, SwapIntent>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  save(intent: Omit<SwapIntent, 'id' | 'expiresAt'>): SwapIntent {
    this.purge();
    const saved = { ...intent, id: randomUUID(), expiresAt: this.now() + this.ttlMs };
    this.intents.set(saved.id, saved);
    return saved;
  }

  peek(id: string): SwapIntent | null {
    const intent = this.intents.get(id);
    if (!intent || intent.expiresAt < this.now()) return null;
    return intent;
  }

  take(id: string): SwapIntent | null {
    const intent = this.peek(id);
    this.intents.delete(id);
    return intent;
  }

  private purge() {
    const at = this.now();
    for (const [id, intent] of this.intents) if (intent.expiresAt < at) this.intents.delete(id);
  }
}
