import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type AccountSignerMeta,
  type Instruction,
  type KeyPairSigner,
} from '@solana/kit';
import {
  encodeFunctionData,
  erc20Abi,
  keccak256,
  serializeTransaction,
  type Hex,
  type TransactionSerializableEIP1559,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { MVP_NETWORKS, MVP_TOKENS } from '../src/catalog/mvp.js';
import { createWalletKey } from '../src/lib/wallet-key.js';
import {
  evmBroadcasterFromClient,
  rejectionCode,
  solanaBroadcasterFromRpc,
} from '../src/transactions/broadcasters.js';
import { decodeEvmTransfer } from '../src/transactions/decode-evm.js';
import { decodeSolanaTransfer, solanaSignatureOf } from '../src/transactions/decode-solana.js';
import { TransactionStore } from '../src/transactions/store.js';
import {
  BroadcastRejectedError,
  TransactionDecodeError,
  type TransactionBroadcaster,
} from '../src/transactions/types.js';

import { makeDeps, seededDb, TEST_NOW } from './helpers.js';

const arbitrum = MVP_NETWORKS.find((network) => network.id === 'arbitrum')!;
const token = (id: string) => MVP_TOKENS.find((item) => item.id === id)!;
const RECIPIENT = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const account = privateKeyToAccount(generatePrivateKey());

const baseTx = (overrides: Partial<TransactionSerializableEIP1559> = {}) =>
  ({
    type: 'eip1559',
    chainId: 42161,
    nonce: 7,
    gas: 70_000n,
    maxFeePerGas: 20_000_000n,
    maxPriorityFeePerGas: 0n,
    to: token('usdc-arbitrum').contractAddress as Hex,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [RECIPIENT, 12_500_000n],
    }),
    ...overrides,
  }) satisfies TransactionSerializableEIP1559;

const signEvm = (overrides: Partial<TransactionSerializableEIP1559> = {}) =>
  account.signTransaction(baseTx(overrides));

async function expectDecodeError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(TransactionDecodeError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('baca transaksi EVM bertanda tangan', () => {
  it('transfer USDC: pengirim dari tanda tangan, penerima & jumlah dari data', async () => {
    const signed = await signEvm();
    const decoded = await decodeEvmTransfer(signed, arbitrum, MVP_TOKENS);
    expect(decoded).toEqual({
      txHash: keccak256(signed),
      from: account.address,
      counterparty: RECIPIENT,
      tokenId: 'usdc-arbitrum',
      amountRaw: 12_500_000n,
    });
  });

  it('kirim ETH (value tanpa data)', async () => {
    const signed = await signEvm({ to: RECIPIENT, data: '0x', value: 10n ** 15n });
    const decoded = await decodeEvmTransfer(signed, arbitrum, MVP_TOKENS);
    expect(decoded).toMatchObject({ tokenId: 'eth-arbitrum', amountRaw: 10n ** 15n });
  });

  it.each([
    ['chain lain', { chainId: 1 }, 'wrong_chain'],
    [
      'kontrak tak dikenal',
      { to: '0x0000000000000000000000000000000000000001' as Hex },
      'unsupported_token',
    ],
    [
      'approve, bukan transfer',
      {
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [RECIPIENT, 1n] }),
      },
      'unsupported_transaction',
    ],
    [
      'transfer 0',
      {
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [RECIPIENT, 0n],
        }),
      },
      'invalid_amount',
    ],
    ['token + ETH sekaligus', { value: 1n }, 'unsupported_transaction'],
    ['ETH 0', { to: RECIPIENT as Hex, data: '0x' as Hex, value: 0n }, 'invalid_amount'],
  ])('menolak %s', async (_label, overrides, code) => {
    await expectDecodeError(
      decodeEvmTransfer(await signEvm(overrides), arbitrum, MVP_TOKENS),
      code,
    );
  });

  it('menolak transaksi tanpa tanda tangan dan teks acak', async () => {
    await expectDecodeError(
      decodeEvmTransfer(serializeTransaction(baseTx()), arbitrum, MVP_TOKENS),
      'unsigned',
    );
    await expectDecodeError(
      decodeEvmTransfer('0xdeadbeef', arbitrum, MVP_TOKENS),
      'invalid_encoding',
    );
    await expectDecodeError(decodeEvmTransfer('halo', arbitrum, MVP_TOKENS), 'invalid_encoding');
  });
});

const PROGRAMS = {
  system: address('11111111111111111111111111111111'),
  token: address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  ata: address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  computeBudget: address('ComputeBudget111111111111111111111111111111'),
  memo: address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
};
const USDC_MINT = address(token('usdc-solana').contractAddress!);
const SOURCE_ATA = address('So11111111111111111111111111111111111111112');
const DEST_ATA = address('4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T');
const DEST_OWNER = address('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');

