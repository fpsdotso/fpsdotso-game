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
  const [showGameBrowser, setShowGameBrowser] = useState(false);

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

  return (
    <div id="container">
      {/* Minimal header - just status indicators */}
      <div className="game-header-minimal">
        {/* <div className="status-indicators">
          <div className="status-item">
            <span className="status-label">Solana:</span>
            <span className={`status-value ${solanaReady ? 'ready' : 'loading'}`}>
              {solanaReady ? "✅ Ready" : "⏳ Loading..."}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Game:</span>
            <span className={`status-value ${gameReady ? 'ready' : 'loading'}`}>
              {gameReady ? "✅ Ready" : "⏳ Loading..."}
            </span>
          </div>
        </div> */}

        {/* Ephemeral Wallet Panel - shown when wallet is connected */}
        {walletConnected && window.gameBridge && (
          <EphemeralWalletPanel gameBridge={window.gameBridge} />
        )}

        {gameMessages.length > 0 && (
          <div className="game-messages-minimal">
            <strong>Game Messages:</strong>
            {gameMessages.slice(-3).map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        )}
      </div>

      <canvas id="canvas" onContextMenu={(e) => e.preventDefault()}></canvas>
    </div>
  );
}

export default App;
