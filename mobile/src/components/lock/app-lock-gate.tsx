import { useWallet } from '@/hooks/use-wallet';

import { UnlockScreen } from './unlock-screen';

/** Pasang layar kunci di atas app selama wallet terkunci. */
export function AppLockGate() {
  const { locked } = useWallet();
  return locked ? <UnlockScreen /> : null;
}