const u64 = (prefix: number[], value: bigint, suffix: number[] = []) => {
  const bytes = new Uint8Array(prefix.length + 8 + suffix.length);
  bytes.set(prefix);
  new DataView(bytes.buffer).setBigUint64(prefix.length, value, true);
  bytes.set(suffix, prefix.length + 8);
  return bytes;
};

/** Instruksi yang boleh membawa signer di akunnya (dipakai untuk tanda tangan otomatis). */
type Ix = Omit<Instruction, 'accounts'> & {
  accounts?: (NonNullable<Instruction['accounts']>[number] | AccountSignerMeta)[];
};

const signerMeta = (
  signer: KeyPairSigner,
  role: AccountRole.READONLY_SIGNER | AccountRole.WRITABLE_SIGNER,
): AccountSignerMeta => ({ address: signer.address, role, signer });

const transferChecked = (
  owner: KeyPairSigner | string,
  amount: bigint,
  decimals = 6,
  mint = USDC_MINT,
): Ix => ({
  programAddress: PROGRAMS.token,
  accounts: [
    { address: SOURCE_ATA, role: AccountRole.WRITABLE },
    { address: mint, role: AccountRole.READONLY },
    { address: DEST_ATA, role: AccountRole.WRITABLE },
    typeof owner === 'string'
      ? { address: address(owner), role: AccountRole.READONLY_SIGNER }
      : { address: owner.address, role: AccountRole.READONLY_SIGNER, signer: owner },
  ],
  data: u64([12], amount, [decimals]),
});

const createAta = (payer: KeyPairSigner): Ix => ({
  programAddress: PROGRAMS.ata,
  accounts: [
    { address: payer.address, role: AccountRole.WRITABLE_SIGNER, signer: payer },
    { address: DEST_ATA, role: AccountRole.WRITABLE },
    { address: DEST_OWNER, role: AccountRole.READONLY },
    { address: USDC_MINT, role: AccountRole.READONLY },
    { address: PROGRAMS.system, role: AccountRole.READONLY },
    { address: PROGRAMS.token, role: AccountRole.READONLY },
  ],
  data: new Uint8Array([1]),
});

async function signSolana(
  payer: KeyPairSigner,
  instructions: Instruction[],
  version: 'legacy' | 0 = 0,
) {
  const message = pipe(
    createTransactionMessage({ version }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash('4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi'),
          lastValidBlockHeight: 1n,
        },
        m,
      ),
    (m) => appendTransactionMessageInstructions(instructions as Instruction[], m),
  );
  return getBase64EncodedWireTransaction(await signTransactionMessageWithSigners(message));
}

