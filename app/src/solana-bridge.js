/**
 * Solana Bridge - Manages communication between the game and Solana blockchain
 * This module uses @coral-xyz/anchor to interact with the map_registry program
 */

import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import mapRegistryIdl from './idl/map_registry.json';

// Program ID from the IDL
const PROGRAM_ID = new PublicKey(mapRegistryIdl.address);

// Cluster/Network configuration
//const NETWORK = process.env.REACT_APP_SOLANA_NETWORK || 'devnet';
//const RPC_URL = process.env.REACT_APP_RPC_URL || web3.clusterApiUrl(NETWORK) || "http://0.0.0.0:8899";

const RPC_URL = process.env.REACT_APP_RPC_URL || "http://127.0.0.1:8899";

// Global state
let connection = null;
let provider = null;
let program = null;
let wallet = null;

/**
 * Initialize the Solana connection and Anchor program
 * This must be called before any other functions
 */
export async function initSolanaClient() {
  try {
    console.log('🚀 Initializing Solana client...');
    console.log(`📡 Connecting to Solana Network: ${RPC_URL}`);

    // Create connection
    connection = new Connection(RPC_URL, 'confirmed');

    // Test connection
    const version = await connection.getVersion();
    console.log('✅ Connected to Solana:', version);

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Solana client:', error);
    return false;
  }
}

/**
 * Connect wallet using browser extension (Phantom, Solflare, etc.)
 * This sets up the Anchor provider and program
 */
export async function connectWallet() {
  try {
    console.log('🔗 Connecting wallet...');

    // Check if wallet is available
    if (!window.solana) {
      throw new Error('Solana wallet not found! Please install Phantom or another Solana wallet.');
    }

    // Connect to wallet
    const response = await window.solana.connect();
    wallet = window.solana;

    console.log('📝 Wallet public key:', response.publicKey.toString());

    // Create provider
    provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    );

    // Initialize program
    program = new Program(mapRegistryIdl, provider);

    console.log('✅ Wallet connected:', response.publicKey.toString());

    return {
      publicKey: response.publicKey.toString(),
      connected: true,
    };
  } catch (error) {
    console.error('❌ Failed to connect wallet:', error);
    return null;
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet() {
  try {
    if (wallet && wallet.disconnect) {
      await wallet.disconnect();
    }
    wallet = null;
    provider = null;
    program = null;
    console.log('👋 Wallet disconnected');
    return true;
  } catch (error) {
    console.error('❌ Failed to disconnect wallet:', error);
    return false;
  }
}

/**
 * Get wallet balance in SOL
 */
export async function getBalance() {
  if (!wallet || !wallet.publicKey) {
    console.error('Wallet not connected');
    return 0;
  }

  try {
    const balance = await connection.getBalance(wallet.publicKey);
    const balanceInSol = balance / web3.LAMPORTS_PER_SOL;
    console.log('💰 Balance:', balanceInSol, 'SOL');
    return balanceInSol;
  } catch (error) {
    console.error('❌ Failed to get balance:', error);
    return 0;
  }
}

/**
 * Initialize the map registry (should be called once)
 * Creates the global registry PDA
 */
export async function initializeRegistry() {
  if (!program || !wallet) {
    console.error('Program not initialized or wallet not connected');
    return false;
  }

  try {
    console.log('📝 Initializing map registry...');

    // Derive the registry PDA
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-registry')],
      program.programId
    );

    const tx = await program.methods
      .initialize()
      .accounts({
        mapRegistry: registryPda,
        user: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Registry initialized! Transaction:', tx);
    return true;
  } catch (error) {
    // If already initialized, that's okay
    if (error.message.includes('already in use')) {
      console.log('✅ Registry already initialized');
      return true;
    }
    console.error('❌ Failed to initialize registry:', error);
    return false;
  }
}

/**
 * Create a new map
 * @param {string} mapId - Unique identifier for the map
 * @param {string} name - Display name
 * @param {string} description - Map description
 * @param {boolean} isDefault - Whether this is a default map
 * @param {Uint8Array} mapData - The actual map data
 */
export async function createMap(mapId, name, description, isDefault, mapData) {
  if (!program || !wallet) {
    console.error('Program not initialized or wallet not connected');
    return null;
  }

  try {
    console.log(`📝 Creating map: ${name} (${mapId})`);

    // Ensure registry is initialized first
    await initializeRegistry();

    // Derive PDAs
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-metadata'), Buffer.from(mapId)],
      program.programId
    );

    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-data'), Buffer.from(mapId)],
      program.programId
    );

    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-registry')],
      program.programId
    );

    const [userMapIndexPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so user-map-index'), wallet.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .createMap(mapId, name, description, isDefault, Buffer.from(mapData))
      .accounts({
        mapMetadata: mapMetadataPda,
        mapDataAccount: mapDataPda,
        mapRegistry: registryPda,
        userMapIndex: userMapIndexPda,
        user: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Map created! Transaction:', tx);
    return {
      mapId,
      transaction: tx,
      mapMetadataPda: mapMetadataPda.toString(),
      mapDataPda: mapDataPda.toString(),
    };
  } catch (error) {
    console.error('❌ Failed to create map:', error);
    console.error('Error details:', error.logs || error.message);
    return null;
  }
}

/**
 * Fetch map metadata
 * @param {string} mapId - The map ID to fetch
 */
export async function getMapMetadata(mapId) {
  if (!program) {
    console.error('Program not initialized');
    return null;
  }

  try {
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-metadata'), Buffer.from(mapId)],
      program.programId
    );

    const metadata = await program.account.mapMetadata.fetch(mapMetadataPda);
    console.log('📊 Map metadata:', metadata);
    return metadata;
  } catch (error) {
    console.error('❌ Failed to fetch map metadata:', error);
    return null;
  }
}

/**
 * Fetch map data
 * @param {string} mapId - The map ID to fetch
 */
export async function getMapData(mapId) {
  if (!program) {
    console.error('Program not initialized');
    return null;
  }

  try {
    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-data'), Buffer.from(mapId)],
      program.programId
    );

    const mapData = await program.account.mapData.fetch(mapDataPda);
    console.log('📊 Map data fetched');
    return mapData.data; // Returns the byte array
  } catch (error) {
    console.error('❌ Failed to fetch map data:', error);
    return null;
  }
}

