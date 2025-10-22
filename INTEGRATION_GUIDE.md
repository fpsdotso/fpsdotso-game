# Integration Guide: Game ↔ Solana

This guide shows you how to integrate Solana blockchain functionality into your Raylib game.

## Quick Start

### 1. Build the project
```bash
./build-game.sh
```

This builds:
- ✅ Solana client (wasm-bindgen) → `app/public/solana-client/`
- ✅ Raylib game (Emscripten) → `app/public/fpsdotso-game.js` + `.wasm`

### 2. Run the app
```bash
cd app
npm start
```

Open http://localhost:3000

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                               │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   React App                          │    │
│  │                                                       │    │
│  │  ┌──────────────┐          ┌──────────────────┐    │    │
│  │  │ solana-      │◄────────►│  game-bridge.js  │    │    │
│  │  │ bridge.js    │          │                  │    │    │
│  │  └──────────────┘          └──────────────────┘    │    │
│  │         ▲                           ▲               │    │
│  └─────────┼───────────────────────────┼───────────────┘    │
│            │                           │                     │
│            ▼                           ▼                     │
│  ┌──────────────────┐       ┌──────────────────┐           │
│  │ Solana Client    │       │  Raylib Game     │           │
│  │ (wasm-bindgen)   │       │  (Emscripten)    │           │
│  │                  │       │                  │           │
│  │ - connect_wallet │       │ - Game logic     │           │
│  │ - register_kill  │       │ - Rendering      │           │
│  │ - get_stats      │       │ - Input handling │           │
│  └──────────────────┘       └──────────────────┘           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Adding Solana Calls to Your Game

### Step 1: Declare JavaScript Functions in Rust

Edit `game/src/main.rs`:

```rust
use raylib::prelude::*;
use std::os::raw::c_char;
use std::ffi::CString;

// Declare external JavaScript functions
extern "C" {
    fn js_register_kill(killer: *const c_char, victim: *const c_char);
    fn js_get_player_stats(player_id: *const c_char);
    fn js_send_message(message: *const c_char);
}

// Helper function to call JS safely
fn register_kill_on_chain(killer: &str, victim: &str) {
    unsafe {
        let killer_c = CString::new(killer).unwrap();
        let victim_c = CString::new(victim).unwrap();
        js_register_kill(killer_c.as_ptr(), victim_c.as_ptr());
    }
}

fn send_message(msg: &str) {
    unsafe {
        let msg_c = CString::new(msg).unwrap();
        js_send_message(msg_c.as_ptr());
    }
}

fn main() {
    let (mut rl, thread) = raylib::init()
        .size(800, 600)
        .title("FPS.so - Solana Game")
        .build();

    send_message("Game initialized!");

    while !rl.window_should_close() {
        let mut d = rl.begin_drawing(&thread);
        d.clear_background(Color::RAYWHITE);
        d.draw_text("FPS.so - Press K to test kill", 200, 280, 20, Color::BLACK);

        // Test: Press K to register a kill
        if d.is_key_pressed(KeyboardKey::KEY_K) {
            send_message("Player killed!");
            register_kill_on_chain("player1", "player2");
        }
    }
}
```

### Step 2: Implement JavaScript Functions

Edit `app/src/game-bridge.js` and add to `initGameBridge()`:

```javascript
export function initGameBridge() {
  if (!window.Module) {
    console.warn('Module not available yet');
    return;
  }

  // ... existing code ...

  // Add these functions for the game to call
  window.js_register_kill = function(killerPtr, victimPtr) {
    const killer = window.Module.UTF8ToString(killerPtr);
    const victim = window.Module.UTF8ToString(victimPtr);

    console.log(`🎯 Kill event: ${killer} → ${victim}`);
    window.gameBridge.registerKill(killer, victim);
  };

  window.js_get_player_stats = function(playerIdPtr) {
    const playerId = window.Module.UTF8ToString(playerIdPtr);

    console.log(`📊 Getting stats for: ${playerId}`);
    window.gameBridge.getPlayerStats(playerId);
  };

  window.js_send_message = function(messagePtr) {
    const message = window.Module.UTF8ToString(messagePtr);
    window.gameBridge.sendMessage(message);
  };
}
```

### Step 3: Rebuild and Test

```bash
./build-game.sh
cd app && npm start
```

## Example: Complete Kill System

Here's a complete example of tracking kills on-chain:

### Game Side (Rust)

```rust
struct Player {
    name: String,
    position: Vector2,
    health: i32,
}

impl Player {
    fn take_damage(&mut self, damage: i32, attacker: &str) {
        self.health -= damage;

        if self.health <= 0 {
            // Player died - register on blockchain
            register_kill_on_chain(attacker, &self.name);

            // Send notification to UI
            send_message(&format!("{} was killed by {}", self.name, attacker));

            // Respawn logic...
            self.respawn();
        }
    }

    fn respawn(&mut self) {
        self.health = 100;
        self.position = Vector2::new(400.0, 300.0);
    }
}
```