describe('baca transaksi Solana bertanda tangan', () => {
  it('SPL TransferChecked + buat ATA penerima: pemilik ATA jadi penerima', async () => {
    const payer = await generateKeyPairSigner();
    const resolve = vi.fn(async () => 'tidak-dipakai');
    const wire = await signSolana(payer, [
      { programAddress: PROGRAMS.computeBudget, data: new Uint8Array([3, 1, 0, 0, 0, 0, 0, 0, 0]) },
      createAta(payer),
      transferChecked(payer, 1_500_000n),
    ]);
    const decoded = await decodeSolanaTransfer(wire, MVP_TOKENS, resolve);
    expect(decoded).toEqual({
      txHash: solanaSignatureOf(wire),
      from: payer.address,
      counterparty: DEST_OWNER,
      tokenId: 'usdc-solana',
      amountRaw: 1_500_000n,
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('tanpa instruksi ATA: pemilik dicari lewat RPC (format legacy juga diterima)', async () => {
    const payer = await generateKeyPairSigner();
    const wire = await signSolana(payer, [transferChecked(payer, 5n)], 'legacy');
    const resolve = vi.fn(async () => DEST_OWNER as string);
    const decoded = await decodeSolanaTransfer(wire, MVP_TOKENS, resolve);
    expect(resolve).toHaveBeenCalledWith(DEST_ATA);
    expect(decoded.counterparty).toBe(DEST_OWNER);
  });

  it('kirim SOL lewat System Program', async () => {
    const payer = await generateKeyPairSigner();
    const wire = await signSolana(payer, [
      {
        programAddress: PROGRAMS.system,
        accounts: [
          signerMeta(payer, AccountRole.WRITABLE_SIGNER),
          { address: DEST_OWNER, role: AccountRole.WRITABLE },
        ],
        data: u64([2, 0, 0, 0], 250_000_000n),
      },
    ]);
    const decoded = await decodeSolanaTransfer(wire, MVP_TOKENS, async () => null);
    expect(decoded).toMatchObject({
      tokenId: 'sol-solana',
      counterparty: DEST_OWNER,
      amountRaw: 250_000_000n,
    });
  });

  it.each([
    ['instruksi program lain', 'memo', 'unsupported_transaction'],
    ['dua transfer sekaligus', 'double', 'unsupported_transaction'],
    ['mint tidak dikenal', 'mint', 'unsupported_token'],
    ['desimal tidak cocok', 'decimals', 'unsupported_transaction'],
    ['Transfer lama (tanpa cek mint)', 'plain', 'unsupported_transaction'],
    ['jumlah 0', 'zero', 'invalid_amount'],
  ])('menolak %s', async (_label, variant, code) => {
    const payer = await generateKeyPairSigner();
    const instructions: Record<string, Ix[]> = {
      memo: [
        transferChecked(payer, 1n),
        { programAddress: PROGRAMS.memo, data: new Uint8Array([104, 105]) },
      ],
      double: [transferChecked(payer, 1n), transferChecked(payer, 2n)],
      mint: [transferChecked(payer, 1n, 6, DEST_OWNER)],
      decimals: [transferChecked(payer, 1n, 9)],
      plain: [{ ...transferChecked(payer, 1n), data: u64([3], 1n) }],
      zero: [transferChecked(payer, 0n)],
    };
    await expectDecodeError(
      decodeSolanaTransfer(
        await signSolana(payer, instructions[variant]!),
        MVP_TOKENS,
        async () => null,
      ),
      code,
    );
  });

  it('menolak kalau pemilik token bukan penanda tangan, dan teks acak', async () => {
    const payer = await generateKeyPairSigner();
    const victim = await generateKeyPairSigner();
    // Pemilik token ditandai signer tapi tanda tangannya belum ada → signature null.
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(payer.address, m),
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
          [transferChecked(victim.address, 1n)] as Instruction[],
          m,
        ),
    );
    const partial = await partiallySignTransactionMessageWithSigners(message);
    await expectDecodeError(
      decodeSolanaTransfer(getBase64EncodedWireTransaction(partial), MVP_TOKENS, async () => null),
      'unsigned',
    );
    await expectDecodeError(
      decodeSolanaTransfer('bukan base64!!', MVP_TOKENS, async () => null),
      'invalid_encoding',
    );
  });
});

describe('broadcaster', () => {
  it.each([
    ['insufficient funds for gas * price + value', 'insufficient_funds'],
    [
      'Attempt to debit an account but found no record of a prior credit. insufficient lamports',
      'insufficient_funds',
    ],
    ['nonce too low', 'nonce_too_low'],
    ['replacement transaction underpriced', 'fee_too_low'],
    ['Blockhash not found', 'blockhash_expired'],
    ['execution reverted', 'rejected'],
    ['fetch failed', null],
  ])('kode penolakan untuk "%s"', (message, code) => {
    expect(rejectionCode(message)).toBe(code);
  });

  it('"already known" dianggap berhasil, penolakan jadi BroadcastRejectedError', async () => {
    const known = evmBroadcasterFromClient(
      { sendRawTransaction: async () => Promise.reject(new Error('already known')) },
      () => '0xhash',
    );
    await expect(known.send('0x01')).resolves.toBe('0xhash');

    const poor = solanaBroadcasterFromRpc(
      async () => Promise.reject(new Error('Transaction simulation failed: insufficient lamports')),
      () => 'sig',
    );
    await expect(poor.send('AA==')).rejects.toBeInstanceOf(BroadcastRejectedError);

    // Alasan asli di `cause` (seperti error Solana asli) tetap terbaca.
    const nested = solanaBroadcasterFromRpc(
      async () =>
        Promise.reject(
          new Error('Transaction simulation failed', {
            cause: new Error('Attempt to debit an account but found no record of a prior credit.'),
          }),
        ),
      () => 'sig',
    );
    await expect(nested.send('AA==')).rejects.toMatchObject({ code: 'insufficient_funds' });

    const down = evmBroadcasterFromClient(
      { sendRawTransaction: async () => Promise.reject(new Error('fetch failed')) },
      () => '0xhash',
    );
    await expect(down.send('0x01')).rejects.toThrow('fetch failed');
  });
});

function txApp(broadcaster: TransactionBroadcaster) {
  const db = seededDb();
  const walletKey = createWalletKey('rahasia-tes');
  const app = createApp({
    ...makeDeps(db, {}),
    priceStaleAfterMs: 15 * 60_000,
    logRequests: false,
    transactions: {
      broadcasters: new Map([
        ['arbitrum', broadcaster],
        ['solana', broadcaster],
      ]),
      transactionStore: new TransactionStore(db, () => TEST_NOW),
      walletKey,
    },
  });
  const post = (body: unknown) =>
    app.request('/v1/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://contoh.app' },
      body: JSON.stringify(body),
    });
  return { app, db, post, walletKey };
}

