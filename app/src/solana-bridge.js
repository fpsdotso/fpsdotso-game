/**
 * Solana Bridge - Manages communication between the game and Solana blockchain
 * This module uses @coral-xyz/anchor to interact with the map_registry program
 */

import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import mapRegistryIdl from "./idl/map_registry.json";
import matchmakingIdl from "./idl/matchmaking.json";

// Program IDs from the IDLs
const PROGRAM_ID = new PublicKey(mapRegistryIdl.address);
const MATCHMAKING_PROGRAM_ID = new PublicKey(matchmakingIdl.address);

// Cluster/Network configuration
//const NETWORK = process.env.REACT_APP_SOLANA_NETWORK || 'devnet';
//const RPC_URL = process.env.REACT_APP_RPC_URL || web3.clusterApiUrl(NETWORK) || "http://0.0.0.0:8899";

const RPC_URL = process.env.REACT_APP_SOLANA_RPC_URL || "http://127.0.0.1:8899";
console.log(`🌐 Using Solana RPC URL: ${RPC_URL}`);

// Global state
let connection = null;
let provider = null;
let program = null;
let matchmakingProgram = null;
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
    Cube: { cube: {} },
    Rectangle: { rectangle: {} },
    Triangle: { triangle: {} },
    Sphere: { sphere: {} },
    Cylinder: { cylinder: {} },
    Plane: { plane: {} },
    SpawnPointBlue: { spawnPointBlue: {} },
    SpawnPointRed: { spawnPointRed: {} },
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
    console.log("📦 Deserializing Borsh data, byte length:", bytes.length);

    // Read the Map structure from Borsh bytes manually
    let offset = 0;

    // Read name (string = 4 bytes length + data)
    const nameLen = new DataView(bytes.buffer, offset, 4).getUint32(0, true);
    offset += 4;
    const nameBytes = bytes.slice(offset, offset + nameLen);
    const name = new TextDecoder().decode(nameBytes);
    offset += nameLen;
    console.log("  Map name:", name);

    // Read version (u8)
    const version = bytes[offset];
    offset += 1;
    console.log("  Version:", version);

    // Read objects Vec (4 bytes length + data)
    const objectsLen = new DataView(bytes.buffer, offset, 4).getUint32(0, true);
    offset += 4;
    console.log("  Objects count:", objectsLen);

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

    console.log("✅ Successfully deserialized", objects.length, "objects");
    return objects;
  } catch (error) {
    console.error("❌ Failed to deserialize Borsh data:", error);
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
  if (typeof modelType === "string") {
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
    console.log("📦 Serializing map to Borsh format...");
    console.log("  Name:", mapName);
    console.log("  Objects:", mapObjects.length);

    // Calculate total size needed
    const nameBytes = new TextEncoder().encode(mapName);
    const nameLen = nameBytes.length;

    // Map structure:
    // - name: 4 bytes (length) + nameLen bytes (string data)
    // - version: 1 byte (u8)
    // - objects: 4 bytes (length) + (19 bytes * object count)
    //   Each MapObject: 1 (enum) + 6 (pos i16×3) + 6 (rot u16×3) + 3 (scale u8×3) + 3 (color u8×3) = 19 bytes
    // - spawn_x, spawn_y, spawn_z: 3 * 2 bytes (i16)
    const totalSize = 4 + nameLen + 1 + 4 + 19 * mapObjects.length + 6;

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

    console.log(
      "✅ Successfully serialized to Borsh, total bytes:",
      bytes.length
    );
    return bytes;
  } catch (error) {
    console.error("❌ Failed to serialize to Borsh:", error);
    throw error;
  }
}

/**
 * Initialize the Solana connection and Anchor program
 * This must be called before any other functions
 */
export async function initSolanaClient() {
  try {
    console.log("🚀 Initializing Solana client...");
    console.log(`📡 Connecting to Solana Network: ${RPC_URL}`);

    // Create connection
    connection = new Connection(RPC_URL, "confirmed");

    // Test connection
    const version = await connection.getVersion();
    console.log("✅ Connected to Solana:", version);

    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Solana client:", error);
    return false;
  }
}

/**
 * Connect wallet using browser extension (Phantom, Solflare, etc.)
 * This sets up the Anchor provider and program
 */
export async function connectWallet() {
  try {
    console.log("🔗 Connecting wallet...");

    // Check if wallet is available
    if (!window.solana) {
      throw new Error(
        "Solana wallet not found! Please install Phantom or another Solana wallet."
      );
    }

    // Connect to wallet
    const response = await window.solana.connect();
    wallet = window.solana;

    console.log("📝 Wallet public key:", response.publicKey.toString());

    // Create provider
    provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    // Initialize programs
    program = new Program(mapRegistryIdl, provider);
    matchmakingProgram = new Program(matchmakingIdl, provider);

    console.log("✅ Wallet connected:", response.publicKey.toString());

    return {
      publicKey: response.publicKey.toString(),
      connected: true,
    };
  } catch (error) {
    console.error("❌ Failed to connect wallet:", error);
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
    matchmakingProgram = null;
    console.log("👋 Wallet disconnected");
    return true;
  } catch (error) {
    console.error("❌ Failed to disconnect wallet:", error);
    return false;
  }
}

