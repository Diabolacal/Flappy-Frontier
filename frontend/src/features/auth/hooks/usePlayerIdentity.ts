import { useCurrentAccount, useConnectWallet, useDisconnectWallet } from '@mysten/dapp-kit';
import { detectEnvironment } from '@/lib/environment';
import type { PlayerIdentity } from '../types';

export function usePlayerIdentity() {
  const account = useCurrentAccount();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { isInGameBrowser } = detectEnvironment();

  const player: PlayerIdentity = {
    address: account?.address ?? null,
    displayName: account?.address
      ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}`
      : 'Pilot',
    isInGameBrowser,
  };

  return {
    player,
    canPlayRanked: !!account?.address,
    connect: connectWallet,
    disconnect: disconnectWallet,
  };
}
