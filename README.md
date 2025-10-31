# 🎮 FPS.SO - On-Chain First Person Shooter

<div align="center">

[![Solana](https://img.shields.io/badge/Solana-Blockchain-9945FF?style=for-the-badge&logo=solana)](https://solana.com)
[![MagicBlock](https://img.shields.io/badge/MagicBlock-Ephemeral%20Rollups-00f294?style=for-the-badge)](https://magicblock.gg)
[![Rust](https://img.shields.io/badge/Rust-Game%20Engine-orange?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-UI-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)

**Web2-grade competitive FPS gameplay, powered by Solana and MagicBlock Ephemeral Rollups**

[Play Now](#quick-start) • [Documentation](#architecture) • [Roadmap](#roadmap)

</div>

---

## 🎯 What is FPS.SO?

FPS.SO is a **skill-based first-person shooter** built on Solana, delivering **Web2-native responsiveness** through MagicBlock's Ephemeral Rollups. Experience competitive 5v5 gameplay with ultra-low latency (~10-40ms), gasless transactions, and verifiable on-chain actions.

### ⚡ Key Features

- **🎮 Competitive 5v5 Gameplay** - Team-based deathmatch with real-time leaderboards
- **🖥️ Cross-Platform** - Desktop (WASD + Mouse) and Mobile (Virtual Joystick)
- **⚡ Ultra-Low Latency** - 10-40ms input response via Ephemeral Rollups
- **💸 Gasless UX** - No transaction fees for player actions during gameplay
- **🔗 On-Chain Verification** - All game actions are verifiably committed to Solana
- **🗺️ Map Editor** - Create and share custom maps stored on-chain
- **🏆 Matchmaking System** - Join lobbies, ready up, and compete

---

## 🚀 The Problem & Solution

### Problem
- On-chain games today focus on "earning" rather than competitive, skill-based gameplay
- Lack of live, low-latency FPS experiences on Solana that feel Web2-native
- High gas fees make real-time gaming impractical

### Solution
FPS.SO combines **Solana's high throughput** with **MagicBlock's Ephemeral Rollups** to deliver:
1. **Web2-grade latency** - Inputs processed in 10-40ms
2. **Gasless gameplay** - Players don't pay for every action
3. **On-chain verification** - All actions are provably committed to Solana
4. **Competitive integrity** - No cheating, all actions are auditable

---

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
┌──────────────────────────────────────────────────────────────────────┐
│                          FPS.SO Game Client                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐      ┌──────────────────┐      ┌────────────┐ │
│  │  Raylib Game    │      │  React UI Layer  │      │  Solana    │ │
│  │  (Rust/WASM)    │◄────►│  (game-bridge.js)│◄────►│  Client    │ │
│  │                 │      │                  │      │  (Anchor)  │ │
│  │  • 3D Rendering │      │  • Lobby System  │      │  Programs: │ │
│  │  • Player Input │      │  • Matchmaking   │      │  - Game    │ │
│  │  • Physics      │      │  • Map Editor    │      │  - Match-  │ │
│  │  • Audio        │      │  • Wallet UI     │      │    making  │ │
│  └─────────────────┘      └──────────────────┘      │  - Map Reg │ │
│                                                      └────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────────────────────────┐
        │         MagicBlock Ephemeral Rollup           │
        ├───────────────────────────────────────────────┤
        │  • Ultra-low latency input processing         │
        │  • Gasless transaction execution              │
        │  • State delegation & synchronization         │
        │  • Batched on-chain commits                   │
        └───────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────────────────────────┐
        │              Solana Mainnet/Devnet            │
        ├───────────────────────────────────────────────┤
        │  • Final state commitment                     │
        │  • Player accounts & metadata                 │
        │  • Game lobbies & match results               │
        │  • Custom maps & leaderboards                 │
        └───────────────────────────────────────────────┘
```

### Technology Stack

**Game Engine**
- **Raylib** - Fast, cross-platform game framework (Rust bindings)
- **Emscripten** - Compiles Rust to WebAssembly
- **3D Audio** - Spatial sound for immersive gameplay

**Frontend**
- **React** - UI components and state management
- **Anchor** - Solana program framework
- **Web3.js** - Blockchain interactions

**Blockchain**
- **Solana** - High-performance L1 blockchain
- **MagicBlock Ephemeral Rollups** - Ultra-low latency execution layer
- **Anchor Programs** - Smart contracts for game logic

---

## 🎮 Quick Start

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Install Node.js and pnpm
npm install -g pnpm

# Add wasm32 target
rustup target add wasm32-unknown-emscripten
```

### Build & Run

```bash
# 1. Clone the repository
git clone https://github.com/fpsdotso/fpsdotso-game.git
cd fpsdotso-game

# 2. Build the game (Rust → WASM)
./build-game.sh

# 3. Start the React app
cd app
pnpm install
pnpm run start

# 4. Open http://localhost:3000
```

### Environment Configuration

Create `app/.env`:

```bash
# Solana RPC (Devnet or Mainnet)
REACT_APP_SOLANA_RPC_URL=https://api.devnet.solana.com

# MagicBlock Ephemeral Rollup
REACT_APP_EPHEMERAL_RPC_URL=https://rollup.fps.so
REACT_APP_EPHEMERAL_WEBSOCKET_RPC_URL=wss://rollup.fps.so
```

---

## 🎯 How to Play

### 1. Connect Wallet
- Click "Connect Wallet" and approve the connection
- Compatible with Phantom, Solflare, and other Solana wallets

### 2. Initialize Player
- Enter a username (3-32 characters)
- Click "Initialize Player" to create your on-chain profile

### 3. Join or Create Lobby
- **Create Room**: Choose a map and max players
- **Join Room**: Browse available lobbies and join
- **Ready Up**: Mark yourself as ready when you're prepared

### 4. Start Playing
- **Desktop Controls**:
  - `WASD` - Movement
  - `Mouse` - Look around
  - `Left Click` - Shoot
  - `R` - Reload
  - `ESC` - Pause menu
  - `M` - Settings

- **Mobile Controls**:
  - `Virtual Joystick` - Movement
  - `Drag screen` - Look around
  - `Shoot button` - Fire weapon

### 5. Win Conditions
- **Team Deathmatch**: First team to reach kill limit wins
- **Time Limit**: Team with most kills when time expires wins

---

## 🔑 Why Only Possible on MagicBlock (OPOMB)

### Ultra-Low Latency
- **10-40ms input response** - Ephemeral Rollups process actions instantly
- **60Hz+ gameplay** - Smooth, responsive controls comparable to Web2 games
- **Adaptive rate limiting** - Automatically adjusts send rate based on network conditions

### Gasless UX
- **No transaction fees** during gameplay - Players use ephemeral wallets
- **Batch commitments** - Actions are batched and committed to Solana periodically
- **Seamless onboarding** - No need to constantly approve transactions

### Security & Verifiability
- **Delegated accounts** - Game state is delegated to ephemeral rollup
- **On-chain audit trail** - All actions are verifiably committed
- **Anti-cheat** - Server-authoritative gameplay prevents client-side cheating

### Connection Management
- **Auto-refresh** - Connection refreshed every 60 seconds to prevent degradation
- **Adaptive throttling** - Send rate adjusts based on latency (7-20 tx/s)
- **Resilient networking** - Handles network fluctuations gracefully

---

## 📊 Target Market

### Primary Audience
- **Web3 Gamers** - Crypto natives looking for competitive gaming
- **Web2 Gamers** - Traditional gamers interested in blockchain benefits
- **NFT Communities** - Collectors and communities seeking utility

### Market Signals
- Gaming dominance rose from **20.1% → 25%** in Q3 2024
- **7.4M daily unique active wallets** in blockchain gaming
- Growing demand for **skill-based** rather than pay-to-win games

---

## 🗺️ Roadmap

### Phase 1: Foundation (Current)
- ✅ Core FPS mechanics (movement, shooting, damage)
- ✅ 5v5 team deathmatch
- ✅ MagicBlock Ephemeral Rollups integration
- ✅ Lobby system with matchmaking
- ✅ On-chain map storage and editor
- ✅ Desktop and mobile support
- ✅ 3D spatial audio
- ✅ Minimap and HUD

### Phase 2: Polish & Expansion (Q1 2025)
- 🔄 Additional maps (urban, forest, industrial)
- 🔄 New game modes (Capture the Flag, King of the Hill)
- 🔄 More weapons (sniper, shotgun, rocket launcher)
- 🔄 Improved movement physics (jump, crouch, sprint)
- 🔄 Gun recoil and accuracy systems
- 🔄 Publish on Solana DApp Store

### Phase 3: Competitive Features (Q2 2025)
- 📋 Ranked matchmaking with MMR system
- 📋 Global leaderboards
- 📋 Season-based tournaments
- 📋 Replay system
- 📋 Spectator mode improvements

### Phase 4: Economy & Marketplace (Q3 2025)
- 📋 NFT gun skins marketplace
- 📋 Cosmetic items (character skins, emotes)
- 📋 Tournament prize pools
- 📋 Community-created content monetization

---

## 🏛️ Smart Contract Architecture

### Programs

1. **Game Program** (`game/`)
   - Manages player state during active matches
   - Processes player inputs (movement, shooting)
   - Handles damage, deaths, and respawns
   - Tracks team scores and match results

2. **Matchmaking Program** (`matchmaking/`)
   - Player registration and profiles
   - Lobby creation and joining
   - Team assignment
   - Ready state management
   - Game state transitions (waiting → active → ended)

3. **Map Registry Program** (`map_registry/`)
   - Stores custom maps on-chain
   - Map metadata (name, creator, description)
   - Map object data (positions, rotations, scales)
   - User map indexes

### Key Features

- **Account Delegation** - GamePlayer accounts delegated to ephemeral rollup
- **PDA-based Architecture** - Deterministic addressing for accounts
- **Optimized Storage** - Efficient encoding for on-chain map data
- **Team-based Logic** - Spawn points, scoring, and victory conditions

---

## 🛠️ Development

### Project Structure

```
fpsdotso-game/
├── game/                    # Rust game engine (Raylib)
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── game/           # Game state & logic
│   │   ├── menu/           # Menu system
│   │   ├── map/            # Map loading & rendering
│   │   └── raycaster/      # 3D rendering
│   └── assets/             # Game assets (models, textures)
│
├── app/                     # React frontend
│   ├── src/
│   │   ├── App.js          # Main app component
│   │   ├── game-bridge.js  # Rust ↔ JS bridge
│   │   ├── solana-bridge.js # Blockchain integration
│   │   ├── components/     # UI components
│   │   └── idl/            # Anchor IDL files
│   └── public/             # Static assets
│
├── idls/                    # Anchor program IDLs
│   ├── game.json
│   ├── matchmaking.json
│   └── map_registry.json
│
└── build-game.sh           # Build script
```

### Build Commands

```bash
# Build everything
./build-game.sh

# Build only game (Rust → WASM)
source ~/emsdk/emsdk_env.sh
cd game
cargo build --release --target wasm32-unknown-emscripten

# Build only React app
cd app
pnpm run build

# Run development server
cd app
pnpm run start
```

### Testing

```bash
# Run Rust tests
cd game
cargo test

# Run React tests
cd app
pnpm test

# Integration tests
node test-runner.js
```

---

## 🔧 Configuration

### Network Endpoints

**Devnet**
```bash
RPC: https://api.devnet.solana.com
WebSocket: wss://api.devnet.solana.com
```

**Mainnet Beta**
```bash
RPC: https://api.mainnet-beta.solana.com
WebSocket: wss://api.mainnet-beta.solana.com
```

**Ephemeral Rollup**
```bash
RPC: https://rollup.fps.so
WebSocket: wss://rollup.fps.so
```

### Game Settings

Adjust in-game via **Settings Menu (M)**:
- Mouse Sensitivity: 0.1x - 5.0x
- Music Volume: On/Off
- Graphics Quality: Low/Medium/High
- Network Stats: Latency display

---

## 📖 API Documentation

### JavaScript Bridge Functions

```javascript
// Initialize player
await window.gameBridge.initPlayer(username);

// Create game lobby
await window.gameBridge.createGame(lobbyName, mapName);

// Join game
await window.gameBridge.joinGame(gamePubkey);

// Set ready state
await window.gameBridge.setReadyState(gamePubkey, isReady);

// Start game (host only)
await window.gameBridge.startGame(gamePubkey);

// Get map data
const mapData = await window.gameBridge.getMapDataById(mapId);

// Send player input (called automatically)
await window.gameBridge.sendPlayerInput(input);
```

### Rust → JavaScript Callbacks

```rust
// Call JavaScript from Rust
unsafe {
    let js_code = r#"window.gameBridge.onPlayerKill(killer, victim);"#;
    let c_str = CString::new(js_code).unwrap();
    emscripten_run_script(c_str.as_ptr());
}
```

---

## 🐛 Troubleshooting

### Common Issues

**"Failed to load WASM module"**
- Run `./build-game.sh` to rebuild
- Clear browser cache
- Check console for specific errors

**"Wallet not connecting"**
- Ensure wallet extension is installed
- Try refreshing the page
- Check network connection

**"High latency during gameplay"**
- Check network connection
- Verify ephemeral RPC endpoint is responsive
- System auto-adjusts send rate based on latency

**"Game stuck in lobby"**
- Ensure all players are ready
- Check game state on blockchain
- Try leaving and rejoining

### Debug Tools

**Debug Console** - Press `/` during gameplay  
**Browser Console** - Check for JavaScript errors  
**Network Tab** - Monitor RPC calls and WebSocket connections

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow Rust style guidelines (`rustfmt`)
- Write tests for new features
- Update documentation
- Keep commits atomic and descriptive

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[MagicBlock](https://magicblock.gg)** - Ephemeral Rollups technology
- **[Solana Foundation](https://solana.com)** - Blockchain infrastructure
- **[Raylib](https://www.raylib.com/)** - Game framework
- **[Anchor](https://www.anchor-lang.com/)** - Solana program framework

---

## 📞 Contact & Community

- **Website**: [fps.so](https://fps.so)
- **Twitter**: [@fpsdotso](https://twitter.com/fpsdotso)
- **Discord**: [Join our community](https://discord.gg/fpsdotso)
- **GitHub**: [fpsdotso/fpsdotso-game](https://github.com/fpsdotso/fpsdotso-game)

---

<div align="center">

**Built with ❤️ for the Solana gaming community**

[⬆ Back to Top](#-fpsso---on-chain-first-person-shooter)

</div>
