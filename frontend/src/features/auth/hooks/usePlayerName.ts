import { useState, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { resolvePlayerName, resolvePlayerNames, shortenAddress } from '@/lib/playerNames';

/** Resolve the connected player's EVE Frontier character name. */
export function usePlayerName(address: string | null): string {
  const suiClient = useSuiClient();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setName(null);
      return;
    }
    let cancelled = false;
    void resolvePlayerName(suiClient, address).then((resolved) => {
      if (!cancelled) setName(resolved);
    });
    return () => { cancelled = true; };
  }, [suiClient, address]);

  if (!address) return 'Pilot';
  return name ?? shortenAddress(address);
}

/** Resolve names for a list of addresses (e.g. leaderboard entries). */
export function usePlayerNames(addresses: string[]): Map<string, string | null> {
  const suiClient = useSuiClient();
  const [names, setNames] = useState<Map<string, string | null>>(new Map());
  const key = addresses.join(',');

  useEffect(() => {
    if (addresses.length === 0) return;
    let cancelled = false;
    void resolvePlayerNames(suiClient, addresses).then((resolved) => {
      if (!cancelled) setNames(resolved);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suiClient, key]);

  return names;
}
