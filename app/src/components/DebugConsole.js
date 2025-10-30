import React, { useState, useEffect, useRef } from 'react';
import '../styles/DebugConsole.css';

const DebugConsole = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const consoleRef = useRef(null);
  const autoScrollRef = useRef(true); // Track if auto-scroll is enabled

  useEffect(() => {
    // Listen for '/' key to toggle console
    const handleKeyPress = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only toggle if not typing in an input field
        const activeElement = document.activeElement;
        if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsOpen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    // Listen for custom transaction events
    const handleTransaction = (event) => {
      // Skip if paused
      if (isPaused) {
        console.log('📊 Debug console is paused, skipping log entry');
        return;
      }
      
      const { type, signature, endpoint, action, status, error, timestamp, functionName } = event.detail;
      
      const logEntry = {
        id: Date.now() + Math.random(),
        type,
        signature,
        endpoint,
        action,
        status,
        error,
        timestamp: timestamp || new Date().toISOString(),
        functionName: functionName || action, // Use functionName if provided, fallback to action
      };

      setLogs(prev => [logEntry, ...prev].slice(0, 300)); // Keep last 300 logs
    };

    window.addEventListener('debug-transaction', handleTransaction);
    return () => window.removeEventListener('debug-transaction', handleTransaction);
  }, [isPaused]);

  useEffect(() => {
    // Auto-scroll to top when new logs arrive (only if auto-scroll is enabled)
    if (consoleRef.current && isOpen && autoScrollRef.current) {
      // Use requestAnimationFrame for smoother scrolling with high-frequency updates
      requestAnimationFrame(() => {
        if (consoleRef.current) {
          consoleRef.current.scrollTop = 0;
        }
      });
    }
  }, [logs, isOpen]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (consoleRef.current) {
      // If user scrolls away from top, disable auto-scroll
      autoScrollRef.current = consoleRef.current.scrollTop < 50;
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  };

  const getEndpointBadge = (endpoint) => {
    if (endpoint?.includes('ephemeral') || endpoint?.includes('8899')) {
      return <span className="endpoint-badge ephemeral">Ephemeral</span>;
    } else if (endpoint?.includes('devnet') || endpoint?.includes('testnet') || endpoint?.includes('mainnet')) {
      return <span className="endpoint-badge solana">Solana</span>;
    }
    return <span className="endpoint-badge unknown">Unknown</span>;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const shortenSignature = (sig) => {
    if (!sig) return 'N/A';
    return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getSolscanUrl = (signature, endpoint) => {
    if (!signature) return null;
    
    // Encode the RPC URL for use as a custom cluster parameter
    const customRpc = encodeURIComponent(endpoint);
    return `https://solscan.io/tx/${signature}?cluster=custom&customUrl=${customRpc}`;
  };

  const isHighFrequency = (type) => {
    // High-frequency transaction types (ephemeral rollup game input)
    return type === 'Game Input';
  };

  if (!isOpen) return null;

  return (
    <div className="debug-console">
      <div className="debug-console-header">
        <div className="debug-console-title">
          <span className="debug-icon">🔍</span>
          <h3>Transaction Debug Console</h3>
          <span className="debug-hint">Press '/' to toggle</span>
        </div>
        <div className="debug-console-actions">
          <button 
            className={`pause-btn ${isPaused ? 'paused' : ''}`}
            onClick={togglePause} 
            title={isPaused ? "Resume recording transactions" : "Pause recording transactions"}
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
          <button className="clear-btn" onClick={clearLogs} title="Clear logs">
            🗑️ Clear
          </button>
          <button className="close-btn" onClick={() => setIsOpen(false)} title="Close console">
            ✕
          </button>
        </div>
      </div>

      <div className="debug-console-body" ref={consoleRef} onScroll={handleScroll}>
        {logs.length === 0 ? (
          <div className="empty-state">
            <p>No transactions yet. Transactions will appear here as they occur.</p>
            <p className="hint">💡 This console tracks both Solana RPC and Ephemeral Rollup transactions</p>
          </div>
        ) : (
          <div className="logs-container">
            {logs.map(log => (
              <div key={log.id} className={`log-entry ${log.status} ${isHighFrequency(log.type) ? 'high-frequency' : ''}`}>
                <div className="log-header">
                  <span className="log-status">{getStatusIcon(log.status)}</span>
                  <span className="log-time">{formatTimestamp(log.timestamp)}</span>
                  {getEndpointBadge(log.endpoint)}
                  <span className="log-type">{log.type}</span>
                </div>
                
                {log.functionName && (
                  <div className="log-function">
                    <strong>Function:</strong> <code>{log.functionName}</code>
                  </div>
                )}
                
                {log.action && log.action !== log.functionName && (
                  <div className="log-action">
                    <strong>Action:</strong> {log.action}
                  </div>
                )}
                
                {log.signature && (
                  <div className="log-signature">
                    <strong>Signature:</strong> 
                    <code onClick={() => copyToClipboard(log.signature)} title="Click to copy">
                      {shortenSignature(log.signature)}
                    </code>
                    <button 
                      className="copy-btn" 
                      onClick={() => copyToClipboard(log.signature)}
                      title="Copy full signature"
                    >
                      📋
                    </button>
                    {log.endpoint && (
                      <a
                        href={getSolscanUrl(log.signature, log.endpoint)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="solscan-btn"
                        title="View on Solscan"
                      >
                        🔍 Solscan
                      </a>
                    )}
                  </div>
                )}
                
                {log.endpoint && (
                  <div className="log-endpoint">
                    <strong>Endpoint:</strong> <code>{log.endpoint}</code>
                  </div>
                )}
                
                {log.error && (
                  <div className="log-error">
                    <strong>Error:</strong> {log.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="debug-console-footer">
        <span className="log-count">{logs.length} transaction{logs.length !== 1 ? 's' : ''}</span>
        {isPaused && <span className="paused-indicator">⏸️ Recording Paused</span>}
        <span className="footer-hint">Showing last 300 transactions</span>
      </div>
    </div>
  );
};

export default DebugConsole;
