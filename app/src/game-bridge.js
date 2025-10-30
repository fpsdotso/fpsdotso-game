/**
 * Game Bridge - Provides functions that the Emscripten game can call
 * This module exposes JavaScript functions to the WASM game through
 * the Emscripten Module interface.
 */

import * as solanaBridge from "./solana-bridge";
import websocketGameManager from "./websocket-game-manager";
import { publicKey, u64, bool } from '@solana/buffer-layout-utils';
import * as BufferLayout from '@solana/buffer-layout';

const { u32, u8, struct, f32 } = BufferLayout;

// Track last logged positions to avoid duplicate logs
const lastLoggedPositions = {};

/**
 * GamePlayer account layout for Borsh deserialization
 * Matches the Rust struct from the game program
 */
const GamePlayerLayout = struct([
  publicKey('authority'),        // 32 bytes
  publicKey('gameId'),            // 32 bytes
  f32('position_x'),              // 4 bytes
  f32('position_y'),              // 4 bytes
  f32('position_z'),              // 4 bytes
  f32('rotation_x'),              // 4 bytes
  f32('rotation_y'),              // 4 bytes
  f32('rotation_z'),              // 4 bytes
  u8('health'),                   // 1 byte
  bool('is_alive'),               // 1 byte
  u8('team'),                     // 1 byte
  u32('kills'),                   // 4 bytes
  u32('deaths'),                  // 4 bytes
  u32('score'),                   // 4 bytes
  u64('last_update'),             // 8 bytes
  u8('bump'),                     // 1 byte
]);

/**
 * Initialize the game bridge
 * Sets up functions that the Emscripten game can call
 */
