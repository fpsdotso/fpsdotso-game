import React, { useEffect, useState } from 'react';
import './App.css';
import { initSolanaClient, connectWallet, getBalance } from './solana-bridge';
import { initGameBridge, onGameMessage } from './game-bridge';

import * as solanaBridge from './solana-bridge';

// Polyfill Buffer for browser environment (required by Solana/Anchor)
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Expose Solana bridge globally for Rust/Emscripten to access
window.solanaMapBridge = {
  createMap: solanaBridge.createMap,
  getUserMaps: solanaBridge.getUserMaps,
  getMapData: solanaBridge.getMapData,
  getMapMetadata: solanaBridge.getMapMetadata
};

function App() {
  const [solanaReady, setSolanaReady] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [gameMessages, setGameMessages] = useState([]);

  useEffect(() => {
    async function init() {
      // Step 1: Initialize Solana connection
      console.log('🚀 Initializing Solana connection...');
      const solanaSuccess = await initSolanaClient();
      setSolanaReady(solanaSuccess);

      // Step 2: Initialize game bridge
      console.log('🎮 Setting up game bridge...');
      initGameBridge();

      // Step 3: Load the game
      const canvas = document.getElementById('canvas');
      if (!canvas) {
        console.error('Canvas element not found!');
        return;
      }

      // Define the Module object for Emscripten
      window.Module = {
        canvas: canvas,
        locateFile: function (path) {
          if (path.endsWith('.wasm')) {
            return `${process.env.PUBLIC_URL}/fpsdotso_game.wasm`;
          }
          return path;
        },
        onRuntimeInitialized: () => {
          console.log('✅ Game runtime initialized');
          setGameReady(true);
          // Re-initialize game bridge now that Module is ready
          initGameBridge();
        },
      };

      // Load the game script
      const existingScript = document.querySelector(`script[src="${process.env.PUBLIC_URL}/fpsdotso-game.js"]`);
      if (!existingScript) {
        const script = document.createElement('script');
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

  const handleConnectWallet = async () => {
    const result = await connectWallet();
    if (result && result.connected) {
      setWalletConnected(true);
      setWalletAddress(result.publicKey);
      const bal = await getBalance();
      setBalance(bal);
    }
  };

  const handleRefreshBalance = async () => {
    const bal = await getBalance();
    setBalance(bal);
  };

  return (
    <div id="container">
      <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#1a1a1a', color: '#fff' }}>
        <h1 style={{ margin: '0 0 20px 0' }}>FPS.so - Solana Game</h1>

        <div style={{ display: 'flex', gap: '30px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <div>
            <strong>Status:</strong>
            <div style={{ marginTop: '5px' }}>
              Solana: {solanaReady ? '✅ Ready' : '⏳ Loading...'}
            </div>
            <div>
              Game: {gameReady ? '✅ Ready' : '⏳ Loading...'}
            </div>
          </div>

          <div>
            <strong>Wallet:</strong>
            <div style={{ marginTop: '5px' }}>
              {walletConnected ? (
                <>
                  <div>✅ Connected</div>
                  <div style={{ fontSize: '0.85em', opacity: 0.8 }}>
                    {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                  </div>
                  <div>Balance: {balance.toFixed(4)} SOL</div>
                  <button
                    onClick={handleRefreshBalance}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      backgroundColor: '#512da8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
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
                    marginTop: '8px',
                    padding: '8px 16px',
                    backgroundColor: solanaReady ? '#9c27b0' : '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: solanaReady ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>

        {gameMessages.length > 0 && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
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