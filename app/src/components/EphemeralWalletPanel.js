/**
 * Ephemeral Wallet Panel Component
 * Simple display with balance and fund button
 */

import React, { useState, useEffect } from "react";

function EphemeralWalletPanel({ gameBridge }) {
  const [balance, setBalance] = useState(0);
  const [address, setAddress] = useState("");
  const [funding, setFunding] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-refresh balance every 5 seconds
  useEffect(() => {
    const loadBalance = async () => {
      if (!gameBridge) return;
      try {
        const info = await gameBridge.getEphemeralWalletInfo();
        if (info) {
          setBalance(info.ephemeralBalance);
          setAddress(info.ephemeralWallet); // Use ephemeralWallet, not ephemeralPublicKey
        }
      } catch (err) {
        console.error("Failed to load balance:", err);
      }
    };

    loadBalance();
    const interval = setInterval(loadBalance, 5000);
    return () => clearInterval(interval);
  }, [gameBridge]);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
    <div
      style={{
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(15px)",
        border: "2px solid rgba(156, 81, 255, 0.5)",
        borderRadius: "12px",
        padding: "16px 20px",
        color: "#ffffff",
        minWidth: "220px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.6)",
      }}
    >
      <div
        style={{
          color: "#9c51ff",
          fontWeight: "700",
          fontSize: "14px",
          marginBottom: "12px",
          textTransform: "uppercase",
          letterSpacing: "1px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>⚡</span>
        <span>Game Wallet</span>
      </div>
      <div style={{ marginTop: "8px" }}>
        <div
          style={{
            color: "#00f294",
            fontSize: "20px",
            fontWeight: "600",
            marginBottom: "4px",
          }}
        >
          {balance.toFixed(4)} SOL
        </div>
        <div
          style={{
            color: "rgba(255, 255, 255, 0.5)",
            fontSize: "11px",
            marginBottom: "12px",
          }}
        >
          Ephemeral Rollup Balance
        </div>

        {/* Address Display with Copy Button */}
        {address && (
          <div
            style={{
              background: "rgba(156, 81, 255, 0.1)",
              border: "1px solid rgba(156, 81, 255, 0.3)",
              borderRadius: "6px",
              padding: "10px",
              marginBottom: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onClick={handleCopyAddress}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(156, 81, 255, 0.2)";
              e.currentTarget.style.borderColor = "rgba(156, 81, 255, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(156, 81, 255, 0.1)";
              e.currentTarget.style.borderColor = "rgba(156, 81, 255, 0.3)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Wallet Address
              </span>
              <span style={{ fontSize: "14px" }}>
                {copied ? "✅" : "📋"}
              </span>
            </div>
            <div
              style={{
                color: "#9c51ff",
                fontSize: "11px",
                fontFamily: "monospace",
                wordBreak: "break-all",
                lineHeight: "1.4",
              }}
            >
              {address.slice(0, 4)}...{address.slice(-4)}
            </div>
            <div
              style={{
                color: "rgba(156, 81, 255, 0.6)",
                fontSize: "9px",
                marginTop: "4px",
                textAlign: "center",
              }}
            >
              {copied ? "Copied!" : "Click to copy full address"}
            </div>
          </div>
        )}

        <button
          onClick={handleFund}
          disabled={funding}
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: funding ? "#555" : "#4ade80",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: funding ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "13px",
            transition: "all 0.2s ease",
            opacity: funding ? 0.6 : 1,
            boxShadow: funding ? "none" : "0 2px 8px rgba(74, 222, 128, 0.3)",
          }}
          onMouseEnter={(e) => {
            if (!funding) {
              e.target.style.backgroundColor = "#22c55e";
              e.target.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!funding) {
              e.target.style.backgroundColor = "#4ade80";
              e.target.style.transform = "translateY(0)";
            }
          }}
        >
          {funding ? "Funding..." : "💰 Fund 0.1 SOL"}
        </button>
      </div>
    </div>
  );
}

export default EphemeralWalletPanel;
