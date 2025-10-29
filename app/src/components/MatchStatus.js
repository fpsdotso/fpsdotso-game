import React, { useState, useEffect } from 'react';
import './MatchStatus.css';

/**
 * MatchStatus Component
 * Displays current match information including team scores
 * Only visible during active gameplay (gameState === 1)
 */
function MatchStatus({ gamePublicKey, currentGameState, onGameEnd }) {
  const [matchData, setMatchData] = useState({
    teamAScore: 0,
    teamBScore: 0,
    timeRemaining: '5:00',
    gameMode: 'Team Deathmatch',
    players: []
  });
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => {
    if (!gamePublicKey || currentGameState !== 1) {
      return;
    }

    // Fetch real match data from blockchain
    const fetchMatchData = async () => {
      try {
        console.log('📊 Fetching match status for:', gamePublicKey);

        // Get all players from the game
        if (window.gameBridge && window.gameBridge.getGamePlayers) {
          const players = await window.gameBridge.getGamePlayers(gamePublicKey);

          // Calculate team scores by summing kills
          let teamAScore = 0;
          let teamBScore = 0;

          players.forEach(player => {
            const kills = player.kills || 0;
            // Team is now u8: 1 = Team A (Blue), 2 = Team B (Red)
            const teamName = player.team === 1 ? 'A' : 'B';
            console.log(`📊 Player ${player.username || 'Unknown'} (Team ${teamName}): ${kills} kills`);
            if (player.team === 1) {
              teamAScore += kills;
            } else if (player.team === 2) {
              teamBScore += kills;
            }
          });

          console.log(`📊 Final Scores - Team A: ${teamAScore}, Team B: ${teamBScore}`);

          setMatchData({
            teamAScore,
            teamBScore,
            timeRemaining: '5:00', // TODO: Get from game contract
            gameMode: 'Team Deathmatch - First to 10',
            players
          });

          // Check for win condition (10 kills)
          const WIN_THRESHOLD = 10;
          if ((teamAScore >= WIN_THRESHOLD || teamBScore >= WIN_THRESHOLD) && !hasEnded) {
            setHasEnded(true);
            const winningTeam = teamAScore >= WIN_THRESHOLD ? 'A' : 'B';

            // Find MVP (player with most kills)
            let mvpPlayer = null;
            if (players.length > 0) {
              mvpPlayer = players.reduce((max, player) =>
                (player.kills || 0) > (max.kills || 0) ? player : max
              );
            }

            console.log(`🏆 Game ended! Team ${winningTeam} wins! MVP:`, mvpPlayer);

            // Call the onGameEnd callback with results
            if (onGameEnd) {
              onGameEnd({
                winningTeam,
                teamAScore,
                teamBScore,
                mvpPlayer
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch match data:', error);
      }
    };

    // Fetch immediately
    fetchMatchData();

    // Poll for updates every 3 seconds
    const interval = setInterval(fetchMatchData, 3000);

    return () => clearInterval(interval);
  }, [gamePublicKey, currentGameState, hasEnded, onGameEnd]);

  // Don't render if not in active game
  if (currentGameState !== 1) {
    return null;
  }

  const WIN_THRESHOLD = 10;
  const teamAProgress = (matchData.teamAScore / WIN_THRESHOLD) * 100;
  const teamBProgress = (matchData.teamBScore / WIN_THRESHOLD) * 100;

  return (
    <div className="match-status">
      <div className="match-status-container">
        {/* Team A Score */}
        <div className="team-score team-a">
          <div className="team-label">TEAM A (BLUE)</div>
          <div className="team-score-value">{matchData.teamAScore}/{WIN_THRESHOLD}</div>
          <div className="score-progress-bar">
            <div
              className="score-progress-fill team-a-fill"
              style={{ width: `${Math.min(teamAProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Center Info */}
        <div className="match-center">
          <div className="match-mode">{matchData.gameMode}</div>
          <div className="match-time">{matchData.timeRemaining}</div>
          {(matchData.teamAScore >= WIN_THRESHOLD || matchData.teamBScore >= WIN_THRESHOLD) && (
            <div className="match-ending">MATCH ENDING...</div>
          )}
        </div>

        {/* Team B Score */}
        <div className="team-score team-b">
          <div className="team-label">TEAM B (RED)</div>
          <div className="team-score-value">{matchData.teamBScore}/{WIN_THRESHOLD}</div>
          <div className="score-progress-bar">
            <div
              className="score-progress-fill team-b-fill"
              style={{ width: `${Math.min(teamBProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatchStatus;