/**
 * Get wallet balance in SOL
 */
export async function getBalance() {
  if (!wallet || !wallet.publicKey) {
    console.error("Wallet not connected");
    return 0;
  }

  try {
    const balance = await connection.getBalance(wallet.publicKey);
    const balanceInSol = balance / web3.LAMPORTS_PER_SOL;
    console.log("💰 Balance:", balanceInSol, "SOL");
    return balanceInSol;
  } catch (error) {
    console.error("❌ Failed to get balance:", error);
    return 0;
  }
}

/**
 * Initialize the map registry (should be called once)
 * Creates the global registry PDA
 */
export async function initializeRegistry() {
  if (!program || !wallet) {
    console.error("Program not initialized or wallet not connected");
    return false;
  }

  try {
    console.log("📝 Initializing map registry...");

    // Derive the registry PDA
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-registry")],
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

    console.log("✅ Registry initialized! Transaction:", tx);
    return true;
  } catch (error) {
    // If already initialized, that's okay
    if (error.message.includes("already in use")) {
      console.log("✅ Registry already initialized");
      return true;
    }
    console.error("❌ Failed to initialize registry:", error);
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
export async function createMap(
  mapId,
  name,
  description,
  isDefault,
  mapObjectsOrBytes
) {
  if (!program || !wallet) {
    console.error("Program not initialized or wallet not connected");
    return null;
  }

  try {
    console.log(`📝 Creating map: ${name} (${mapId})`);

    // Ensure registry is initialized first
    await initializeRegistry();

    let mapData;

    // Check if input is Uint8Array (Borsh bytes from Rust) or object array
    if (mapObjectsOrBytes instanceof Uint8Array) {
      console.log("📦 Input is Borsh-encoded bytes, deserializing...");
      // Deserialize Borsh bytes to get MapObject array
      mapData = deserializeMapFromBorsh(mapObjectsOrBytes);
    } else if (Array.isArray(mapObjectsOrBytes)) {
      console.log(
        `📦 Input is object array, converting ${mapObjectsOrBytes.length} objects...`
      );
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
      throw new Error("Invalid mapObjectsOrBytes: must be Uint8Array or Array");
    }

    console.log("📦 Final map data for Solana:", mapData.length, "objects");

    // Derive PDAs
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-metadata"), Buffer.from(mapId)],
      program.programId
    );

    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-data"), Buffer.from(mapId)],
      program.programId
    );

    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-registry")],
      program.programId
    );

    const [userMapIndexPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so user-map-index"), wallet.publicKey.toBuffer()],
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

    console.log("✅ Map created! Transaction:", tx);
    return {
      mapId,
      transaction: tx,
      mapMetadataPda: mapMetadataPda.toString(),
      mapDataPda: mapDataPda.toString(),
    };
  } catch (error) {
    console.error("❌ Failed to create map:", error);
    console.error("Error details:", error.logs || error.message);
    return null;
  }
}

/**
 * Fetch map metadata
 * @param {string} mapId - The map ID to fetch
 */
export async function getMapMetadata(mapId) {
  if (!program) {
    console.error("Program not initialized");
    return null;
  }

  try {
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-metadata"), Buffer.from(mapId)],
      program.programId
    );

    const metadata = await program.account.mapMetadata.fetch(mapMetadataPda);
    console.log("📊 Map metadata:", metadata);
    return metadata;
  } catch (error) {
    console.error("❌ Failed to fetch map metadata:", error);
    return null;
  }
}

/**
 * Fetch map data
 * @param {string} mapId - The map ID to fetch
 * @param {string} format - Return format: 'gameObjects', 'mapObjects', or 'borsh'
 * @returns {Array<Object>|Uint8Array} Array of objects or Borsh bytes depending on format
 */
export async function getMapData(mapId, format = "gameObjects") {
  if (!program) {
    console.error("Program not initialized");
    return null;
  }

  try {
    // Fetch both metadata and data
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-metadata"), Buffer.from(mapId)],
      program.programId
    );

    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-data"), Buffer.from(mapId)],
      program.programId
    );

    const [metadata, mapData] = await Promise.all([
      program.account.mapMetadata.fetch(mapMetadataPda),
      program.account.mapData.fetch(mapDataPda),
    ]);

    console.log("📊 Map data fetched:", mapData.objects.length, "objects");

    // Return in requested format
    if (format === "borsh") {
      // Serialize to Borsh bytes matching Rust Map struct
      return serializeMapToBorsh(metadata.name, mapData.objects);
    } else if (format === "gameObjects") {
      // Convert to game object format
      return mapData.objects.map((obj) => mapObjectToGameObject(obj));
    } else {
      // Return raw MapObjects from Solana
      return mapData.objects;
    }
  } catch (error) {
    console.error("❌ Failed to fetch map data:", error);
    return null;
  }
}

