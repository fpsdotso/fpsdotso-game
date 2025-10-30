import React, { useEffect, useState } from "react";
import "./App.css";
import "./styles/toast.css";
import toast, { Toaster } from "react-hot-toast";
import {
  initSolanaClient,
  connectWallet,
  getBalance,
  initPlayer,
  getPlayer,
  getAllGames,
  getAvailableGames,
  joinGame,
  joinAsSpectator,
  createGame,
  getPlayerCurrentGame,
  getGame,
  getAllPlayersInGame,
  setReadyState,
  startGame,
  leaveCurrentGame,
  getGameState,
} from "./solana-bridge";
import { initGameBridge, onGameMessage } from "./game-bridge";
import EphemeralWalletPanel from "./components/EphemeralWalletPanel";
import LobbyBrowser from "./components/LobbyBrowser";
import LobbyRoom from "./components/LobbyRoom";
import Minimap from "./components/Minimap";
import MatchStatus from "./components/MatchStatus";
import RespawnOverlay from "./components/RespawnOverlay";
import VirtualJoystick from "./components/VirtualJoystick";
import VictoryDialog from "./components/VictoryDialog";
import PauseMenu from "./components/PauseMenu";
import SettingsPanel from "./components/SettingsPanel";
import DebugConsole from "./components/DebugConsole";

// NOTE: This app is configured to connect to Solana LOCALNET only
// RPC URL is hardcoded to http://127.0.0.1:8899 in solana-bridge.js

import * as solanaBridge from "./solana-bridge";

// Polyfill Buffer for browser environment (required by Solana/Anchor)
import { Buffer } from "buffer";
window.Buffer = Buffer;

// Expose Solana bridge globally for Rust/Emscripten to access
window.solanaMapBridge = {
  createMap: solanaBridge.createMap,
  getUserMaps: solanaBridge.getUserMaps,
  getMapData: solanaBridge.getMapData,
  getMapMetadata: solanaBridge.getMapMetadata,
};

