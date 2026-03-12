# Flappy Frontier

A Flappy Bird-style side-scrolling game built for the [EVE Frontier](https://www.evefrontier.com/) universe, backed by [Sui](https://sui.io/) smart contracts.

Players fly through procedurally generated space-themed obstacles, submit scores to an on-chain leaderboard, and compete for weekly automated payouts funded by entry fees — all without an admin key or backend server.

## What It Demonstrates

| Sui Primitive | Usage |
|---------------|-------|
| **`sui::random`** | Provably fair seed generation for each run |
| **`Clock`** | Weekly epoch boundaries, automated payout triggers |
| **`Coin<SUI>` / `Balance<SUI>`** | Self-sustaining entry fee → prize pool → payout loop |
| **On-chain leaderboard** | Top 10 scores stored as transparent, verifiable state |
| **Shared objects** | Concurrent multi-player interaction |
| **Events** | Off-chain indexing for real-time UI reactivity |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Canvas 2D Game  │────►│  Sui Wallet      │────►│  Move Contracts     │
│  (React + Vite)  │     │  (Entry Fee +    │     │  (Leaderboard +     │
│                  │     │   Score Submit)   │     │   Treasury +        │
│  787×1198px CEF  │     │                  │     │   sui::random)      │
│  compatible      │     │                  │     │                     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

- **Frontend:** Vite + React + Canvas 2D — deployed to Cloudflare Pages
- **Contracts:** Sui Move — `contracts/flappy_frontier/`
- **In-game:** Loadable in EVE Frontier's in-game browser (787×1198px portrait, free-play mode)

## Quick Start

```bash
# Build Move contracts
sui move build --path contracts/flappy_frontier

# Run Move tests
sui move test --path contracts/flappy_frontier

# Install frontend dependencies (when frontend exists)
cd frontend && npm install

# Start development server
npm run dev

# Verify active Sui environment
sui client active-env
```

## Project Structure

```
├── .github/             # Copilot instructions, prompts, skills
├── .vscode/             # Workspace settings, tasks, prompts
├── contracts/           # Sui Move smart contracts
│   └── flappy_frontier/ # Leaderboard, Treasury, game seed
├── frontend/            # React + Canvas 2D game (TBD)
├── docs/                # Architecture, strategy, research
├── templates/           # Cloudflare deployment templates
└── vendor/              # Git submodules (read-only)
```

## In-Game Browser Constraints

The game is designed to run inside EVE Frontier's in-game CEF webview:
- **Viewport:** 787×1198px, portrait orientation, DPR 1
- **Engine:** Chrome 122 (Chromium)
- **Canvas 2D / WebGL:** Both supported
- **Input:** Mouse + keyboard only (no touch)
- **Wallet:** No Sui wallet available — in-game = free-play only
- **Color scheme:** Dark mode preferred

Score submission requires an external browser with a Sui wallet connected.

## Hackathon

This project is a submission for the EVE Frontier hackathon (March 2026). See `docs/strategy/flappy-frontier-product-vision.md` for the full product vision.

## License

MIT — see [LICENSE](LICENSE).