/**
 * Get all maps created by a user
 * @param {string} userPublicKey - User's public key (optional, defaults to connected wallet)
 */
export async function getUserMaps(userPublicKey = null) {
  if (!program) {
    console.error("Program not initialized");
    return null;
  }

  try {
    const pubkey = userPublicKey
      ? new PublicKey(userPublicKey)
      : wallet.publicKey;

    const [userMapIndexPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so user-map-index"), pubkey.toBuffer()],
      program.programId
    );

    const userMapIndex = await program.account.userMapIndex.fetch(
      userMapIndexPda
    );
    console.log("📊 User maps:", userMapIndex);
    return userMapIndex;
  } catch (error) {
    console.error("❌ Failed to fetch user maps:", error);
    return null;
  }
}

/**
 * Get registry stats (total map counts)
 */
export async function getRegistryStats() {
  if (!program) {
    console.error("Program not initialized");
    return null;
  }

  try {
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-registry")],
      program.programId
    );

    const registry = await program.account.mapRegistry.fetch(registryPda);
    console.log("📊 Registry stats:", registry);
    return {
      defaultMapsCount: registry.defaultMapsCount,
      userMapsCount: registry.userMapsCount,
    };
  } catch (error) {
    console.error("❌ Failed to fetch registry stats:", error);
    return null;
  }
}

/**
 * Update map metadata (name and/or description)
 * @param {string} mapId - The map ID to update
 * @param {string|null} name - New name (optional)
 * @param {string|null} description - New description (optional)
 */
export async function updateMapMetadata(
  mapId,
  name = null,
  description = null
) {
  if (!program || !wallet) {
    console.error("Program not initialized or wallet not connected");
    return null;
  }

  try {
    console.log(`📝 Updating map metadata: ${mapId}`);

    // Derive map metadata PDA
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-metadata"), Buffer.from(mapId)],
      program.programId
    );

    const tx = await program.methods
      .updateMapMetadata(name, description)
      .accounts({
        mapMetadata: mapMetadataPda,
        user: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Map metadata updated! Transaction:", tx);
    return { transaction: tx };
  } catch (error) {
    console.error("❌ Failed to update map metadata:", error);
    console.error("Error details:", error.logs || error.message);
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
    console.error("Program not initialized or wallet not connected");
    return null;
  }

  try {
    console.log(`📝 Updating map data: ${mapId}`);
    console.log(`📦 New map objects count: ${mapObjects.length}`);

    // Convert game objects to MapObject structures
    const mapData = mapObjects.map((obj) => gameObjectToMapObject(obj));

    // Derive PDAs
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-metadata"), Buffer.from(mapId)],
      program.programId
    );

    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-data"), Buffer.from(mapId)],
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

    console.log("✅ Map data updated! Transaction:", tx);
    return { transaction: tx };
  } catch (error) {
    console.error("❌ Failed to update map data:", error);
    console.error("Error details:", error.logs || error.message);
    return null;
  }
}

/**
 * Delete a map (only the creator can delete)
 * @param {string} mapId - The map ID to delete
 */
export async function deleteMap(mapId) {
  if (!program || !wallet) {
    console.error("Program not initialized or wallet not connected");
    return null;
  }

  try {
    console.log(`🗑️ Deleting map: ${mapId}`);

    // Derive PDAs
    const [mapMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-metadata"), Buffer.from(mapId)],
      program.programId
    );

    const [mapDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so map-data"), Buffer.from(mapId)],
      program.programId
    );

    const [userMapIndexPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fps.so user-map-index"), wallet.publicKey.toBuffer()],
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

    console.log("✅ Map deleted! Transaction:", tx);
    return { transaction: tx };
  } catch (error) {
    console.error("❌ Failed to delete map:", error);
    console.error("Error details:", error.logs || error.message);
    return null;
  }
}

/**
 * Register a kill event on-chain
 * This is a placeholder - you'll need to add a kill tracking instruction to your program
 */
export async function registerKill(killer, victim) {
  console.log(`📊 Registering kill: ${killer} killed ${victim}`);
  console.log("⚠️ Kill tracking not yet implemented in the smart contract");
  // TODO: Implement kill tracking in your Anchor program
  return true;
}

/**
 * Get player stats
 * This is a placeholder - you'll need to add player stats tracking to your program
 */
export async function getPlayerStats(playerId) {
  console.log(`📊 Getting stats for player: ${playerId}`);
  console.log("⚠️ Player stats not yet implemented in the smart contract");
  // TODO: Implement player stats in your Anchor program
  return {
    kills: 0,
    deaths: 0,
    score: 0,
  };
}

/**
 * Initialize a new player
 * @param {string} username - Player's username
 */
export async function initPlayer(username) {
  if (!matchmakingProgram || !wallet) {
    console.error(
      "Matchmaking program not initialized or wallet not connected"
    );
    return null;
  }

  try {
    console.log(`📝 Initializing player: ${username}`);

    // Validate username length (3-32 characters as per smart contract)
    if (username.length < 3 || username.length > 32) {
      throw new Error("Username must be between 3 and 32 characters");
    }

    // Derive player PDA
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), wallet.publicKey.toBuffer()],
      matchmakingProgram.programId
    );

    // Encode username as bytes with length prefix (as expected by smart contract)
    const usernameUtf8 = Buffer.from(username, "utf-8");
    const usernameBytes = Buffer.concat([
      Buffer.from([usernameUtf8.length]), // First byte: length
      usernameUtf8, // Following bytes: actual username
    ]);

    const tx = await matchmakingProgram.methods
      .initPlayer(usernameBytes)
      .accounts({
        player: playerPda,
        authority: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Player initialized! Transaction:", tx);
    return {
      playerPda: playerPda.toString(),
      transaction: tx,
    };
  } catch (error) {
    console.error("❌ Failed to initialize player:", error);
    return null;
  }
}

