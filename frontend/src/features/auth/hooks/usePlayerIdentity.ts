import { useState } from 'react';
import { ANONYMOUS_PLAYER } from '../types';
import type { PlayerIdentity } from '../types';
import { detectEnvironment } from '@/lib/environment';

export function usePlayerIdentity() {
  const [player] = useState<PlayerIdentity>(() => ({
    ...ANONYMOUS_PLAYER,
    isInGameBrowser: detectEnvironment().isInGameBrowser,
  }));

  return {
    player,
    canPlayRanked: false,
    connect: () => {},
    disconnect: () => {},
  };
}
