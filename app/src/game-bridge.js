/**
 * Game Bridge - Provides functions that the Emscripten game can call
 * This module exposes JavaScript functions to the WASM game through
 * the Emscripten Module interface.
 */

import * as solanaBridge from './solana-bridge';

/**
 * Initialize the game bridge
 * Sets up functions that the Emscripten game can call
 */
export function initGameBridge() {
  // Make sure Module is available
  if (!window.Module) {
    console.warn('Module not available yet, game bridge will be set up later');
    return;
  }

  console.log('Setting up game bridge functions...');

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
      console.log('[Game Bridge] connectWallet called');
      return await solanaBridge.connectWallet();
    },

    getBalance: async () => {
      console.log('[Game Bridge] getBalance called');
      return await solanaBridge.getBalance();
    },

    // Utility functions
    isSolanaReady: () => {
      return solanaBridge.isSolanaClientReady();
    },

    // Example: Send a message from game to UI
    sendMessage: (message) => {
      console.log(`[Game Message]: ${message}`);
      // Dispatch custom event that React can listen to
      window.dispatchEvent(new CustomEvent('gameMessage', { detail: message }));
    },
  };

  console.log('✅ Game bridge initialized');
}

/**
 * Call a game function from JavaScript
 * (For future use if you want to call C functions exported from the game)
 */
export function callGameFunction(functionName, ...args) {
  if (window.Module && window.Module.cwrap) {
    try {
      const gameFunction = window.Module.cwrap(functionName, 'number', ['number']);
      return gameFunction(...args);
    } catch (error) {
      console.error(`Failed to call game function ${functionName}:`, error);
      return null;
    }
  }
  console.warn('Module.cwrap not available');
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
  window.addEventListener('gameMessage', (event) => {
    callback(event.detail);
  });
}