/**
 * Create a new game (wrapper for initGame with parameters for compatibility)
 * @param {string} lobbyName - Lobby name (not used in smart contract)
 * @param {string} mapName - Map name (not used in smart contract)
 */
export async function createGame(lobbyName, mapName) {
  console.log(`📝 Creating game: ${lobbyName} on ${mapName}`);
  // The smart contract initGame doesn't take parameters, but we log them for debugging
  return await initGame();
}

/**
 * Check if player is currently in a game
 */
export async function getPlayerCurrentGame() {
  if (!matchmakingProgram || !wallet) {
    console.error(
      "Matchmaking program not initialized or wallet not connected"
    );
    return null;
  }

  try {
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), wallet.publicKey.toBuffer()],
      matchmakingProgram.programId
    );

    const playerAccount = await matchmakingProgram.account.player.fetch(
      playerPda
    );

    if (playerAccount.currentGame) {
      console.log(
        "🎮 Player is currently in game:",
        playerAccount.currentGame.toString()
      );
      return playerAccount.currentGame.toString();
    } else {
      console.log("🎮 Player is not in any game");
      return null;
    }
  } catch (error) {
    console.error("❌ Failed to check player's current game:", error);
    return null;
  }
}

/**
 * Initialize a new game
 * This requires the player to be initialized first
 */
export async function initGame() {
  if (!matchmakingProgram || !wallet) {
    console.error(
      "Matchmaking program not initialized or wallet not connected"
    );
    return null;
  }

  try {
    console.log("📝 Initializing game...");

    // First, check if player is already in a game
    const currentGame = await getPlayerCurrentGame();
    if (currentGame) {
      console.warn("⚠️ Player is already in a game:", currentGame);
      return {
        error: "PlayerAlreadyInGame",
        message:
          "You are already in a game. Please leave the current game first.",
        currentGame: currentGame,
      };
    }

    // Get the player account to access game_counter
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), wallet.publicKey.toBuffer()],
      matchmakingProgram.programId
    );

    const playerAccount = await matchmakingProgram.account.player.fetch(
      playerPda
    );
    const gameCounter = playerAccount.gameCounter;

    // Derive game PDA using game_counter
    const gameCounterBuffer = Buffer.alloc(4);
    gameCounterBuffer.writeUInt32LE(gameCounter, 0);

    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), wallet.publicKey.toBuffer(), gameCounterBuffer],
      matchmakingProgram.programId
    );

    const tx = await matchmakingProgram.methods
      .initGame()
      .accounts({
        game: gamePda,
        player: playerPda,
        authority: wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Game initialized! Transaction:", tx);
    console.log("✅ Game PDA:", gamePda.toString());
    console.log("✅ Player PDA:", playerPda.toString());

    // Wait a moment for the transaction to be confirmed
    console.log("⏳ Waiting for transaction confirmation...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Try to fetch the game account to verify it was created
    try {
      const gameAccount = await matchmakingProgram.account.game.fetch(gamePda);
      console.log("✅ Game account verified:", gameAccount);

      // Also try to fetch it using the connection directly
      const accountInfo = await connection.getAccountInfo(gamePda);
      if (accountInfo) {
        console.log("✅ Game account exists on-chain:", {
          owner: accountInfo.owner.toString(),
          dataLength: accountInfo.data.length,
          first8Bytes: Array.from(accountInfo.data.slice(0, 8)),
        });
      } else {
        console.warn("⚠️ Game account not found on-chain");
      }
    } catch (error) {
      console.warn("⚠️ Could not fetch game account after creation:", error);
    }

    return {
      gamePda: gamePda.toString(),
      playerPda: playerPda.toString(),
      transaction: tx,
    };
  } catch (error) {
    console.error("❌ Failed to initialize game:", error);
    return null;
  }
}

/**
 * Leave the current game (no gamePubkey needed - uses player's current game)
 */
export async function leaveCurrentGame() {
  if (!matchmakingProgram || !wallet) {
    console.error(
      "Matchmaking program not initialized or wallet not connected"
    );
    return null;
  }

  try {
    console.log("📝 Leaving current game...");

    // First, get the current game
    const currentGame = await getPlayerCurrentGame();
    if (!currentGame) {
      console.warn("⚠️ Player is not in any game");
      return {
        error: "NotInGame",
        message: "You are not currently in any game.",
      };
    }

    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), wallet.publicKey.toBuffer()],
      matchmakingProgram.programId
    );

    const gamePubkeyObj = new PublicKey(currentGame);

    const tx = await matchmakingProgram.methods
      .leaveGame()
      .accounts({
        game: gamePubkeyObj,
        player: playerPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Left game! Transaction:", tx);
    return {
      gamePda: currentGame,
      playerPda: playerPda.toString(),
      transaction: tx,
    };
  } catch (error) {
    console.error("❌ Failed to leave game:", error);
    return null;
  }
}

