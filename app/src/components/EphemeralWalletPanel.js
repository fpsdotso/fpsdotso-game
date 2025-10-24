/**
 * Ephemeral Wallet Panel Component
 * Simple display with balance and fund button
 */

import React, { useState, useEffect } from "react";

function EphemeralWalletPanel({ gameBridge }) {
  const [balance, setBalance] = useState(0);
  const [funding, setFunding] = useState(false);

  // Auto-refresh balance every 5 seconds
  useEffect(() => {
    const loadBalance = async () => {
      if (!gameBridge) return;
      try {
        const info = await gameBridge.getEphemeralWalletInfo();
        if (info) setBalance(info.ephemeralBalance);
      } catch (err) {
        console.error("Failed to load balance:", err);
      }
    };

    loadBalance();
    const interval = setInterval(loadBalance, 5000);
    return () => clearInterval(interval);
  }, [gameBridge]);

  const handleFund = async () => {
    if (!gameBridge || funding) return;
    setFunding(true);

    try {
      await gameBridge.fundEphemeralWallet(0.1);
      setTimeout(() => setBalance((prev) => prev + 0.1), 2000);
    } catch (err) {
      alert("Funding failed: " + err.message);
    } finally {
      setFunding(false);
    }
  };

  return (
    <div>
      <strong>Game Wallet:</strong>
      <div style={{ marginTop: "5px" }}>
        <div>Balance: {balance.toFixed(4)} SOL</div>
        <button
          onClick={handleFund}
          disabled={funding}
          style={{
            marginTop: "8px",
            padding: "6px 12px",
            backgroundColor: funding ? "#666" : "#4ade80",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: funding ? "not-allowed" : "pointer",
          }}
        >
          {funding ? "Funding..." : "Fund 0.1 SOL"}
        </button>
      </div>
    </div>
  );
}

export default EphemeralWalletPanel;
