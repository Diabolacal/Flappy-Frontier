import { useEffect, useRef, useCallback, useState } from 'react';
import {
  useWallets,
  useCurrentWallet,
  useConnectWallet,
  useAutoConnectWallet,
} from '@mysten/dapp-kit';

const EVE_FRONTIER_WALLET = 'EVE Frontier Client Wallet';

/** How long to wait for wallet registration before falling back to generic path */
const DETECTION_SETTLE_MS = 1500;

export type SSUWalletStatus =
  | 'detecting'    // waiting for wallet registration to settle
  | 'auto-connecting' // programmatic connect in progress
  | 'connected'    // wallet connected (auto or manual)
  | 'ready'        // SSU wallet found but not yet connected (show direct button)
  | 'unavailable'; // not SSU environment (no EVE Frontier Client Wallet found after settling)

export interface SSUWalletInfo {
  /** Whether the EVE Frontier Client Wallet is present (runtime evidence) */
  isSSU: boolean;
  /** Current status of the SSU wallet flow */
  status: SSUWalletStatus;
  /** Direct-connect to the EVE Frontier Client Wallet (no chooser modal) */
  connectDirectly: () => void;
  /** Debug info for visible truth markers (wallet count, names, settled) */
  debug: { walletCount: number; walletNames: string[]; settled: boolean };
}

/**
 * Detects the SSU environment by wallet runtime evidence (not viewport) and
 * auto-connects to the EVE Frontier Client Wallet when found.
 * Falls back to a direct one-click connect path if auto-connect doesn't fire.
 *
 * Uses a settling period to avoid showing the generic "Connect Wallet" button
 * before wallet registration has completed (wallets register asynchronously
 * via useEffect in dapp-kit, meaning the first render may have an empty list).
 *
 * In normal browsers (no EVE Frontier Client Wallet after settling),
 * `isSSU` is false and the hook is effectively a no-op.
 */
export function useSSUWallet(): SSUWalletInfo {
  const wallets = useWallets();
  const { isConnected, isConnecting } = useCurrentWallet();
  const { mutate: connectWallet } = useConnectWallet();
  const autoConnectStatus = useAutoConnectWallet();
  const attemptedRef = useRef(false);
  const [settled, setSettled] = useState(false);

  // Find the EVE Frontier Client Wallet by prefix (actual name may have a suffix like "(Eve Vault like)")
  const targetWallet = wallets.find(w => w.name.startsWith(EVE_FRONTIER_WALLET));
  const isSSU = !!targetWallet;

  // Settling timer: after DETECTION_SETTLE_MS, mark detection as settled.
  // If the wallet is found before the timer fires, settle immediately.
  useEffect(() => {
    if (isSSU || isConnected) {
      setSettled(true);
      return;
    }
    const timer = setTimeout(() => setSettled(true), DETECTION_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isSSU, isConnected]);

  // Direct connect callback — bypasses chooser modal
  const connectDirectly = useCallback(() => {
    if (targetWallet && !isConnected && !isConnecting) {
      connectWallet({ wallet: targetWallet });
    }
  }, [targetWallet, isConnected, isConnecting, connectWallet]);

  // Auto-connect: after dapp-kit autoConnect finishes without connecting,
  // if the EVE Frontier Client Wallet is present, connect automatically.
  useEffect(() => {
    if (attemptedRef.current) return;
    if (!targetWallet) return;
    if (autoConnectStatus !== 'attempted') return;
    if (isConnected || isConnecting) return;

    attemptedRef.current = true;
    connectWallet({ wallet: targetWallet });
  }, [targetWallet, autoConnectStatus, isConnected, isConnecting, connectWallet]);

  // Debug info for visible truth markers
  const debug = {
    walletCount: wallets.length,
    walletNames: wallets.map(w => w.name),
    settled,
  };

  // Derive status
  let status: SSUWalletStatus;
  if (isConnected) {
    status = 'connected';
  } else if (isSSU && (isConnecting || attemptedRef.current)) {
    status = 'auto-connecting';
  } else if (isSSU && autoConnectStatus !== 'attempted') {
    status = 'detecting';
  } else if (isSSU) {
    status = 'ready';
  } else if (!settled) {
    // Not yet settled and wallet not found — still detecting
    status = 'detecting';
  } else {
    status = 'unavailable';
  }

  return { isSSU, status, connectDirectly, debug };
}
