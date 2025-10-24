/**
 * Game Bridge - Provides functions that the Emscripten game can call
 * This module exposes JavaScript functions to the WASM game through
 * the Emscripten Module interface.
 */

import * as solanaBridge from "./solana-bridge";

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
