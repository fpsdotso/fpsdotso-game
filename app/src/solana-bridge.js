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
 * Model types enum matching the Solana program
 * These are the proper enum variant objects for Anchor serialization
 */
export const ModelType = {
  Cube: { cube: {} },
  Rectangle: { rectangle: {} },
  Triangle: { triangle: {} },
  Sphere: { sphere: {} },
  Cylinder: { cylinder: {} },
  Plane: { plane: {} },
  SpawnPointBlue: { spawnPointBlue: {} },
  SpawnPointRed: { spawnPointRed: {} },
};

/**
 * Helper to create ModelType from string name
 * @param {string} typeName - Name of the model type (e.g., "Cube", "Sphere")
 * @returns {Object} Proper enum variant for Anchor
 */
export function getModelType(typeName) {
  const typeMap = {
    'Cube': { cube: {} },
    'Rectangle': { rectangle: {} },
    'Triangle': { triangle: {} },
    'Sphere': { sphere: {} },
    'Cylinder': { cylinder: {} },
    'Plane': { plane: {} },
    'SpawnPointBlue': { spawnPointBlue: {} },
    'SpawnPointRed': { spawnPointRed: {} },
  };
  return typeMap[typeName] || { cube: {} }; // Default to Cube
}

/**
 * Deserialize Borsh-encoded Map data from Rust game
 * @param {Uint8Array} bytes - Borsh-serialized Map data
 * @returns {Array<Object>} Array of MapObject structures
 */
export function deserializeMapFromBorsh(bytes) {
  try {
    console.log('📦 Deserializing Borsh data, byte length:', bytes.length);

    // Read the Map structure from Borsh bytes manually
    let offset = 0;

    // Read name (string = 4 bytes length + data)
    const nameLen = new DataView(bytes.buffer, offset, 4).getUint32(0, true);
    offset += 4;
    const nameBytes = bytes.slice(offset, offset + nameLen);
    const name = new TextDecoder().decode(nameBytes);
    offset += nameLen;
    console.log('  Map name:', name);

    // Read version (u8)
    const version = bytes[offset];
    offset += 1;
    console.log('  Version:', version);

    // Read objects Vec (4 bytes length + data)
    const objectsLen = new DataView(bytes.buffer, offset, 4).getUint32(0, true);
    offset += 4;
    console.log('  Objects count:', objectsLen);

    const objects = [];
    for (let i = 0; i < objectsLen; i++) {
      // Read ModelType enum (1 byte discriminator)
      const modelTypeDiscriminator = bytes[offset];
      offset += 1;

      // Map discriminator to ModelType
      const modelTypes = [
        { cube: {} },
        { rectangle: {} },
        { triangle: {} },
        { sphere: {} },
        { cylinder: {} },
        { plane: {} },
        { spawnPointBlue: {} },
        { spawnPointRed: {} },
      ];
      const modelType = modelTypes[modelTypeDiscriminator] || { cube: {} };

      // Read position (3 x i16)
      const posX = new DataView(bytes.buffer, offset, 2).getInt16(0, true);
      offset += 2;
      const posY = new DataView(bytes.buffer, offset, 2).getInt16(0, true);
      offset += 2;
      const posZ = new DataView(bytes.buffer, offset, 2).getInt16(0, true);
      offset += 2;

      // Read rotation (3 x u16)
      const rotX = new DataView(bytes.buffer, offset, 2).getUint16(0, true);
      offset += 2;
      const rotY = new DataView(bytes.buffer, offset, 2).getUint16(0, true);
      offset += 2;
      const rotZ = new DataView(bytes.buffer, offset, 2).getUint16(0, true);
      offset += 2;

      // Read scale (3 x u8)
      const scaleX = bytes[offset++];
      const scaleY = bytes[offset++];
      const scaleZ = bytes[offset++];

      // Read color (3 x u8)
      const colorR = bytes[offset++];
      const colorG = bytes[offset++];
      const colorB = bytes[offset++];

      objects.push({
        modelType,
        posX,
        posY,
        posZ,
        rotX,
        rotY,
        rotZ,
        scaleX,
        scaleY,
        scaleZ,
        colorR,
        colorG,
        colorB,
      });
    }

    console.log('✅ Successfully deserialized', objects.length, 'objects');
    return objects;
  } catch (error) {
    console.error('❌ Failed to deserialize Borsh data:', error);
    throw error;
  }
}