/**
 * Get all maps created by a user
 * @param {string} userPublicKey - User's public key (optional, defaults to connected wallet)
 */
export async function getUserMaps(userPublicKey = null) {
  if (!program) {
    console.error('Program not initialized');
    return null;
  }

  try {
    const pubkey = userPublicKey ? new PublicKey(userPublicKey) : wallet.publicKey;

    const [userMapIndexPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so user-map-index'), pubkey.toBuffer()],
      program.programId
    );

    const userMapIndex = await program.account.userMapIndex.fetch(userMapIndexPda);
    console.log('📊 User maps:', userMapIndex);
    return userMapIndex;
  } catch (error) {
    console.error('❌ Failed to fetch user maps:', error);
    return null;
  }
}

/**
 * Get registry stats (total map counts)
 */
export async function getRegistryStats() {
  if (!program) {
    console.error('Program not initialized');
    return null;
  }

  try {
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-registry')],
      program.programId
    );

    const registry = await program.account.mapRegistry.fetch(registryPda);
    console.log('📊 Registry stats:', registry);
    return {
      defaultMapsCount: registry.defaultMapsCount,
      userMapsCount: registry.userMapsCount,
    };
  } catch (error) {
    console.error('❌ Failed to fetch registry stats:', error);
    return null;
  }
}

/**
 * Register a kill event on-chain
 * This is a placeholder - you'll need to add a kill tracking instruction to your program
 */
export async function registerKill(killer, victim) {
  console.log(`📊 Registering kill: ${killer} killed ${victim}`);
  console.log('⚠️ Kill tracking not yet implemented in the smart contract');
  // TODO: Implement kill tracking in your Anchor program
  return true;
}

/**
 * Get player stats
 * This is a placeholder - you'll need to add player stats tracking to your program
 */
export async function getPlayerStats(playerId) {
  console.log(`📊 Getting stats for player: ${playerId}`);
  console.log('⚠️ Player stats not yet implemented in the smart contract');
  // TODO: Implement player stats in your Anchor program
  return {
    kills: 0,
    deaths: 0,
    score: 0,
  };
}

/**
 * Check if Solana client is ready
 */
export function isSolanaClientReady() {
  return connection !== null;
}

/**
 * Check if wallet is connected
 */
export function isWalletConnected() {
  return wallet !== null && wallet.publicKey !== null;
}

/**
 * Get the connected wallet public key
 */
export function getWalletPublicKey() {
  return wallet?.publicKey?.toString() || null;
}

/**
 * Get the program instance (for advanced usage)
 */
export function getProgram() {
  return program;
}

/**
 * Get the connection instance (for advanced usage)
 */
export function getConnection() {
  return connection;
}
