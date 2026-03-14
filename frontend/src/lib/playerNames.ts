/**
 * Player name resolution via EVE Frontier Character objects.
 *
 * Resolution path (2 RPC calls per address):
 *   1. getOwnedObjects(owner=address, filter=PlayerProfile) → character_id
 *   2. getObject(id=character_id) → metadata.fields.name
 *
 * Includes an in-memory cache (5-min TTL) to avoid repeated lookups.
 * Not all wallet addresses have Characters — only players who created
 * an in-game EVE Frontier character.
 */
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { CONTRACT_CONFIG } from './contractConfig';

const PLAYER_PROFILE_TYPE = `${CONTRACT_CONFIG.worldPackageId}::character::PlayerProfile`;
const CACHE_TTL_MS = 5 * 60_000;

interface CacheEntry {
  name: string | null;
  fetchedAt: number;
}

const nameCache = new Map<string, CacheEntry>();

/** Resolve a single player's EVE Frontier character name, or null if none. */
export async function resolvePlayerName(
  client: SuiJsonRpcClient,
  address: string,
): Promise<string | null> {
  const cached = nameCache.get(address);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.name;
  }

  try {
    // Step 1: Find PlayerProfile owned by this address
    const { data: profiles } = await client.getOwnedObjects({
      owner: address,
      filter: { StructType: PLAYER_PROFILE_TYPE },
      options: { showContent: true },
    });

    if (!profiles?.length) {
      nameCache.set(address, { name: null, fetchedAt: Date.now() });
      return null;
    }

    const profileContent = profiles[0]?.data?.content;
    if (!profileContent || profileContent.dataType !== 'moveObject') {
      nameCache.set(address, { name: null, fetchedAt: Date.now() });
      return null;
    }

    const fields = profileContent.fields as Record<string, unknown>;
    const characterId = fields['character_id'] as string | undefined;
    if (!characterId) {
      nameCache.set(address, { name: null, fetchedAt: Date.now() });
      return null;
    }

    // Step 2: Fetch Character → metadata.name
    const charResult = await client.getObject({
      id: characterId,
      options: { showContent: true },
    });

    const charContent = charResult.data?.content;
    if (!charContent || charContent.dataType !== 'moveObject') {
      nameCache.set(address, { name: null, fetchedAt: Date.now() });
      return null;
    }

    const charFields = charContent.fields as Record<string, unknown>;
    const metadata = charFields['metadata'] as
      | { fields: Record<string, unknown> }
      | null
      | undefined;
    const rawName = metadata?.fields?.['name'] as string | undefined;
    const resolvedName = rawName?.trim() || null;

    nameCache.set(address, { name: resolvedName, fetchedAt: Date.now() });
    return resolvedName;
  } catch {
    nameCache.set(address, { name: null, fetchedAt: Date.now() });
    return null;
  }
}

/** Resolve names for multiple addresses. Uses cache and parallelizes uncached lookups. */
export async function resolvePlayerNames(
  client: SuiJsonRpcClient,
  addresses: string[],
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const uncached: string[] = [];

  for (const addr of addresses) {
    const cached = nameCache.get(addr);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      results.set(addr, cached.name);
    } else {
      uncached.push(addr);
    }
  }

  await Promise.all(
    uncached.map(async (addr) => {
      const name = await resolvePlayerName(client, addr);
      results.set(addr, name);
    }),
  );

  return results;
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatPlayerDisplay(addr: string, name: string | null): string {
  return name ?? shortenAddress(addr);
}