/**
 * Convert game object to MapObject structure for Solana
 * @param {Object} obj - Game object with position, rotation, scale, color
 * @returns {Object} MapObject structure matching the IDL
 */
export function gameObjectToMapObject(obj) {
  // Scale position values from float (-100.0 to 100.0) to i16 range
  const posScale = 327.67; // 32767 / 100

  // Helper to clamp values within ranges
  const clampI16 = (val) => Math.max(-32768, Math.min(32767, Math.round(val)));
  const clampU16 = (val) => Math.max(0, Math.min(65535, Math.round(val)));
  const clampU8 = (val) => Math.max(0, Math.min(255, Math.round(val)));

  // Ensure modelType is properly formatted
  let modelType = obj.modelType || ModelType.Cube;

  // If modelType is a string, convert it
  if (typeof modelType === 'string') {
    modelType = getModelType(modelType);
  }

  return {
    modelType: modelType,
    posX: clampI16((obj.position?.x ?? 0) * posScale),
    posY: clampI16((obj.position?.y ?? 0) * posScale),
    posZ: clampI16((obj.position?.z ?? 0) * posScale),
    rotX: clampU16((obj.rotation?.x ?? 0) % 360),
    rotY: clampU16((obj.rotation?.y ?? 0) % 360),
    rotZ: clampU16((obj.rotation?.z ?? 0) % 360),
    scaleX: clampU8((obj.scale?.x ?? 1) * 10),
    scaleY: clampU8((obj.scale?.y ?? 1) * 10),
    scaleZ: clampU8((obj.scale?.z ?? 1) * 10),
    colorR: clampU8(obj.color?.r ?? 255),
    colorG: clampU8(obj.color?.g ?? 255),
    colorB: clampU8(obj.color?.b ?? 255),
  };
}

/**
 * Convert MapObject from Solana to game object structure
 * @param {Object} mapObj - MapObject from Solana
 * @returns {Object} Game object with position, rotation, scale, color
 */
export function mapObjectToGameObject(mapObj) {
  const posScale = 327.67; // 32767 / 100

  return {
    modelType: mapObj.modelType,
    position: {
      x: mapObj.posX / posScale,
      y: mapObj.posY / posScale,
      z: mapObj.posZ / posScale,
    },
    rotation: {
      x: mapObj.rotX,
      y: mapObj.rotY,
      z: mapObj.rotZ,
    },
    scale: {
      x: mapObj.scaleX / 10,
      y: mapObj.scaleY / 10,
      z: mapObj.scaleZ / 10,
    },
    color: {
      r: mapObj.colorR,
      g: mapObj.colorG,
      b: mapObj.colorB,
    },
  };
}

/**
 * Serialize MapObjects back to Borsh format matching Rust Map struct
 * This creates a complete Map struct that Rust can deserialize
 * @param {string} mapName - Name of the map
 * @param {Array<Object>} mapObjects - Array of MapObject structures from Solana
 * @returns {Uint8Array} Borsh-serialized Map data
 */
