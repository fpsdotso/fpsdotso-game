# JavaScript Bridge Documentation

This document explains how to use the JavaScript bridge to communicate between the Raylib game (Emscripten) and the Solana client (wasm-bindgen).

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐         ┌─────────────────────┐
│  Raylib Game        │         │  JavaScript Bridge   │         │  Solana Client      │
│  (Emscripten WASM)  │ ◄─────► │  (React App)         │ ◄─────► │  (wasm-bindgen)     │
└─────────────────────┘         └──────────────────────┘         └─────────────────────┘
```

## Files

- **`app/src/solana-bridge.js`** - Manages Solana client WASM module
- **`app/src/game-bridge.js`** - Provides interface for game to call JS functions
- **`app/src/App.js`** - React component that loads both modules

## How to Call JavaScript from Your Game (C/Rust)

### Option 1: Using Emscripten's EM_JS

In your Rust game code, you can call JavaScript functions:

```rust
use std::os::raw::c_char;
use std::ffi::CString;

// Declare external JavaScript functions
extern "C" {
    fn js_register_kill(killer: *const c_char, victim: *const c_char);
    fn js_send_message(message: *const c_char);
}

fn on_player_killed(killer: &str, victim: &str) {
    unsafe {
        let killer_c = CString::new(killer).unwrap();
        let victim_c = CString::new(victim).unwrap();

        js_register_kill(killer_c.as_ptr(), victim_c.as_ptr());
    }
}

fn send_game_message(msg: &str) {
    unsafe {
        let msg_c = CString::new(msg).unwrap();
        js_send_message(msg_c.as_ptr());
    }
}
```

Then in your JavaScript (add to `game-bridge.js`):

```javascript
// Add to initGameBridge() function:

// Define functions that can be called from WASM
window.js_register_kill = function(killerPtr, victimPtr) {
  const killer = window.Module.UTF8ToString(killerPtr);
  const victim = window.Module.UTF8ToString(victimPtr);

  window.gameBridge.registerKill(killer, victim);
};

window.js_send_message = function(messagePtr) {
  const message = window.Module.UTF8ToString(messagePtr);
  window.gameBridge.sendMessage(message);
};
```

### Option 2: Direct Window Access

Your game can directly call functions on `window.gameBridge`:

```javascript
// From JavaScript console or game
window.gameBridge.registerKill("player1", "player2");
window.gameBridge.getPlayerStats("player1");
window.gameBridge.sendMessage("Hello from game!");
```

## Available Bridge Functions

### From Game → Solana

```javascript
// Register a kill on the blockchain
await window.gameBridge.registerKill(killerName, victimName);

// Get player stats from on-chain data
const stats = await window.gameBridge.getPlayerStats(playerId);
// Returns: { kills: number, deaths: number, score: number }

// Connect wallet
const result = await window.gameBridge.connectWallet();

// Get wallet balance
const balance = await window.gameBridge.getBalance();

// Check if Solana is ready
const ready = window.gameBridge.isSolanaReady();

// Send message to UI
window.gameBridge.sendMessage("Game event happened!");
```

### From React → Game

If you need to call functions exported from your game:

```javascript
import { callGameFunction } from './game-bridge';

// Call a C function exported with EMSCRIPTEN_KEEPALIVE
const result = callGameFunction('your_exported_function', arg1, arg2);
```

## Example: Full Kill Registration Flow

### 1. In your Rust game (game/src/main.rs):

```rust
use raylib::prelude::*;
use std::os::raw::c_char;
use std::ffi::CString;

extern "C" {
    fn js_register_kill(killer: *const c_char, victim: *const c_char);
}

fn main() {
    let (mut rl, thread) = raylib::init()
        .size(800, 600)
        .title("FPS.so Game")
        .build();

    while !rl.window_should_close() {
        let mut d = rl.begin_drawing(&thread);
        d.clear_background(Color::RAYWHITE);

        // When K key is pressed, register a test kill
        if d.is_key_pressed(KeyboardKey::KEY_K) {
            unsafe {
                let killer = CString::new("player1").unwrap();
                let victim = CString::new("player2").unwrap();
                js_register_kill(killer.as_ptr(), victim.as_ptr());
            }
        }
    }
}
```

### 2. The JavaScript bridge handles it automatically!

The bridge in `game-bridge.js` will:
1. Receive the call from the game
2. Convert C strings to JavaScript strings
3. Call the Solana client WASM module
4. Execute the blockchain transaction
5. Return the result

## Testing

1. Build both modules:
```bash
./build-game.sh
```

2. Start the React app:
```bash
cd app
npm start
```

3. Open browser console and test:
```javascript
// Test Solana functions
await window.gameBridge.connectWallet();
await window.gameBridge.registerKill("test1", "test2");
await window.gameBridge.getPlayerStats("test1");

// Check status
console.log(window.gameBridge.isSolanaReady());
```

4. In the game, press K to test kill registration from the game itself.

## Event System

Listen for events from the game in React:

```javascript
import { onGameMessage } from './game-bridge';

// In your component
useEffect(() => {
  onGameMessage((message) => {
    console.log('Game says:', message);
    // Update UI, show notification, etc.
  });
}, []);
```

## Troubleshooting

### "Solana client not initialized"
- Make sure `initSolanaClient()` completes before calling functions
- Check browser console for WASM loading errors

### "Module not available"
- Ensure the game script has loaded
- Check that `window.Module.onRuntimeInitialized` callback fires

### "UTF8ToString is not a function"
- The game hasn't finished initializing
- Wait for `gameReady` state before calling game functions

## Next Steps

1. Implement actual Solana transactions in `solana-client/src/lib.rs`
2. Add more game events (deaths, score updates, etc.)
3. Implement proper wallet integration (Phantom, Solflare, etc.)
4. Add error handling and retry logic
5. Create a proper game state management system