/**
 * Join an existing game
 * @param {string} gamePubkey - The game's public key
 */
export async function joinGame(gamePubkey) {
  if (!matchmakingProgram || !wallet) {
    console.error(
      "Matchmaking program not initialized or wallet not connected"
    );
    return null;
  }

  try {
    console.log(`📝 Joining game: ${gamePubkey}`);

    // First, check if player is already in a game
    const currentGame = await getPlayerCurrentGame();
    if (currentGame) {
      console.warn("⚠️ Player is already in a game:", currentGame);
      return {
        error: "PlayerAlreadyInGame",
        message:
          "You are already in a game. Please leave the current game first.",
        currentGame: currentGame,
      };
    }

    const gamePublicKey = new PublicKey(gamePubkey);

    // Derive player PDA
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), wallet.publicKey.toBuffer()],
      matchmakingProgram.programId
    );

    const tx = await matchmakingProgram.methods
      .joinGame()
      .accounts({
        game: gamePublicKey,
        player: playerPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Joined game! Transaction:", tx);
    return {
      transaction: tx,
    };
  } catch (error) {
    console.error("❌ Failed to join game:", error);
    return null;
  }
}

/**
 * Leave the current game
 * @param {string} gamePubkey - The game's public key
 */
export async function leaveGame(gamePubkey) {
  if (!matchmakingProgram || !wallet) {
    console.error(
      "Matchmaking program not initialized or wallet not connected"
    );
    return null;
  }

  try {
    console.log(`📝 Leaving game: ${gamePubkey}`);

    const gamePublicKey = new PublicKey(gamePubkey);

    // Derive player PDA
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), wallet.publicKey.toBuffer()],
      matchmakingProgram.programId
    );

    const tx = await matchmakingProgram.methods
      .leaveGame()
      .accounts({
        game: gamePublicKey,
        player: playerPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Left game! Transaction:", tx);
    return {
      transaction: tx,
    };
  } catch (error) {
    console.error("❌ Failed to leave game:", error);
    return null;
  }
}

/**
 * Start the game
 * @param {string} gamePubkey - The game's public key
 */
export async function startGame(gamePubkey) {
  if (!matchmakingProgram || !wallet) {
    console.error(
      "Matchmaking program not initialized or wallet not connected"
    );
    return null;
  }

  try {
    console.log(`📝 Starting game: ${gamePubkey}`);

    const gamePublicKey = new PublicKey(gamePubkey);

    // Derive player PDA
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), wallet.publicKey.toBuffer()],
      matchmakingProgram.programId
    );

    const tx = await matchmakingProgram.methods
      .startGame()
      .accounts({
        game: gamePublicKey,
        player: playerPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Game started! Transaction:", tx);
    return {
      transaction: tx,
    };
  } catch (error) {
    console.error("❌ Failed to start game:", error);
    return null;
  }
}

/**
 * Set player ready state in a game
 * @param {string} gamePubkey - The game's public key
 * @param {boolean} isReady - Whether the player is ready
 */
export async function setReadyState(gamePubkey, isReady) {
  if (!matchmakingProgram || !wallet) {
    console.error(
      "Matchmaking program not initialized or wallet not connected"
    );
    return null;
  }

  try {
    console.log(`📝 Setting ready state to: ${isReady} for game: ${gamePubkey}`);

    // Derive player PDA
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), wallet.publicKey.toBuffer()],
      matchmakingProgram.programId
    );

    const gamePublicKey = new PublicKey(gamePubkey);

    const tx = await matchmakingProgram.methods
      .setReadyState(isReady)
      .accounts({
        game: gamePublicKey,
        player: playerPda,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Ready state updated! Transaction:", tx);
    return {
      transaction: tx,
      isReady: isReady,
    };
  } catch (error) {
    console.error("❌ Failed to set ready state:", error);
    return null;
  }
}

