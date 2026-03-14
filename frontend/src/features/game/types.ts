import type { GameMode } from '@/game/types';

export interface GameModeConfig {
  mode: GameMode;
  seedSource: 'local' | 'chain';
  scorePersistence: 'local' | 'chain';
  requiresEntryFee: boolean;
  leaderboardEligible: boolean;
  label: string;
  description: string;
}

export const GAME_MODES: Record<GameMode, GameModeConfig> = {
  practice: {
    mode: 'practice',
    seedSource: 'local',
    scorePersistence: 'local',
    requiresEntryFee: false,
    leaderboardEligible: false,
    label: 'Practice',
    description: 'Free play - no wallet needed',
  },
  ranked: {
    mode: 'ranked',
    seedSource: 'chain',
    scorePersistence: 'chain',
    requiresEntryFee: true,
    leaderboardEligible: true,
    label: 'Ranked',
    description: 'Compete for weekly EVE prizes',
  },
};
