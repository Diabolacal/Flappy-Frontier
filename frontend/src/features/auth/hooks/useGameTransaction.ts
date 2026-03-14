/**
 * Hook for executing game transactions with optional gas sponsorship.
 *
 * When a sponsor service is configured (VITE_SPONSOR_SERVICE_URL),
 * transactions are gas-sponsored — the player only needs EVE for entry fees.
 * Otherwise, falls back to standard execution requiring SUI for gas.
 */
import { useCallback } from 'react';
import {
  useSuiClient,
  useCurrentWallet,
  useSignAndExecuteTransaction,
  useSignTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import {
  detectSponsorshipInfo,
  requestSponsorship,
  b64ToUint8Array,
  SPONSOR_SERVICE_URL,
  type SponsorshipInfo,
} from '@/lib/sponsorship';

export interface GameTransactionResult {
  digest?: string;
  events?: Array<{ type: string; parsedJson?: Record<string, unknown> }>;
  effects?: Record<string, unknown>;
  [key: string]: unknown;
}

export function useGameTransaction() {
  const suiClient = useSuiClient();
  const { currentWallet } = useCurrentWallet();

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showEvents: true, showEffects: true },
      }),
  });

  const { mutateAsync: signTx } = useSignTransaction();

  const sponsorship: SponsorshipInfo = detectSponsorshipInfo(currentWallet);

  const execute = useCallback(
    async (
      tx: Transaction,
      sender: string,
    ): Promise<GameTransactionResult> => {
      // Try sponsored path when a sponsor service is available
      if (sponsorship.canSponsorGameTx && SPONSOR_SERVICE_URL && sender) {
        try {
          // 1. Build transaction kind bytes (no gas info)
          const txKindBytes = await tx.build({
            client: suiClient,
            onlyTransactionKind: true,
          });

          // 2. Request sponsorship — service adds gas payment and signs
          const { txB64, sponsorSignature } = await requestSponsorship(
            txKindBytes,
            sender,
          );

          // 3. Reconstruct Transaction from sponsor-prepared bytes for player signing
          const sponsoredTx = Transaction.from(b64ToUint8Array(txB64));
          const { signature: playerSig, bytes: signedBytes } = await signTx({
            transaction: sponsoredTx,
          });

          // 4. Execute with dual signatures (player + sponsor)
          return (await suiClient.executeTransactionBlock({
            transactionBlock: signedBytes,
            signature: [playerSig, sponsorSignature],
            options: { showEvents: true, showEffects: true },
          })) as GameTransactionResult;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // If the player rejected, don't fall back — propagate
          if (msg.includes('rejected') || msg.includes('denied')) {
            throw err;
          }
          console.warn('[sponsorship] Falling back to standard execution:', msg);
        }
      }

      // Standard path — player pays gas
      return (await signAndExecute({
        transaction: tx,
      })) as GameTransactionResult;
    },
    [sponsorship.canSponsorGameTx, suiClient, signAndExecute, signTx],
  );

  return { execute, sponsorship, suiClient };
}