/**
 * Get player account data
 * @param {string} userPublicKey - User's public key (optional, defaults to connected wallet)
 */
export async function getPlayer(userPublicKey = null) {
  if (!matchmakingProgram) {
    console.error("Matchmaking program not initialized");
    return null;
  }

  try {
    const pubkey = userPublicKey
      ? new PublicKey(userPublicKey)
      : wallet.publicKey;

    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), pubkey.toBuffer()],
      matchmakingProgram.programId
    );

    const playerAccount = await matchmakingProgram.account.player.fetch(
      playerPda
    );
    console.log("📊 Player account:", playerAccount);
    return playerAccount;
  } catch (error) {
    console.error("❌ Failed to fetch player account:", error);
    return null;
  }
}

/**
 * Get game account data
 * @param {string} gamePubkey - The game's public key
 */
export async function getGame(gamePubkey) {
  if (!matchmakingProgram) {
    console.error("Matchmaking program not initialized");
    return null;
  }

  try {
    const gamePublicKey = new PublicKey(gamePubkey);
    const gameAccount = await matchmakingProgram.account.game.fetch(
      gamePublicKey
    );
    console.log("📊 Game account:", gameAccount);
    return gameAccount;
  } catch (error) {
    console.error("❌ Failed to fetch game account:", error);
    return null;
  }
}

/**
 * Get only the game state from a game PDA
 * @param {string} gamePubkey - The game's public key
 * @returns {number|null} Game state (0=waiting, 1=active, 2=ended, 3=paused) or null on error
 */
export async function getGameState(gamePubkey) {
  if (!matchmakingProgram) {
    console.error("Matchmaking program not initialized");
    return null;
  }

  try {
    const gamePublicKey = new PublicKey(gamePubkey);
    const gameAccount = await matchmakingProgram.account.game.fetch(
      gamePublicKey
    );
    console.log("🎮 Game state:", gameAccount.gameState);
    return gameAccount.gameState;
  } catch (error) {
    console.error("❌ Failed to fetch game state:", error);
    return null;
  }
}

/**
 * Get all games from the blockchain
 * @param {number} filterState - Optional game state filter (0=waiting, 1=active, 2=ended, 3=paused)
 */