export function serializeMapToBorsh(mapName, mapObjects) {
  try {
    console.log('📦 Serializing map to Borsh format...');
    console.log('  Name:', mapName);
    console.log('  Objects:', mapObjects.length);

    // Calculate total size needed
    const nameBytes = new TextEncoder().encode(mapName);
    const nameLen = nameBytes.length;

    // Map structure:
    // - name: 4 bytes (length) + nameLen bytes (string data)
    // - version: 1 byte (u8)
    // - objects: 4 bytes (length) + (19 bytes * object count)
    //   Each MapObject: 1 (enum) + 6 (pos i16×3) + 6 (rot u16×3) + 3 (scale u8×3) + 3 (color u8×3) = 19 bytes
    // - spawn_x, spawn_y, spawn_z: 3 * 2 bytes (i16)
    const totalSize = 4 + nameLen + 1 + 4 + (19 * mapObjects.length) + 6;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 0;

    // Write name (4 bytes length + string data)
    view.setUint32(offset, nameLen, true);
    offset += 4;
    bytes.set(nameBytes, offset);
    offset += nameLen;

    // Write version (u8)
    bytes[offset] = 1;
    offset += 1;

    // Write objects vec length (4 bytes)
    view.setUint32(offset, mapObjects.length, true);
    offset += 4;

    // Write each MapObject (19 bytes each)
    for (let i = 0; i < mapObjects.length; i++) {
      const obj = mapObjects[i];

      // Get model type discriminator (0-7)
      let discriminator = 0;
      if (obj.modelType.cube !== undefined) discriminator = 0;
      else if (obj.modelType.rectangle !== undefined) discriminator = 1;
      else if (obj.modelType.triangle !== undefined) discriminator = 2;
      else if (obj.modelType.sphere !== undefined) discriminator = 3;
      else if (obj.modelType.cylinder !== undefined) discriminator = 4;
      else if (obj.modelType.plane !== undefined) discriminator = 5;
      else if (obj.modelType.spawnPointBlue !== undefined) discriminator = 6;
      else if (obj.modelType.spawnPointRed !== undefined) discriminator = 7;

      // Write model type (1 byte)
      bytes[offset++] = discriminator;

      // Write position (3 x i16 = 6 bytes)
      view.setInt16(offset, obj.posX, true);
      offset += 2;
      view.setInt16(offset, obj.posY, true);
      offset += 2;
      view.setInt16(offset, obj.posZ, true);
      offset += 2;

      // Write rotation (3 x u16 = 6 bytes)
      view.setUint16(offset, obj.rotX, true);
      offset += 2;
      view.setUint16(offset, obj.rotY, true);
      offset += 2;
      view.setUint16(offset, obj.rotZ, true);
      offset += 2;

      // Write scale (3 x u8 = 3 bytes)
      bytes[offset++] = obj.scaleX;
      bytes[offset++] = obj.scaleY;
      bytes[offset++] = obj.scaleZ;

      // Write color (3 x u8 = 3 bytes)
      bytes[offset++] = obj.colorR;
      bytes[offset++] = obj.colorG;
      bytes[offset++] = obj.colorB;
    }

    // Write spawn point (default to 0, 0, 0)
    view.setInt16(offset, 0, true);
    offset += 2;
    view.setInt16(offset, 0, true);
    offset += 2;
    view.setInt16(offset, 0, true);
    offset += 2;

    console.log('✅ Successfully serialized to Borsh, total bytes:', bytes.length);
    return bytes;
  } catch (error) {
    console.error('❌ Failed to serialize to Borsh:', error);
    throw error;
  }
}

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
 * @param {Array<Object>|Uint8Array} mapObjectsOrBytes - Array of game objects OR Borsh-serialized Map data
 */
