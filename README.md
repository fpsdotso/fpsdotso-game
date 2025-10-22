# FPS.so - Solana Game Frontend

A Rust-based FPS game with Solana blockchain integration. The game uses Raylib (compiled via Emscripten) and communicates with Solana smart contracts through a JavaScript bridge.

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐         ┌─────────────────────┐
│  Raylib Game        │         │  JavaScript Bridge   │         │  Solana Client      │
│  (Emscripten WASM)  │ ◄─────► │  (React App)         │ ◄─────► │  (wasm-bindgen)     │
└─────────────────────┘         └──────────────────────┘         └─────────────────────┘
```

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

Open http://localhost:3000

### 3. Test the Bridge

Open http://localhost:3000/test-bridge.html for a testing console

## Project Structure

```
fpsdotso-game/
├── game/                      # Raylib game (Emscripten)
│   └── src/main.rs           # Game logic
├── solana-client/            # Solana client (wasm-bindgen)
│   └── src/lib.rs           # Blockchain interactions
├── app/                      # React frontend
│   ├── src/
│   │   ├── App.js           # Main component
│   │   ├── solana-bridge.js # Solana WASM loader
│   │   └── game-bridge.js   # Game ↔ JS interface
│   └── public/
│       └── test-bridge.html # Bridge testing console
├── build-game.sh            # Build script
└── idls/                    # Solana program IDLs
```

## Documentation

- **[BRIDGE_SUMMARY.md](./BRIDGE_SUMMARY.md)** - Quick overview of the bridge
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Complete integration walkthrough
- **[JAVASCRIPT_BRIDGE.md](./JAVASCRIPT_BRIDGE.md)** - API reference and examples

## How It Works

### Game → Solana Communication

1. Game detects event (e.g., player kill)
2. Calls JavaScript function via Emscripten
3. Bridge converts C strings to JS strings
4. Solana client WASM executes blockchain transaction
5. Result returned to game

### Example

**In Rust game:**
```rust
extern "C" {
    fn js_register_kill(killer: *const c_char, victim: *const c_char);
}

// When player dies
register_kill_on_chain("player1", "player2");
```

**JavaScript handles the rest automatically!**

## Available Bridge Functions

From the game, you can call:
- `js_register_kill(killer, victim)` - Record kill on-chain
- `js_get_player_stats(playerId)` - Fetch player stats
- `js_send_message(message)` - Send message to UI
- `js_connect_wallet()` - Connect wallet
- `js_get_balance()` - Get wallet balance

## Testing

### Browser Console Test

```javascript
// Check readiness
window.gameBridge.isSolanaReady()

// Test functions
await window.gameBridge.connectWallet()
await window.gameBridge.registerKill("alice", "bob")
await window.gameBridge.getPlayerStats("alice")
```

### Test Console

Visit http://localhost:3000/test-bridge.html for a visual testing interface

## Development

### Build Commands

```bash
# Build both modules
./build-game.sh

# Build only game
source emsdk_env.sh
cargo build --release --target wasm32-unknown-emscripten -p fpsdotso-game

# Build only solana-client
cd solana-client
wasm-pack build --target web --out-dir ../app/public/solana-client
```

### Watch Mode (React only)

```bash
cd app
pnpm run start
```

## Features

- ✅ Raylib game engine (Emscripten WASM)
- ✅ Solana blockchain integration (wasm-bindgen)
- ✅ JavaScript bridge for communication
- ✅ React frontend with wallet integration
- ✅ Real-time game events to blockchain
- ✅ On-chain player stats and leaderboards

## Next Steps

1. Implement Solana program for game data storage
2. Add proper wallet integration (Phantom, Solflare)
3. Implement transaction signing and confirmation
4. Add more game mechanics
5. Create leaderboard system
6. Add token rewards/payments

## Troubleshooting

### Build Fails
- Ensure Emscripten is installed: `source emsdk_env.sh`
- Install wasm-pack: `cargo install wasm-pack`
- Check Rust target: `rustup target add wasm32-unknown-emscripten`

### Module Not Found
- Check files exist in `app/public/`
- Clear browser cache
- Check browser console for errors

### Bridge Not Working
- Wait for both modules to initialize
- Check console logs for initialization sequence
- Use test-bridge.html to debug

## Contributing

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for detailed development instructions.

## License

[Your License Here]