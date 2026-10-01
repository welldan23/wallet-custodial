import type { Config } from '../config.js';
import { createSolanaFeeRpc } from '../fees/solana.js';

import { jupiterQuoteSource } from './jupiter.js';
import { lifiQuoteSource } from './lifi.js';
import { SwapQuoteService, solanaSwapFeeEstimator } from './quote-service.js';

/** Layanan quote swap dari konfigurasi (LI.FI + Jupiter, biaya Solana dari RPC). */
export function createSwapQuoteService(config: Config): SwapQuoteService {
  const solanaRpcUrl = config.rpcUrls.solana;
  return new SwapQuoteService({
    lifi: lifiQuoteSource({
      timeoutMs: config.swapQuoteTimeoutMs,
      apiKey: config.lifiApiKey ?? undefined,
      integrator: config.lifiIntegrator ?? undefined,
    }),
    jupiter: jupiterQuoteSource({
      baseUrl: config.jupiterBaseUrl,
      apiKey: config.jupiterApiKey ?? undefined,
      timeoutMs: config.swapQuoteTimeoutMs,
      estimateNetworkFee: solanaRpcUrl
        ? solanaSwapFeeEstimator(createSolanaFeeRpc(solanaRpcUrl))
        : async () => 5_000n,
    }),
  });
}
