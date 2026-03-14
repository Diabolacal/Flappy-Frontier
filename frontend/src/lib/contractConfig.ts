/**
 * On-chain contract configuration for Flappy Frontier.
 * Populated with real Sui testnet object IDs from Phase 2 deployment.
 *
 * Publish tx:  EDskNKWvcvyHPqQrJuppHhSa46XY7gfofiTMKu9ihGGf
 * Init treasury tx: Afs7jex1t97a4HdnY3psvMn6v6AwWLQc8NJZw8YTsMg
 */

export const CONTRACT_CONFIG = {
  /** Target network */
  network: 'testnet',

  /** Sui fullnode RPC endpoint */
  rpcUrl: 'https://fullnode.testnet.sui.io:443',

  /** Published package ID (contains config, game, leaderboard, treasury modules) */
  packageId:
    '0xa23c94bd1ec5dc6516573fccd3af0f756057fb83170bc4d0d37082007ee49867',

  /** AdminCap object — owned by deployer, used for parameter adjustment only */
  adminCapId:
    '0x78d4b07dd93cf96de22410f700a18777fcbe444b6430a8b5c8bdaadd4ed1e10d',

  /** GameConfig shared object — entry fee, epoch duration, payout shares */
  gameConfigId:
    '0xb46195f179cd1ee5be6f6703db0965ce42c08585a3fa055b0dc11d10b8c1103a',

  /** Treasury<EVE> shared object — holds entry fee balances, distributes payouts */
  treasuryId:
    '0xe9aa35d0eb9aad2514cd7dde9626808dd48444042f28c098eb7bc476fefdd17b',

  /** Leaderboard shared object — top-10 sorted entries per epoch */
  leaderboardId:
    '0xff84ea77cc26f1722879e4f9511f629ab17432ac7c0f805a4eeccdb09f294327',

  /** UpgradeCap object — owned by deployer, for future package upgrades */
  upgradeCapId:
    '0xfb8e9a60a7b3d115e96aef61d2799fec1c359d133904e55c94d5451e71204b4a',

  /** Utopia EVE coin type (fully qualified) */
  eveCoinType:
    '0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE',

  /** Entry fee: 100 EVE (9 decimals) = 100_000_000_000 base units */
  entryFeeAmount: 100_000_000_000,

  /** Epoch duration: 10 minutes (600_000 ms) for testnet validation */
  epochDurationMs: 600_000,

  /** Payout shares: top 3 get 50% / 30% / 20% */
  payoutShares: [50, 30, 20] as const,

  /** Max leaderboard size */
  maxLeaderboardSize: 10,

  /** Sui Clock shared object (well-known address) */
  clockObjectId: '0x6',

  /** Sui Random shared object (well-known address) */
  randomObjectId: '0x8',
} as const;

export type ContractConfig = typeof CONTRACT_CONFIG;
