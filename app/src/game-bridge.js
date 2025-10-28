/**
 * Game Bridge - Provides functions that the Emscripten game can call
 * This module exposes JavaScript functions to the WASM game through
 * the Emscripten Module interface.
 */

import * as solanaBridge from "./solana-bridge";
import websocketGameManager from "./websocket-game-manager";

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
        const players = await solanaBridge.getGamePlayers(gamePubkey);
        console.log("[Game Bridge] Found", players.length, "players to subscribe to");

        // Extract GamePlayer account public keys
        const gamePlayerPubkeys = players.map(p => p.publicKey);

        // Subscribe to all GamePlayer accounts via WebSocket
        await websocketGameManager.subscribeToGamePlayers(gamePlayerPubkeys, async (accountPubkey, accountData) => {
          console.log("[Game Bridge] 📡 Received WebSocket update for:", accountPubkey);

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

              // If data is an array (binary), convert to Buffer
              let decodedData;
              if (Array.isArray(accountDataRaw)) {
                decodedData = Buffer.from(accountDataRaw);
              } else if (typeof accountDataRaw === 'string') {
                // Base64 encoded
                decodedData = Buffer.from(accountDataRaw, 'base64');
              }

              if (decodedData) {
                try {
                  // Try to decode using Anchor's type coder instead of account coder
                  // The GamePlayer schema is in the "types" section of the IDL, not "accounts"
                  const gamePlayerData = gameProgram.coder.types.decode('GamePlayer', decodedData.slice(8)); // Skip 8-byte discriminator
                  console.log("[Game Bridge] ✅ Decoded GamePlayer data:", gamePlayerData);

                  // Store the decoded data
                  window.___websocket_player_updates[accountPubkey] = {
                    timestamp: Date.now(),
                    data: accountData,
                    parsed: gamePlayerData, // Include parsed data
                  };
                } catch (typeDecodeError) {
                  console.warn("[Game Bridge] ⚠️ Type decoder failed, storing raw data:", typeDecodeError.message);
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
      // Return all pending WebSocket player updates and clear the queue
      const updates = window.___websocket_player_updates || {};
      window.___websocket_player_updates = {};
      return JSON.stringify(updates);
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
