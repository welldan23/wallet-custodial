import { isAddress as isSolanaAddress } from '@solana/kit';
import { Hono } from 'hono';
import { getAddress, isAddress as isEvmAddress } from 'viem';

import { getBalanceSummary, type BalanceSummaryDeps } from '../services/balance-summary.js';

/**
 * GET /v1/balances/summary?evm=0x…&solana=…
 *
 * Hanya menerima alamat publik. Minimal salah satu dari `evm` atau `solana`.
 */
export function balancesRoutes(deps: BalanceSummaryDeps): Hono {
  const app = new Hono();

  app.get('/summary', async (c) => {
    const evm = c.req.query('evm')?.trim() || null;
    const solana = c.req.query('solana')?.trim() || null;

    if (!evm && !solana) {
      return c.json(
        { error: 'missing_address', message: 'Provide at least one address: evm or solana.' },
        400,
      );
    }
    if (evm && !isEvmAddress(evm, { strict: false })) {
      return c.json(
        { error: 'invalid_evm_address', message: 'evm is not a valid EVM address.' },
        400,
      );
    }
    if (solana && !isSolanaAddress(solana)) {
      return c.json(
        { error: 'invalid_solana_address', message: 'solana is not a valid Solana address.' },
        400,
      );
    }

    const summary = await getBalanceSummary(deps, {
      evm: evm ? getAddress(evm) : null,
      solana,
    });

    // Data per pengguna: jangan disimpan cache bersama (CDN/proxy).
    c.header('Cache-Control', 'no-store');
    return c.json(summary);
  });

  return app;
}
