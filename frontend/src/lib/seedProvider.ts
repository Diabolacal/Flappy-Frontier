export interface SeedResult {
  seed: number;
  runId: string | null;
  source: 'local' | 'chain';
}

export function getLocalSeed(): SeedResult {
  return {
    seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
    runId: null,
    source: 'local',
  };
}
