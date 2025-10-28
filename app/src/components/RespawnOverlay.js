import React, { useState, useEffect } from 'react';
import './RespawnOverlay.css';

/**
 * RespawnOverlay Component
 * Displays death screen and respawn countdown
 * Only visible when player is dead
 */
function RespawnOverlay() {
  const [isDead, setIsDead] = useState(false);
  const [deathTimestamp, setDeathTimestamp] = useState(0);
  const [remainingTime, setRemainingTime] = useState(3.0);

  useEffect(() => {
    // Poll for death state from game
    const checkDeathState = () => {
      if (window.gameDeathState) {
        const { dead, timestamp } = window.gameDeathState;

        if (dead && timestamp > 0) {
          setIsDead(true);
          setDeathTimestamp(timestamp);

          // Calculate remaining time
          const currentTime = Date.now() / 1000;
          const timeSinceDeath = currentTime - timestamp;
          const remaining = Math.max(0, 3.0 - timeSinceDeath);
          setRemainingTime(remaining);
        } else {
          setIsDead(false);
          setDeathTimestamp(0);
          setRemainingTime(3.0);
        }
      }
    };

    // Check every 100ms for smooth countdown
    const interval = setInterval(checkDeathState, 100);

    return () => clearInterval(interval);
  }, []);

  if (!isDead) {
    return null;
  }

  return (
    <div className="respawn-overlay">
      <div className="respawn-overlay-content">
        <h1 className="death-title">YOU DIED</h1>

        {remainingTime > 0 ? (
          <div className="respawn-timer">
            <p className="timer-label">Respawning in</p>
            <p className="timer-value">{remainingTime.toFixed(1)}s</p>
          </div>
        ) : (
          <div className="respawn-message">
            <p className="respawning-text">Respawning...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RespawnOverlay;
