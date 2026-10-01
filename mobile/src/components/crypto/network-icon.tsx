import type { ReactNode } from 'react';
import Svg from 'react-native-svg';

import type { NetworkId } from '@/types/wallet';

import { ArbitrumGlyph, BaseGlyph, EthGlyph, PolGlyph, SolGlyph } from './glyphs';

const NETWORK_GLYPHS: Record<NetworkId, () => ReactNode> = {
  ethereum: EthGlyph,
  arbitrum: ArbitrumGlyph,
  base: BaseGlyph,
  polygon: PolGlyph,
  solana: SolGlyph,
};

type NetworkIconProps = {
  networkId: NetworkId;
  size?: number;
};

export function NetworkIcon({ networkId, size = 16 }: NetworkIconProps) {
  const Glyph = NETWORK_GLYPHS[networkId];
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel={networkId}>
      <Glyph />
    </Svg>
  );
}