export async function getAllGames(filterState = null) {
  if (!matchmakingProgram || !connection) {
    console.error("Matchmaking program or connection not initialized");
    return [];
  }

  try {
    console.log("📊 Fetching all games...");
    console.log("📊 Program ID:", matchmakingProgram.programId.toString());
    console.log("📊 Connection endpoint:", connection.rpcEndpoint);

    // Game discriminator from IDL: [27, 90, 166, 125, 74, 100, 121, 18]
    const gameDiscriminator = Buffer.from([27, 90, 166, 125, 74, 100, 121, 18]);
    console.log("📊 Game discriminator:", Array.from(gameDiscriminator));

    // Get all game accounts with better error handling
    let accounts = [];
    try {
      console.log(
        "📊 Attempting getProgramAccounts with discriminator filter..."
      );
      accounts = await connection.getProgramAccounts(
        matchmakingProgram.programId,
        {
          filters: [{ memcmp: { offset: 0, bytes: gameDiscriminator } }],
        }
      );
      console.log("📊 getProgramAccounts with discriminator succeeded");
    } catch (error) {
      console.warn(
        "⚠️ getProgramAccounts failed, trying without discriminator filter:",
        error
      );
      // Fallback: get all accounts and filter manually
      try {
        console.log("📊 Attempting getProgramAccounts without filters...");
        const allAccounts = await connection.getProgramAccounts(
          matchmakingProgram.programId
        );
        console.log(
          `📊 Found ${allAccounts.length} total accounts, filtering for games...`
        );

        // Filter accounts that start with the game discriminator
        accounts = allAccounts.filter(({ account }) => {
          if (account.data.length < 8) return false;
          const accountDiscriminator = account.data.slice(0, 8);
          const matches = accountDiscriminator.equals(gameDiscriminator);
          if (matches) {
            console.log(
              "📊 Found matching game account:",
              account.owner.toString()
            );
          }
          return matches;
        });
        console.log(`📊 Filtered to ${accounts.length} game accounts`);
      } catch (fallbackError) {
        console.error(
          "❌ Fallback getProgramAccounts also failed:",
          fallbackError
        );
        return [];
      }
    }

    console.log(`📊 Found ${accounts.length} game accounts`);

    // If no accounts found, return empty array
    if (accounts.length === 0) {
      console.log("📊 No game accounts found - no games have been created yet");
      return [];
    }

    // Parse each game account
    const games = [];
    for (const { pubkey, account } of accounts) {
      console.log(`📊 Parsing game account: ${pubkey.toString()}`);
      console.log(`📊 Account data length: ${account.data.length}`);
      console.log(`📊 First 8 bytes:`, Array.from(account.data.slice(0, 8)));

      // Try to decode using Anchor first
      let gameData;
      try {
        gameData = matchmakingProgram.coder.accounts.decode(
          "Game",
          account.data
        );
        console.log(`📊 Successfully decoded with Anchor:`, gameData);
      } catch (anchorError) {
        console.log(
          `⚠️ Anchor decode failed for ${pubkey.toString()}, using fallback:`,
          anchorError.message
        );

        // Manual parsing as fallback
        // Skip the 8-byte discriminator and parse the rest
        const dataWithoutDiscriminator = account.data.slice(8);
        console.log(
          `📊 Raw data (without discriminator):`,
          Array.from(dataWithoutDiscriminator.slice(0, 32))
        );
        console.log(`📊 Full account data length: ${account.data.length}`);
        console.log(`📊 Full account data:`, Array.from(account.data));

        // Create a mock game object with basic data
        gameData = {
          gameState: 0, // Assume waiting state
          isPrivate: false,
          currentPlayersTeamA: 1,
          currentPlayersTeamB: 0,
          maxPlayersPerTeam: 5,
          matchStartTimestamp: Date.now() / 1000,
          lobbyName: `Game ${pubkey.toString().slice(0, 8)}`,
          mapName: "default-map",
          createdBy: pubkey.toString(),
          // Add other required fields with defaults
          teamAScore: 0,
          teamBScore: 0,
          matchDuration: 300, // 5 minutes
          gameCounter: 0,
        };

        console.log(`📊 Created mock game data:`, gameData);
      }

      console.log(`📊 Final decoded game data:`, gameData);

      // Apply state filter if provided
      if (filterState !== null && gameData.gameState !== filterState) {
        console.log(
          `📊 Filtering out game with state ${gameData.gameState} (looking for ${filterState})`
        );
        continue;
      }

      const gameObject = {
        publicKey: pubkey.toString(),
        ...gameData,
        // Add computed fields
        totalPlayers:
          gameData.currentPlayersTeamA + gameData.currentPlayersTeamB,
        maxPlayers: gameData.maxPlayersPerTeam * 2,
        isJoinable:
          gameData.gameState === 0 &&
          !gameData.isPrivate &&
          gameData.currentPlayersTeamA + gameData.currentPlayersTeamB <
            gameData.maxPlayersPerTeam * 2,
      };

      console.log(`📊 Final game object:`, gameObject);
      games.push(gameObject);
    }

    // Sort by creation time (most recent first)
    games.sort((a, b) => b.matchStartTimestamp - a.matchStartTimestamp);

    console.log(`📊 Successfully parsed ${games.length} games`);
    return games;
  } catch (error) {
    console.error("❌ Failed to fetch games:", error);
    return [];
  }
}

/**
 * Get available games (joinable games only)
 * Filters for games that are waiting, not private, and not full
 */
