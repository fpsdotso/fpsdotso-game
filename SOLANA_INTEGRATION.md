# Solana Integration with Raylib Game

This document explains how the Solana blockchain integration works with your Raylib FPS game using JavaScript/TypeScript and Anchor.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      React App (app/)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   App.js     │  │ game-bridge  │  │ solana-bridge   │  │
│  │   (UI)       │──│    .js       │──│     .js         │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         │                 │                    │            │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│   ┌─────────┐      ┌──────────┐         ┌─────────┐       │
│   │ Canvas  │      │  window  │         │ @coral- │       │
│   │ Element │      │.gameBridge│        │xyz/anchor│      │
│   └─────────┘      └──────────┘         └─────────┘       │
└─────────────────────────────────────────────────────────────┘
         │                 │                    │
         │                 │                    │
         ▼                 ▼                    ▼
┌─────────────────┐  ┌──────────────────────────────────────┐
│  Raylib Game    │  │      Solana Blockchain               │
│  (WASM)         │  │  - map_registry program              │
│  - C/C++ code   │  │  - Wallet (Phantom/Solflare)         │
│  - Emscripten   │  │  - RPC Connection                    │
└─────────────────┘  └──────────────────────────────────────┘
```

## Components

### 1. **solana-bridge.js** ([app/src/solana-bridge.js](app/src/solana-bridge.js))

This is the main Solana integration module using `@coral-xyz/anchor` (JavaScript Anchor client).

**Key Functions:**

- `initSolanaClient()` - Initialize connection to Solana RPC
- `connectWallet()` - Connect to browser wallet (Phantom, Solflare, etc.)
- `getBalance()` - Get wallet SOL balance
- `initializeRegistry()` - Initialize the map registry on-chain
- `createMap()` - Create a new map on-chain
- `getMapMetadata()` - Fetch map metadata
- `getMapData()` - Fetch map data
- `getUserMaps()` - Get all maps created by a user
- `getRegistryStats()` - Get global registry statistics

**Smart Contract Integration:**

The module interacts with your `map_registry` Anchor program using the IDL file at [app/src/idl/map_registry.json](app/src/idl/map_registry.json).

Program ID: `6XPHneawKSf2BWTtfZurtMdVvBiKsriTnGLKjoWdK791`

### 2. **game-bridge.js** ([app/src/game-bridge.js](app/src/game-bridge.js))

This module exposes functions that your Raylib game (compiled to WASM via Emscripten) can call.

**Exposed via `window.gameBridge`:**

```javascript
window.gameBridge = {
  // Solana functions
  registerKill: async (killer, victim) => { ... },
  getPlayerStats: async (playerId) => { ... },
  connectWallet: async () => { ... },
  getBalance: async () => { ... },

  // Utility
  isSolanaReady: () => { ... },
  sendMessage: (message) => { ... },
}
```

### 3. **App.js** ([app/src/App.js](app/src/App.js))

The main React component that:
- Loads the Raylib game WASM module
- Initializes Solana connection
- Provides UI for wallet connection
- Shows game status and wallet info

## How to Call JavaScript Functions from Raylib (C/C++)

Your Raylib game is compiled to WebAssembly using Emscripten. To call JavaScript functions from your C/C++ game code:

### Method 1: Using Emscripten's EM_JS macro

```c
#include <emscripten.h>

// Define JavaScript function to call from C
EM_JS(void, js_register_kill, (const char* killer, const char* victim), {
    if (window.gameBridge && window.gameBridge.registerKill) {
        window.gameBridge.registerKill(
            UTF8ToString(killer),
            UTF8ToString(victim)
        ).then(function(result) {
            console.log('Kill registered:', result);
        });
    }
});

// Use it in your game code
void player_killed(const char* killer_id, const char* victim_id) {
    js_register_kill(killer_id, victim_id);
}
```

### Method 2: Using emscripten_run_script

```c
#include <emscripten.h>
#include <stdio.h>

void register_kill(const char* killer, const char* victim) {
    char script[256];
    snprintf(script, sizeof(script),
        "if(window.gameBridge){window.gameBridge.registerKill('%s','%s');}",
        killer, victim);
    emscripten_run_script(script);
}
```

### Method 3: Using ccall from JavaScript to call C functions

If you want to go the other direction (JavaScript calling your C functions):

In your C code, export a function:
```c
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
void on_map_loaded(const char* map_data, int data_length) {
    // Process map data in your game
    printf("Map loaded: %d bytes\n", data_length);
}
```

From JavaScript:
```javascript
// In game-bridge.js or elsewhere
Module.ccall(
    'on_map_loaded',  // C function name
    null,             // return type
    ['string', 'number'], // argument types
    [mapData, mapData.length] // arguments
);
```

## Example: Load Map from Solana in Your Game

Here's a complete example of loading a map from the blockchain:

### In JavaScript ([game-bridge.js](app/src/game-bridge.js)):

```javascript
import { getMapData, getMapMetadata } from './solana-bridge';

// Add this to window.gameBridge
window.gameBridge.loadMapFromSolana = async (mapId) => {
  try {
    const metadata = await getMapMetadata(mapId);
    const mapData = await getMapData(mapId);

    // Convert Uint8Array to base64 or pass directly to C
    const dataArray = Array.from(mapData);

    // Call C function to load the map
    if (window.Module && window.Module.ccall) {
      window.Module.ccall(
        'load_map_from_data',
        null,
        ['string', 'array', 'number'],
        [metadata.name, dataArray, dataArray.length]
      );
    }

    return true;
  } catch (error) {
    console.error('Failed to load map:', error);
    return false;
  }
};
```

### In your C game code:

```c
#include <emscripten.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[256];
    unsigned char* data;
    size_t data_length;
} GameMap;

