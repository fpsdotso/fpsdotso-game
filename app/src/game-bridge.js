/**
 * Game Bridge - Provides functions that the Emscripten game can call
 * This module exposes JavaScript functions to the WASM game through
 * the Emscripten Module interface.
 */

import * as solanaBridge from "./solana-bridge";
import websocketGameManager from "./websocket-game-manager";
import { publicKey, u64, bool } from "@solana/buffer-layout-utils";
import * as BufferLayout from "@solana/buffer-layout";
import { debug } from "./utils/debug-config";

const { u32, u8, struct, f32 } = BufferLayout;

// Track last logged positions to reduce spam
const lastLoggedPositions = {};

// Track previous bullet counts to detect shooting
const previousBulletCounts = {};

// Track if we've played a sound recently for a player (debounce)
const recentSoundPlays = {};

/**
 * Play 3D positional audio for other players shooting
 * @param {number} x - X position of the sound
 * @param {number} y - Y position of the sound
 * @param {number} z - Z position of the sound
 * @param {string} playerPubkey - Player public key for debouncing
 */
function play3DShootingSound(x, y, z, playerPubkey) {
  // Debounce: Don't play sound if we just played it for this player (within 100ms)
  const now = Date.now();
  if (recentSoundPlays[playerPubkey] && now - recentSoundPlays[playerPubkey] < 100) {
    return;
  }
  recentSoundPlays[playerPubkey] = now;

  // Call Rust function to play 3D sound at the player's location
  if (window.gameBridge && window.gameBridge.play3DSound) {
    window.gameBridge.play3DSound('shoot', x, y, z);
    debug.log('AUDIO', `🔊 Playing 3D shooting sound at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}) for player ${playerPubkey.slice(0, 8)}`);
  } else {
    // Fallback: Play 2D sound if 3D audio not available
    console.log(`🔊 Would play 3D shooting sound at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
  }
}

/**
 * GamePlayer account layout for Borsh deserialization
 * Matches the Rust struct from the game program
 */
const GamePlayerLayout = struct([
  publicKey("authority"), // 32 bytes
  publicKey("gameId"), // 32 bytes
  f32("position_x"), // 4 bytes
  f32("position_y"), // 4 bytes
  f32("position_z"), // 4 bytes
  f32("rotation_x"), // 4 bytes
  f32("rotation_y"), // 4 bytes
  f32("rotation_z"), // 4 bytes
  u8("health"), // 1 byte
  bool("is_alive"), // 1 byte
  u8("team"), // 1 byte
  bool("is_spectator"), // 1 byte
  u32("kills"), // 4 bytes
  u32("deaths"), // 4 bytes
  u32("score"), // 4 bytes
  u64("last_update"), // 8 bytes
  u64("death_timestamp"), // 8 bytes
  u8("bullet_count"), // 1 byte - Current ammo (max 10)
  u64("reload_start_timestamp"), // 8 bytes - Reload start time (0 if not reloading)
  u8("bump"), // 1 byte
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

  // Expose functions to the game through window.gameBridge
  window.gameBridge = {
    // UI update callbacks (set by React App)
    onAmmoUpdate: null,
    onReloadStatusUpdate: null,

    // Solana functions
    registerKill: async (killer, victim) => {
      debug.log(
        "GAME_BRIDGE",
        `[Game Bridge] registerKill called: ${killer} -> ${victim}`
      );
      return await solanaBridge.registerKill(killer, victim);
    },

    getPlayerStats: async (playerId) => {
      debug.log(
        "GAME_BRIDGE",
        `[Game Bridge] getPlayerStats called: ${playerId}`
      );
      return await solanaBridge.getPlayerStats(playerId);
    },

    connectWallet: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] connectWallet called");
      return await solanaBridge.connectWallet();
    },

    getBalance: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] getBalance called");
      return await solanaBridge.getBalance();
    },

    createGame: async (lobbyName, mapName) => {
      debug.log(
        "GAME_BRIDGE",
        `[Game Bridge] createGame called: ${lobbyName} on ${mapName}`
      );
      const result = await solanaBridge.createGame(lobbyName, mapName);
      debug.log("GAME_BRIDGE", "[Game Bridge] createGame result:", result);
      return result;
    },

    testInitPlayer: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] testInitPlayer called");
      const result = await solanaBridge.testInitPlayer();
      debug.log("GAME_BRIDGE", "[Game Bridge] testInitPlayer result:", result);
      return result;
    },

    testMatchmakingProgram: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] testMatchmakingProgram called");
      const result = await solanaBridge.testMatchmakingProgram();
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] testMatchmakingProgram result:",
        result
      );
      return result;
    },

    testCreateAndFetchGame: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] testCreateAndFetchGame called");
      const result = await solanaBridge.testCreateAndFetchGame();
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] testCreateAndFetchGame result:",
        result
      );
      return result;
    },

    testAllProgramAccounts: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] testAllProgramAccounts called");
      const result = await solanaBridge.testAllProgramAccounts();
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] testAllProgramAccounts result:",
        result
      );
      return result;
    },

    getAvailableGames: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] getAvailableGames called");
      const result = await solanaBridge.getAvailableGames();
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] getAvailableGames result:",
        result
      );
      return result;
    },

    getPlayerCurrentGame: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] getPlayerCurrentGame called");
      const result = await solanaBridge.getPlayerCurrentGame();
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] getPlayerCurrentGame result:",
        result
      );
      return result;
    },

    leaveCurrentGame: async () => {
      debug.log("GAME_BRIDGE", "[Game Bridge] leaveCurrentGame called");
      const result = await solanaBridge.leaveCurrentGame();
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] leaveCurrentGame result:",
        result
      );
      return result;
    },

    // Utility functions
    isSolanaReady: () => {
      return solanaBridge.isSolanaClientReady();
    },

    // Example: Send a message from game to UI
    sendMessage: (message) => {
      debug.log("GAME_BRIDGE", `[Game Message]: ${message}`);
      // Dispatch custom event that React can listen to
      window.dispatchEvent(new CustomEvent("gameMessage", { detail: message }));
    },

    // Lobby functions
    joinGame: async (gamePubkey) => {
      debug.log("GAME_BRIDGE", "[Game Bridge] joinGame called:", gamePubkey);
      const result = await solanaBridge.joinGame(gamePubkey);
      debug.log("GAME_BRIDGE", "[Game Bridge] joinGame result:", result);
      return result;
    },

    startGame: async (gamePubkey) => {
      debug.log("GAME_BRIDGE", "[Game Bridge] startGame called:", gamePubkey);
      const result = await solanaBridge.startGame(gamePubkey);
      debug.log("GAME_BRIDGE", "[Game Bridge] startGame result:", result);
      return result;
    },

    getGame: async (gamePubkey) => {
      debug.log("GAME_BRIDGE", "[Game Bridge] getGame called:", gamePubkey);
      const result = await solanaBridge.getGame(gamePubkey);
      debug.log("GAME_BRIDGE", "[Game Bridge] getGame result:", result);
      return result;
    },

    getAllPlayersInGame: async (gamePubkey) => {
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] getAllPlayersInGame called:",
        gamePubkey
      );
      const result = await solanaBridge.getAllPlayersInGame(gamePubkey);
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] getAllPlayersInGame result:",
        result
      );
      return result;
    },

    setReadyState: async (gamePubkey, isReady) => {
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] setReadyState called:",
        gamePubkey,
        isReady
      );
      const result = await solanaBridge.setReadyState(gamePubkey, isReady);
      debug.log("GAME_BRIDGE", "[Game Bridge] setReadyState result:", result);
      return result;
    },

    getMapDataById: async (mapId) => {
      debug.log("GAME_BRIDGE", "[Game Bridge] getMapDataById called:", mapId);
      const result = await solanaBridge.getMapData(mapId, "borsh");
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] getMapDataById result:",
        result ? `${result.length} bytes` : "null"
      );

      // The Rust game expects Module.mapDataResult to be set with base64-encoded data
      if (result && window.Module) {
        try {
          // Convert Uint8Array to base64 string
          const base64 = btoa(String.fromCharCode.apply(null, result));
          // Set Module.mapDataResult as JSON string expected by Rust
          window.Module.mapDataResult = JSON.stringify({
            success: true,
            data: base64,
          });
          debug.log(
            "GAME_BRIDGE",
            "[Game Bridge] ✅ Set Module.mapDataResult with",
            result.length,
            "bytes as base64"
          );
        } catch (error) {
          debug.error(
            "[Game Bridge] ❌ Failed to set Module.mapDataResult:",
            error
          );
          window.Module.mapDataResult = JSON.stringify({
            error: error.message,
          });
        }
      } else if (!result) {
        debug.warn("GAME_BRIDGE", "[Game Bridge] ⚠️ No map data to set");
        if (window.Module) {
          window.Module.mapDataResult = JSON.stringify({
            error: "Failed to fetch map data",
          });
        }
      }

      return result;
    },

    // Get map objects data (for spawn points, etc.) - returns parsed game objects
    getMapObjectsData: async (mapId) => {
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] getMapObjectsData called:",
        mapId
      );
      try {
        const result = await solanaBridge.getMapData(mapId, "gameObjects");
        debug.log(
          "GAME_BRIDGE",
          "[Game Bridge] getMapObjectsData result:",
          result ? `${result.length} objects` : "null"
        );
        return result;
      } catch (error) {
        debug.error("[Game Bridge] ❌ getMapObjectsData failed:", error);
        return null;
      }
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
      console.log(
        `[Game Bridge] shootPlayer called: damage=${damage}, targets=${
          otherPlayerPdas?.length || 0
        }`
      );
      return await solanaBridge.shootPlayer(damage, gameId, otherPlayerPdas);
    },

    awardKill: async (scorePoints, gameId) => {
      console.log(`[Game Bridge] awardKill called: points=${scorePoints}`);
      return await solanaBridge.awardKill(scorePoints, gameId);
    },

    respawnPlayer: async (gameId, spawnX, spawnY, spawnZ) => {
      console.log(
        `[Game Bridge] respawnPlayer called: spawn=(${spawnX}, ${spawnY}, ${spawnZ})`
      );
      return await solanaBridge.respawnPlayer(gameId, spawnX, spawnY, spawnZ);
    },

    // Reload functions (two-step process with 1 second delay)
    startReload: async (gameId) => {
      return await solanaBridge.startReload(gameId);
    },

    finishReload: async (gameId) => {
      return await solanaBridge.finishReload(gameId);
    },

    // Function for Rust to manually update UI with current bullet count
    updateUIAmmo: (bulletCount) => {
      // Store globally for Rust to read
      window.___current_player_bullet_count = bulletCount;

      if (window.gameBridge?.onAmmoUpdate) {
        window.gameBridge.onAmmoUpdate(bulletCount);
      }
    },

    // Function for Rust to manually update UI with reload status
    updateUIReloadStatus: (isReloading) => {
      if (window.gameBridge?.onReloadStatusUpdate) {
        window.gameBridge.onReloadStatusUpdate(isReloading);
      }
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
          return [];
        }

        // Filter out current player and return PDAs (using publicKey property)
        const otherPlayers = allPlayers
          .filter((player) => player.authority !== currentEphemeralKey)
          .map((player) => player.publicKey);

        return otherPlayers;
      } catch (error) {
        console.error("[Game Bridge] Error getting other player PDAs:", error);
        return [];
      }
    },

    // Game mode control functions
    startGameMode: () => {
      if (window.Module && window.Module._start_game) {
        try {
          window.Module._start_game();
        } catch (error) {
          console.error("[Game Bridge] ❌ Error calling _start_game:", error);
        }
      } else {
        console.warn("⚠️ Module._start_game not available");
      }
    },

    // Settings bridge (JS overlay → Rust via globals polled in main.rs)
    openSettings: () => {
      try {
        window.__settings_open = true;
      } catch (e) {
        console.warn("Failed to open settings:", e);
      }
    },
    closeSettings: () => {
      try {
        window.__settings_open = false;
      } catch (e) {
        console.warn("Failed to close settings:", e);
      }
    },
    getMouseSensitivity: () => {
      try {
        if (typeof window.__mouse_sensitivity === "number") {
          return window.__mouse_sensitivity;
        }
        const saved = localStorage.getItem("mouseSensitivity");
        if (saved != null) return parseFloat(saved);
      } catch (e) {}
      return 0.006; // slightly lower default sensitivity
    },
    setMouseSensitivity: (value) => {
      try {
        window.__mouse_sensitivity = Number(value);
        try {
          localStorage.setItem("mouseSensitivity", String(value));
        } catch (_) {}
      } catch (e) {
        console.warn("Failed to set sensitivity:", e);
      }
    },

    stopGameMode: () => {
      if (window.Module && window.Module._stop_game) {
        window.Module._stop_game();
      } else {
        debug.warn("GAME_BRIDGE", "⚠️ Module._stop_game not available");
      }
    },

    setCurrentGame: (gamePubkey) => {
      debug.log(
        "GAME_BRIDGE",
        "[Game Bridge] setCurrentGame called:",
        gamePubkey
      );
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
        debug.warn(
          "GAME_BRIDGE",
          "⚠️ Module._set_current_game_js not available"
        );
      }
    },

    // WebSocket real-time game state functions
    connectWebSocket: async () => {
      debug.log("WEBSOCKET", "[Game Bridge] connectWebSocket called");
      try {
        await websocketGameManager.connect();
        return { success: true };
      } catch (error) {
        debug.error("[Game Bridge] Failed to connect WebSocket:", error);
        return { success: false, error: error.message };
      }
    },

    disconnectWebSocket: () => {
      debug.log("WEBSOCKET", "[Game Bridge] disconnectWebSocket called");
      websocketGameManager.disconnect();
      return { success: true };
    },

    subscribeToGamePlayers: async (gamePubkey) => {
      debug.log(
        "WEBSOCKET",
        "[Game Bridge] subscribeToGamePlayers called:",
        gamePubkey
      );
      try {
        // First, get all players in the game
        // Retry mechanism: GamePlayer accounts might not be created immediately when game starts
        let players = [];
        let retryCount = 0;
        const maxRetries = 10;

        while (players.length === 0 && retryCount < maxRetries) {
          players = await solanaBridge.getGamePlayers(gamePubkey);
          debug.log(
            "WEBSOCKET",
            `[Game Bridge] Attempt ${retryCount + 1}: Found ${
              players.length
            } players to subscribe to`
          );

          if (players.length === 0 && retryCount < maxRetries - 1) {
            debug.log(
              "WEBSOCKET",
              `[Game Bridge] No players found yet, waiting 1 second before retry...`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          retryCount++;
        }

        if (players.length === 0) {
          console.warn(
            "[Game Bridge] No GamePlayer accounts found after retries. Players may need to ready up first."
          );
          return { success: false, error: "No players found" };
        }

        console.log(
          "[Game Bridge] Successfully found",
          players.length,
          "players after",
          retryCount,
          "attempts"
        );

        // Extract GamePlayer account public keys
        const gamePlayerPubkeys = players.map((p) => p.publicKey);

        // Subscribe to all GamePlayer accounts via WebSocket
        await websocketGameManager.subscribeToGamePlayers(
          gamePlayerPubkeys,
          async (accountPubkey, accountData) => {
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
                  decodedData = Buffer.from(accountDataRaw[0], "base64");
                } else if (typeof accountDataRaw === "string") {
                  // Base64 encoded string
                  decodedData = Buffer.from(accountDataRaw, "base64");
                }

                if (decodedData) {
                  try {
                    // Deserialize using @solana/buffer-layout
                    // Skip 8-byte discriminator, then decode the rest using our layout
                    const dataWithoutDiscriminator = decodedData.slice(8);
                    const rawData = GamePlayerLayout.decode(
                      dataWithoutDiscriminator
                    );

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
                      isSpectator: rawData.is_spectator,
                      kills: rawData.kills,
                      deaths: rawData.deaths,
                      score: rawData.score,
                      lastUpdate: Number(rawData.last_update), // Convert BigInt to Number
                      deathTimestamp: Number(rawData.death_timestamp), // Convert BigInt to Number
                      bulletCount: rawData.bullet_count, // Current ammo (max 10)
                      reloadStartTimestamp: Number(
                        rawData.reload_start_timestamp
                      ), // Reload start time (0 if not reloading)
                      bump: rawData.bump,
                    };

                    // 🎯 CHECK IF DATA CHANGED (compare position to reduce console spam)
                    const posKey = `${gamePlayerData.positionX.toFixed(
                      2
                    )},${gamePlayerData.positionY.toFixed(
                      2
                    )},${gamePlayerData.positionZ.toFixed(2)}`;
                    const lastPos = lastLoggedPositions[accountPubkey];
                    const dataChanged = lastPos !== posKey;

                  if (dataChanged) {
                    lastLoggedPositions[accountPubkey] = posKey;
                    const totalPlayers = Object.keys(window.___websocket_player_updates).length;
                    debug.log('PLAYER_UPDATES', `[WebSocket] 📡 Player ${accountPubkey.slice(0, 8)} | Pos(${gamePlayerData.positionX.toFixed(1)}, ${gamePlayerData.positionY.toFixed(1)}, ${gamePlayerData.positionZ.toFixed(1)}) | Rot(${gamePlayerData.rotationY.toFixed(2)}) | Team ${gamePlayerData.team} | HP ${gamePlayerData.health} | Alive: ${gamePlayerData.isAlive} | Ammo: ${gamePlayerData.bulletCount} | Reload: ${gamePlayerData.reloadStartTimestamp} | Total: ${totalPlayers} players`);
                  }

                  // 🔫 DETECT SHOOTING: Check if bullet count decreased
                  const previousBulletCount = previousBulletCounts[accountPubkey];
                  if (previousBulletCount !== undefined && gamePlayerData.bulletCount < previousBulletCount) {
                    // Bullet count decreased = player shot!
                    // Check if this is NOT the current player (we don't play sound for our own shots)
                    try {
                      const currentPlayerEphemeralKey = solanaBridge.getCurrentPlayerEphemeralKey();
                      if (!currentPlayerEphemeralKey || gamePlayerData.authority !== currentPlayerEphemeralKey) {
                        // This is another player shooting - play 3D sound at their location
                        debug.log('AUDIO', `🔫 Player ${accountPubkey.slice(0, 8)} shot! Ammo: ${previousBulletCount} → ${gamePlayerData.bulletCount}`);
                        play3DShootingSound(
                          gamePlayerData.positionX,
                          gamePlayerData.positionY,
                          gamePlayerData.positionZ,
                          accountPubkey
                        );
                      }
                    } catch (err) {
                      // Ephemeral wallet not initialized yet, assume it's another player
                      play3DShootingSound(
                        gamePlayerData.positionX,
                        gamePlayerData.positionY,
                        gamePlayerData.positionZ,
                        accountPubkey
                      );
                    }
                  }
                  // Store current bullet count for next comparison
                  previousBulletCounts[accountPubkey] = gamePlayerData.bulletCount;

                    // Store the decoded data
                    window.___websocket_player_updates[accountPubkey] = {
                      timestamp: Date.now(),
                      data: accountData,
                      parsed: gamePlayerData, // Include parsed data (with BigInt converted to Number)
                    };

                    // 🎯 UPDATE UI IF THIS IS THE CURRENT PLAYER
                    // Check if this is the current player (by comparing ephemeral wallet authority)
                    try {
                      const currentPlayerEphemeralKey =
                        solanaBridge.getCurrentPlayerEphemeralKey();
                      if (
                        currentPlayerEphemeralKey &&
                        gamePlayerData.authority === currentPlayerEphemeralKey
                      ) {
                        // Update bullet count in UI
                        if (window.gameBridge?.onAmmoUpdate) {
                          window.gameBridge.onAmmoUpdate(
                            gamePlayerData.bulletCount
                          );
                        }

                        // Update reload status in UI
                        if (window.gameBridge?.onReloadStatusUpdate) {
                          const isReloading =
                            gamePlayerData.reloadStartTimestamp > 0;
                          window.gameBridge.onReloadStatusUpdate(isReloading);
                        }

                        // 🎯 CRITICAL: Store current player's bullet count in a global variable
                        // This makes it easy for the Rust game to access via JavaScript
                        window.___current_player_bullet_count =
                          gamePlayerData.bulletCount;
                        window.___current_player_reload_timestamp =
                          gamePlayerData.reloadStartTimestamp;

                        //console.log(`[Game Bridge] 🔫 Current player ammo updated: ${gamePlayerData.bulletCount}/10, reloading: ${gamePlayerData.reloadStartTimestamp > 0}`);
                      }
                    } catch (err) {
                      // Ephemeral wallet not initialized yet, skip UI update
                    }
                  } catch (decodeError) {
                    console.error(
                      "[Game Bridge] ⚠️ Decoder failed:",
                      decodeError.message
                    );
                    console.error("[Game Bridge] Stack:", decodeError.stack);
                    console.error(
                      "[Game Bridge] Data length:",
                      decodedData?.length,
                      "bytes"
                    );
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
              console.error(
                "[Game Bridge] ❌ Failed to decode account data:",
                error
              );
              // Store raw data as fallback
              window.___websocket_player_updates[accountPubkey] = {
                timestamp: Date.now(),
                data: accountData,
              };
            }
          }
        );

        console.log("[Game Bridge] Subscribed to all GamePlayer accounts");
        return { success: true, playerCount: players.length };
      } catch (error) {
        console.error(
          "[Game Bridge] Failed to subscribe to game players:",
          error
        );
        return { success: false, error: error.message };
      }
    },

    unsubscribeFromGamePlayers: async (gamePubkey) => {
      console.log(
        "[Game Bridge] unsubscribeFromGamePlayers called:",
        gamePubkey
      );
      try {
        // Get all players in the game
        const players = await solanaBridge.getGamePlayers(gamePubkey);
        const gamePlayerPubkeys = players.map((p) => p.publicKey);

        // Unsubscribe from all GamePlayer accounts
        await websocketGameManager.unsubscribeFromGamePlayers(
          gamePlayerPubkeys
        );

        console.log("[Game Bridge] Unsubscribed from all GamePlayer accounts");
        return { success: true };
      } catch (error) {
        console.error(
          "[Game Bridge] Failed to unsubscribe from game players:",
          error
        );
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
          console.log(
            `    Pos: (${p.positionX || p.position_x}, ${
              p.positionY || p.position_y
            }, ${p.positionZ || p.position_z})`
          );
          console.log(
            `    Rot: (${p.rotationX || p.rotation_x}, ${
              p.rotationY || p.rotation_y
            }, ${p.rotationZ || p.rotation_z})`
          );
          console.log(
            `    Health: ${p.health}, Team: ${p.team}, Alive: ${
              p.isAlive || p.is_alive
            }`
          );
          console.log(
            `    Age: ${((Date.now() - update.timestamp) / 1000).toFixed(
              1
            )}s ago`
          );
        } else {
          console.log(`  Player ${accountPubkey.slice(0, 8)}... (not decoded)`);
        }
      }
      console.log("==========================================");
    },

    /**
     * Play 3D positional audio
     * This function should be implemented by Rust to play audio at a specific location
     * @param {string} soundName - Name of the sound to play (e.g., 'shoot', 'reload', 'hit')
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} z - Z position
     */
    play3DSound: (soundName, x, y, z) => {
      console.log(`🔊 [Game Bridge] play3DSound stub called: ${soundName} at (${x}, ${y}, ${z})`);
      console.log(`⚠️ This should be implemented in Rust to play actual 3D audio`);
      // This is a stub - the actual implementation should be in Rust/raylib
      // Rust should replace this function with a real implementation that uses raylib audio
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
