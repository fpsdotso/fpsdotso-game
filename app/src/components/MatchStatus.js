import React, { useState, useEffect } from 'react';
import './MatchStatus.css';

/**
 * MatchStatus Component
 * Displays current match information including team scores
 * Only visible during active gameplay (gameState === 1)
 */
function MatchStatus({ gamePublicKey, currentGameState }) {
  const [matchData, setMatchData] = useState({
    teamAScore: 0,
    teamBScore: 0,
    timeRemaining: '5:00',
    gameMode: 'Team Deathmatch'
  });

  useEffect(() => {
    if (!gamePublicKey || currentGameState !== 1) {
      return;
    }

    // TODO: Fetch real match data from blockchain
    // For now, using mock data that updates periodically
    const fetchMatchData = async () => {
      try {
        // This would call the blockchain to get real-time match stats
        // For now, we'll simulate it
        console.log('📊 Fetching match status for:', gamePublicKey);

        // Mock data - replace with actual blockchain call
        // const gameData = await window.solanaGameBridge.getGameStats(gamePublicKey);

      } catch (error) {
        console.error('Failed to fetch match data:', error);
      }
    };

    // Fetch immediately
    fetchMatchData();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchMatchData, 5000);

    return () => clearInterval(interval);
  }, [gamePublicKey, currentGameState]);

  // Don't render if not in active game
  if (currentGameState !== 1) {
    return null;
  }

  return (
    <div className="match-status">
      <div className="match-status-container">
        {/* Team A Score */}
        <div className="team-score team-a">
          <div className="team-label">TEAM A</div>
          <div className="team-score-value">{matchData.teamAScore}</div>
        </div>

        {/* Center Info */}
        <div className="match-center">
          <div className="match-mode">{matchData.gameMode}</div>
          <div className="match-time">{matchData.timeRemaining}</div>
        </div>

        {/* Team B Score */}
        <div className="team-score team-b">
          <div className="team-label">TEAM B</div>
          <div className="team-score-value">{matchData.teamBScore}</div>
        </div>
      </div>
    </div>
  );
}

export default MatchStatus;
