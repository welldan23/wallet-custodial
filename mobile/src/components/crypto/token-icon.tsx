import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { EthGlyph, FallbackGlyph, PolGlyph, SolGlyph, UsdcGlyph, UsdtGlyph } from './glyphs';

const TOKEN_GLYPHS: Record<string, () => ReactNode> = {
  USDC: UsdcGlyph,
  USDT: UsdtGlyph,
  ETH: EthGlyph,
  POL: PolGlyph,
  SOL: SolGlyph,
};

type TokenIconProps = {
  symbol: string;
  size?: number;
};

/** Logo token bulat. Token yang belum punya logo tampil sebagai huruf depan. */
export function TokenIcon({ symbol, size = 40 }: TokenIconProps) {
  const Glyph = TOKEN_GLYPHS[symbol];

  if (!Glyph) {
    return (
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Svg width={size} height={size} viewBox="0 0 32 32" style={{ position: 'absolute' }}>
          <FallbackGlyph />
        </Svg>
        <Text className="font-bold text-primary-700" style={{ fontSize: size * 0.4 }}>
          {symbol.charAt(0)}
        </Text>
      </View>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel={symbol}>
      <Glyph />
    </Svg>
  );
}
