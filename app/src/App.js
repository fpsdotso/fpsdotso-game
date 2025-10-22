import React, { useEffect, useState } from 'react';
import './App.css';
import { initSolanaClient, connectWallet, getBalance } from './solana-bridge';
import { initGameBridge, onGameMessage } from './game-bridge';

function App() {
  const [solanaReady, setSolanaReady] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [balance, setBalance] = useState(0);
  const [gameMessages, setGameMessages] = useState([]);

  useEffect(() => {
    async function init() {
      // Step 1: Initialize Solana client
      console.log('🚀 Initializing Solana client...');
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
    if (result) {
      setWalletConnected(true);
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
      <div style={{ marginBottom: '20px' }}>
        <h1>FPS.so - Solana Game</h1>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
          <div>
            <strong>Status:</strong>
            <div>
              Solana: {solanaReady ? '✅ Ready' : '⏳ Loading...'}
            </div>
            <div>
              Game: {gameReady ? '✅ Ready' : '⏳ Loading...'}
            </div>
          </div>

          <div>
            <strong>Wallet:</strong>
            <div>
              {walletConnected ? (
                <>
                  <div>✅ Connected</div>
                  <div>Balance: {balance}</div>
                  <button onClick={handleRefreshBalance} style={{ marginTop: '5px' }}>
                    Refresh Balance
                  </button>
                </>
              ) : (
                <button onClick={handleConnectWallet} disabled={!solanaReady}>
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