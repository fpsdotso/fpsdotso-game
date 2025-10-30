import React, { useState, useEffect } from 'react';

/**
 * LatencyDisplay Component
 * 
 * Displays WebSocket/Ephemeral Rollup latency/ping on the left side of the screen during gameplay.
 * Measures round-trip time (RTT) by making HTTP RPC calls to the Ephemeral Rollup.
 * Only visible during active gameplay.
 */
const LatencyDisplay = ({ gamePublicKey, isPlaying }) => {
  const [latency, setLatency] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only measure latency during active gameplay
    if (!isPlaying || !gamePublicKey) {
      setLatency(null);
      setIsConnected(false);
      return;
    }

    let pingInterval;

    const measureLatency = async () => {
      // Check if WebSocket is connected
      if (window.gameBridge && window.gameBridge.getWebSocketStatus) {
        const status = window.gameBridge.getWebSocketStatus();
        setIsConnected(status === 'connected');

        if (status !== 'connected') {
          setLatency(null);
          return;
        }
      } else {
        // Assume connected if we're playing
        setIsConnected(true);
      }

      try {
        // Measure latency using HTTP RPC call to EPHEMERAL ROLLUP
        const startTime = performance.now();
        
        // Make a lightweight RPC call to ephemeral connection
        if (window.ephemeralConnection) {
          await window.ephemeralConnection.getSlot();
          const endTime = performance.now();
          const rtt = endTime - startTime;
          setLatency(Math.round(rtt));
        } else if (window.solanaBridge && window.solanaBridge.measureLatency) {
          // Alternative: use the dedicated latency measurement function
          const rtt = await window.solanaBridge.measureLatency();
          setLatency(Math.round(rtt));
        } else {
          console.warn('⚠️ No ephemeral connection available for latency measurement');
          setLatency(null);
        }
      } catch (error) {
        console.error('❌ Error measuring latency:', error);
        // On error, mark as high latency
        setLatency(999);
      }
    };

    // Measure latency immediately
    measureLatency();
    
    // Measure latency every 2000ms (once every 2 seconds to avoid overloading)
    pingInterval = setInterval(measureLatency, 2000);

    return () => {
      if (pingInterval) clearInterval(pingInterval);
    };
  }, [isPlaying, gamePublicKey]);

  // Don't render anything if not playing
  if (!isPlaying) return null;

  // Determine latency quality and color
  const getLatencyColor = () => {
    if (!latency || !isConnected) return '#888888'; // Gray for disconnected
    if (latency < 50) return '#00f294'; // Green for excellent
    if (latency < 100) return '#00d9ff'; // Cyan for good
    if (latency < 150) return '#ffaa00'; // Yellow for fair
    return '#ff4444'; // Red for poor
  };

  const getLatencyLabel = () => {
    if (!isConnected) return 'OFFLINE';
    if (!latency) return '---';
    if (latency < 50) return 'EXCELLENT';
    if (latency < 100) return 'GOOD';
    if (latency < 150) return 'FAIR';
    return 'POOR';
  };

  const latencyColor = getLatencyColor();
  const latencyLabel = getLatencyLabel();

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.9), rgba(20, 20, 30, 0.7))',
        backdropFilter: 'blur(10px)',
        border: `2px solid ${latencyColor}`,
        borderRadius: '8px',
        padding: '12px 20px',
        boxShadow: `0 4px 20px ${latencyColor}40`,
        pointerEvents: 'none',
        zIndex: 1000,
        minWidth: '150px',
      }}
    >
      {/* Connection Status Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#00f294' : '#ff4444',
            boxShadow: isConnected ? '0 0 8px #00f294' : '0 0 8px #ff4444',
            animation: isConnected ? 'pulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <div
          style={{
            color: '#c8c8dc',
            fontSize: '10px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
          }}
        >
          {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
      </div>

      {/* Ephemeral Rollup Label */}
      <div
        style={{
          color: '#9c51ff',
          fontSize: '9px',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          marginBottom: '6px',
          opacity: 0.8,
        }}
      >
        EPHEMERAL RPC
      </div>

      {/* Latency Value */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
        }}
      >
        <div
          style={{
            color: latencyColor,
            fontSize: '32px',
            fontWeight: 'bold',
            lineHeight: '1',
            textShadow: `0 0 10px ${latencyColor}60`,
          }}
        >
          {latency !== null ? latency : '---'}
        </div>
        <div
          style={{
            color: '#c8c8dc',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          ms
        </div>
      </div>

      {/* Latency Quality Label */}
      <div
        style={{
          color: latencyColor,
          fontSize: '10px',
          fontWeight: 'bold',
          marginTop: '4px',
          letterSpacing: '0.5px',
        }}
      >
        {latencyLabel}
      </div>

      {/* Pulse animation for connection indicator */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
};

export default LatencyDisplay;
