/**
 * Ephemeral Wallet Manager
 * Creates and manages an ephemeral wallet stored in IndexedDB for high-performance
 * Magicblock transactions while keeping the main wallet for funding
 */

import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

const DB_NAME = "fpsdotso-wallets";
const DB_VERSION = 1;
const STORE_NAME = "ephemeral-keypairs";
const KEYPAIR_KEY = "current-ephemeral-keypair";

// Global state
let ephemeralKeypair = null;
let mainWallet = null;

/**
 * Open IndexedDB connection
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save keypair to IndexedDB
 * @param {Uint8Array} secretKey - The secret key bytes
 */
async function saveKeypairToDB(secretKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(Array.from(secretKey), KEYPAIR_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load keypair from IndexedDB
 * @returns {Uint8Array|null} The secret key bytes or null if not found
 */
async function loadKeypairFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(KEYPAIR_KEY);

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        resolve(new Uint8Array(result));
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Initialize or load the ephemeral wallet
 * @param {Object} wallet - The main wallet (Phantom/Solflare adapter)
 * @returns {Object} Ephemeral wallet info
 */
export async function initializeEphemeralWallet(wallet) {
  try {
    console.log("🔑 Initializing ephemeral wallet...");
    mainWallet = wallet;

    // Try to load existing keypair
    let secretKey = await loadKeypairFromDB();

    if (secretKey) {
      console.log("✅ Loaded existing ephemeral wallet from IndexedDB");
      ephemeralKeypair = Keypair.fromSecretKey(secretKey);
    } else {
      console.log("🆕 Creating new ephemeral wallet...");
      ephemeralKeypair = Keypair.generate();
      await saveKeypairToDB(ephemeralKeypair.secretKey);
      console.log("✅ Created and saved new ephemeral wallet");
    }

    return {
      publicKey: ephemeralKeypair.publicKey.toString(),
      isNew: !secretKey,
    };
  } catch (error) {
    console.error("❌ Failed to initialize ephemeral wallet:", error);
    throw error;
  }
}

/**
 * Get the current ephemeral keypair
 * @returns {Keypair|null}
 */
export function getEphemeralKeypair() {
  return ephemeralKeypair;
}

/**
 * Get the ephemeral wallet public key
 * @returns {string|null}
 */
export function getEphemeralPublicKey() {
  return ephemeralKeypair ? ephemeralKeypair.publicKey.toString() : null;
}

/**
 * Check the balance of the ephemeral wallet
 * @param {Connection} connection - Solana connection
 * @returns {number} Balance in SOL
 */
export async function getEphemeralBalance(connection) {
  if (!ephemeralKeypair) {
    throw new Error("Ephemeral wallet not initialized");
  }

  const balance = await connection.getBalance(ephemeralKeypair.publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Fund the ephemeral wallet from the main wallet
 * @param {Connection} connection - Solana connection
 * @param {number} amountSol - Amount to transfer in SOL
 * @returns {string} Transaction signature
 */
export async function fundEphemeralWallet(connection, amountSol) {
  if (!ephemeralKeypair) {
    throw new Error("Ephemeral wallet not initialized");
  }

  if (!mainWallet || !mainWallet.publicKey) {
    throw new Error("Main wallet not connected");
  }

  try {
    console.log(`💰 Funding ephemeral wallet with ${amountSol} SOL...`);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: mainWallet.publicKey,
        toPubkey: ephemeralKeypair.publicKey,
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = mainWallet.publicKey;

    // Sign and send with main wallet
    const signed = await mainWallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());

    console.log("✅ Funding transaction sent:", signature);

    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("✅ Funding transaction confirmed");
    return signature;
  } catch (error) {
    console.error("❌ Failed to fund ephemeral wallet:", error);
    throw error;
  }
}

/**
 * Delete the ephemeral wallet from IndexedDB
 * Useful for creating a fresh wallet
 */
export async function deleteEphemeralWallet() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(KEYPAIR_KEY);

    request.onsuccess = () => {
      ephemeralKeypair = null;
      console.log("✅ Ephemeral wallet deleted");
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get wallet info for display
 * @param {Connection} connection - Solana connection
 * @returns {Object} Wallet information
 */
export async function getWalletInfo(connection) {
  if (!ephemeralKeypair || !mainWallet) {
    return null;
  }

  const balance = await getEphemeralBalance(connection);

  return {
    mainWallet: mainWallet.publicKey.toString(),
    ephemeralWallet: ephemeralKeypair.publicKey.toString(),
    ephemeralBalance: balance,
  };
}