GameMap current_map;

EMSCRIPTEN_KEEPALIVE
void load_map_from_data(const char* name, unsigned char* data, int length) {
    printf("Loading map: %s (%d bytes)\n", name, length);

    // Copy map name
    strncpy(current_map.name, name, sizeof(current_map.name) - 1);

    // Allocate and copy map data
    current_map.data = malloc(length);
    if (current_map.data) {
        memcpy(current_map.data, data, length);
        current_map.data_length = length;

        // Parse and load your map...
        parse_map_data(current_map.data, current_map.data_length);
    }
}

void parse_map_data(unsigned char* data, size_t length) {
    // Your map parsing logic here
    // Load tiles, spawn points, etc.
}
```

## Environment Configuration

Create a `.env` file in the `app/` directory:

```bash
# Network: 'devnet', 'testnet', or 'mainnet-beta'
REACT_APP_SOLANA_NETWORK=devnet

# Custom RPC URL (optional)
# REACT_APP_RPC_URL=https://api.devnet.solana.com
```

## Running the Project

### 1. Build the Raylib game:

```bash
./build-game.sh
```

This compiles your Rust/C game to WASM and outputs:
- `app/public/fpsdotso-game.js`
- `app/public/fpsdotso_game.wasm`

### 2. Start the React app:

```bash
cd app
npm start
```

The app will run at `http://localhost:3000`

### 3. Install a Solana wallet:

- [Phantom](https://phantom.app/)
- [Solflare](https://solflare.com/)
- [Backpack](https://backpack.app/)

### 4. Get devnet SOL:

Visit https://faucet.solana.com/ and request devnet SOL for testing.

## Available Solana Functions for Your Game

Here are the key functions you can call from your game:

### Map Management

```javascript
// Create a map
const result = await window.gameBridge.createMap(
  'map-001',                    // mapId
  'City Arena',                 // name
  'Urban combat map',           // description
  false,                        // isDefault
  new Uint8Array([...])         // map data bytes
);

// Load a map
const mapData = await window.gameBridge.loadMapFromSolana('map-001');

// Get user's maps
const userMaps = await window.gameBridge.getUserMaps();
```

### Player Stats (TODO - needs to be implemented in smart contract)

```javascript
// Register a kill
await window.gameBridge.registerKill('player1', 'player2');

// Get player stats
const stats = await window.gameBridge.getPlayerStats('player1');
// Returns: { kills: 0, deaths: 0, score: 0 }
```

### Wallet

```javascript
// Connect wallet
const result = await window.gameBridge.connectWallet();

// Get balance
const balance = await window.gameBridge.getBalance();

// Check if Solana is ready
const ready = window.gameBridge.isSolanaReady();
```

## Next Steps: Implementing Player Stats

To add kill tracking and player stats to the blockchain:

1. **Add to Anchor program** (`fpsdotso-contracts/programs/map_registry/`):

```rust
#[account]
pub struct PlayerStats {
    pub player: Pubkey,
    pub kills: u32,
    pub deaths: u32,
    pub score: u64,
    pub last_updated: i64,
}

#[derive(Accounts)]
pub struct RegisterKill<'info> {
    #[account(
        init_if_needed,
        payer = killer,
        space = 8 + 32 + 4 + 4 + 8 + 8,
        seeds = [b"player-stats", killer.key().as_ref()],
        bump
    )]
    pub killer_stats: Account<'info, PlayerStats>,

    #[account(
        init_if_needed,
        payer = killer,
        space = 8 + 32 + 4 + 4 + 8 + 8,
        seeds = [b"player-stats", victim.key().as_ref()],
        bump
    )]
    pub victim_stats: Account<'info, PlayerStats>,

    #[account(mut)]
    pub killer: Signer<'info>,
    pub victim: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn register_kill(ctx: Context<RegisterKill>) -> Result<()> {
    ctx.accounts.killer_stats.kills += 1;
    ctx.accounts.victim_stats.deaths += 1;
    Ok(())
}
```

2. **Rebuild the program**:

```bash
cd ../fpsdotso-contracts
anchor build
```

3. **Update the IDL**:

```bash
cp target/idl/map_registry.json ../fpsdotso-game/idls/
cp target/idl/map_registry.json ../fpsdotso-game/app/src/idl/
```

4. **Update [solana-bridge.js](app/src/solana-bridge.js)** to call the new instruction.

## Troubleshooting

### "Wallet not found"
- Make sure you have Phantom or another Solana wallet extension installed
- Refresh the page after installing the wallet

### "Failed to fetch account"
- The account doesn't exist on-chain yet
- Make sure you've initialized the registry: `initializeRegistry()`
- Check you're on the correct network (devnet/mainnet)

### Game can't call JavaScript functions
- Check browser console for errors
- Make sure `window.gameBridge` is initialized before your game code runs
- Use `console.log()` in your JavaScript to debug
- Use `printf()` or `EM_ASM({ console.log(...) })` in your C code to debug

### CORS errors
- Make sure you're running the React app through `npm start`
- Don't open the HTML file directly in the browser

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Emscripten Documentation](https://emscripten.org/docs/)
- [Raylib](https://www.raylib.com/)
- [Phantom Wallet](https://phantom.app/)