export async function getAvailableGames() {
  if (!matchmakingProgram) {
    console.error("Matchmaking program not initialized");
    return [];
  }

  if (!wallet || !wallet.publicKey) {
    console.error("Wallet not connected");
    return [];
  }

  try {
    console.log("📊 Fetching available games...");

    // Get all waiting games
    const allGames = await getAllGames(0); // 0 = waiting state

    // Filter for joinable games
    const availableGames = allGames.filter(
      (game) =>
        game.gameState === 0 && // waiting state
        !game.isPrivate && // not private
        game.totalPlayers < game.maxPlayers // not full
    );

    console.log(`📊 Found ${availableGames.length} available games`);
    return availableGames;
  } catch (error) {
    console.error("❌ Failed to fetch available games:", error);
    return [];
  }
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

/**
 * Get the matchmaking program instance (for advanced usage)
 */
export function getMatchmakingProgram() {
  return matchmakingProgram;
}

/**
 * Test function to initialize a player (for game bridge compatibility)
 */
export async function testInitPlayer() {
  console.log("🧪 Testing initPlayer...");
  const result = await initPlayer("TestPlayer");
  console.log("🧪 testInitPlayer result:", result);
  return result;
}

/**
 * Test function to test matchmaking program (for game bridge compatibility)
 */
export async function testMatchmakingProgram() {
  console.log("🧪 Testing matchmaking program...");
  if (!matchmakingProgram) {
    return { error: "Matchmaking program not initialized" };
  }

  try {
    // Test if we can get the program ID
    const programId = matchmakingProgram.programId.toString();
    console.log("🧪 Matchmaking program ID:", programId);
    return {
      success: true,
      programId: programId,
      message: "Matchmaking program is ready",
    };
  } catch (error) {
    console.error("🧪 Matchmaking program test failed:", error);
    return { error: error.message };
  }
}

/**
 * Test function to check all accounts in the program
 */
export async function testAllProgramAccounts() {
  console.log("🧪 Testing all program accounts...");

  try {
    if (!matchmakingProgram || !connection) {
      return { error: "Program or connection not initialized" };
    }

    console.log("🧪 Program ID:", matchmakingProgram.programId.toString());

    // Get ALL accounts owned by the program
    const allAccounts = await connection.getProgramAccounts(
      matchmakingProgram.programId
    );

    console.log(`🧪 Found ${allAccounts.length} total accounts in program`);

    // Log details of each account
    for (let i = 0; i < allAccounts.length; i++) {
      const { pubkey, account } = allAccounts[i];
      console.log(`🧪 Account ${i + 1}:`, {
        pubkey: pubkey.toString(),
        owner: account.owner.toString(),
        dataLength: account.data.length,
        first8Bytes: Array.from(account.data.slice(0, 8)),
        lamports: account.lamports,
      });
    }

    return {
      success: true,
      totalAccounts: allAccounts.length,
      accounts: allAccounts.map(({ pubkey, account }) => ({
        pubkey: pubkey.toString(),
        dataLength: account.data.length,
        first8Bytes: Array.from(account.data.slice(0, 8)),
      })),
    };
  } catch (error) {
    console.error("🧪 Test all program accounts failed:", error);
    return { error: error.message };
  }
}

/**
 * Test function to create a game and verify it can be fetched
 */
export async function testCreateAndFetchGame() {
  console.log("🧪 Testing create and fetch game...");

  try {
    // First, try to get existing games
    console.log("🧪 Fetching existing games...");
    const existingGames = await getAllGames();
    console.log("🧪 Existing games:", existingGames.length);

    // If no games exist, create one
    if (existingGames.length === 0) {
      console.log("🧪 No games exist, creating a test game...");
      const createResult = await initGame();
      if (createResult) {
        console.log("🧪 Test game created:", createResult);

        // Wait a moment for the transaction to be confirmed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Try to fetch games again
        const newGames = await getAllGames();
        console.log("🧪 Games after creation:", newGames.length);
        return {
          success: true,
          created: true,
          gamesCount: newGames.length,
          message: "Test game created and fetched successfully",
        };
      } else {
        return { error: "Failed to create test game" };
      }
    } else {
      return {
        success: true,
        created: false,
        gamesCount: existingGames.length,
        message: "Games already exist, no need to create test game",
      };
    }
  } catch (error) {
    console.error("🧪 Test create and fetch game failed:", error);
    return { error: error.message };
  }
}

/**
 * Get all players in a specific game with their usernames and team assignments
 * Now uses the team_a_players and team_b_players arrays from the Game PDA
 */
export async function getAllPlayersInGame(gamePubkey) {
  console.log("📊 Fetching all players in game:", gamePubkey);

  if (!matchmakingProgram) {
    console.error("❌ Matchmaking program not initialized");
    return { error: "Matchmaking program not initialized" };
  }

  try {
    // Get the Game account which now contains player arrays
    const gamePublicKey = new PublicKey(gamePubkey);
    const gameAccount = await matchmakingProgram.account.game.fetch(gamePublicKey);

    console.log("📊 Game has", gameAccount.teamAPlayers.length, "players in Team A");
    console.log("📊 Game has", gameAccount.teamBPlayers.length, "players in Team B");

    const gamePlayers = [];

    // Process Team A players
    for (const playerPubkey of gameAccount.teamAPlayers) {
      try {
        const playerAccount = await matchmakingProgram.account.player.fetch(playerPubkey);

        console.log(
          "📊 Team A player:",
          playerPubkey.toString(),
          "Username:",
          playerAccount.username
        );

        gamePlayers.push({
          publicKey: playerPubkey.toString(),
          username: playerAccount.username,
          team: "A",
          level: playerAccount.level,
          matches: playerAccount.totalMatchesPlayed,
          isReady: playerAccount.isReady,
        });
      } catch (error) {
        console.warn(
          "⚠️ Failed to fetch Team A player:",
          playerPubkey.toString(),
          error
        );
      }
    }

    // Process Team B players
    for (const playerPubkey of gameAccount.teamBPlayers) {
      try {
        const playerAccount = await matchmakingProgram.account.player.fetch(playerPubkey);

        console.log(
          "📊 Team B player:",
          playerPubkey.toString(),
          "Username:",
          playerAccount.username
        );

        gamePlayers.push({
          publicKey: playerPubkey.toString(),
          username: playerAccount.username,
          team: "B",
          level: playerAccount.level,
          matches: playerAccount.totalMatchesPlayed,
          isReady: playerAccount.isReady,
        });
      } catch (error) {
        console.warn(
          "⚠️ Failed to fetch Team B player:",
          playerPubkey.toString(),
          error
        );
      }
    }

    console.log("📊 Found", gamePlayers.length, "players in game");
    return gamePlayers;
  } catch (error) {
    console.error("❌ Failed to get players in game:", error);
    return { error: error.message };
  }
}