export function initGameBridge() {
  // Make sure Module is available
  if (!window.Module) {
    console.warn("Module not available yet, game bridge will be set up later");
    return;
  }

  console.log("Setting up game bridge functions...");

  // Expose functions to the game through window.gameBridge
  window.gameBridge = {
    // Solana functions
    registerKill: async (killer, victim) => {
      console.log(`[Game Bridge] registerKill called: ${killer} -> ${victim}`);
      return await solanaBridge.registerKill(killer, victim);
    },

    getPlayerStats: async (playerId) => {
      console.log(`[Game Bridge] getPlayerStats called: ${playerId}`);
      return await solanaBridge.getPlayerStats(playerId);
    },

    connectWallet: async () => {
      console.log("[Game Bridge] connectWallet called");
      return await solanaBridge.connectWallet();
    },

    getBalance: async () => {
      console.log("[Game Bridge] getBalance called");
      return await solanaBridge.getBalance();
    },

    createGame: async (lobbyName, mapName) => {
      console.log(
        `[Game Bridge] createGame called: ${lobbyName} on ${mapName}`
      );
      const result = await solanaBridge.createGame(lobbyName, mapName);
      console.log("[Game Bridge] createGame result:", result);
      return result;
    },

    testInitPlayer: async () => {
      console.log("[Game Bridge] testInitPlayer called");
      const result = await solanaBridge.testInitPlayer();
      console.log("[Game Bridge] testInitPlayer result:", result);
      return result;
    },

    testMatchmakingProgram: async () => {
      console.log("[Game Bridge] testMatchmakingProgram called");
      const result = await solanaBridge.testMatchmakingProgram();
      console.log("[Game Bridge] testMatchmakingProgram result:", result);
      return result;
    },

    testCreateAndFetchGame: async () => {
      console.log("[Game Bridge] testCreateAndFetchGame called");
      const result = await solanaBridge.testCreateAndFetchGame();
      console.log("[Game Bridge] testCreateAndFetchGame result:", result);
      return result;
    },

    testAllProgramAccounts: async () => {
      console.log("[Game Bridge] testAllProgramAccounts called");
      const result = await solanaBridge.testAllProgramAccounts();
      console.log("[Game Bridge] testAllProgramAccounts result:", result);
      return result;
    },

    getAvailableGames: async () => {
      console.log("[Game Bridge] getAvailableGames called");
      const result = await solanaBridge.getAvailableGames();
      console.log("[Game Bridge] getAvailableGames result:", result);
      return result;
    },

    getPlayerCurrentGame: async () => {
      console.log("[Game Bridge] getPlayerCurrentGame called");
      const result = await solanaBridge.getPlayerCurrentGame();
      console.log("[Game Bridge] getPlayerCurrentGame result:", result);
      return result;
    },

    leaveCurrentGame: async () => {
      console.log("[Game Bridge] leaveCurrentGame called");
      const result = await solanaBridge.leaveCurrentGame();
      console.log("[Game Bridge] leaveCurrentGame result:", result);
      return result;
    },

    // Utility functions
    isSolanaReady: () => {
      return solanaBridge.isSolanaClientReady();
    },

    // Example: Send a message from game to UI
    sendMessage: (message) => {
      console.log(`[Game Message]: ${message}`);
      // Dispatch custom event that React can listen to
      window.dispatchEvent(new CustomEvent("gameMessage", { detail: message }));
    },

    // Lobby functions
    joinGame: async (gamePubkey) => {
      console.log("[Game Bridge] joinGame called:", gamePubkey);
      const result = await solanaBridge.joinGame(gamePubkey);
      console.log("[Game Bridge] joinGame result:", result);
      return result;
    },

    startGame: async (gamePubkey) => {
      console.log("[Game Bridge] startGame called:", gamePubkey);
      const result = await solanaBridge.startGame(gamePubkey);
      console.log("[Game Bridge] startGame result:", result);
      return result;
    },

    getGame: async (gamePubkey) => {
      console.log("[Game Bridge] getGame called:", gamePubkey);
      const result = await solanaBridge.getGame(gamePubkey);
      console.log("[Game Bridge] getGame result:", result);
      return result;
    },

    getAllPlayersInGame: async (gamePubkey) => {
      console.log("[Game Bridge] getAllPlayersInGame called:", gamePubkey);
      const result = await solanaBridge.getAllPlayersInGame(gamePubkey);
      console.log("[Game Bridge] getAllPlayersInGame result:", result);
      return result;
    },

    setReadyState: async (gamePubkey, isReady) => {
      console.log("[Game Bridge] setReadyState called:", gamePubkey, isReady);
      const result = await solanaBridge.setReadyState(gamePubkey, isReady);
      console.log("[Game Bridge] setReadyState result:", result);
      return result;
    },

    getMapDataById: async (mapId) => {
      console.log("[Game Bridge] getMapDataById called:", mapId);
      const result = await solanaBridge.getMapData(mapId, "borsh");
      console.log("[Game Bridge] getMapDataById result:", result ? `${result.length} bytes` : 'null');
      return result;
    },

    // Ephemeral wallet functions
    getEphemeralWalletInfo: async () => {
      return await solanaBridge.getEphemeralWalletInfo();
    },

    fundEphemeralWallet: async (amountSol) => {
      return await solanaBridge.fundEphemeralWallet(amountSol);
    },

    getEphemeralBalance: async () => {
      return await solanaBridge.getEphemeralBalance();
    },

    getEphemeralPublicKey: () => {
      return solanaBridge.getEphemeralPublicKey();
    },

    // Game input function for ephemeral rollup
    sendPlayerInput: async (input) => {
      return await solanaBridge.sendPlayerInput(input);
    },

    // Shooting functions
    shootPlayer: async (damage, gameId, otherPlayerPdas) => {
      console.log(`[Game Bridge] shootPlayer called: damage=${damage}, targets=${otherPlayerPdas?.length || 0}`);
      return await solanaBridge.shootPlayer(damage, gameId, otherPlayerPdas);
    },

    awardKill: async (scorePoints, gameId) => {
      console.log(`[Game Bridge] awardKill called: points=${scorePoints}`);
      return await solanaBridge.awardKill(scorePoints, gameId);
    },

    respawnPlayer: async (gameId, spawnX, spawnY, spawnZ) => {
      console.log(`[Game Bridge] respawnPlayer called: spawn=(${spawnX}, ${spawnY}, ${spawnZ})`);
      return await solanaBridge.respawnPlayer(gameId, spawnX, spawnY, spawnZ);
    },

    // Get all players in game for synchronization
    getGamePlayers: async (gamePublicKey) => {
      return await solanaBridge.getGamePlayers(gamePublicKey);
    },

    // Get current player's authority (wallet public key)
    getCurrentPlayerAuthority: () => {
      return solanaBridge.getCurrentPlayerAuthority();
    },

    // Get current player's ephemeral wallet public key (for GamePlayer matching)
    getCurrentPlayerEphemeralKey: () => {
      return solanaBridge.getCurrentPlayerEphemeralKey();
    },

    // Get all other player PDAs for shooting detection
    getOtherPlayerPDAs: async (gamePublicKey) => {
      try {
        const currentEphemeralKey = solanaBridge.getCurrentPlayerEphemeralKey();
        const allPlayers = await solanaBridge.getGamePlayers(gamePublicKey);

        if (!allPlayers || allPlayers.length === 0) {
          console.log('[Game Bridge] No players found in game');
          return [];
        }

        // Filter out current player and return PDAs (using publicKey property)
        const otherPlayers = allPlayers
          .filter(player => player.authority !== currentEphemeralKey)
          .map(player => player.publicKey);

        console.log(`[Game Bridge] Found ${otherPlayers.length} other players for shooting detection`);
        console.log(`[Game Bridge] Current player key: ${currentEphemeralKey}`);
        console.log(`[Game Bridge] Other player PDAs:`, otherPlayers);
        return otherPlayers;
      } catch (error) {
        console.error('[Game Bridge] Error getting other player PDAs:', error);
        return [];
      }
    },

    // Game mode control functions
    startGameMode: () => {
      console.log("[Game Bridge] startGameMode called - switching to playing mode");
      console.log("[Game Bridge] Module available:", !!window.Module);
      console.log("[Game Bridge] _start_game available:", !!(window.Module && window.Module._start_game));

      if (window.Module && window.Module._start_game) {
        console.log("[Game Bridge] Calling Module._start_game()...");
        try {
          window.Module._start_game();
          console.log("[Game Bridge] ✅ Module._start_game() called successfully");
        } catch (error) {
          console.error("[Game Bridge] ❌ Error calling _start_game:", error);
        }
      } else {
        console.warn("⚠️ Module._start_game not available");
        console.log("Available Module functions:", Object.keys(window.Module || {}));
      }
    },

    stopGameMode: () => {
      console.log("[Game Bridge] stopGameMode called - switching to menu mode");
      if (window.Module && window.Module._stop_game) {
        window.Module._stop_game();
      } else {
        console.warn("⚠️ Module._stop_game not available");
      }
    },

    setCurrentGame: (gamePubkey) => {
      console.log("[Game Bridge] setCurrentGame called:", gamePubkey);
      if (window.Module && window.Module._set_current_game_js) {
        // Allocate string in WASM memory
        const lengthBytes = window.Module.lengthBytesUTF8(gamePubkey) + 1;
        const stringPtr = window.Module._malloc(lengthBytes);
        window.Module.stringToUTF8(gamePubkey, stringPtr, lengthBytes);

        // Call the function
        window.Module._set_current_game_js(stringPtr);

        // Free the memory
        window.Module._free(stringPtr);
      } else {
        console.warn("⚠️ Module._set_current_game_js not available");
      }
    },

    // WebSocket real-time game state functions
    connectWebSocket: async () => {
      console.log("[Game Bridge] connectWebSocket called");
      try {
        await websocketGameManager.connect();
        return { success: true };
      } catch (error) {
        console.error("[Game Bridge] Failed to connect WebSocket:", error);
        return { success: false, error: error.message };
      }
    },

    disconnectWebSocket: () => {
      console.log("[Game Bridge] disconnectWebSocket called");
      websocketGameManager.disconnect();
      return { success: true };
    },

    subscribeToGamePlayers: async (gamePubkey) => {
      console.log("[Game Bridge] subscribeToGamePlayers called:", gamePubkey);
      try {
        // First, get all players in the game
        // Retry mechanism: GamePlayer accounts might not be created immediately when game starts
        let players = [];
        let retryCount = 0;
        const maxRetries = 10;

        while (players.length === 0 && retryCount < maxRetries) {
          players = await solanaBridge.getGamePlayers(gamePubkey);
          console.log(`[Game Bridge] Attempt ${retryCount + 1}: Found ${players.length} players to subscribe to`);

          if (players.length === 0 && retryCount < maxRetries - 1) {
            console.log(`[Game Bridge] No players found yet, waiting 1 second before retry...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          retryCount++;
        }

        if (players.length === 0) {
          console.warn("[Game Bridge] No GamePlayer accounts found after retries. Players may need to ready up first.");
          return { success: false, error: "No players found" };
        }

        console.log("[Game Bridge] Successfully found", players.length, "players after", retryCount, "attempts");

        // Extract GamePlayer account public keys
        const gamePlayerPubkeys = players.map(p => p.publicKey);

        // Subscribe to all GamePlayer accounts via WebSocket
        await websocketGameManager.subscribeToGamePlayers(gamePlayerPubkeys, async (accountPubkey, accountData) => {
          // Store the updated player data in a global variable that Rust can read
          if (!window.___websocket_player_updates) {
            window.___websocket_player_updates = {};
          }

          // We need to decode the account data from the WebSocket notification
          // The accountData contains the raw account info, we need to parse it using Anchor
          try {
            // Get the game program to decode the account
            const gameProgram = solanaBridge.getGameProgram();
            if (gameProgram && accountData?.value?.data) {
              // The data is base64 encoded, decode it
              const accountDataRaw = accountData.value.data;

              // If data is an array, it's in format: [base64String, 'base64']
              let decodedData;
              if (Array.isArray(accountDataRaw)) {
                // Extract the base64 string from the array (first element)
                decodedData = Buffer.from(accountDataRaw[0], 'base64');
              } else if (typeof accountDataRaw === 'string') {
                // Base64 encoded string
                decodedData = Buffer.from(accountDataRaw, 'base64');
              }

              if (decodedData) {
                try {
                  // Deserialize using @solana/buffer-layout
                  // Skip 8-byte discriminator, then decode the rest using our layout
                  const dataWithoutDiscriminator = decodedData.slice(8);
                  const rawData = GamePlayerLayout.decode(dataWithoutDiscriminator);

                  // Convert BigInt to Number and use camelCase for Rust compatibility
                  const gamePlayerData = {
                    authority: rawData.authority.toString(), // Convert PublicKey to string
                    gameId: rawData.gameId.toString(),
                    positionX: rawData.position_x, // camelCase for Rust
                    positionY: rawData.position_y,
                    positionZ: rawData.position_z,
                    rotationX: rawData.rotation_x,
                    rotationY: rawData.rotation_y,
                    rotationZ: rawData.rotation_z,
                    health: rawData.health,
                    isAlive: rawData.is_alive, // camelCase for Rust
                    team: rawData.team,
                    kills: rawData.kills,
                    deaths: rawData.deaths,
                    score: rawData.score,
                    lastUpdate: Number(rawData.last_update), // Convert BigInt to Number
                    bump: rawData.bump,
                  };

                  // 🎯 CHECK IF DATA CHANGED (compare position to reduce console spam)
                  const posKey = `${gamePlayerData.positionX.toFixed(2)},${gamePlayerData.positionY.toFixed(2)},${gamePlayerData.positionZ.toFixed(2)}`;
                  const lastPos = lastLoggedPositions[accountPubkey];
                  const dataChanged = lastPos !== posKey;

                  if (dataChanged) {
                    lastLoggedPositions[accountPubkey] = posKey;
                    const totalPlayers = Object.keys(window.___websocket_player_updates).length;
                    console.log(`[WebSocket] 📡 Player ${accountPubkey.slice(0, 8)} | Pos(${gamePlayerData.positionX.toFixed(1)}, ${gamePlayerData.positionY.toFixed(1)}, ${gamePlayerData.positionZ.toFixed(1)}) | Rot(${gamePlayerData.rotationY.toFixed(2)}) | Team ${gamePlayerData.team} | HP ${gamePlayerData.health} | Alive: ${gamePlayerData.isAlive} | Total: ${totalPlayers} players`);
                  }

                  // Store the decoded data
                  window.___websocket_player_updates[accountPubkey] = {
                    timestamp: Date.now(),
                    data: accountData,
                    parsed: gamePlayerData, // Include parsed data (with BigInt converted to Number)
                  };
                } catch (decodeError) {
                  console.error("[Game Bridge] ⚠️ Decoder failed:", decodeError.message);
                  console.error("[Game Bridge] Stack:", decodeError.stack);
                  console.error("[Game Bridge] Data length:", decodedData?.length, "bytes");
                  // Fallback: store raw data
                  window.___websocket_player_updates[accountPubkey] = {
                    timestamp: Date.now(),
                    data: accountData,
                  };
                }
              }
            } else {
              // Fallback: store raw data
              window.___websocket_player_updates[accountPubkey] = {
                timestamp: Date.now(),
                data: accountData,
              };
            }
          } catch (error) {
            console.error("[Game Bridge] ❌ Failed to decode account data:", error);
            // Store raw data as fallback
            window.___websocket_player_updates[accountPubkey] = {
              timestamp: Date.now(),
              data: accountData,
            };
          }
        });

        console.log("[Game Bridge] Subscribed to all GamePlayer accounts");
        return { success: true, playerCount: players.length };
      } catch (error) {
        console.error("[Game Bridge] Failed to subscribe to game players:", error);
        return { success: false, error: error.message };
      }
    },

    unsubscribeFromGamePlayers: async (gamePubkey) => {
      console.log("[Game Bridge] unsubscribeFromGamePlayers called:", gamePubkey);
      try {
        // Get all players in the game
        const players = await solanaBridge.getGamePlayers(gamePubkey);
        const gamePlayerPubkeys = players.map(p => p.publicKey);

        // Unsubscribe from all GamePlayer accounts
        await websocketGameManager.unsubscribeFromGamePlayers(gamePlayerPubkeys);

        console.log("[Game Bridge] Unsubscribed from all GamePlayer accounts");
        return { success: true };
      } catch (error) {
        console.error("[Game Bridge] Failed to unsubscribe from game players:", error);
        return { success: false, error: error.message };
      }
    },

    getWebSocketPlayerUpdates: () => {
      // Return all pending WebSocket player updates (but DON'T clear them)
      // The web minimap also needs this data, so we keep it available
      const updates = window.___websocket_player_updates || {};
      return JSON.stringify(updates);
    },

    // Debug function to log all current player positions
    logAllPlayerPositions: () => {
      console.log("📍 === ALL PLAYER POSITIONS (WebSocket) ===");
      const updates = window.___websocket_player_updates || {};
      const playerCount = Object.keys(updates).length;

      if (playerCount === 0) {
        console.log("  No player updates available");
        return;
      }

      console.log(`  Total players tracked: ${playerCount}`);
      for (const [accountPubkey, update] of Object.entries(updates)) {
        if (update.parsed) {
          const p = update.parsed;
          console.log(`  Player ${accountPubkey.slice(0, 8)}...`);
          console.log(`    Pos: (${p.positionX || p.position_x}, ${p.positionY || p.position_y}, ${p.positionZ || p.position_z})`);
          console.log(`    Rot: (${p.rotationX || p.rotation_x}, ${p.rotationY || p.rotation_y}, ${p.rotationZ || p.rotation_z})`);
          console.log(`    Health: ${p.health}, Team: ${p.team}, Alive: ${p.isAlive || p.is_alive}`);
          console.log(`    Age: ${((Date.now() - update.timestamp) / 1000).toFixed(1)}s ago`);
        } else {
          console.log(`  Player ${accountPubkey.slice(0, 8)}... (not decoded)`);
        }
      }
      console.log("==========================================");
    },
  };

  console.log("✅ Game bridge initialized");
}

/**
 * Call a game function from JavaScript
 * (For future use if you want to call C functions exported from the game)
 */
export function callGameFunction(functionName, ...args) {
  if (window.Module && window.Module.cwrap) {
    try {
      const gameFunction = window.Module.cwrap(functionName, "number", [
        "number",
      ]);
      return gameFunction(...args);
    } catch (error) {
      console.error(`Failed to call game function ${functionName}:`, error);
      return null;
    }
  }
  console.warn("Module.cwrap not available");
  return null;
}

/**
 * Get a pointer to a string in WASM memory
 * Useful for passing strings to the game
 */
export function createStringPointer(str) {
  if (!window.Module) return null;

  const lengthBytes = window.Module.lengthBytesUTF8(str) + 1;
  const stringPointer = window.Module._malloc(lengthBytes);
  window.Module.stringToUTF8(str, stringPointer, lengthBytes);

  return stringPointer;
}

/**
 * Free a string pointer
 */
export function freeStringPointer(ptr) {
  if (window.Module && ptr) {
    window.Module._free(ptr);
  }
}

/**
 * Listen for messages from the game
 */
export function onGameMessage(callback) {
  window.addEventListener("gameMessage", (event) => {
    callback(event.detail);
  });
}
