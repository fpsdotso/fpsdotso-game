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
      <div
        style={{
          marginBottom: "20px",
          padding: "20px",
          backgroundColor: "#1a1a1a",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: "0 0 20px 0" }}>FPS.so - Solana Game</h1>

        <div
          style={{
            display: "flex",
            gap: "30px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>Status:</strong>
            <div style={{ marginTop: "5px" }}>
              Solana: {solanaReady ? "✅ Ready" : "⏳ Loading..."}
            </div>
            <div>Game: {gameReady ? "✅ Ready" : "⏳ Loading..."}</div>
          </div>

          <div>
            <strong>Wallet:</strong>
            <div style={{ marginTop: "5px" }}>
              {walletConnected ? (
                <>
                  <div>✅ Connected</div>
                  <div style={{ fontSize: "0.85em", opacity: 0.8 }}>
                    {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                  </div>
                  <div>Balance: {balance.toFixed(4)} SOL</div>
                  <button
                    onClick={handleRefreshBalance}
                    style={{
                      marginTop: "8px",
                      padding: "6px 12px",
                      backgroundColor: "#512da8",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Refresh Balance
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  disabled={!solanaReady}
                  style={{
                    marginTop: "8px",
                    padding: "8px 16px",
                    backgroundColor: solanaReady ? "#9c27b0" : "#666",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: solanaReady ? "pointer" : "not-allowed",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>

          {/* Ephemeral Wallet Panel - shown when wallet is connected */}
          {walletConnected && window.gameBridge && (
            <EphemeralWalletPanel gameBridge={window.gameBridge} />
          )}

          <div>
            <strong>Player:</strong>
            <div style={{ marginTop: "5px" }}>
              {playerInitialized ? (
                <>
                  <div>✅ Initialized</div>
                  {playerData && (
                    <div style={{ fontSize: "0.85em", opacity: 0.8 }}>
                      <div>Username: {playerData.username}</div>
                      <div>Level: {playerData.level}</div>
                      <div>Matches: {playerData.totalMatchesPlayed}</div>
                      <div>Team: {playerData.team}</div>
                      {playerData.authority && (
                        <div
                          title={playerData.authority.toString()}
                          style={{ cursor: "help" }}
                        >
                          Authority:{" "}
                          {playerData.authority.toString().slice(0, 4)}...
                          {playerData.authority.toString().slice(-4)}
                        </div>
                      )}
                      {playerData.signingKey && (
                        <div
                          title={playerData.signingKey.toString()}
                          style={{ cursor: "help" }}
                        >
                          Signing Key:{" "}
                          {playerData.signingKey.toString().slice(0, 4)}...
                          {playerData.signingKey.toString().slice(-4)}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleCheckPlayer}
                    style={{
                      marginTop: "8px",
                      padding: "6px 12px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Refresh Player Data
                  </button>
                </>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Enter username"
                    value={playerUsername}
                    onChange={(e) => setPlayerUsername(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      marginRight: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                  <button
                    onClick={handleInitPlayer}
                    disabled={!walletConnected || !playerUsername.trim()}
                    style={{
                      padding: "6px 12px",
                      backgroundColor:
                        walletConnected && playerUsername.trim()
                          ? "#4caf50"
                          : "#666",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor:
                        walletConnected && playerUsername.trim()
                          ? "pointer"
                          : "not-allowed",
                      fontSize: "14px",
                    }}
                  >
                    Initialize Player
                  </button>
                  <button
                    onClick={handleCheckPlayer}
                    disabled={!walletConnected}
                    style={{
                      marginLeft: "8px",
                      padding: "6px 12px",
                      backgroundColor: walletConnected ? "#2196f3" : "#666",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: walletConnected ? "pointer" : "not-allowed",
                      fontSize: "14px",
                    }}
                  >
                    Check Player
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <strong>Game Browser:</strong>
            <div style={{ marginTop: "5px" }}>
              {!showGameBrowser ? (
                <button
                  onClick={() => {
                    setShowGameBrowser(true);
                    loadGames();
                  }}
                  disabled={!walletConnected}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: walletConnected ? "#2196f3" : "#666",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: walletConnected ? "pointer" : "not-allowed",
                    fontSize: "14px",
                  }}
                >
                  Browse Games
                </button>
              ) : (
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={loadGames}
                      disabled={gamesLoading}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: gamesLoading ? "#666" : "#4caf50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: gamesLoading ? "not-allowed" : "pointer",
                        fontSize: "14px",
                      }}
                    >
                      {gamesLoading ? "Loading..." : "Refresh Games"}
                    </button>
                    <button
                      onClick={handleCreateGame}
                      disabled={!playerInitialized || gamesLoading}
                      style={{
                        padding: "6px 12px",
                        backgroundColor:
                          !playerInitialized || gamesLoading
                            ? "#666"
                            : "#ff9800",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor:
                          !playerInitialized || gamesLoading
                            ? "not-allowed"
                            : "pointer",
                        fontSize: "14px",
                      }}
                    >
                      Create Game
                    </button>
                    <button
                      onClick={() => setShowGameBrowser(false)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      Close Browser
                    </button>
                  </div>

                  {gamesLoading ? (
                    <div style={{ padding: "20px", textAlign: "center" }}>
                      Loading games...
                    </div>
                  ) : games.length === 0 ? (
                    <div
                      style={{
                        padding: "20px",
                        textAlign: "center",
                        color: "#666",
                      }}
                    >
                      No games available. Create a new game to get started!
                    </div>
                  ) : (
                    <div
                      style={{
                        maxHeight: "300px",
                        overflowY: "auto",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        padding: "10px",
                      }}
                    >
                      {games.map((game, index) => (
                        <div
                          key={game.publicKey}
                          style={{
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            padding: "10px",
                            marginBottom: "8px",
                            backgroundColor: game.isJoinable
                              ? "#f0f8f0"
                              : "#f5f5f5",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div
                                style={{ fontWeight: "bold", fontSize: "14px" }}
                              >
                                {game.lobbyName}
                              </div>
                              <div style={{ fontSize: "12px", color: "#666" }}>
                                Map: {game.mapName} | Players:{" "}
                                {game.totalPlayers}/{game.maxPlayers}
                              </div>
                              <div style={{ fontSize: "12px", color: "#666" }}>
                                Created by:{" "}
                                {game.createdBy.toString().slice(0, 4)}...
                                {game.createdBy.toString().slice(-4)}
                              </div>
                            </div>
                            <div>
                              {game.isJoinable ? (
                                <button
                                  onClick={() => handleJoinGame(game.publicKey)}
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#4caf50",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                >
                                  Join
                                </button>
                              ) : (
                                <span
                                  style={{ fontSize: "12px", color: "#666" }}
                                >
                                  {game.isPrivate ? "Private" : "Full"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {gameMessages.length > 0 && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              background: "#f0f0f0",
              borderRadius: "5px",
            }}
          >
            <strong>Game Messages:</strong>
            {gameMessages.slice(-5).map((msg, i) => (
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