### Solana Client Side (Rust)

Edit `solana-client/src/lib.rs`:

```rust
#[wasm_bindgen]
impl SolanaClient {
    #[wasm_bindgen]
    pub fn register_kill(&self, killer: &str, victim: &str) -> Result<(), JsValue> {
        log(&format!("📝 Recording kill: {} → {}", killer, victim));

        // TODO: Implement actual Solana transaction
        // Example:
        // 1. Create instruction to call your Solana program
        // 2. Sign transaction with wallet
        // 3. Send to blockchain
        // 4. Wait for confirmation

        // For now, just log it
        log("✅ Kill recorded on-chain (mock)");
        Ok(())
    }
}
```

## Testing the Integration

### From Browser Console

```javascript
// Test Solana functions directly
await window.gameBridge.registerKill("alice", "bob");
await window.gameBridge.getPlayerStats("alice");
await window.gameBridge.connectWallet();

// Check if everything is ready
console.log("Solana ready:", window.gameBridge.isSolanaReady());
```

### From the Game

1. Press **K** key to trigger a test kill
2. Check browser console for logs
3. Verify the kill is registered

## Project Structure

```
fpsdotso-game/
├── game/                           # Raylib game (Emscripten)
│   ├── src/
│   │   └── main.rs                 # Game logic
│   └── Cargo.toml
│
├── solana-client/                  # Solana client (wasm-bindgen)
│   ├── src/
│   │   └── lib.rs                  # Blockchain interactions
│   └── Cargo.toml
│
├── app/                            # React app
│   ├── src/
│   │   ├── App.js                  # Main component
│   │   ├── solana-bridge.js        # Solana module loader
│   │   └── game-bridge.js          # Game ↔ JS interface
│   └── public/
│       ├── solana-client/          # Built Solana WASM
│       ├── fpsdotso-game.js        # Built game WASM
│       └── fpsdotso_game.wasm
│
├── build-game.sh                   # Build script
├── JAVASCRIPT_BRIDGE.md            # Bridge API docs
└── INTEGRATION_GUIDE.md            # This file
```

## Common Patterns

### 1. Async Calls from Game

Since blockchain calls are async, you may want to handle responses:

```rust
// In your game
fn register_kill_and_notify(killer: &str, victim: &str) {
    // Send the kill event
    register_kill_on_chain(killer, victim);

    // The actual transaction happens async in JS
    // You can poll for confirmation or use callbacks
}
```

### 2. Game Events

Send various game events to the UI:

```rust
send_message("game_start");
send_message("round_end");
send_message(&format!("score:{}", score));
```

Handle them in React:

```javascript
onGameMessage((message) => {
  if (message === "game_start") {
    // Update UI
  } else if (message.startsWith("score:")) {
    const score = message.split(":")[1];
    setScore(score);
  }
});
```

### 3. Real-time Stats

Update player stats in real-time:

```javascript
// In React component
useEffect(() => {
  const interval = setInterval(async () => {
    if (window.gameBridge.isSolanaReady()) {
      const stats = await window.gameBridge.getPlayerStats(playerId);
      setPlayerStats(stats);
    }
  }, 5000); // Update every 5 seconds

  return () => clearInterval(interval);
}, [playerId]);
```

## Next Steps

1. **Implement Solana Program**: Create your on-chain program for storing game data
2. **Wallet Integration**: Add proper wallet adapter (Phantom, Solflare)
3. **Transaction Signing**: Implement proper transaction creation and signing
4. **Error Handling**: Add retry logic and error recovery
5. **State Management**: Sync game state with on-chain data
6. **Testing**: Add unit tests for bridge functions

## Resources

- [JAVASCRIPT_BRIDGE.md](./JAVASCRIPT_BRIDGE.md) - Detailed API documentation
- [Emscripten Documentation](https://emscripten.org/docs/)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [Anchor Framework](https://www.anchor-lang.com/)

## Troubleshooting

### Build fails
- Make sure Emscripten is installed and sourced: `source emsdk_env.sh`
- Check that wasm-pack is installed: `cargo install wasm-pack`

### Module not found in browser
- Check that files are in `app/public/`
- Clear browser cache
- Check browser console for 404 errors

### Functions not available
- Ensure `initGameBridge()` is called after Module loads
- Check `window.Module.onRuntimeInitialized` callback fires
- Verify Solana client initialized: `window.gameBridge.isSolanaReady()`

Need help? Check the console logs - they show the initialization sequence!
