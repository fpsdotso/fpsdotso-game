import React from 'react';
import './VictoryDialog.css';

/**
 * VictoryDialog Component
 * Displays match results with winning team and MVP
 */
function VictoryDialog({ winningTeam, teamAScore, teamBScore, mvpPlayer, onClose }) {
  const isTeamAWinner = winningTeam === 'A';
  const winningColor = isTeamAWinner ? '#00d9ff' : '#ff4444';
  const winningTeamName = isTeamAWinner ? 'Team A (Blue)' : 'Team B (Red)';

  return (
    <div className="victory-dialog-overlay" onClick={onClose}>
      <div className="victory-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Victory Header */}
        <div className="victory-header" style={{ borderColor: winningColor }}>
          <h1 className="victory-title" style={{ color: winningColor, textShadow: `0 0 20px ${winningColor}` }}>
            🏆 VICTORY! 🏆
          </h1>
          <p className="victory-subtitle" style={{ color: winningColor }}>
            {winningTeamName} Wins!
          </p>
        </div>

        {/* Match Stats */}
        <div className="victory-stats">
          <div className="final-score">
            <div className="score-item team-a-score">
              <div className="score-label">Team A (Blue)</div>
              <div className="score-value" style={{ color: '#00d9ff' }}>{teamAScore}</div>
            </div>
            <div className="score-divider">-</div>
            <div className="score-item team-b-score">
              <div className="score-label">Team B (Red)</div>
              <div className="score-value" style={{ color: '#ff4444' }}>{teamBScore}</div>
            </div>
          </div>

          {/* MVP Section */}
          {mvpPlayer && (
            <div className="mvp-section">
              <div className="mvp-badge">⭐ MVP ⭐</div>
              <div className="mvp-player">
                <div className="mvp-name">{mvpPlayer.username}</div>
                <div className="mvp-stats">
                  <span className="mvp-kills">{mvpPlayer.kills} Kills</span>
                  {mvpPlayer.deaths !== undefined && (
                    <span className="mvp-deaths">{mvpPlayer.deaths} Deaths</span>
                  )}
                  {mvpPlayer.kills > 0 && mvpPlayer.deaths !== undefined && (
                    <span className="mvp-kd">K/D: {(mvpPlayer.kills / Math.max(mvpPlayer.deaths, 1)).toFixed(2)}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="victory-actions">
          <button className="victory-btn victory-btn-primary" onClick={onClose}>
            Return to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default VictoryDialog;
