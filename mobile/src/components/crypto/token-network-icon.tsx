import { View } from 'react-native';

import type { NetworkId } from '@/types/wallet';

import { NetworkIcon } from './network-icon';
import { TokenIcon } from './token-icon';

/** Logo token dengan lencana jaringan kecil di pojok kanan bawah. */
export function TokenNetworkIcon({
  symbol,
  networkId,
  size = 40,
}: {
  symbol: string;
  networkId: NetworkId;
  size?: number;
}) {
  const badge = Math.round(size * 0.42);
  return (
    <View style={{ width: size, height: size }}>
      <TokenIcon symbol={symbol} size={size} />
      <View
        className="absolute items-center justify-center rounded-full bg-surface"
        style={{ right: -2, bottom: -2, width: badge + 4, height: badge + 4 }}>
        <NetworkIcon networkId={networkId} size={badge} />
      </View>
    </View>
  );
}
