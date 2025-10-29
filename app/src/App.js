import React, { useEffect, useState } from "react";
import "./App.css";
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
  const [activeTab, setActiveTab] = useState('mapeditor'); // 'lobby', 'store', 'mapeditor' - default to map editor so game loads

  // Game state tracking
  const [currentGameState, setCurrentGameState] = useState(null); // 0=waiting, 1=active, 2=ended, 3=paused
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Victory dialog state
  const [showVictoryDialog, setShowVictoryDialog] = useState(false);
  const [victoryData, setVictoryData] = useState(null);

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
        const players = await getAllPlayersInGame(currentLobbyData.gamePublicKey);

        console.log('🔄 Refreshing lobby data, players:', players);

        const teamAPlayers = players
          .filter(p => p.team === 'A' && !p.isSpectator)
          .map(p => p.username);
        const teamBPlayers = players
          .filter(p => p.team === 'B' && !p.isSpectator)
          .map(p => p.username);
        const spectators = players
          .filter(p => p.isSpectator)
          .map(p => p.username);
        const teamAReady = players
          .filter(p => p.team === 'A' && !p.isSpectator)
          .map(p => p.isReady);
        const teamBReady = players
          .filter(p => p.team === 'B' && !p.isSpectator)
          .map(p => p.isReady);

        console.log('🔄 Ready states - Team A:', teamAReady, 'Team B:', teamBReady);

        setCurrentLobbyData(prev => ({
          ...prev,
          teamA: teamAPlayers,
          teamB: teamBPlayers,
          spectators: spectators,
          teamAReady: teamAReady,
          teamBReady: teamBReady
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
        console.log('🎮 Current game state:', gameState);

        if (gameState !== null && gameState !== currentGameState) {
          setCurrentGameState(gameState);

          // Game state 1 = active (game has started)
          if (gameState === 1) {
            console.log('🎮 Game has started! Switching to fullscreen gameplay...');

            // Exit lobby view
            setInLobby(false);

            // Switch to map editor tab (where game canvas is)
            setActiveTab('mapeditor');

            // Set the current game in Raylib for multiplayer sync
            if (window.gameBridge && window.gameBridge.setCurrentGame && currentLobbyData?.gamePublicKey) {
              window.gameBridge.setCurrentGame(currentLobbyData.gamePublicKey);
              console.log('✅ Set current game pubkey in Raylib');
            }

            // Load the map data from blockchain
            if (window.gameBridge && window.gameBridge.getMapDataById && currentLobbyData?.mapName) {
              console.log('🗺️ Loading map from blockchain:', currentLobbyData.mapName);
              window.gameBridge.getMapDataById(currentLobbyData.mapName).then(mapData => {
                if (mapData) {
                  console.log('✅ Map data loaded, length:', mapData ? mapData.length : 0);
                  // The Rust side will handle loading the map
                } else {
                  console.warn('⚠️ No map data returned');
                }
              }).catch(err => {
                console.error('❌ Failed to load map:', err);
              });
            }

            // Tell Raylib game to switch to playing mode AFTER setting up the game
            setTimeout(() => {
              if (window.gameBridge && window.gameBridge.startGameMode) {
                window.gameBridge.startGameMode();
                console.log('✅ Called startGameMode');
              } else {
                console.warn('⚠️ gameBridge.startGameMode not available');
              }
            }, 500); // Wait 500ms for map to load

            // Enter fullscreen mode
            enterFullscreen();
          }
          // Game state 2 = ended
          else if (gameState === 2) {
            console.log('🏁 Game has ended');

            // Fetch final game data to get the winning team
            const finalGameData = await getGame(currentLobbyData.gamePublicKey);
            if (finalGameData && finalGameData.winningTeam !== null && finalGameData.winningTeam !== undefined) {
              const winningTeamName = finalGameData.winningTeam === 1 ? 'Team A (Blue)' : 'Team B (Red)';
              const winningColor = finalGameData.winningTeam === 1 ? '#00d9ff' : '#ff4444';
              console.log(`🏆 ${winningTeamName} won the match!`);

              // Show victory message
              const victoryMessage = document.createElement('div');
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
                  Final Score: Team A ${finalGameData.teamAKills || 0} - ${finalGameData.teamBKills || 0} Team B
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
    const container = document.getElementById('container');
    const canvas = document.getElementById('canvas');
    if (container && !isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen().then(() => {
          setIsFullscreen(true);
          console.log('✅ Entered fullscreen mode');
          // Lock the mouse pointer when entering fullscreen
          if (canvas && canvas.requestPointerLock) {
            canvas.requestPointerLock();
            console.log('✅ Mouse pointer locked');
          }
        }).catch(err => {
          console.error('❌ Failed to enter fullscreen:', err);
        });
      } else if (container.webkitRequestFullscreen) { // Safari
        container.webkitRequestFullscreen();
        setIsFullscreen(true);
        // Lock the mouse pointer for Safari
        if (canvas && canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      } else if (container.mozRequestFullScreen) { // Firefox
        container.mozRequestFullScreen();
        setIsFullscreen(true);
        // Lock the mouse pointer for Firefox
        if (canvas && canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      } else if (container.msRequestFullscreen) { // IE/Edge
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
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
          console.log('✅ Exited fullscreen mode');
        }).catch(err => {
          console.error('❌ Failed to exit fullscreen:', err);
        });
      } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
        setIsFullscreen(false);
      } else if (document.mozCancelFullScreen) { // Firefox
        document.mozCancelFullScreen();
        setIsFullscreen(false);
      } else if (document.msExitFullscreen) { // IE/Edge
        document.msExitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listen for fullscreen changes (user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement);

      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && currentGameState === 1) {
        console.log('⚠️ User exited fullscreen during gameplay');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [currentGameState]);

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

        // Fetch game data
        const gameData = await getGame(currentGamePubkey);
        if (gameData) {
          console.log("📊 Game data:", gameData);

          // Fetch all players in the game
          const players = await getAllPlayersInGame(currentGamePubkey);
          console.log("👥 Players in game:", players);

          // Separate players into teams and spectators
          const teamAPlayers = players
            .filter(p => p.team === 'A' && !p.isSpectator)
            .map(p => p.username);
          const teamBPlayers = players
            .filter(p => p.team === 'B' && !p.isSpectator)
            .map(p => p.username);
          const spectators = players
            .filter(p => p.isSpectator)
            .map(p => p.username);
          const teamAReady = players
            .filter(p => p.team === 'A' && !p.isSpectator)
            .map(p => p.isReady);
          const teamBReady = players
            .filter(p => p.team === 'B' && !p.isSpectator)
            .map(p => p.isReady);

          // Determine if current player is the leader
          const createdByString = gameData.createdBy?.toString();
          const currentWalletString = currentWalletAddress; // Use passed wallet address
          console.log('👑 Leadership check (auto-rejoin):', {
            createdBy: createdByString,
            currentWallet: currentWalletString,
            isLeader: createdByString === currentWalletString
          });
          const isLeader = createdByString === currentWalletString;

          // Set lobby state
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
          setActiveTab('lobby');
          console.log("✅ Auto-opened lobby for existing game");
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
  const handleCreateRoom = async (roomName, mapName, maxPlayers) => {
    if (!playerInitialized) {
      alert("Please initialize your player first");
      return;
    }

    try {
      console.log(`🎮 Creating room: ${roomName} with map: ${mapName}`);
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

          console.log('📊 Created game data:', gameData);
          console.log('👥 Players after creation:', players);

          const teamAPlayers = players
            .filter(p => p.team === 'A' && !p.isSpectator)
            .map(p => p.username);
          const teamBPlayers = players
            .filter(p => p.team === 'B' && !p.isSpectator)
            .map(p => p.username);
          const spectators = players
            .filter(p => p.isSpectator)
            .map(p => p.username);
          const teamAReady = players
            .filter(p => p.team === 'A' && !p.isSpectator)
            .map(p => p.isReady);
          const teamBReady = players
            .filter(p => p.team === 'B' && !p.isSpectator)
            .map(p => p.isReady);

          // Verify leadership against blockchain
          const createdByString = gameData.createdBy?.toString();
          const isLeader = createdByString === walletAddress;
          console.log('👑 Leadership check (create room):', {
            createdBy: createdByString,
            walletAddress: walletAddress,
            isLeader: isLeader
          });

          setCurrentLobbyData({
            gamePublicKey: gamePubkey,
            lobbyName: roomName,
            mapName: mapName,
            maxPlayers: maxPlayers,
            teamA: teamAPlayers.length > 0 ? teamAPlayers : [playerData?.username || walletAddress.slice(0, 8)],
            teamB: teamBPlayers,
            spectators: spectators,
            teamAReady: teamAReady.length > 0 ? teamAReady : [false],
            teamBReady: teamBReady
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
            teamBReady: []
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

      console.log('🔍 Join game result:', result);

      if (result?.error === "PlayerAlreadyInGame") {
        console.warn("⚠️ Player already in game:", result.currentGame);
        alert(`You are already in a game (${result.currentGame}). Please leave that game first.`);
        return;
      }

      if (result && result.transaction) {
        console.log("✅ Successfully joined room! Transaction:", result.transaction);

        // Wait a moment for transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Fetch actual game data and players from blockchain
        const gameData = await getGame(gamePublicKey);
        const players = await getAllPlayersInGame(gamePublicKey);

        console.log("📊 Game data:", gameData);
        console.log("👥 Players in game:", players);

        // Separate players into teams and spectators
        const teamAPlayers = players
          .filter(p => p.team === 'A' && !p.isSpectator)
          .map(p => p.username);
        const teamBPlayers = players
          .filter(p => p.team === 'B' && !p.isSpectator)
          .map(p => p.username);
        const spectators = players
          .filter(p => p.isSpectator)
          .map(p => p.username);
        const teamAReady = players
          .filter(p => p.team === 'A' && !p.isSpectator)
          .map(p => p.isReady);
        const teamBReady = players
          .filter(p => p.team === 'B' && !p.isSpectator)
          .map(p => p.isReady);

        // Determine if current player is the leader
        const createdByString = gameData.createdBy?.toString();
        console.log('👑 Leadership check (join room):', {
          createdBy: createdByString,
          walletAddress: walletAddress,
          isLeader: createdByString === walletAddress
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
          teamBReady: teamBReady
        });
      } else {
        console.error("❌ Failed to join room: No transaction returned");
        alert("Failed to join room. No transaction was created. Check console for details.");
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

      console.log('🔍 Join as spectator result:', result);

      if (result?.error === "PlayerAlreadyInGame") {
        console.warn("⚠️ Player already in game:", result.currentGame);
        alert(`You are already in a game (${result.currentGame}). Please leave that game first.`);
        return;
      }

      if (result && result.transaction) {
        console.log("✅ Successfully joined as spectator! Transaction:", result.transaction);

        // Wait a moment for transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Fetch actual game data and players from blockchain
        const gameData = await getGame(gamePublicKey);
        const players = await getAllPlayersInGame(gamePublicKey);

        console.log("📊 Game data:", gameData);
        console.log("👥 Players in game:", players);

        // Separate players into teams and spectators
        const teamAPlayers = players
          .filter(p => p.team === 'A' && !p.isSpectator)
          .map(p => p.username);
        const teamBPlayers = players
          .filter(p => p.team === 'B' && !p.isSpectator)
          .map(p => p.username);
        const spectators = players
          .filter(p => p.isSpectator)
          .map(p => p.username);
        const teamAReady = players
          .filter(p => p.team === 'A' && !p.isSpectator)
          .map(p => p.isReady);
        const teamBReady = players
          .filter(p => p.team === 'B' && !p.isSpectator)
          .map(p => p.isReady);

        // Determine if current player is the leader
        const createdByString = gameData.createdBy?.toString();
        console.log('👑 Leadership check (join as spectator):', {
          createdBy: createdByString,
          walletAddress: walletAddress,
          isLeader: createdByString === walletAddress
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
          teamBReady: teamBReady
        });
      } else {
        console.error("❌ Failed to join as spectator: No transaction returned");
        alert("Failed to join as spectator. No transaction was created. Check console for details.");
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

      const result = await setReadyState(currentLobbyData.gamePublicKey, newReadyState);

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
        // Game will transition to playing mode
        setInLobby(false);
        // Switch to map editor tab where the game will load
        setActiveTab('mapeditor');
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

  return (
    <div id="container">
      {/* Game canvas - full screen background */}
      <canvas
        id="canvas"
        onContextMenu={(e) => e.preventDefault()}
        style={{
          display: activeTab === 'mapeditor' ? 'block' : 'none'
        }}
      ></canvas>

      {/* Virtual Joystick for mobile */}
      <VirtualJoystick 
        isPlaying={currentGameState === 1 && activeTab === 'mapeditor'} 
        gameId={currentLobbyData?.gamePublicKey}
        onInput={(input) => console.log('Virtual joystick input:', input)}
      />

      {/* Web UI overlay */}
      <div className="web-ui-overlay" style={{ pointerEvents: activeTab === 'mapeditor' ? 'none' : 'auto' }}>
        {/* Top Navigation Bar with Tabs - Hidden when in active game */}
        <nav className="game-nav" style={{
          pointerEvents: 'auto',
          display: currentGameState === 1 ? 'none' : 'flex'
        }}>
          {/* Left: Logo and Tabs */}
          <div className="hud-top-left">
            <h1 className="game-title">
              <span style={{ color: '#9c51ff' }}>FPS</span>
              <span style={{ color: '#00f294' }}>.SO</span>
            </h1>

            <div className="nav-tabs">
              <button
                className={`nav-tab ${activeTab === 'lobby' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('lobby');
                  setShowGameBrowser(true);
                  if (!gamesLoading) loadGames();
                }}
              >
                🎮 Lobby
              </button>
              <button
                className={`nav-tab ${activeTab === 'store' ? 'active' : ''}`}
                onClick={() => setActiveTab('store')}
              >
                🛒 Store
              </button>
              <button
                className={`nav-tab ${activeTab === 'mapeditor' ? 'active' : ''}`}
                onClick={() => setActiveTab('mapeditor')}
              >
                🗺️ Map Editor
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
                  style={{ padding: '6px 12px', fontSize: '11px' }}
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
        <div className="hud-bottom-left" style={{
          display: currentGameState === 1 ? 'none' : 'block'
        }}>
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
                  Matches: <span className="stat-value">{playerData.totalMatchesPlayed}</span>
                </div>
                <div className="stat-item">
                  Team: <span className="stat-value">{playerData.team}</span>
                </div>
              </div>
              <button className="hud-button" onClick={handleCheckPlayer} style={{ marginTop: '10px', width: '100%' }}>
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
                style={{ width: '100%' }}
              />
              <button
                className="hud-button-success hud-button"
                onClick={handleInitPlayer}
                disabled={!playerUsername.trim()}
                style={{ width: '100%' }}
              >
                Initialize Player
              </button>
            </div>
          ) : null}
        </div>

        {/* Bottom Right - Ephemeral Wallet - Hidden when in active game */}
        <div className="hud-bottom-right" style={{
          display: currentGameState === 1 ? 'none' : 'block'
        }}>
          {walletConnected && window.gameBridge && (
            <EphemeralWalletPanel gameBridge={window.gameBridge} />
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'lobby' && !inLobby && (
          <LobbyBrowser
            games={games}
            loading={gamesLoading}
            onRefresh={loadGames}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onJoinAsSpectator={handleJoinAsSpectator}
            onClose={() => setActiveTab('lobby')}
          />
        )}

        {activeTab === 'lobby' && inLobby && currentLobbyData && (
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

        {activeTab === 'store' && (
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(13, 13, 17, 0.95)',
            border: '2px solid rgba(156, 81, 255, 0.5)',
            borderRadius: '16px',
            padding: '40px',
            color: '#fff',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#9c51ff', fontSize: '32px' }}>🛒 Store</h2>
            <p style={{ color: '#c8c8dc', marginTop: '20px' }}>Coming Soon...</p>
            <p style={{ color: '#888', fontSize: '14px', marginTop: '10px' }}>
              Purchase skins, weapons, and exclusive items with SOL
            </p>
          </div>
        )}

        {/* Map Editor is shown via canvas when activeTab === 'mapeditor' */}

        {/* In-Game HUD (shown during active gameplay) */}
        {currentGameState === 1 && (
          <>
            {/* Crosshair */}
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '20px',
              height: '20px',
              pointerEvents: 'none',
              zIndex: 1000
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '0',
                width: '20px',
                height: '2px',
                background: 'rgba(0, 242, 148, 0.8)',
                boxShadow: '0 0 10px rgba(0, 242, 148, 0.6)'
              }}></div>
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '0',
                width: '2px',
                height: '20px',
                background: 'rgba(0, 242, 148, 0.8)',
                boxShadow: '0 0 10px rgba(0, 242, 148, 0.6)'
              }}></div>
            </div>

            {/* Health and Ammo Display */}
            <div style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              display: 'flex',
              gap: '20px',
              pointerEvents: 'none',
              zIndex: 1000
            }}>
              {/* Health */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(156, 81, 255, 0.2), rgba(156, 81, 255, 0.1))',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(156, 81, 255, 0.5)',
                borderRadius: '8px',
                padding: '15px 25px',
                boxShadow: '0 4px 20px rgba(156, 81, 255, 0.3)'
              }}>
                <div style={{ color: '#9c51ff', fontSize: '12px', marginBottom: '5px' }}>HEALTH</div>
                <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>100</div>
              </div>

              {/* Ammo */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(0, 242, 148, 0.2), rgba(0, 242, 148, 0.1))',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(0, 242, 148, 0.5)',
                borderRadius: '8px',
                padding: '15px 25px',
                boxShadow: '0 4px 20px rgba(0, 242, 148, 0.3)'
              }}>
                <div style={{ color: '#00f294', fontSize: '12px', marginBottom: '5px' }}>AMMO</div>
                <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>30/120</div>
              </div>
            </div>

            {/* Minimap - Modern web-based implementation */}
            <Minimap gamePublicKey={currentLobbyData?.gamePublicKey} />

            {/* Match Status - Shows team scores during gameplay */}
            <MatchStatus
              gamePublicKey={currentLobbyData?.gamePublicKey}
              currentGameState={currentGameState}
              onGameEnd={(data) => {
                console.log('🏆 Game ended, showing victory dialog:', data);
                setVictoryData(data);
                setShowVictoryDialog(true);
              }}
            />

            {/* Fullscreen toggle button - only show when in game but not fullscreen */}
            {currentGameState === 1 && !isFullscreen && (
              <button
                onClick={enterFullscreen}
                style={{
                  position: 'fixed',
                  bottom: '20px',
                  right: '20px',
                  padding: '12px 24px',
                  backgroundColor: 'rgba(156, 81, 255, 0.9)',
                  color: 'white',
                  border: '2px solid #9c51ff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  zIndex: 1000,
                  boxShadow: '0 4px 15px rgba(156, 81, 255, 0.4)',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'auto'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(156, 81, 255, 1)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(156, 81, 255, 0.9)';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                ⛶ Enter Fullscreen
              </button>
            )}

            {/* ESC to exit hint - only show when in fullscreen */}
            {isFullscreen && (
              <div style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '14px',
                textAlign: 'center',
                pointerEvents: 'none',
                zIndex: 1000
              }}>
                Press <span style={{ color: '#9c51ff', fontWeight: 'bold' }}>ESC</span> to exit fullscreen
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

              // Leave the game on the blockchain
              try {
                console.log('🚪 Leaving game after victory...');
                await leaveCurrentGame();
                console.log('✅ Successfully left game');
              } catch (error) {
                console.error('❌ Error leaving game:', error);
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
    </div>
  );
}

export default App;
