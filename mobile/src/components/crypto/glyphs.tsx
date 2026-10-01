/**
 * Logo token & jaringan versi sederhana (viewBox 32×32), digambar dengan SVG
 * supaya tajam di semua ukuran dan tidak perlu unduh gambar dari luar.
 */
import { useId } from 'react';
import { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export function UsdcGlyph() {
  return (
    <>
      <Circle cx={16} cy={16} r={16} fill="#2775CA" />
      <Path
        d="M11.94 7.3A9.6 9.6 0 0 0 11.94 24.7M20.06 7.3A9.6 9.6 0 0 1 20.06 24.7"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M19.2 12.6C18.6 11.5 17.4 11 16 11C14.2 11 13 11.9 13 13.3C13 16.4 19.3 15.2 19.3 18.6C19.3 20.1 17.9 21 16 21C14.4 21 13.2 20.4 12.6 19.2M16 9.2V11M16 21V22.8"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

export function UsdtGlyph() {
  return (
    <>
      <Circle cx={16} cy={16} r={16} fill="#26A17B" />
      <Path
        fill="#FFFFFF"
        d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117"
      />
    </>
  );
}

export function EthGlyph() {
  return (
    <>
      <Circle cx={16} cy={16} r={16} fill="#627EEA" />
      <G fill="#FFFFFF">
        <Path fillOpacity={0.602} d="M16.498 4v8.87l7.497 3.35z" />
        <Path d="M16.498 4L9 16.22l7.498-3.35z" />
        <Path fillOpacity={0.602} d="M16.498 21.968v6.027L24 17.616z" />
        <Path d="M16.498 27.995v-6.028L9 17.616z" />
        <Path fillOpacity={0.2} d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
        <Path fillOpacity={0.602} d="M9 16.22l7.498 4.353v-7.701z" />
      </G>
    </>
  );
}

export function PolGlyph() {
  return (
    <>
      <Circle cx={16} cy={16} r={16} fill="#8247E5" />
      <Path
        fill="#FFFFFF"
        d="M21.092 12.693c-.369-.215-.848-.215-1.254 0l-2.879 1.654-1.955 1.078-2.879 1.653c-.369.216-.848.216-1.254 0l-2.288-1.294c-.369-.215-.627-.61-.627-1.042V12.19c0-.431.221-.826.627-1.042l2.25-1.258c.37-.216.85-.216 1.256 0l2.25 1.258c.37.216.628.611.628 1.042v1.654l1.955-1.115v-1.653a1.16 1.16 0 00-.627-1.042l-4.17-2.372c-.369-.216-.848-.216-1.254 0l-4.244 2.372A1.16 1.16 0 006 11.076v4.78c0 .432.221.827.627 1.043l4.244 2.372c.369.215.849.215 1.254 0l2.879-1.618 1.955-1.114 2.879-1.617c.369-.216.848-.216 1.254 0l2.251 1.258c.37.215.627.61.627 1.042v2.552c0 .431-.22.826-.627 1.042l-2.25 1.294c-.37.216-.85.216-1.255 0l-2.251-1.258c-.37-.216-.628-.611-.628-1.042v-1.654l-1.955 1.115v1.653c0 .431.221.827.627 1.042l4.244 2.372c.369.216.848.216 1.254 0l4.244-2.372c.369-.215.627-.61.627-1.042v-4.78a1.16 1.16 0 00-.627-1.042l-4.28-2.409z"
      />
    </>
  );
}

export function SolGlyph() {
  const gradientId = `sol-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <>
      <Circle cx={16} cy={16} r={16} fill="#101114" />
      <Defs>
        <LinearGradient
          id={gradientId}
          x1={8}
          y1={23}
          x2={24}
          y2={9}
          gradientUnits="userSpaceOnUse">
          <Stop offset={0} stopColor="#9945FF" />
          <Stop offset={1} stopColor="#14F195" />
        </LinearGradient>
      </Defs>
      <G fill={`url(#${gradientId})`}>
        <Path d="M10.5 9.6H24L21.5 12.4H8Z" />
        <Path d="M8 14.6H21.5L24 17.4H10.5Z" />
        <Path d="M10.5 19.6H24L21.5 22.4H8Z" />
      </G>
    </>
  );
}

export function ArbitrumGlyph() {
  return (
    <>
      <Circle cx={16} cy={16} r={16} fill="#213147" />
      <Path
        d="M10.2 22.6L16 9.4L21.8 22.6"
        stroke="#12AAFF"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M13.4 22.6L16 16.6L18.6 22.6"
        stroke="#FFFFFF"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  );
}

export function BaseGlyph() {
  return (
    <>
      <Circle cx={16} cy={16} r={16} fill="#0052FF" />
      <Path
        fill="#FFFFFF"
        d="M15.95 25C20.95 25 25 20.97 25 16S20.95 7 15.95 7C11.21 7 7.33 10.62 6.94 15.23H18.9V16.77H6.94C7.33 21.38 11.21 25 15.95 25Z"
      />
    </>
  );
}

export function FallbackGlyph() {
  return <Rect x={0} y={0} width={32} height={32} rx={16} fill="#DCE8FF" />;
}
