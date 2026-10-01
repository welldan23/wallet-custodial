import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type KeyPairSigner,
} from '@solana/kit';
import {
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  keccak256,
  maxUint256,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { MVP_TOKENS } from '../src/catalog/mvp.js';
import { createWalletKey } from '../src/lib/wallet-key.js';
import { SwapIntentStore } from '../src/swap/intents.js';
import { solanaRouterProgram } from '../src/swap/verify.js';
import type { SwapQuote, SwapQuoteRequest } from '../src/swap/types.js';
import { TransactionStore } from '../src/transactions/store.js';
import { BroadcastRejectedError } from '../src/transactions/types.js';

import { makeDeps, seededDb, TEST_NOW } from './helpers.js';

const LIFI_ROUTER = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
const SWAP_DATA = '0x4630a0d8deadbeef';
const account = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
const USDC_ARB = MVP_TOKENS.find((token) => token.id === 'usdc-arbitrum')!;
const JUPITER = address('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');

const evmQuote = (request: SwapQuoteRequest): SwapQuote => ({
  provider: 'lifi',
  tool: '1inch',
  crossChain: false,
  amountInRaw: request.amountRaw,
  amountOutRaw: 99_770_030n,
  minAmountOutRaw: 99_271_180n,
  fees: [],
  priceImpactPct: null,
  etaSeconds: 30,
  quoteId: 'q-evm',
  approvalAddress: LIFI_ROUTER,
  evmTransaction: { to: LIFI_ROUTER, data: SWAP_DATA, value: 0n, gasLimit: 400_000n },
});

const solanaMessage = (payer: string, amount: number) =>
  pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(address(payer), m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash('4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi'),
          lastValidBlockHeight: 1n,
        },
        m,
      ),
    (m) =>
      appendTransactionMessageInstructions(
        [
          {
            programAddress: address('ComputeBudget111111111111111111111111111111'),
            data: new Uint8Array([2, 0, 0, 1, 0]),
          },
          {
            programAddress: JUPITER,
            accounts: [{ address: address(payer), role: AccountRole.WRITABLE_SIGNER }],
            data: new Uint8Array([amount]),
          },
        ],
        m,
      ),
  );

