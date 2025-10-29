import React, { useState, useEffect } from 'react';
import './KillFeed.css';

/**
 * KillFeed Component
 * Displays recent kill notifications on the left side of the screen
 */
function KillFeed() {
  const [killEvents, setKillEvents] = useState([]);

  useEffect(() => {
    // Listen for kill events from the global window object
    const handleKillEvent = (event) => {
      const { killer, victim, timestamp } = event.detail;

      // Create a unique ID for this kill event
      const killId = `${timestamp}-${Math.random()}`;

      const newKill = {
        id: killId,
        killer,
        victim,
        timestamp,
      };

      // Add the new kill to the feed
      setKillEvents(prev => [newKill, ...prev].slice(0, 5)); // Keep only last 5 kills

      // Remove this kill after 5 seconds
      setTimeout(() => {
        setKillEvents(prev => prev.filter(k => k.id !== killId));
      }, 5000);
    };

    window.addEventListener('killEvent', handleKillEvent);

    return () => {
      window.removeEventListener('killEvent', handleKillEvent);
    };
  }, []);

  if (killEvents.length === 0) {
    return null;
  }

  return (
    <div className="kill-feed">
      {killEvents.map((kill) => (
        <div key={kill.id} className="kill-event">
          <span className="killer-name">{kill.killer}</span>
          <span className="kill-icon">💀</span>
          <span className="victim-name">{kill.victim}</span>
        </div>
      ))}
    </div>
  );
}

export default KillFeed;
