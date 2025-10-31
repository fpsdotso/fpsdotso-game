# FPS.so - Solana Game Frontend

A Rust-based FPS game with Solana blockchain integration. The game uses Raylib (compiled via Emscripten) and communicates with Solana smart contracts through a JavaScript bridge.

### Problem

- On-chain games today mostly focus on “earning,” not competitive, skill‑based gameplay.
- There is a lack of live, low‑latency FPS experiences on Solana that feel Web2‑native.

### Solution

FPS.so is a skill‑based first‑person shooter on Solana. We stream inputs through MagicBlock’s Ephemeral Rollups to deliver Web2‑grade responsiveness while actions are verifiably committed on-chain. This game is playable on your desktop and phone!

1. 5v5 First Person Shooting gameplay
2. Desktop (WASD/mouse) and mobile joystick controls (React overlay)

### Why Only Possible On MagicBlock (OPOMB)

- Ultra‑low latency play (as low as ~10 ms) via Ephemeral Rollups.
- Secure: inputs/actions follow a delegated, verifiable rollup path.
- Gasless UX: movements and actions execute a program behind the scenes with no transaction fees for players.

### Target Market

- Web3 gamers, Web2 gamers, and NFT collectors/communities.
- Market signal: Gaming dominance rose from 20.1% → 25% in Q3 with 7.4M daily UAW.

### Roadmap

- Q1: More maps, game modes, and weapons; improved movement & gun physics; publish on Solana Dapp Store.
- Q2: Ranked matchmaking with MMR; leaderboards; online tourneys.
- Q3: Marketplace for cosmetic gun skins as NFTs, Battlepasses as subscription model for players to enjoy premium perks.

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐         ┌─────────────────────┐
│  Raylib Game        │         │  JavaScript Bridge   │         │  Solana Client      │
│  (Emscripten WASM)  │ ◄─────► │  (React App)         │ ◄─────► │  (wasm-bindgen)     │
└─────────────────────┘         └──────────────────────┘         └─────────────────────┘
```

### How It Works (High Level)

1. Raylib (Rust) compiles to WASM and renders the game in a canvas.
2. A JavaScript bridge exposes functions both ways (game → JS → on‑chain and UI → game).
3. Player inputs are streamed using MagicBlock Ephemeral Rollups (ephemeral wallet + ER RPC), then committed on‑chain.
4. State (players, maps, lobbies) can be queried and synced back to the client.

## Quick Start

### Prerequisites

- Rust (with wasm32-unknown-emscripten target)
- Emscripten SDK
- Node.js and pnpm
- wasm-pack

### 1. Build Everything

```bash
./build-game.sh
```

This builds:

- Solana client (wasm-bindgen) → `app/public/solana-client/`
- Raylib game (Emscripten) → `app/public/fpsdotso-game.js` + `.wasm`

### 2. Run the App

```bash
cd app
pnpm install
pnpm run start
```

### Controls

- Desktop: WASD to move, mouse to look, click to shoot (where implemented).
- Mobile: A joystick overlay is shown, drag the screen to move character's camera, and a shoot button would be shown. Joystick inputs are streamed via the same MagicBlock ER pathway for gasless, low‑latency control.

## How It Works

### Game → Solana Communication

1. Game detects event (e.g., player kill)
2. Calls JavaScript function via Emscripten
3. Bridge converts C strings to JS strings
4. Solana client WASM executes blockchain transaction
5. Result returned to game

### Build Commands

```bash
# Build both modules
./build-game.sh

# Build only game
source emsdk_env.sh
cargo build --release --target wasm32-unknown-emscripten -p fpsdotso-game


```
