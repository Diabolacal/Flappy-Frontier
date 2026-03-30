# Flappy Frontier: Demo Video Script

**Retention:** Carry-forward

Voiceover script for a demo video. The footage is one continuous screen recording of gameplay (not edited into separate clips). Voiceover is generated in ElevenLabs and laid over the recording. The narration does not need to match specific on-screen moments.

---

## Recording Notes

Record one continuous session. No separate clips, no tight edits needed.

- Open the game inside an SSU on Stillness if possible (shows in-game browser). Standalone browser with EVE Vault works too.
- Play a few runs. Mix of practice and ranked is fine. Crashes and restarts are expected.
- Do at least one or two ranked runs so the entry fee, score submission, and leaderboard update are visible at some point in the footage.
- Open the leaderboard panel at least once so it's visible.
- Target about 1.5 to 2 minutes of raw footage. The voiceover is around 100 seconds, so a bit of extra footage gives you room.
- Mute game audio if you prefer, or keep it. The voiceover will dominate.

---

## ElevenLabs Settings

- **Target voiceover duration:** ~100 seconds
- **Voice style:** Calm male. Measured pace, slightly technical, not hype. Think developer walkthrough, not trailer. No dramatic pauses.
- **Speed:** Normal to slightly slow. Let sentences breathe.

---

## Voiceover Script

Copy the block below into ElevenLabs as one continuous input.

```
Flappy Frontier is a ranked Flappy Bird game built on Sui for the EVE Frontier hackathon.

The game itself is simple on purpose. You fly a ship through pipes, and the difficulty ramps up as your score increases. What matters is what's underneath it.

Every ranked run starts with a transaction. You pay a hundred EVE as an entry fee, and the chain generates your run seed using Sui's native randomness. The obstacles are deterministic from that seed, so anyone can reproduce the obstacle sequence from the on-chain seed. You play, you crash, and your score is submitted on-chain automatically.

The leaderboard is fully on-chain. Top ten scores, sorted, one entry per player per epoch. Player names are resolved from EVE Frontier character data. When the week ends, anyone can trigger the payout. The top three split the pool: fifty, thirty, twenty percent. No admin key, no manual payout step. The contract handles it all.

The treasury has no admin withdrawal path. Entry fees go in. Payouts go to winners. That's it.

Gas is sponsored through a Cloudflare Worker. Players never need SUI tokens. The sponsor service validates every transaction command against an allow-list and blocks attempts to drain the sponsor wallet. If the sponsor goes down, the game falls back to player-paid gas.

Inside the EVE Frontier game client, the wallet auto-detects and connects without any modal or chooser. In a standalone browser, EVE Vault or any Sui wallet works. Either way, the experience is low friction. No faucet, no extra tokens, no detours.

This is a reusable pattern. The contracts are generic, the sponsor service is policy-driven, and the wallet detection is framework-agnostic. Replace the game and the infrastructure works for any competitive on-chain game.
```

---

## Shorter Fallback (~60 seconds)

If you need a tighter version:

```
Flappy Frontier is a ranked Flappy Bird game on Sui, built for the EVE Frontier hackathon.

The gameplay is simple. What matters is the infrastructure. Every ranked run pays a hundred EVE entry fee. The chain generates your run seed using Sui's native randomness. Obstacles are deterministic from that seed. You play, crash, and your score is submitted on-chain automatically.

The leaderboard is fully on-chain. Top ten, sorted, one per player. When the week ends, anyone can trigger the payout. Top three split the pool. No admin key, no manual payout step.

Gas is sponsored through a Cloudflare Worker. Players don't need SUI. Inside the EVE Frontier game client, the wallet auto-detects and connects. No modal, no faucet, no extra steps.

The contracts are generic, the sponsor service is policy-driven, and the wallet flow is framework-agnostic. This is a reusable pattern for on-chain competitive games.
```
