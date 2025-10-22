/**
 * Solana Bridge - Manages communication between the game and Solana blockchain
 * This module loads the solana-client WASM module and provides an interface
 * for the Emscripten game to interact with Solana.
 */

import { loadSolanaWasm } from './load-solana-wasm';

let solanaClientModule = null;
let solanaClient = null;

/**
 * Initialize the Solana client WASM module
 */
export async function initSolanaClient() {
  try {
    console.log('Loading Solana client WASM module...');

    // Load the WASM module using script injection
    // This bypasses React's module restrictions
    solanaClientModule = await loadSolanaWasm();

    // Create a new SolanaClient instance
    solanaClient = new solanaClientModule.SolanaClient();

    console.log('✅ Solana client initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Solana client:', error);
    console.error('Error details:', error.message);
    return false;
  }
}

/**
 * Connect wallet
 * Called from game or UI
 */
export async function connectWallet() {
  if (!solanaClient) {
    console.error('Solana client not initialized');
    return null;
  }

  try {
    const result = await solanaClient.connect_wallet();
    console.log('Wallet connected:', result);
    return result;
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    return null;
  }
}

/**
 * Get balance
 */
export async function getBalance() {
  if (!solanaClient) {
    console.error('Solana client not initialized');
    return 0;
  }

  try {
    const balance = await solanaClient.get_balance();
    console.log('Balance:', balance);
    return balance;
  } catch (error) {
    console.error('Failed to get balance:', error);
    return 0;
  }
}

/**
 * Register a kill event on-chain
 * This will be called from the game when a player gets killed
 */
export async function registerKill(killer, victim) {
  if (!solanaClient) {
    console.error('Solana client not initialized');
    return false;
  }

  try {
    console.log(`📊 Registering kill: ${killer} killed ${victim}`);
    await solanaClient.register_kill(killer, victim);
    console.log('✅ Kill registered successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to register kill:', error);
    return false;
  }
}

/**
 * Get player stats from on-chain data
 */
export async function getPlayerStats(playerId) {
  if (!solanaClient) {
    console.error('Solana client not initialized');
    return null;
  }

  try {
    const stats = await solanaClient.get_player_stats(playerId);
    console.log(`Player ${playerId} stats:`, stats);
    return stats;
  } catch (error) {
    console.error('Failed to get player stats:', error);
    return null;
  }
}

/**
 * Check if Solana client is ready
 */
export function isSolanaClientReady() {
  return solanaClient !== null;
}

// Export the module and client for advanced usage
export function getSolanaModule() {
  return solanaClientModule;
}

export function getSolanaClient() {
  return solanaClient;
}
