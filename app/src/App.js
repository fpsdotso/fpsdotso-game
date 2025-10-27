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
  createGame,
} from "./solana-bridge";
import { initGameBridge, onGameMessage } from "./game-bridge";
import EphemeralWalletPanel from "./components/EphemeralWalletPanel";
import LobbyBrowser from "./components/LobbyBrowser";
import LobbyRoom from "./components/LobbyRoom";

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
          if (path.endsWith(".wasm")) {
            // Add cache busting to force reload of WASM file
            const timestamp = Date.now();
            return `${process.env.PUBLIC_URL}/fpsdotso_game.wasm?t=${timestamp}`;
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
        }
      } catch (error) {
        console.log("ℹ️ No existing player found");
      }
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
      console.log(`🎮 Creating room: ${roomName}`);
      const result = await createGame(roomName, mapName);
      if (result) {
        console.log("✅ Successfully created room!");
        // Enter the lobby
        setInLobby(true);
        setIsLobbyLeader(true);
        setCurrentLobbyData({
          lobbyName: roomName,
          mapName: mapName,
          maxPlayers: maxPlayers,
          teamA: [playerData?.username || walletAddress.slice(0, 8)],
          teamB: [],
          teamAReady: [false],
          teamBReady: []
        });
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
      if (result) {
        console.log("✅ Successfully joined room!");
        setInLobby(true);
        setIsLobbyLeader(false);
        setPlayerReady(false);
        // TODO: Fetch actual lobby data from blockchain
        setCurrentLobbyData({
          lobbyName: "Game Lobby",
          mapName: "Default Map",
          maxPlayers: 10,
          teamA: ["Player1"],
          teamB: [playerData?.username || walletAddress.slice(0, 8)],
          teamAReady: [false],
          teamBReady: [false]
        });
      }
    } catch (error) {
      console.error("❌ Error joining room:", error);
      alert("Error joining room: " + error.message);
    }
  };

  const handleToggleReady = () => {
    setPlayerReady(!playerReady);
    // TODO: Call blockchain to update ready state
    if (window.gameBridge && window.gameBridge.setReadyState) {
      window.gameBridge.setReadyState(currentLobbyData?.gamePublicKey, !playerReady);
    }
  };

  const handleStartGame = async () => {
    if (!isLobbyLeader) return;

    try {
      console.log("🎮 Starting game...");
      // TODO: Call blockchain to start game
      if (window.gameBridge && window.gameBridge.startGame) {
        await window.gameBridge.startGame(currentLobbyData?.gamePublicKey);
      }
      // Game will transition to playing mode via Rust
      setInLobby(false);
    } catch (error) {
      console.error("❌ Error starting game:", error);
      alert("Error starting game: " + error.message);
    }
  };

  const handleLeaveLobby = () => {
    setInLobby(false);
    setCurrentLobbyData(null);
    setPlayerReady(false);
    setIsLobbyLeader(false);
    // TODO: Call blockchain to leave game
    if (window.gameBridge && window.gameBridge.leaveCurrentGame) {
      window.gameBridge.leaveCurrentGame();
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

      {/* Web UI overlay */}
      <div className="web-ui-overlay" style={{ pointerEvents: activeTab === 'mapeditor' ? 'none' : 'auto' }}>
        {/* Top Navigation Bar with Tabs */}
        <nav className="game-nav" style={{ pointerEvents: 'auto' }}>
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

        {/* Bottom Left - Player Info */}
        <div className="hud-bottom-left">
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

        {/* Bottom Right - Ephemeral Wallet */}
        <div className="hud-bottom-right">
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
      </div>
    </div>
  );
}

export default App;
