import { useWallet } from '@/hooks/use-wallet';

import { PrivacyCover } from './privacy-cover';
import { UnlockScreen } from './unlock-screen';

/** Layar kunci selama wallet terkunci + penutup privasi saat app tidak aktif. */
export function AppLockGate() {
  const { locked, status } = useWallet();
  return (
    <>
      {locked && <UnlockScreen />}
      {status === 'ready' && <PrivacyCover />}
    </>
  );
}
