/**
 * Debug Configuration
 * Set these to false to disable verbose logging in production
 */

export const DEBUG_CONFIG = {
  // Core systems
  WALLET: false,           // Wallet connection logs
  TRANSACTIONS: false,      // Transaction execution logs
  WEBSOCKET: false,         // WebSocket connection/subscription logs
  GAME_BRIDGE: false,       // Game bridge function calls
  
  // Data operations
  MAP_OPERATIONS: false,    // Map creation/loading logs
  BORSH_SERIALIZATION: false, // Borsh serialize/deserialize logs
  PLAYER_UPDATES: false,    // Player position/state updates
  
  // Always show critical logs
  ERRORS: true,             // Error messages
  WARNINGS: true,           // Warning messages
  SUCCESS: true,            // Success messages (transactions, connections)
};

/**
 * Conditional logging helpers
 */
export const debug = {
  log: (category, ...args) => {
    if (DEBUG_CONFIG[category]) {
      console.log(...args);
    }
  },
  
  warn: (category, ...args) => {
    if (DEBUG_CONFIG[category] || DEBUG_CONFIG.WARNINGS) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    if (DEBUG_CONFIG.ERRORS) {
      console.error(...args);
    }
  },
  
  success: (...args) => {
    if (DEBUG_CONFIG.SUCCESS) {
      console.log(...args);
    }
  }
};