function swapApp(options: { allowance?: bigint; reject?: boolean } = {}) {
  const db = seededDb();
  const clock = { now: TEST_NOW.getTime() };
  const intents = new SwapIntentStore(120_000, () => clock.now);
  const sent: string[] = [];
  const store = new TransactionStore(db, () => TEST_NOW);
  const broadcaster = {
    send: vi.fn(async (signed: string) => {
      if (options.reject) throw new BroadcastRejectedError('insufficient_funds');
      sent.push(signed);
      return 'ok';
    }),
  };
  const buildJupiterSwap = vi.fn(async (_quote: unknown, userPublicKey: string) =>
    getBase64EncodedWireTransaction(compileTransaction(solanaMessage(userPublicKey, 7))),
  );
  const app = createApp({
    ...makeDeps(db, {}),
    priceStaleAfterMs: 60_000,
    logRequests: false,
    swapQuotes: {
      quote: async (request) =>
        request.fromNetwork.chainType === 'solana'
          ? {
              ...evmQuote(request),
              provider: 'jupiter',
              approvalAddress: null,
              evmTransaction: undefined,
              jupiterQuoteResponse: { ok: 1 },
            }
          : evmQuote(request),
    },
    swapExecution: {
      intents,
      allowanceOf: vi.fn(async () => options.allowance ?? 0n),
      buildJupiterSwap,
    },
    transactions: {
      broadcasters: new Map([
        ['arbitrum', broadcaster],
        ['solana', broadcaster],
      ]),
      transactionStore: store,
      walletKey: createWalletKey('tes'),
    },
  });
  const post = async (path: string, body: unknown) => {
    const res = await app.request(`/v1/swap/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { res, body: (await res.json()) as Record<string, any> };
  };
  return { app, post, sent, broadcaster, clock, buildJupiterSwap };
}

const prepareEvm = (
  post: ReturnType<typeof swapApp>['post'],
  extra: Record<string, unknown> = {},
) =>
  post('prepare', {
    from: 'usdc-arbitrum',
    to: 'usdt-arbitrum',
    amount: '100',
    slippage: '0.5',
    fromAddress: account.address,
    ...extra,
  });

const sign = (signer: typeof account, tx: { to: string; data: string; value?: string }) =>
  signer.signTransaction({
    type: 'eip1559',
    chainId: 42161,
    nonce: 1,
    gas: 400_000n,
    maxFeePerGas: 20_000_000n,
    maxPriorityFeePerGas: 0n,
    to: tx.to as Hex,
    data: tx.data as Hex,
    value: BigInt(tx.value ?? '0'),
  });

describe('POST /v1/swap/prepare (EVM)', () => {
  it('menyiapkan transaksi swap + approve dengan jumlah PERSIS kalau izin kurang', async () => {
    const { post } = swapApp({ allowance: 5n });
    const { res, body } = await prepareEvm(post);
    expect(res.status).toBe(200);
    expect(body.transaction).toEqual({
      chainType: 'evm',
      chainId: '42161',
      to: LIFI_ROUTER,
      data: SWAP_DATA,
      value: '0',
      gasLimit: '400000',
    });
    expect(body.approval).toMatchObject({
      chainId: '42161',
      to: USDC_ARB.contractAddress,
      value: '0',
    });
    const call = decodeFunctionData({ abi: erc20Abi, data: body.approval.data });
    expect(call.functionName).toBe('approve');
    expect(call.args).toEqual([LIFI_ROUTER, 100_000_000n]);
    expect(body.quote).toMatchObject({ provider: 'lifi', to: { amount: '99.77003' } });
    expect(body.intentId).toEqual(expect.any(String));
  });

  it('izin sudah cukup → tanpa approve', async () => {
    const { post } = swapApp({ allowance: 100_000_000n });
    expect((await prepareEvm(post)).body.approval).toBeNull();
  });

  it('wajib fromAddress; beda tipe jaringan wajib toAddress', async () => {
    const { post } = swapApp();
    expect((await prepareEvm(post, { fromAddress: undefined })).body.error).toBe(
      'missing_from_address',
    );
    expect((await prepareEvm(post, { to: 'usdc-solana' })).body.error).toBe('missing_to_address');
  });
});

describe('POST /v1/swap/execute (EVM)', () => {
  it('approve lalu swap disiarkan berurutan, swap tercatat di riwayat', async () => {
    const { app, post, sent } = swapApp();
    const prepared = (await prepareEvm(post)).body;
    const signedApproval = await sign(account, prepared.approval);
    const signedSwap = await sign(account, prepared.transaction);

    const { res, body } = await post('execute', {
      intentId: prepared.intentId,
      signedTransaction: signedSwap,
      signedApproval,
    });
    expect(res.status).toBe(201);
    expect(sent).toEqual([signedApproval, signedSwap]);
    expect(body.transaction).toMatchObject({
      type: 'swap',
      status: 'pending',
      tokenId: 'usdc-arbitrum',
      amount: '100',
      counterpartyAddress: LIFI_ROUTER,
      txHash: keccak256(signedSwap),
      swap: {
        provider: 'lifi',
        toTokenId: 'usdt-arbitrum',
        toSymbol: 'USDT',
        quotedAmount: '99.77003',
        minAmount: '99.27118',
        receivedAmount: null,
        slippageBps: 50,
        bridgeStatus: null,
      },
    });

    // Detail swap juga ada di endpoint status.
    const status = await app.request(`/v1/transactions/${body.transaction.id}`);
    expect(((await status.json()) as Record<string, any>).transaction.swap.toSymbol).toBe('USDT');

    // Intent sekali pakai.
    const again = await post('execute', {
      intentId: prepared.intentId,
      signedTransaction: signedSwap,
      signedApproval,
    });
    expect(again.res.status).toBe(410);
  });

  it('menolak transaksi yang diubah, approve tak terbatas, atau penanda tangan lain — tanpa menyiarkan', async () => {
    const { post, broadcaster } = swapApp();
    const prepared = (await prepareEvm(post)).body;
    const approval = await sign(account, prepared.approval);
    const swap = await sign(account, prepared.transaction);
    const infinite = await sign(account, {
      ...prepared.approval,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [LIFI_ROUTER, maxUint256],
      }),
    });

    const cases = [
      [
        {
          signedTransaction: await sign(account, {
            ...prepared.transaction,
            data: `${SWAP_DATA}00`,
          }),
          signedApproval: approval,
        },
        'unsupported_transaction',
      ],
      [
        {
          signedTransaction: await sign(account, {
            ...prepared.transaction,
            to: USDC_ARB.contractAddress!,
          }),
          signedApproval: approval,
        },
        'unsupported_transaction',
      ],
      [{ signedTransaction: swap, signedApproval: infinite }, 'unsupported_transaction'],
      [
        { signedTransaction: await sign(stranger, prepared.transaction), signedApproval: approval },
        'unsigned',
      ],
      [{ signedTransaction: swap }, 'approval_required'],
    ] as const;
    for (const [extra, error] of cases) {
      const { res, body } = await post('execute', { intentId: prepared.intentId, ...extra });
      expect(res.status, error).toBe(400);
      expect(body.error).toBe(error);
    }
    expect(broadcaster.send).not.toHaveBeenCalled();

    // Setelah semua percobaan gagal, intent masih bisa dipakai dengan transaksi yang benar.
    const ok = await post('execute', {
      intentId: prepared.intentId,
      signedTransaction: swap,
      signedApproval: approval,
    });
    expect(ok.res.status).toBe(201);
  });

  it('jaringan menolak → 422; intent kedaluwarsa → 410', async () => {
    const rejected = swapApp({ allowance: 10n ** 12n, reject: true });
    const prepared = (await prepareEvm(rejected.post)).body;
    const res = await rejected.post('execute', {
      intentId: prepared.intentId,
      signedTransaction: await sign(account, prepared.transaction),
    });
    expect(res.res.status).toBe(422);
    expect(res.body.error).toBe('insufficient_funds');

    const late = swapApp({ allowance: 10n ** 12n });
    const intent = (await prepareEvm(late.post)).body;
    late.clock.now += 120_001;
    const expired = await late.post('execute', {
      intentId: intent.intentId,
      signedTransaction: await sign(account, intent.transaction),
    });
    expect(expired.res.status).toBe(410);
  });
});

describe('swap Solana (Jupiter)', () => {
  async function prepareSolana(payer: KeyPairSigner) {
    const app = swapApp();
    const prepared = await app.post('prepare', {
      from: 'usdc-solana',
      to: 'usdt-solana',
      amount: '50',
      fromAddress: payer.address,
    });
    return { ...app, prepared: prepared.body };
  }

  it('transaksi Jupiter ditandatangani tanpa diubah → disiarkan & tercatat', async () => {
    const payer = await generateKeyPairSigner();
    const { post, prepared, buildJupiterSwap, sent } = await prepareSolana(payer);
    expect(buildJupiterSwap).toHaveBeenCalledWith({ ok: 1 }, payer.address);
    expect(prepared.transaction.chainType).toBe('solana');
    expect(solanaRouterProgram(prepared.transaction.serializedTransaction)).toBe(JUPITER);

    const signed = getBase64EncodedWireTransaction(
      await signTransactionMessageWithSigners(
        setTransactionMessageFeePayerSigner(payer, solanaMessage(payer.address, 7)),
      ),
    );
    const { res, body } = await post('execute', {
      intentId: prepared.intentId,
      signedTransaction: signed,
    });
    expect(res.status).toBe(201);
    expect(sent).toEqual([signed]);
    expect(body.transaction).toMatchObject({
      type: 'swap',
      networkId: 'solana',
      counterpartyAddress: JUPITER,
      swap: { provider: 'jupiter', toTokenId: 'usdt-solana' },
    });
  });

  it('isi transaksi Solana diubah → ditolak', async () => {
    const payer = await generateKeyPairSigner();
    const { post, prepared, broadcaster } = await prepareSolana(payer);
    const tampered = getBase64EncodedWireTransaction(
      await signTransactionMessageWithSigners(
        setTransactionMessageFeePayerSigner(payer, solanaMessage(payer.address, 99)),
      ),
    );
    const { res, body } = await post('execute', {
      intentId: prepared.intentId,
      signedTransaction: tampered,
    });
    expect(res.status).toBe(400);
    expect(body.error).toBe('unsupported_transaction');
    expect(broadcaster.send).not.toHaveBeenCalled();
  });
});

describe('tanpa konfigurasi eksekusi', () => {
  it('prepare & execute → 503', async () => {
    const app = createApp({
      ...makeDeps(seededDb(), {}),
      priceStaleAfterMs: 60_000,
      logRequests: false,
    });
    const prepare = await app.request('/v1/swap/prepare', {
      method: 'POST',
      body: JSON.stringify({
        from: 'usdc-arbitrum',
        to: 'usdt-arbitrum',
        amount: '1',
        fromAddress: account.address,
      }),
    });
    expect(prepare.status).toBe(503);
    const execute = await app.request('/v1/swap/execute', {
      method: 'POST',
      body: JSON.stringify({ intentId: 'x' }),
    });
    expect(execute.status).toBe(503);
  });
});
