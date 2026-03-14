/**
 * On-chain contract configuration for Flappy Frontier.
 * Populated with Sui testnet (Stillness) object IDs.
 *
 * Publish tx:  AoCPM4PTDzCnRGK1kAux9tQmg3mYgWobxpSpV73V4nNN
 * Init treasury tx: 7kwvmWFxCS8Qy7mwJyWnYowTEuvw5cAxcUxBZc5pPJ75
 */

export const CONTRACT_CONFIG = {
  /** Target network */
  network: 'testnet',

  /** Sui fullnode RPC endpoint */
  rpcUrl: 'https://fullnode.testnet.sui.io:443',

  /** EVE Frontier world package ID (Stillness) — used for player name resolution */
  worldPackageId:
    '0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c',

  /** Published package ID (contains config, game, leaderboard, treasury modules) */
  packageId:
    '0x355b6228ae72f7cf64632ecd0bc7f13d3e5100f3f06699e45c3294633d9175e6',

  /** AdminCap object — owned by deployer, used for parameter adjustment only */
  adminCapId:
    '0xc633e5f3896461f2d3a4f125e61dfe39c31211d013951fd14f476ea7eede77f7',

  /** GameConfig shared object — entry fee, epoch duration, payout shares */
  gameConfigId:
    '0x96127c4dbd75f883397a420b45a03c8af004890993c56cb91e48fce8860f5c57',

  /** Treasury<EVE> shared object — holds entry fee balances, distributes payouts */
  treasuryId:
    '0xad7f49363fe1a35f47049ddcc6156b98b210cd603e453e88bd9e90faf6ab2813',

  /** Leaderboard shared object — top-10 sorted entries per epoch */
  leaderboardId:
    '0xeeda7b2193064213b5f2c1c7fb9c8f519f5facf812c4cf71fe029bc4bbba784d',

  /** UpgradeCap object — owned by deployer, for future package upgrades */
  upgradeCapId:
    '0x2dd8d599ea0629fa87debfcf072822f3125b12de90c75a744b594e350a48aa5a',

  /** Stillness EVE coin type (fully qualified) */
  eveCoinType:
    '0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE',

  /** Entry fee: 100 EVE (9 decimals) = 100_000_000_000 base units */
  entryFeeAmount: 100_000_000_000,

  /** Epoch duration: 7 days (604_800_000 ms) — weekly competition period */
  epochDurationMs: 604_800_000,

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