function App() {
  const [solanaReady, setSolanaReady] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);
  const [gameMessages, setGameMessages] = useState([]);
  const [playerInitialized, setPlayerInitialized] = useState(false);
  const [playerData, setPlayerData] = useState(null);
  const [playerUsername, setPlayerUsername] = useState("");
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [showGameBrowser, setShowGameBrowser] = useState(false); // Don't show lobby by default

  // Lobby state
  const [inLobby, setInLobby] = useState(false);
  const [currentLobbyData, setCurrentLobbyData] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isLobbyLeader, setIsLobbyLeader] = useState(false);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState("lobby"); // 'lobby', 'store', 'mapeditor'

  // Game state tracking
  const [currentGameState, setCurrentGameState] = useState(null); // 0=waiting, 1=active, 2=ended, 3=paused
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Victory dialog state
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [victoryData, setVictoryData] = useState(null);

  // Pause menu state
  const [isPaused, setIsPaused] = useState(false);

  // Ammo and reload state
  const [bulletCount, setBulletCount] = useState(10); // Start with full magazine
  const [isReloading, setIsReloading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sensitivity, setSensitivity] = useState(() => {
    const stored = localStorage.getItem("sensitivity");
    return stored ? parseFloat(stored) : 1.0;
  });
  const [musicEnabled, setMusicEnabled] = useState(() => {
    const stored = localStorage.getItem("musicEnabled");
    return stored !== null ? stored === "true" : true;
  });

  // Save settings to localStorage/global on change
  useEffect(() => {
    localStorage.setItem("sensitivity", sensitivity.toString());
    window.sensitivity = sensitivity;
  }, [sensitivity]);
  useEffect(() => {
    localStorage.setItem("musicEnabled", musicEnabled.toString());
    window.musicEnabled = musicEnabled;
    // Optionally, trigger music on/off here (call your music player)
    if (typeof window.toggleMusic === "function")
      window.toggleMusic(musicEnabled);
  }, [musicEnabled]);

  // Settings panel toggle by 'M' key
  useEffect(() => {
    const handler = (evt) => {
      if (evt.key && (evt.key === "m" || evt.key === "M")) {
        evt.preventDefault();
        setSettingsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Set up ammo and reload callbacks for Rust game to call
  // IMPORTANT: This must run whenever gameBridge changes
  useEffect(() => {
    const setupCallbacks = () => {
      if (window.gameBridge) {
        window.gameBridge.onAmmoUpdate = (bulletCount) => {
          setBulletCount(bulletCount);
        };

        window.gameBridge.onReloadStatusUpdate = (isReloading) => {
          setIsReloading(isReloading);
        };
        return true;
      }
      return false;
    };

    // Try to set up callbacks immediately
    if (!setupCallbacks()) {
      // If gameBridge isn't ready, poll for it
      const interval = setInterval(() => {
        if (setupCallbacks()) {
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    async function init() {
      // Step 1: Initialize Solana connection
      console.log("🚀 Initializing Solana connection...");
      const solanaSuccess = await initSolanaClient();
      setSolanaReady(solanaSuccess);

      // Step 2: Initialize game bridge
      console.log("🎮 Setting up game bridge...");
      initGameBridge();

      // Step 3: Load the game
      const canvas = document.getElementById("canvas");
      if (!canvas) {
        console.error("Canvas element not found!");
        return;
      }

      // Define the Module object for Emscripten
      window.Module = {
        canvas: canvas,
        locateFile: function (path) {
          // Handle WASM file
          if (path.endsWith(".wasm")) {
            // Add cache busting to force reload of WASM file
            const timestamp = Date.now();
            return `${process.env.PUBLIC_URL}/fpsdotso_game.wasm?t=${timestamp}`;
          }
          // Handle .data file (preloaded assets including cyber.fbx)
          if (path.endsWith(".data")) {
            const timestamp = Date.now();
            console.log("📦 Loading assets data file:", path);
            return `${process.env.PUBLIC_URL}/fpsdotso_game.data?t=${timestamp}`;
          }
          return path;
        },
        onRuntimeInitialized: () => {
          console.log("✅ Game runtime initialized");
          setGameReady(true);
          // Re-initialize game bridge now that Module is ready
          initGameBridge();
        },
      };

      // Load the game script
      const existingScript = document.querySelector(
        `script[src="${process.env.PUBLIC_URL}/fpsdotso-game.js"]`
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = `${process.env.PUBLIC_URL}/fpsdotso-game.js`;
        script.async = true;
        document.body.appendChild(script);

        return () => {
          document.body.removeChild(script);
        };
      }
    }

    init();

    // Listen for messages from the game
    onGameMessage((message) => {
      setGameMessages((prev) => [...prev, message]);
    });
  }, []);

  // Auto-refresh games when game browser is open
  useEffect(() => {
    if (!showGameBrowser || !walletConnected) return;

    const interval = setInterval(() => {
      loadGames();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [showGameBrowser, walletConnected]);

  // Auto-refresh lobby data when in lobby
  useEffect(() => {
    if (!inLobby || !currentLobbyData?.gamePublicKey) return;

    const refreshLobbyData = async () => {
      try {
        // Check if the game has ended
        const gameState = await getGameState(currentLobbyData.gamePublicKey);
        console.log("🔄 Refreshing lobby, game state:", gameState);

        // If game has ended (state 2), prompt user to leave
        if (gameState === 2) {
          console.log("🏁 Game has ended, prompting user to leave...");

          // Show confirmation dialog
          const shouldLeave = window.confirm(
            "This game has ended. Would you like to leave and return to the lobby browser?\n\n" +
              "(This will require a wallet transaction to remove you from the game)"
          );

          if (shouldLeave) {
            try {
              await leaveCurrentGame();
              console.log("✅ Left ended game");

              // Clear lobby state
              setInLobby(false);
              setCurrentLobbyData(null);
              setPlayerReady(false);
              setIsLobbyLeader(false);
              setCurrentGameState(null);

              // Disconnect WebSocket if connected
              try {
                if (
                  window.gameBridge &&
                  window.gameBridge.disconnectWebSocket
                ) {
                  window.gameBridge.disconnectWebSocket();
                }
              } catch (error) {
                console.error("❌ Error disconnecting WebSocket:", error);
              }

              // Refresh games list
              await loadGames();

              alert("You have been removed from the ended game.");
            } catch (error) {
              console.error("❌ Error leaving game:", error);
              alert("Failed to leave game: " + error.message);
            }
          }
          return; // Stop further processing whether they left or not
        }

        const players = await getAllPlayersInGame(
          currentLobbyData.gamePublicKey
        );

        console.log("🔄 Refreshing lobby data, players:", players);

        const teamAPlayers = players
          .filter((p) => p.team === "A" && !p.isSpectator)
          .map((p) => p.username);
        const teamBPlayers = players
          .filter((p) => p.team === "B" && !p.isSpectator)
          .map((p) => p.username);
        const spectators = players
          .filter((p) => p.isSpectator)
          .map((p) => p.username);
        const teamAReady = players
          .filter((p) => p.team === "A" && !p.isSpectator)
          .map((p) => p.isReady);
        const teamBReady = players
          .filter((p) => p.team === "B" && !p.isSpectator)
          .map((p) => p.isReady);

        console.log(
          "🔄 Ready states - Team A:",
          teamAReady,
          "Team B:",
          teamBReady
        );

        setCurrentLobbyData((prev) => ({
          ...prev,
          teamA: teamAPlayers,
          teamB: teamBPlayers,
          spectators: spectators,
          teamAReady: teamAReady,
          teamBReady: teamBReady,
        }));
      } catch (error) {
        console.warn("⚠️ Failed to refresh lobby data:", error);
      }
    };

    // Initial refresh
    refreshLobbyData();

    // Set up interval for periodic refresh
    const interval = setInterval(refreshLobbyData, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [inLobby, currentLobbyData?.gamePublicKey]);

  // Monitor game state and switch to fullscreen when game starts
  useEffect(() => {
    if (!inLobby || !currentLobbyData?.gamePublicKey) return;

    const checkGameState = async () => {
      try {
        const gameState = await getGameState(currentLobbyData.gamePublicKey);
        console.log("🎮 Current game state:", gameState);

        if (gameState !== null && gameState !== currentGameState) {
          setCurrentGameState(gameState);

          // Game state 1 = active (game has started)
          if (gameState === 1) {
            console.log(
              "🎮 Game has started! Switching to fullscreen gameplay..."
            );

            // Switch to map editor tab (where game canvas is)
            setActiveTab("mapeditor");

            // Set the current game in Raylib for multiplayer sync
            if (
              window.gameBridge &&
              window.gameBridge.setCurrentGame &&
              currentLobbyData?.gamePublicKey
            ) {
              window.gameBridge.setCurrentGame(currentLobbyData.gamePublicKey);
              console.log("✅ Set current game pubkey in Raylib");
            }

            // Initialize WebSocket connection and subscribe to game players
            // Store critical data in closure variables to prevent stale closure issues
            const gamePubkeyForConnection = currentLobbyData.gamePublicKey;
            const mapNameForConnection = currentLobbyData.mapName;

            console.log("🎮 Captured data for game initialization:");
            console.log("   - Game Pubkey:", gamePubkeyForConnection);
            console.log("   - Map Name:", mapNameForConnection);
            console.log("   - Full lobby data:", currentLobbyData);

            // This is run as an immediately invoked async function
            (async () => {
              try {
                console.log(
                  "🔌 ========== GAME START INITIALIZATION =========="
                );
                console.log(
                  "🔌 window.gameBridge available:",
                  !!window.gameBridge
                );
                console.log(
                  "🔌 connectWebSocket available:",
                  !!(window.gameBridge && window.gameBridge.connectWebSocket)
                );
                console.log(
                  "🔌 subscribeToGamePlayers available:",
                  !!(
                    window.gameBridge &&
                    window.gameBridge.subscribeToGamePlayers
                  )
                );
                console.log("🔌 Game Public Key:", gamePubkeyForConnection);
                console.log("🔌 Map Name:", mapNameForConnection);

                // Wait for gameBridge to be available if it's not ready yet
                let waitAttempts = 0;
                while (!window.gameBridge && waitAttempts < 20) {
                  console.log(
                    `⏳ Waiting for gameBridge... (attempt ${waitAttempts + 1})`
                  );
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  waitAttempts++;
                }

                if (!window.gameBridge) {
                  console.error("❌ gameBridge not available after waiting!");
                  setInLobby(false);
                  return;
                }

                // Connect to WebSocket
                if (window.gameBridge.connectWebSocket) {
                  console.log("🔌 [STEP 1] Calling connectWebSocket...");
                  const wsResult = await window.gameBridge.connectWebSocket();
                  console.log(
                    "✅ [STEP 1] WebSocket connect result:",
                    wsResult
                  );
                } else {
                  console.error(
                    "❌ [STEP 1] gameBridge.connectWebSocket not available!"
                  );
                }

                // Small delay to ensure WebSocket is ready
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Subscribe to game players
                if (
                  window.gameBridge.subscribeToGamePlayers &&
                  gamePubkeyForConnection
                ) {
                  console.log(
                    "📡 [STEP 2] Calling subscribeToGamePlayers for game:",
                    gamePubkeyForConnection
                  );
                  await window.gameBridge.subscribeToGamePlayers(
                    gamePubkeyForConnection
                  );
                  console.log("✅ [STEP 2] Subscribed to game players");
                } else {
                  console.error(
                    "❌ [STEP 2] gameBridge.subscribeToGamePlayers not available or no game pubkey!"
                  );
                }

                // Load the map data from blockchain
                if (
                  window.gameBridge &&
                  window.gameBridge.getMapDataById
                ) {
                  // Use the captured mapNameForConnection variable to avoid stale closure
                  const mapToLoad = mapNameForConnection || "Default Map";
                  console.log(
                    "🗺️ [STEP 3] Loading map from blockchain:",
                    mapToLoad,
                    "(original mapName from lobby:",
                    mapNameForConnection,
                    ")"
                  );
                  const mapData = await window.gameBridge.getMapDataById(
                    mapToLoad
                  );
                  if (mapData) {
                    console.log(
                      "✅ [STEP 3] Map data loaded, length:",
                      mapData ? mapData.length : 0
                    );
                    // Wait a bit for the Rust side to fully process the map
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                  } else {
                    console.warn("⚠️ [STEP 3] No map data returned for map:", mapToLoad);
                  }
                } else {
                  console.warn("⚠️ [STEP 3] gameBridge or getMapDataById not available for map loading");
                }

                // Now that everything is set up, tell Raylib game to switch to playing mode
                if (window.gameBridge && window.gameBridge.startGameMode) {
                  window.gameBridge.startGameMode();
                  console.log(
                    "✅ Called startGameMode - game should now be in Playing mode"
                  );
                } else {
                  console.warn("⚠️ gameBridge.startGameMode not available");
                }

                // Exit lobby view AFTER WebSocket is connected and everything is initialized
                setInLobby(false);
                console.log("✅ Exited lobby view after game initialization");
              } catch (error) {
                console.error("❌ Error initializing game connection:", error);
                // Even on error, exit lobby to prevent getting stuck
                setInLobby(false);
              }
            })();

            // Enter fullscreen mode
            enterFullscreen();
          }
          // Game state 2 = ended
          else if (gameState === 2) {
            console.log("🏁 Game has ended");

            // Fetch final game data to get the winning team
            const finalGameData = await getGame(currentLobbyData.gamePublicKey);
            if (
              finalGameData &&
              finalGameData.winningTeam !== null &&
              finalGameData.winningTeam !== undefined
            ) {
              const winningTeamName =
                finalGameData.winningTeam === 1
                  ? "Team A (Blue)"
                  : "Team B (Red)";
              const winningColor =
                finalGameData.winningTeam === 1 ? "#00d9ff" : "#ff4444";
              console.log(`🏆 ${winningTeamName} won the match!`);

              // Show victory message
              const victoryMessage = document.createElement("div");
              victoryMessage.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(20, 20, 30, 0.95);
                border: 3px solid ${winningColor};
                border-radius: 16px;
                padding: 40px 60px;
                z-index: 10000;
                text-align: center;
                box-shadow: 0 0 50px ${winningColor};
              `;
              victoryMessage.innerHTML = `
                <h1 style="color: ${winningColor}; font-size: 48px; margin: 0 0 20px 0; text-shadow: 0 0 20px ${winningColor};">
                  🏆 VICTORY! 🏆
                </h1>
                <p style="color: white; font-size: 32px; margin: 0;">
                  ${winningTeamName} Wins!
                </p>
                <p style="color: #c8c8dc; font-size: 16px; margin: 20px 0 0 0;">
                  Final Score: Team A ${finalGameData.teamAKills || 0} - ${
                finalGameData.teamBKills || 0
              } Team B
                </p>
              `;
              document.body.appendChild(victoryMessage);

              // Remove victory message after 5 seconds
              setTimeout(() => {
                document.body.removeChild(victoryMessage);
              }, 5000);
            }

            // Tell Raylib game to switch back to menu mode
            if (window.gameBridge && window.gameBridge.stopGameMode) {
              window.gameBridge.stopGameMode();
            }

            exitFullscreen();
            setInLobby(false);
            setCurrentLobbyData(null);
          }
        }
      } catch (error) {
        console.warn("⚠️ Failed to check game state:", error);
      }
    };

    // Check immediately
    checkGameState();

    // Poll game state every 2 seconds
    const interval = setInterval(checkGameState, 2000);

    return () => clearInterval(interval);
  }, [inLobby, currentLobbyData?.gamePublicKey, currentGameState]);

  // Fullscreen functions
  const enterFullscreen = () => {
    const container = document.getElementById("container");
    const canvas = document.getElementById("canvas");
    if (container && !isFullscreen) {
      if (container.requestFullscreen) {
        container
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            console.log("✅ Entered fullscreen mode");
            // Lock the mouse pointer when entering fullscreen
            if (canvas && canvas.requestPointerLock) {
              canvas.requestPointerLock();
              console.log("✅ Mouse pointer locked");
            }
          })
          .catch((err) => {
            console.error("❌ Failed to enter fullscreen:", err);
          });
      } else if (container.webkitRequestFullscreen) {
        // Safari
        container.webkitRequestFullscreen();
        setIsFullscreen(true);
        // Lock the mouse pointer for Safari
        if (canvas && canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      } else if (container.mozRequestFullScreen) {
        // Firefox
        container.mozRequestFullScreen();
        setIsFullscreen(true);
        // Lock the mouse pointer for Firefox
        if (canvas && canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      } else if (container.msRequestFullscreen) {
        // IE/Edge
        container.msRequestFullscreen();
        setIsFullscreen(true);
        // Lock the mouse pointer for IE/Edge
        if (canvas && canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      }
    }
  };

  const exitFullscreen = () => {
    if (isFullscreen) {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => {
            setIsFullscreen(false);
            console.log("✅ Exited fullscreen mode");
          })
          .catch((err) => {
            console.error("❌ Failed to exit fullscreen:", err);
          });
      } else if (document.webkitExitFullscreen) {
        // Safari
        document.webkitExitFullscreen();
        setIsFullscreen(false);
      } else if (document.mozCancelFullScreen) {
        // Firefox
        document.mozCancelFullScreen();
        setIsFullscreen(false);
      } else if (document.msExitFullscreen) {
        // IE/Edge
        document.msExitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listen for fullscreen changes (user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      setIsFullscreen(isCurrentlyFullscreen);

      // If user exited fullscreen during gameplay and game is paused, try to re-enter
      if (!isCurrentlyFullscreen && currentGameState === 1 && isPaused) {
        console.log("⚠️ Fullscreen exited while paused, re-entering...");
        // Re-enter fullscreen after a short delay
        setTimeout(() => {
          enterFullscreen();
        }, 100);
      } else if (!isCurrentlyFullscreen && currentGameState === 1) {
        console.log("⚠️ User exited fullscreen during gameplay");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, [currentGameState, isPaused]);

  // Listen for ESC key to toggle pause menu during gameplay
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle ESC key when in active gameplay (not in lobby, not showing victory dialog)
      if (
        event.key === "Escape" &&
        currentGameState === 1 &&
        !inLobby &&
        !showVictoryDialog
      ) {
        event.preventDefault();
        event.stopPropagation();

        setIsPaused((prev) => {
          const newPauseState = !prev;
          console.log(newPauseState ? "⏸️ Game paused" : "▶️ Game resumed");

          // Tell Rust game to pause/unpause
          if (window.gameBridge) {
            if (newPauseState && window.gameBridge.stopGameMode) {
              // Pause: stop game mode (releases mouse, etc.)
              window.gameBridge.stopGameMode();
            } else if (!newPauseState && window.gameBridge.startGameMode) {
              // Resume: start game mode again
              window.gameBridge.startGameMode();
            }
          }

          return newPauseState;
        });
      }
    };

    // Only add listener when in active gameplay (not in lobby)
    if (currentGameState === 1 && !inLobby) {
      // Use capture phase to intercept ESC before fullscreen handler
      document.addEventListener("keydown", handleKeyDown, true);
      return () => {
        document.removeEventListener("keydown", handleKeyDown, true);
      };
    }
  }, [currentGameState, inLobby, showVictoryDialog]);

  const handleConnectWallet = async () => {
    const result = await connectWallet();
    if (result && result.connected) {
      setWalletConnected(true);
      setWalletAddress(result.publicKey);
      const bal = await getBalance();
      setBalance(bal);

      // Check if player already exists
      try {
        const playerInfo = await getPlayer();
        if (playerInfo) {
          setPlayerInitialized(true);
          setPlayerData(playerInfo);
          console.log("✅ Existing player found:", playerInfo);

          // Check if player is already in a game - pass the wallet address
          await checkPlayerInGame(playerInfo, result.publicKey);
        }
      } catch (error) {
        console.log("ℹ️ No existing player found");
      }
    }
  };

  // Check if player is already in a game and auto-open lobby
  const checkPlayerInGame = async (playerInfo, currentWalletAddress) => {
    try {
      const currentGamePubkey = await getPlayerCurrentGame();
      if (currentGamePubkey) {
        console.log("🎮 Player is already in game:", currentGamePubkey);

        // Check if the game has ended
        const gameState = await getGameState(currentGamePubkey);
        console.log("🔍 Checking existing game state:", gameState);

        if (gameState === 2) {
          console.log("🏁 Player is in an ended game, prompting to leave...");

          // Show confirmation dialog
          const shouldLeave = window.confirm(
            "You are still in a game that has ended. Would you like to leave it now?\n\n" +
              "(This will require a wallet transaction to remove you from the game)"
          );

          if (shouldLeave) {
            try {
              await leaveCurrentGame();
              console.log("✅ Left ended game on reconnect");
              alert("You have been removed from the ended game.");
            } catch (error) {
              console.error("❌ Error leaving ended game:", error);
              alert("Failed to leave game: " + error.message);
            }
          } else {
            // If they decline, still don't rejoin the lobby - just show them lobby browser
            console.log("ℹ️ User declined to leave ended game");
          }
          return; // Don't rejoin the lobby either way
        }

        // Fetch game data
        const gameData = await getGame(currentGamePubkey);
        if (gameData) {
          console.log("📊 Game data:", gameData);

          // Fetch all players in the game
          const players = await getAllPlayersInGame(currentGamePubkey);
          console.log("👥 Players in game:", players);

          // Separate players into teams and spectators
          const teamAPlayers = players
            .filter((p) => p.team === "A" && !p.isSpectator)
            .map((p) => p.username);
          const teamBPlayers = players
            .filter((p) => p.team === "B" && !p.isSpectator)
            .map((p) => p.username);
          const spectators = players
            .filter((p) => p.isSpectator)
            .map((p) => p.username);
          const teamAReady = players
            .filter((p) => p.team === "A" && !p.isSpectator)
            .map((p) => p.isReady);
          const teamBReady = players
            .filter((p) => p.team === "B" && !p.isSpectator)
            .map((p) => p.isReady);

          // Determine if current player is the leader
          const createdByString = gameData.createdBy?.toString();
          const currentWalletString = currentWalletAddress; // Use passed wallet address
          console.log("👑 Leadership check (auto-rejoin):", {
            createdBy: createdByString,
            currentWallet: currentWalletString,
            isLeader: createdByString === currentWalletString,
          });
          const isLeader = createdByString === currentWalletString;

          // Check if game is already active (started)
          if (gameState === 1) {
            console.log("🎮 Game is already active, initializing gameplay...");

            // Set game state first
            setCurrentGameState(1);

            // Store lobby data for the active game
            const lobbyData = {
              gamePublicKey: currentGamePubkey,
              lobbyName: gameData.lobbyName || "Game Lobby",
              mapName: gameData.mapName || gameData.mapId || "Default Map",
              maxPlayers: gameData.maxPlayersPerTeam * 2,
            };
            setCurrentLobbyData(lobbyData);

            // Don't set inLobby to true - we're going straight to gameplay
            setInLobby(false);
            setActiveTab("mapeditor");

            // Initialize game connection asynchronously
            setTimeout(async () => {
              try {
                // Set current game in Raylib
                if (window.gameBridge && window.gameBridge.setCurrentGame) {
                  window.gameBridge.setCurrentGame(currentGamePubkey);
                  console.log("✅ Set current game pubkey in Raylib");
                }

                // Connect WebSocket
                if (window.gameBridge && window.gameBridge.connectWebSocket) {
                  await window.gameBridge.connectWebSocket();
                  console.log("✅ WebSocket connected on reconnect");
                }

                // Subscribe to game players
                if (
                  window.gameBridge &&
                  window.gameBridge.subscribeToGamePlayers
                ) {
                  await window.gameBridge.subscribeToGamePlayers(
                    currentGamePubkey
                  );
                  console.log("✅ Subscribed to game players on reconnect");
                }

                // Load map
                if (window.gameBridge && window.gameBridge.getMapDataById) {
                  const mapName = gameData.mapName || gameData.mapId;
                  console.log("🗺️ Loading map from blockchain:", mapName);
                  const mapData = await window.gameBridge.getMapDataById(
                    mapName
                  );
                  if (mapData) {
                    console.log("✅ Map data loaded on reconnect");
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                  }
                }

                // Start game mode
                if (window.gameBridge && window.gameBridge.startGameMode) {
                  window.gameBridge.startGameMode();
                  console.log("✅ Started game mode on reconnect");
                }

                // Enter fullscreen
                enterFullscreen();
              } catch (error) {
                console.error(
                  "❌ Error initializing game on reconnect:",
                  error
                );
              }
            }, 500);
          } else {
            // Game is waiting (state 0), rejoin lobby normally
            setInLobby(true);
            setIsLobbyLeader(isLeader);
            setPlayerReady(playerInfo.isReady || false);
            setCurrentLobbyData({
              gamePublicKey: currentGamePubkey,
              lobbyName: gameData.lobbyName || "Game Lobby",
              mapName: gameData.mapName || gameData.mapId || "Default Map",
              maxPlayers: gameData.maxPlayersPerTeam * 2,
              teamA: teamAPlayers,
              teamB: teamBPlayers,
              spectators: spectators,
              teamAReady: teamAReady,
              teamBReady: teamBReady,
            });

            // Switch to lobby tab
            setActiveTab("lobby");
            console.log("✅ Auto-opened lobby for existing game");
          }
        }
      }
    } catch (error) {
      console.log("ℹ️ Player not in any game:", error.message);
    }
  };

  const handleRefreshBalance = async () => {
    const bal = await getBalance();
    setBalance(bal);
  };

  const handleInitPlayer = async () => {
    if (!playerUsername.trim()) {
      alert("Please enter a username");
      return;
    }

    try {
      console.log("🎮 Initializing player:", playerUsername);
      const result = await initPlayer(playerUsername);
      if (result) {
        setPlayerInitialized(true);
        console.log("✅ Player initialized successfully:", result);
        // Fetch player data to display
        const playerInfo = await getPlayer();
        setPlayerData(playerInfo);
      } else {
        console.error("❌ Failed to initialize player");
        alert("Failed to initialize player. Check console for details.");
      }
    } catch (error) {
      console.error("❌ Error initializing player:", error);
      alert("Error initializing player: " + error.message);
    }
  };

  const handleCheckPlayer = async () => {
    try {
      const playerInfo = await getPlayer();
      setPlayerData(playerInfo);
      if (playerInfo) {
        setPlayerInitialized(true);
        console.log("✅ Player data fetched:", playerInfo);
      }
    } catch (error) {
      console.error("❌ Error fetching player data:", error);
    }
  };

  const loadGames = async () => {
    if (!walletConnected) {
      console.error("Wallet not connected");
      return;
    }

    setGamesLoading(true);
    try {
      console.log("🎮 Loading available games...");
      const availableGames = await getAvailableGames();
      setGames(availableGames);
      console.log(`✅ Loaded ${availableGames.length} games`);
    } catch (error) {
      console.error("❌ Error loading games:", error);
    } finally {
      setGamesLoading(false);
    }
  };

  const handleJoinGame = async (gamePublicKey) => {
    if (!playerInitialized) {
      alert("Please initialize your player first");
      return;
    }

    try {
      console.log(`🎮 Joining game: ${gamePublicKey}`);
      const result = await joinGame(gamePublicKey);
      if (result) {
        console.log("✅ Successfully joined game!");
        alert("Successfully joined the game!");
        // Refresh games list
        await loadGames();
      } else {
        console.error("❌ Failed to join game");
        alert("Failed to join game. Check console for details.");
      }
    } catch (error) {
      console.error("❌ Error joining game:", error);
      alert("Error joining game: " + error.message);
    }
  };

  const handleCreateGame = async () => {
    if (!playerInitialized) {
      alert("Please initialize your player first");
      return;
    }

    try {
      console.log("🎮 Creating new game...");
      const result = await createGame("My Lobby", "Default Map");
      if (result) {
        console.log("✅ Successfully created game!");
        alert("Successfully created game!");
        // Refresh games list
        await loadGames();
      } else {
        console.error("❌ Failed to create game");
        alert("Failed to create game. Check console for details.");
      }
    } catch (error) {
      console.error("❌ Error creating game:", error);
      alert("Error creating game: " + error.message);
    }
  };

  // Lobby handlers
  const handleCreateRoom = async (mapName, maxPlayers) => {
    if (!playerInitialized) {
      alert("Please initialize your player first");
      return;
    }

    // Use player's username as the room name
    const roomName = playerData?.username || playerUsername || walletAddress.slice(0, 8);

    try {
      console.log(`🎮 Creating room: ${roomName}'s Lobby with map: ${mapName}`);
      const result = await createGame(roomName, mapName);
      if (result) {
        console.log("✅ Successfully created room!");

        // Get the game public key from result
        const gamePubkey = result.gamePda || result.publicKey;
        console.log("📍 Game PDA:", gamePubkey);

        // Fetch actual game data and players
        if (gamePubkey) {
          const gameData = await getGame(gamePubkey);
          const players = await getAllPlayersInGame(gamePubkey);

          console.log("📊 Created game data:", gameData);
          console.log("👥 Players after creation:", players);

          const teamAPlayers = players
            .filter((p) => p.team === "A" && !p.isSpectator)
            .map((p) => p.username);
          const teamBPlayers = players
            .filter((p) => p.team === "B" && !p.isSpectator)
            .map((p) => p.username);
          const spectators = players
            .filter((p) => p.isSpectator)
            .map((p) => p.username);
          const teamAReady = players
            .filter((p) => p.team === "A" && !p.isSpectator)
            .map((p) => p.isReady);
          const teamBReady = players
            .filter((p) => p.team === "B" && !p.isSpectator)
            .map((p) => p.isReady);

          // Verify leadership against blockchain
          const createdByString = gameData.createdBy?.toString();
          const isLeader = createdByString === walletAddress;
          console.log("👑 Leadership check (create room):", {
            createdBy: createdByString,
            walletAddress: walletAddress,
            isLeader: isLeader,
          });

          setCurrentLobbyData({
            gamePublicKey: gamePubkey,
            lobbyName: roomName,
            mapName: mapName,
            maxPlayers: maxPlayers,
            teamA:
              teamAPlayers.length > 0
                ? teamAPlayers
                : [playerData?.username || walletAddress.slice(0, 8)],
            teamB: teamBPlayers,
            spectators: spectators,
            teamAReady: teamAReady.length > 0 ? teamAReady : [false],
            teamBReady: teamBReady,
          });

          // Enter the lobby
          setInLobby(true);
          setIsLobbyLeader(isLeader); // Use blockchain verification
        } else {
          // Fallback if we can't get game pubkey
          setCurrentLobbyData({
            lobbyName: roomName,
            mapName: mapName,
            maxPlayers: maxPlayers,
            teamA: [playerData?.username || walletAddress.slice(0, 8)],
            teamB: [],
            spectators: [],
            teamAReady: [false],
            teamBReady: [],
          });

          // Enter the lobby - assume leader if we created it
          setInLobby(true);
          setIsLobbyLeader(true);
        }
        await loadGames();
      }
    } catch (error) {
      console.error("❌ Error creating room:", error);
      alert("Error creating room: " + error.message);
    }
  };

  const handleJoinRoom = async (gamePublicKey) => {
    if (!playerInitialized) {
      alert("Please initialize your player first");
      return;
    }

    try {
      console.log(`🎮 Joining room: ${gamePublicKey}`);
      const result = await joinGame(gamePublicKey);

      console.log("🔍 Join game result:", result);

      if (result?.error === "PlayerAlreadyInGame") {
        console.warn("⚠️ Player already in game:", result.currentGame);
        alert(
          `You are already in a game (${result.currentGame}). Please leave that game first.`
        );
        return;
      }

      if (result && result.transaction) {
        console.log(
          "✅ Successfully joined room! Transaction:",
          result.transaction
        );

        // Wait a moment for transaction to be confirmed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Fetch actual game data and players from blockchain
        const gameData = await getGame(gamePublicKey);
        const players = await getAllPlayersInGame(gamePublicKey);

        console.log("📊 Game data:", gameData);
        console.log("👥 Players in game:", players);

        // Separate players into teams and spectators
        const teamAPlayers = players
          .filter((p) => p.team === "A" && !p.isSpectator)
          .map((p) => p.username);
        const teamBPlayers = players
          .filter((p) => p.team === "B" && !p.isSpectator)
          .map((p) => p.username);
        const spectators = players
          .filter((p) => p.isSpectator)
          .map((p) => p.username);
        const teamAReady = players
          .filter((p) => p.team === "A" && !p.isSpectator)
          .map((p) => p.isReady);
        const teamBReady = players
          .filter((p) => p.team === "B" && !p.isSpectator)
          .map((p) => p.isReady);

        // Determine if current player is the leader
        const createdByString = gameData.createdBy?.toString();
        console.log("👑 Leadership check (join room):", {
          createdBy: createdByString,
          walletAddress: walletAddress,
          isLeader: createdByString === walletAddress,
        });
        const isLeader = createdByString === walletAddress;

        setInLobby(true);
        setIsLobbyLeader(isLeader);
        setPlayerReady(false);
        setCurrentLobbyData({
          gamePublicKey: gamePublicKey,
          lobbyName: gameData.lobbyName || "Game Lobby",
          mapName: gameData.mapName || gameData.mapId || "Default Map",
          maxPlayers: gameData.maxPlayersPerTeam * 2,
          teamA: teamAPlayers,
          teamB: teamBPlayers,
          spectators: spectators,
          teamAReady: teamAReady,
          teamBReady: teamBReady,
        });
      } else {
        console.error("❌ Failed to join room: No transaction returned");
        alert(
          "Failed to join room. No transaction was created. Check console for details."
        );
      }
    } catch (error) {
      console.error("❌ Error joining room:", error);
      alert("Error joining room: " + error.message);
    }
  };

  const handleJoinAsSpectator = async (gamePublicKey) => {
    if (!playerInitialized) {
      alert("Please initialize your player first");
      return;
    }

    try {
      console.log(`👁️ Joining as spectator: ${gamePublicKey}`);
      const result = await joinAsSpectator(gamePublicKey);

      console.log("🔍 Join as spectator result:", result);

      if (result?.error === "PlayerAlreadyInGame") {
        console.warn("⚠️ Player already in game:", result.currentGame);
        alert(
          `You are already in a game (${result.currentGame}). Please leave that game first.`
        );
        return;
      }

      if (result && result.transaction) {
        console.log(
          "✅ Successfully joined as spectator! Transaction:",
          result.transaction
        );

        // Wait a moment for transaction to be confirmed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Fetch actual game data and players from blockchain
        const gameData = await getGame(gamePublicKey);
        const players = await getAllPlayersInGame(gamePublicKey);

        console.log("📊 Game data:", gameData);
        console.log("👥 Players in game:", players);

        // Separate players into teams and spectators
        const teamAPlayers = players
          .filter((p) => p.team === "A" && !p.isSpectator)
          .map((p) => p.username);
        const teamBPlayers = players
          .filter((p) => p.team === "B" && !p.isSpectator)
          .map((p) => p.username);
        const spectators = players
          .filter((p) => p.isSpectator)
          .map((p) => p.username);
        const teamAReady = players
          .filter((p) => p.team === "A" && !p.isSpectator)
          .map((p) => p.isReady);
        const teamBReady = players
          .filter((p) => p.team === "B" && !p.isSpectator)
          .map((p) => p.isReady);

        // Determine if current player is the leader
        const createdByString = gameData.createdBy?.toString();
        console.log("👑 Leadership check (join as spectator):", {
          createdBy: createdByString,
          walletAddress: walletAddress,
          isLeader: createdByString === walletAddress,
        });
        const isLeader = createdByString === walletAddress;

        setInLobby(true);
        setIsLobbyLeader(isLeader);
        setPlayerReady(false); // Spectators can't ready up
        setCurrentLobbyData({
          gamePublicKey: gamePublicKey,
          lobbyName: gameData.lobbyName || "Game Lobby",
          mapName: gameData.mapName || gameData.mapId || "Default Map",
          maxPlayers: gameData.maxPlayersPerTeam * 2,
          teamA: teamAPlayers,
          teamB: teamBPlayers,
          spectators: spectators,
          teamAReady: teamAReady,
          teamBReady: teamBReady,
        });
      } else {
        console.error(
          "❌ Failed to join as spectator: No transaction returned"
        );
        alert(
          "Failed to join as spectator. No transaction was created. Check console for details."
        );
      }
    } catch (error) {
      console.error("❌ Error joining as spectator:", error);
      alert("Error joining as spectator: " + error.message);
    }
  };

  const handleToggleReady = async () => {
    if (!currentLobbyData?.gamePublicKey) {
      console.error("No game public key available");
      return;
    }

    try {
      const newReadyState = !playerReady;
      console.log(`🎮 Setting ready state to: ${newReadyState}`);

      const result = await setReadyState(
        currentLobbyData.gamePublicKey,
        newReadyState
      );

      if (result) {
        setPlayerReady(newReadyState);
        console.log("✅ Ready state updated successfully");
      } else {
        console.error("❌ Failed to update ready state");
        alert("Failed to update ready state. Check console for details.");
      }
    } catch (error) {
      console.error("❌ Error updating ready state:", error);
      alert("Error updating ready state: " + error.message);
    }
  };

  const handleStartGame = async () => {
    if (!isLobbyLeader) return;
    if (!currentLobbyData?.gamePublicKey) {
      console.error("No game public key available");
      return;
    }

    try {
      console.log("🎮 Starting game...");
      const result = await startGame(currentLobbyData.gamePublicKey);

      if (result) {
        console.log("✅ Game started successfully!");
        // Don't set inLobby to false here - let the game state monitoring effect handle it
        // This ensures the host player also goes through the proper game initialization sequence
        console.log("⏳ Waiting for game state to change to active...");
      } else {
        console.error("❌ Failed to start game");
        alert("Failed to start game. Check console for details.");
      }
    } catch (error) {
      console.error("❌ Error starting game:", error);
      alert("Error starting game: " + error.message);
    }
  };

  const handleLeaveLobby = async () => {
    try {
      console.log("🚪 Leaving lobby...");

      // Disconnect WebSocket if connected
      try {
        if (window.gameBridge && window.gameBridge.disconnectWebSocket) {
          window.gameBridge.disconnectWebSocket();
          console.log("✅ WebSocket disconnected");
        }
      } catch (wsError) {
        console.error("❌ Error disconnecting WebSocket:", wsError);
      }

      const result = await leaveCurrentGame();

      if (result) {
        console.log("✅ Left lobby successfully");
        setInLobby(false);
        setCurrentLobbyData(null);
        setPlayerReady(false);
        setIsLobbyLeader(false);
        // Refresh games list
        await loadGames();
      } else if (result?.error === "NotInGame") {
        // Player is not in a game, just clear local state
        console.log("ℹ️ Not in a game, clearing local state");
        setInLobby(false);
        setCurrentLobbyData(null);
        setPlayerReady(false);
        setIsLobbyLeader(false);
      } else {
        console.error("❌ Failed to leave lobby");
        alert("Failed to leave lobby. Check console for details.");
      }
    } catch (error) {
      console.error("❌ Error leaving lobby:", error);
      alert("Error leaving lobby: " + error.message);
    }
  };

  // Handle quitting from pause menu during active game
  const handleQuitGame = async () => {
    try {
      console.log("🚪 Quitting game...");

      // Close pause menu
      setIsPaused(false);

      // Disconnect WebSocket
      try {
        if (window.gameBridge && window.gameBridge.disconnectWebSocket) {
          window.gameBridge.disconnectWebSocket();
          console.log("✅ WebSocket disconnected");
        }
      } catch (wsError) {
        console.error("❌ Error disconnecting WebSocket:", wsError);
      }

      // Leave the game on blockchain
      const result = await leaveCurrentGame();

      if (result || result?.error === "NotInGame") {
        console.log("✅ Left game successfully");
      }

      // Exit fullscreen and return to lobby browser
      exitFullscreen();
      setCurrentGameState(null);
      setInLobby(false);
      setCurrentLobbyData(null);
      setPlayerReady(false);
      setIsLobbyLeader(false);

      // Stop game mode in Raylib
      if (window.gameBridge && window.gameBridge.stopGameMode) {
        window.gameBridge.stopGameMode();
      }

      // Refresh games list
      await loadGames();
    } catch (error) {
      console.error("❌ Error quitting game:", error);
      alert("Error quitting game: " + error.message);
    }
  };

  return (
    <div id="container">
      {/* React Hot Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#fff',
            color: '#1a1a1a',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            padding: '16px',
          },
          success: {
            duration: 5000,
            iconTheme: {
              primary: '#14F195',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
          loading: {
            iconTheme: {
              primary: '#3b82f6',
              secondary: '#fff',
            },
          },
        }}
      />
      
      {/* Settings Panel (modal overlay) */}
      <SettingsPanel
        isOpen={settingsOpen}
        sensitivity={sensitivity}
        musicEnabled={musicEnabled}
        onClose={() => setSettingsOpen(false)}
        onSave={({ sensitivity, musicEnabled }) => {
          setSensitivity(sensitivity);
          setMusicEnabled(musicEnabled);
          setSettingsOpen(false);
        }}
      />
      {/* Game canvas - full screen background */}
      <canvas
        id="canvas"
        onContextMenu={(e) => e.preventDefault()}
        style={{
          display:
            activeTab === "mapeditor" || currentGameState === 1
              ? "block"
              : "none",
        }}
      ></canvas>

      {/* Virtual Joystick for mobile */}
      <VirtualJoystick
        isPlaying={currentGameState === 1}
        gameId={currentLobbyData?.gamePublicKey}
        sensitivity={sensitivity}
        onInput={(input) => console.log("Virtual joystick input:", input)}
      />

      {/* Web UI overlay */}
      <div
        className="web-ui-overlay"
        style={{
          pointerEvents:
            activeTab === "mapeditor" || currentGameState === 1
              ? "none"
              : "auto",
        }}
      >
        {/* Top Navigation Bar with Tabs - Hidden when in active game */}
        <nav
          className="game-nav"
          style={{
            pointerEvents: "auto",
            display: currentGameState === 1 ? "none" : "flex",
          }}
        >
          {/* Left: Logo and Tabs */}
          <div className="hud-top-left">
            <h1 className="game-title">
              <span style={{ color: "#9c51ff" }}>FPS</span>
              <span style={{ color: "#00f294" }}>.SO</span>
            </h1>

            <div className="nav-tabs">
              <button
                className={`nav-tab ${activeTab === "lobby" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("lobby");
                  setShowGameBrowser(true);
                  if (!gamesLoading) loadGames();
                }}
              >
                🎮 Lobby
              </button>
              <button
                className={`nav-tab ${activeTab === "store" ? "active" : ""}`}
                onClick={() => setActiveTab("store")}
              >
                🛒 Store
              </button>
              <button
                className={`nav-tab ${
                  activeTab === "mapeditor" ? "active" : ""
                }`}
                onClick={() => setActiveTab("mapeditor")}
              >
                🗺️ Map Editor
              </button>
              <button
                className="nav-tab"
                onClick={() => setSettingsOpen(true)}
                style={{ marginLeft: 14, fontWeight: 700 }}
                title="Settings (M)"
              >
                Settings (M)
              </button>
            </div>
          </div>

          {/* Right: Status and Wallet */}
          <div className="nav-right">
            <div className="nav-status">
              <span>{solanaReady ? "✅" : "⏳"} Solana</span>
              <span>{gameReady ? "✅" : "⏳"} Game</span>
            </div>

            {walletConnected ? (
              <div className="nav-wallet-info">
                <div>
                  <div className="nav-wallet-address">
                    {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                  </div>
                  <div className="nav-wallet-balance">
                    {balance.toFixed(4)} SOL
                  </div>
                </div>
                <button
                  className="hud-button"
                  onClick={handleRefreshBalance}
                  style={{ padding: "6px 12px", fontSize: "11px" }}
                >
                  Refresh
                </button>
              </div>
            ) : (
              <button
                className="nav-wallet-btn"
                onClick={handleConnectWallet}
                disabled={!solanaReady}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </nav>

        {/* Bottom Left - Player Info - Hidden when in active game */}
        <div
          className="hud-bottom-left"
          style={{
            display: currentGameState === 1 ? "none" : "block",
          }}
        >
          {playerInitialized && playerData ? (
            <div className="player-card">
              <div className="player-header">
                <div className="player-avatar-icon">👤</div>
                <div className="player-info">
                  <h3 className="player-username">{playerData.username}</h3>
                  <div className="player-level">Level {playerData.level}</div>
                </div>
              </div>
              <div className="player-stats">
                <div className="stat-item">
                  Matches:{" "}
                  <span className="stat-value">
                    {playerData.totalMatchesPlayed}
                  </span>
                </div>
                <div className="stat-item">
                  Team: <span className="stat-value">{playerData.team}</span>
                </div>
              </div>
              <button
                className="hud-button"
                onClick={handleCheckPlayer}
                style={{ marginTop: "10px", width: "100%" }}
              >
                Refresh
              </button>
            </div>
          ) : walletConnected ? (
            <div className="player-card">
              <div className="player-header">
                <div className="player-avatar-icon">❓</div>
                <div className="player-info">
                  <h3 className="player-username">Not Initialized</h3>
                  <div className="player-level">Create Player</div>
                </div>
              </div>
              <input
                type="text"
                placeholder="Enter username..."
                value={playerUsername}
                onChange={(e) => setPlayerUsername(e.target.value)}
                className="hud-input"
                style={{ width: "100%" }}
              />
              <button
                className="hud-button-success hud-button"
                onClick={handleInitPlayer}
                disabled={!playerUsername.trim()}
                style={{ width: "100%" }}
              >
                Initialize Player
              </button>
            </div>
          ) : null}
        </div>

        {/* Bottom Right - Ephemeral Wallet - Hidden when in active game */}
        <div
          className="hud-bottom-right"
          style={{
            display: currentGameState === 1 ? "none" : "block",
          }}
        >
          {walletConnected && window.gameBridge && (
            <EphemeralWalletPanel gameBridge={window.gameBridge} />
          )}
        </div>

        {/* Tab Content */}
        {activeTab === "lobby" && !inLobby && (
          <LobbyBrowser
            games={games}
            loading={gamesLoading}
            onRefresh={loadGames}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onJoinAsSpectator={handleJoinAsSpectator}
            onClose={() => setActiveTab("lobby")}
          />
        )}

        {activeTab === "lobby" && inLobby && currentLobbyData && (
          <LobbyRoom
            lobbyData={currentLobbyData}
            currentPlayer={playerData?.username || walletAddress.slice(0, 8)}
            isLeader={isLobbyLeader}
            playerReady={playerReady}
            onToggleReady={handleToggleReady}
            onStartGame={handleStartGame}
            onLeaveLobby={handleLeaveLobby}
          />
        )}

        {activeTab === "store" && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(13, 13, 17, 0.95)",
              border: "2px solid rgba(156, 81, 255, 0.5)",
              borderRadius: "16px",
              padding: "40px",
              color: "#fff",
              textAlign: "center",
            }}
          >
            <h2 style={{ color: "#9c51ff", fontSize: "32px" }}>🛒 Store</h2>
            <p style={{ color: "#c8c8dc", marginTop: "20px" }}>
              Coming Soon...
            </p>
            <p style={{ color: "#888", fontSize: "14px", marginTop: "10px" }}>
              Purchase skins, weapons, and exclusive items with SOL
            </p>
          </div>
        )}

        {/* Map Editor is shown via canvas when activeTab === 'mapeditor' */}

        {/* In-Game HUD (shown during active gameplay) */}
        {currentGameState === 1 && (
          <>
            {/* Crosshair */}
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "20px",
                height: "20px",
                pointerEvents: "none",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "0",
                  width: "20px",
                  height: "2px",
                  background: "rgba(0, 242, 148, 0.8)",
                  boxShadow: "0 0 10px rgba(0, 242, 148, 0.6)",
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "0",
                  width: "2px",
                  height: "20px",
                  background: "rgba(0, 242, 148, 0.8)",
                  boxShadow: "0 0 10px rgba(0, 242, 148, 0.6)",
                }}
              ></div>
            </div>

            {/* Health and Ammo Display */}
            <div
              style={{
                position: "fixed",
                bottom: "20px",
                right: "20px",
                display: "flex",
                gap: "20px",
                pointerEvents: "none",
                zIndex: 1000,
              }}
            >
              {/* Health */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(156, 81, 255, 0.2), rgba(156, 81, 255, 0.1))",
                  backdropFilter: "blur(10px)",
                  border: "2px solid rgba(156, 81, 255, 0.5)",
                  borderRadius: "8px",
                  padding: "15px 25px",
                  boxShadow: "0 4px 20px rgba(156, 81, 255, 0.3)",
                }}
              >
                <div
                  style={{
                    color: "#9c51ff",
                    fontSize: "12px",
                    marginBottom: "5px",
                  }}
                >
                  HEALTH
                </div>
                <div
                  style={{
                    color: "#fff",
                    fontSize: "32px",
                    fontWeight: "bold",
                  }}
                >
                  100
                </div>
              </div>

              {/* Ammo */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0, 242, 148, 0.2), rgba(0, 242, 148, 0.1))",
                  backdropFilter: "blur(10px)",
                  border: "2px solid rgba(0, 242, 148, 0.5)",
                  borderRadius: "8px",
                  padding: "15px 25px",
                  boxShadow: "0 4px 20px rgba(0, 242, 148, 0.3)",
                }}
              >
                <div
                  style={{
                    color: "#00f294",
                    fontSize: "12px",
                    marginBottom: "5px",
                  }}
                >
                  AMMO
                </div>
                <div
                  style={{
                    color: bulletCount === 0 ? "#ff4444" : bulletCount <= 3 ? "#ffaa00" : "#fff",
                    fontSize: "32px",
                    fontWeight: "bold",
                  }}
                >
                  {bulletCount}/10
                  {isReloading && " (Reloading...)"}
                </div>
              </div>
            </div>

            {/* Minimap - Modern web-based implementation */}
            <Minimap gamePublicKey={currentLobbyData?.gamePublicKey} />

            {/* Match Status - Shows team scores during gameplay */}
            <MatchStatus
              gamePublicKey={currentLobbyData?.gamePublicKey}
              currentGameState={currentGameState}
              onGameEnd={(data) => {
                console.log("🏆 Game ended, showing victory dialog:", data);
                setVictoryData(data);
                setShowVictoryDialog(true);
              }}
            />

            {/* Fullscreen toggle button - only show when in game but not fullscreen */}
            {currentGameState === 1 && !isFullscreen && (
              <button
                onClick={enterFullscreen}
                style={{
                  position: "fixed",
                  bottom: "20px",
                  right: "20px",
                  padding: "12px 24px",
                  backgroundColor: "rgba(156, 81, 255, 0.9)",
                  color: "white",
                  border: "2px solid #9c51ff",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  zIndex: 1000,
                  boxShadow: "0 4px 15px rgba(156, 81, 255, 0.4)",
                  transition: "all 0.2s ease",
                  pointerEvents: "auto",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "rgba(156, 81, 255, 1)";
                  e.target.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "rgba(156, 81, 255, 0.9)";
                  e.target.style.transform = "scale(1)";
                }}
              >
                ⛶ Enter Fullscreen
              </button>
            )}

            {/* ESC to pause hint - only show when in gameplay and not paused */}
            {currentGameState === 1 && !isPaused && !showVictoryDialog && (
              <div
                style={{
                  position: "fixed",
                  top: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: "14px",
                  textAlign: "center",
                  pointerEvents: "none",
                  zIndex: 1000,
                }}
              >
                Press{" "}
                <span style={{ color: "#9c51ff", fontWeight: "bold" }}>
                  ESC
                </span>{" "}
                to pause
              </div>
            )}

            {/* Respawn Overlay - Shows death screen and countdown */}
            <RespawnOverlay />
          </>
        )}

        {/* Victory Dialog - Shows when match ends */}
        {showVictoryDialog && victoryData && (
          <VictoryDialog
            winningTeam={victoryData.winningTeam}
            teamAScore={victoryData.teamAScore}
            teamBScore={victoryData.teamBScore}
            mvpPlayer={victoryData.mvpPlayer}
            onClose={async () => {
              setShowVictoryDialog(false);
              setVictoryData(null);

              // Disconnect WebSocket
              try {
                console.log("🔌 Disconnecting WebSocket...");
                if (
                  window.gameBridge &&
                  window.gameBridge.disconnectWebSocket
                ) {
                  window.gameBridge.disconnectWebSocket();
                  console.log("✅ WebSocket disconnected");
                }
              } catch (error) {
                console.error("❌ Error disconnecting WebSocket:", error);
              }

              // Leave the game on the blockchain
              try {
                console.log("🚪 Leaving game after victory...");
                await leaveCurrentGame();
                console.log("✅ Successfully left game");
              } catch (error) {
                console.error("❌ Error leaving game:", error);
              }

              // Exit fullscreen and return to lobby
              exitFullscreen();
              setCurrentGameState(null);
              setInLobby(false);
              setCurrentLobbyData(null);

              // Stop game mode in Raylib
              if (window.gameBridge && window.gameBridge.stopGameMode) {
                window.gameBridge.stopGameMode();
              }
            }}
          />
        )}
      </div>

      {/* Pause Menu - Rendered outside web-ui-overlay for proper pointer events */}
      {/* Only show during active gameplay, NOT in lobby */}
      {isPaused && currentGameState === 1 && !inLobby && !showVictoryDialog && (
        <PauseMenu
          onResume={() => {
            setIsPaused(false);
            // Resume game mode
            if (window.gameBridge && window.gameBridge.startGameMode) {
              window.gameBridge.startGameMode();
              console.log("▶️ Game resumed");
            }
          }}
          onQuit={handleQuitGame}
        />
      )}

      {/* Debug Console - Press '/' to toggle */}
      <DebugConsole />
    </div>
  );
}

export default App;