describe('POST /v1/transactions', () => {
  it('meneruskan transaksi lalu mencatat riwayat pending (alamat pengirim disamarkan)', async () => {
    const send = vi.fn(async (signed: string) => keccak256(signed as Hex));
    const { db, post, walletKey } = txApp({ send });
    const signed = await signEvm();

    const res = await post({ network: 'arbitrum', signedTransaction: signed });
    expect(res.status).toBe(201);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const { transaction } = (await res.json()) as { transaction: Record<string, unknown> };
    expect(transaction).toMatchObject({
      type: 'send',
      status: 'pending',
      networkId: 'arbitrum',
      tokenId: 'usdc-arbitrum',
      symbol: 'USDC',
      amountRaw: '12500000',
      amount: '12.5',
      amountUsd: 12.5,
      counterpartyAddress: RECIPIENT,
      txHash: keccak256(signed),
      explorerUrl: `https://arbiscan.io/tx/${keccak256(signed)}`,
      createdAt: TEST_NOW.toISOString(),
    });
    expect(transaction).not.toHaveProperty('walletKey');
    expect(send).toHaveBeenCalledWith(signed);

    const row = db.prepare('SELECT wallet_key AS walletKey FROM transactions').get() as {
      walletKey: string;
    };
    expect(row.walletKey).toBe(walletKey(account.address));
    expect(JSON.stringify(db.prepare('SELECT * FROM transactions').all())).not.toContain(
      account.address,
    );

    // Kirim ulang transaksi yang sama: tidak di-broadcast lagi, tidak dobel.
    const again = await post({ network: 'arbitrum', signedTransaction: signed });
    expect(again.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM transactions').get()).toEqual({ n: 1 });
  });

  it('transaksi Solana tercatat dengan signature sebagai hash', async () => {
    const payer = await generateKeyPairSigner();
    const wire = await signSolana(payer, [createAta(payer), transferChecked(payer, 2_000_000n)]);
    const { post } = txApp({ send: async () => solanaSignatureOf(wire) });
    const res = await post({ network: 'solana', signedTransaction: wire });
    expect(res.status).toBe(201);
    const { transaction } = (await res.json()) as { transaction: Record<string, unknown> };
    expect(transaction).toMatchObject({
      tokenId: 'usdc-solana',
      amount: '2',
      counterpartyAddress: DEST_OWNER,
      txHash: solanaSignatureOf(wire),
      explorerUrl: `https://solscan.io/tx/${solanaSignatureOf(wire)}`,
    });
  });

  it('jaringan menolak (saldo kurang) → 422 dan tidak dicatat', async () => {
    const { db, post } = txApp({
      send: async () => Promise.reject(new BroadcastRejectedError('insufficient_funds')),
    });
    const res = await post({ network: 'arbitrum', signedTransaction: await signEvm() });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'insufficient_funds' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM transactions').get()).toEqual({ n: 0 });
  });

  it('RPC tidak bisa dihubungi → 502 tanpa membocorkan URL, tidak dicatat', async () => {
    const { db, post } = txApp({
      send: async () => Promise.reject(new Error('fetch failed https://rpc.rahasia/apikey')),
    });
    const res = await post({ network: 'arbitrum', signedTransaction: await signEvm() });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('rahasia');
    expect(db.prepare('SELECT COUNT(*) AS n FROM transactions').get()).toEqual({ n: 0 });
  });

  it.each([
    [{}, 400, 'unknown_network'],
    [{ network: 'arbitrum' }, 400, 'missing_transaction'],
    [{ network: 'arbitrum', signedTransaction: '0x1234' }, 400, 'invalid_encoding'],
    [{ network: 'base', signedTransaction: '0x1234' }, 503, 'broadcast_unavailable'],
  ])('menolak body %j', async (body, status, error) => {
    const { post } = txApp({ send: vi.fn() });
    const res = await post(body);
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ error });
  });

  it('transaksi chain lain tidak di-broadcast', async () => {
    const send = vi.fn();
    const { post } = txApp({ send });
    const res = await post({
      network: 'arbitrum',
      signedTransaction: await signEvm({ chainId: 8453 }),
    });
    expect(await res.json()).toMatchObject({ error: 'wrong_chain' });
    expect(send).not.toHaveBeenCalled();
  });

  it('body terlalu besar ditolak; preflight CORS mengizinkan POST', async () => {
    const { app, post } = txApp({ send: vi.fn() });
    const big = await post({ network: 'arbitrum', signedTransaction: `0x${'00'.repeat(40_000)}` });
    expect(big.status).toBe(413);

    const preflight = await app.request('/v1/transactions', {
      method: 'OPTIONS',
      headers: { Origin: 'https://contoh.app', 'Access-Control-Request-Method': 'POST' },
    });
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
  });
});