export async function createMap(mapId, name, description, isDefault, mapObjectsOrBytes) {
  if (!program || !wallet) {
    console.error('Program not initialized or wallet not connected');
    return null;
  }

  try {
    console.log(`📝 Creating map: ${name} (${mapId})`);

    // Ensure registry is initialized first
    await initializeRegistry();

    let mapData;

    // Check if input is Uint8Array (Borsh bytes from Rust) or object array
    if (mapObjectsOrBytes instanceof Uint8Array) {
      console.log('📦 Input is Borsh-encoded bytes, deserializing...');
      // Deserialize Borsh bytes to get MapObject array
      mapData = deserializeMapFromBorsh(mapObjectsOrBytes);
    } else if (Array.isArray(mapObjectsOrBytes)) {
      console.log(`📦 Input is object array, converting ${mapObjectsOrBytes.length} objects...`);
      // Convert game objects to MapObject structures
      mapData = mapObjectsOrBytes.map((obj, idx) => {
        try {
          const converted = gameObjectToMapObject(obj);
          console.log(`✓ Converted object ${idx}:`, converted);
          return converted;
        } catch (err) {
          console.error(`❌ Failed to convert object ${idx}:`, obj, err);
          throw err;
        }
      });
    } else {
      throw new Error('Invalid mapObjectsOrBytes: must be Uint8Array or Array');
    }

    console.log('📦 Final map data for Solana:', mapData.length, 'objects');

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
      .createMap(mapId, name, description, isDefault, mapData)
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
 * @param {string} format - Return format: 'gameObjects', 'mapObjects', or 'borsh'
 * @returns {Array<Object>|Uint8Array} Array of objects or Borsh bytes depending on format
 */
export async function getMapData(mapId, format = 'gameObjects') {
  if (!program) {
    console.error('Program not initialized');
    return null;
  }

  try {
    // Fetch both metadata and data
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-metadata'), Buffer.from(mapId)],
      program.programId
    );

    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-data'), Buffer.from(mapId)],
      program.programId
    );

    const [metadata, mapData] = await Promise.all([
      program.account.mapMetadata.fetch(mapMetadataPda),
      program.account.mapData.fetch(mapDataPda),
    ]);

    console.log('📊 Map data fetched:', mapData.objects.length, 'objects');

    // Return in requested format
    if (format === 'borsh') {
      // Serialize to Borsh bytes matching Rust Map struct
      return serializeMapToBorsh(metadata.name, mapData.objects);
    } else if (format === 'gameObjects') {
      // Convert to game object format
      return mapData.objects.map(obj => mapObjectToGameObject(obj));
    } else {
      // Return raw MapObjects from Solana
      return mapData.objects;
    }
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
 * Update map metadata (name and/or description)
 * @param {string} mapId - The map ID to update
 * @param {string|null} name - New name (optional)
 * @param {string|null} description - New description (optional)
 */
export async function updateMapMetadata(mapId, name = null, description = null) {
  if (!program || !wallet) {
    console.error('Program not initialized or wallet not connected');
    return null;
  }

  try {
    console.log(`📝 Updating map metadata: ${mapId}`);

    // Derive map metadata PDA
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-metadata'), Buffer.from(mapId)],
      program.programId
    );

    const tx = await program.methods
      .updateMapMetadata(name, description)
      .accounts({
        mapMetadata: mapMetadataPda,
        user: wallet.publicKey,
      })
      .rpc();

    console.log('✅ Map metadata updated! Transaction:', tx);
    return { transaction: tx };
  } catch (error) {
    console.error('❌ Failed to update map metadata:', error);
    console.error('Error details:', error.logs || error.message);
    return null;
  }
}

/**
 * Update map data (replaces all objects)
 * @param {string} mapId - The map ID to update
 * @param {Array<Object>} mapObjects - New array of game objects
 */
export async function updateMapData(mapId, mapObjects) {
  if (!program || !wallet) {
    console.error('Program not initialized or wallet not connected');
    return null;
  }

  try {
    console.log(`📝 Updating map data: ${mapId}`);
    console.log(`📦 New map objects count: ${mapObjects.length}`);

    // Convert game objects to MapObject structures
    const mapData = mapObjects.map(obj => gameObjectToMapObject(obj));

    // Derive PDAs
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-metadata'), Buffer.from(mapId)],
      program.programId
    );

    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-data'), Buffer.from(mapId)],
      program.programId
    );

    const tx = await program.methods
      .updateMapData(mapData)
      .accounts({
        mapMetadata: mapMetadataPda,
        mapDataAccount: mapDataPda,
        user: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Map data updated! Transaction:', tx);
    return { transaction: tx };
  } catch (error) {
    console.error('❌ Failed to update map data:', error);
    console.error('Error details:', error.logs || error.message);
    return null;
  }
}

/**
 * Delete a map (only the creator can delete)
 * @param {string} mapId - The map ID to delete
 */
export async function deleteMap(mapId) {
  if (!program || !wallet) {
    console.error('Program not initialized or wallet not connected');
    return null;
  }

  try {
    console.log(`🗑️ Deleting map: ${mapId}`);

    // Derive PDAs
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-metadata'), Buffer.from(mapId)],
      program.programId
    );

    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so map-data'), Buffer.from(mapId)],
      program.programId
    );

    const [userMapIndexPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fps.so user-map-index'), wallet.publicKey.toBuffer()],
      program.programId
    );

    // Fetch metadata to get creator
    const metadata = await program.account.mapMetadata.fetch(mapMetadataPda);

    const tx = await program.methods
      .deleteMap()
      .accounts({
        mapMetadata: mapMetadataPda,
        mapDataAccount: mapDataPda,
        userMapIndex: userMapIndexPda,
        user: wallet.publicKey,
        creator: metadata.creator,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Map deleted! Transaction:', tx);
    return { transaction: tx };
  } catch (error) {
    console.error('❌ Failed to delete map:', error);
    console.error('Error details:', error.logs || error.message);
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
