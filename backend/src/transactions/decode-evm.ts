import {
  decodeFunctionData,
  erc20Abi,
  getAddress,
  keccak256,
  parseTransaction,
  recoverTransactionAddress,
  type Hex,
  type TransactionSerialized,
} from 'viem';

import type { Network, Token } from '../types.js';

import { TransactionDecodeError, type DecodedTransfer } from './types.js';

/**
 * Baca kiriman dari transaksi EVM bertanda tangan: koin gas (`value`) atau
 * `transfer(to, amount)` ERC-20 ke kontrak token yang ada di katalog.
 * Pengirim dipulihkan dari tanda tangan, chainId wajib cocok dengan jaringan.
 */
export async function decodeEvmTransfer(
  serialized: string,
  network: Network,
  tokens: Token[],
): Promise<DecodedTransfer> {
  if (!/^0x[0-9a-fA-F]+$/.test(serialized)) throw new TransactionDecodeError('invalid_encoding');

  let tx: ReturnType<typeof parseTransaction>;
  try {
    tx = parseTransaction(serialized as TransactionSerialized);
  } catch {
    throw new TransactionDecodeError('invalid_encoding');
  }
  if (tx.chainId === undefined || String(tx.chainId) !== network.chainId) {
    throw new TransactionDecodeError('wrong_chain');
  }
  if (tx.r === undefined || tx.s === undefined) throw new TransactionDecodeError('unsigned');

  let from: string;
  try {
    from = await recoverTransactionAddress({
      serializedTransaction: serialized as TransactionSerialized,
    });
  } catch {
    throw new TransactionDecodeError('unsigned');
  }
  if (!tx.to) throw new TransactionDecodeError('unsupported_transaction');

  const networkTokens = tokens.filter((token) => token.networkId === network.id);
  const data = (tx.data ?? '0x') as Hex;
  const txHash = keccak256(serialized as Hex);

  if (data === '0x') {
    const native = networkTokens.find((token) => token.contractAddress === null);
    if (!native) throw new TransactionDecodeError('unsupported_token');
    if (!tx.value || tx.value <= 0n) throw new TransactionDecodeError('invalid_amount');
    return {
      txHash,
      from,
      counterparty: getAddress(tx.to),
      tokenId: native.id,
      amountRaw: tx.value,
    };
  }

  const token = networkTokens.find(
    (item) => item.contractAddress?.toLowerCase() === tx.to!.toLowerCase(),
  );
  if (!token) throw new TransactionDecodeError('unsupported_token');
  if (tx.value && tx.value > 0n) throw new TransactionDecodeError('unsupported_transaction');

  let call: ReturnType<typeof decodeFunctionData<typeof erc20Abi>>;
  try {
    call = decodeFunctionData({ abi: erc20Abi, data });
  } catch {
    throw new TransactionDecodeError('unsupported_transaction');
  }
  if (call.functionName !== 'transfer') throw new TransactionDecodeError('unsupported_transaction');
  const [recipient, amount] = call.args;
  if (amount <= 0n) throw new TransactionDecodeError('invalid_amount');

  return {
    txHash,
    from,
    counterparty: getAddress(recipient),
    tokenId: token.id,
    amountRaw: amount,
  };
}
