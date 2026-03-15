import { Transaction } from '@mysten/sui/transactions';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { CONTRACT_CONFIG } from './contractConfig';

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

/**
 * Build the PTB for `game::start_run<EVE>()`.
 * Merges all player EVE coins into one, then passes as &mut Coin<EVE>.
 */
export async function buildStartRunTransaction(
  suiClient: SuiJsonRpcClient,
  playerAddress: string,
): Promise<Transaction> {
  const tx = new Transaction();

  // Fetch all EVE coins owned by the player
  const { data: coins } = await suiClient.getCoins({
    owner: playerAddress,
    coinType: CONTRACT_CONFIG.eveCoinType,
  });

  if (!coins || coins.length === 0) {
    throw new Error('No EVE coins found in wallet. You need EVE to play ranked mode.');
  }

  // Calculate total balance
  const totalBalance = coins.reduce((sum, c) => sum + BigInt(c.balance), 0n);
  if (totalBalance < BigInt(CONTRACT_CONFIG.entryFeeAmount)) {
    const needed = CONTRACT_CONFIG.entryFeeAmount / 1_000_000_000;
    throw new Error(`Insufficient EVE balance. Need ${needed} EVE for entry fee.`);
  }

  // Use the first coin as the primary, merge others into it if multiple
  const primaryCoin = tx.object(coins[0]!.coinObjectId);
  if (coins.length > 1) {
    tx.mergeCoins(
      primaryCoin,
      coins.slice(1).map((c) => tx.object(c.coinObjectId)),
    );
  }

  tx.moveCall({
    target: `${CONTRACT_CONFIG.packageId}::game::start_run`,
    typeArguments: [CONTRACT_CONFIG.eveCoinType],
    arguments: [
      tx.object(CONTRACT_CONFIG.treasuryId),
      tx.object(CONTRACT_CONFIG.gameConfigId),
      primaryCoin,
      tx.object(CONTRACT_CONFIG.randomObjectId),
      tx.object(CONTRACT_CONFIG.clockObjectId),
    ],
  });

  return tx;
}

/** Extract the seed (u256 → 32-bit for Mulberry32) from RunStartedEvent in tx effects. */
export function parseSeedFromEvents(
  events: Array<{ type: string; parsedJson?: Record<string, unknown> }>,
): number {
  const runEvent = events.find((e) =>
    e.type.includes('::game::RunStartedEvent'),
  );
  if (!runEvent?.parsedJson) {
    throw new Error('RunStartedEvent not found in transaction events');
  }
  // seed is a u256 string; truncate to 32-bit for Mulberry32 PRNG
  const seedStr = String(runEvent.parsedJson['seed'] ?? '0');
  return Number(BigInt(seedStr) & BigInt(0xffffffff));
}

/** Extract the RunReceipt object ID from RunReceiptCreatedEvent in tx effects. */
export function parseReceiptIdFromEvents(
  events: Array<{ type: string; parsedJson?: Record<string, unknown> }>,
): string {
  const receiptEvent = events.find((e) =>
    e.type.includes('::game::RunReceiptCreatedEvent'),
  );
  if (!receiptEvent?.parsedJson) {
    const eventTypes = events.map((e) => e.type).join(', ');
    throw new Error(
      `RunReceiptCreatedEvent not found. Got ${events.length} event(s): [${eventTypes}]`,
    );
  }
  const receiptId = String(receiptEvent.parsedJson['receipt_id'] ?? '');
  if (!receiptId) {
    throw new Error('receipt_id not found in RunReceiptCreatedEvent');
  }
  return receiptId;
}
