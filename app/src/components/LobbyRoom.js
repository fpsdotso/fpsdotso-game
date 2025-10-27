import React from 'react';
import './LobbyRoom.css';

/**
 * LobbyRoom - In-lobby view showing teams and ready states
 * Recreates the ImGUI lobby view functionality
 */
function LobbyRoom({
  lobbyData,
  currentPlayer,
  isLeader,
  playerReady,
  onToggleReady,
  onStartGame,
  onLeaveLobby
}) {
  const {
    lobbyName = 'Game Lobby',
    mapName = 'Unknown Map',
    teamA = [],
    teamB = [],
    teamAReady = [],
    teamBReady = [],
    maxPlayers = 10
  } = lobbyData || {};

  const totalPlayers = teamA.length + teamB.length;

  return (
    <div className="lobby-room">
      {/* Header */}
      <div className="lobby-room-header">
        <h1 className="lobby-room-title">{lobbyName}</h1>
        <div className="lobby-room-info">
          <span className="info-badge">
            🗺️ {mapName}
          </span>
          <span className="info-badge">
            👥 {totalPlayers}/{maxPlayers} Players
          </span>
          {isLeader && (
            <span className="info-badge leader-badge">
              👑 You are the Leader
            </span>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="teams-container">
        {/* Team A */}
        <div className="team-panel team-blue">
          <div className="team-header">
            <h2 className="team-title">
              <span className="team-icon">🔵</span>
              TEAM A
            </h2>
            <span className="team-count">{teamA.length} Players</span>
          </div>
          <div className="team-players">
            {teamA.length === 0 ? (
              <div className="empty-team">Waiting for players...</div>
            ) : (
              teamA.map((player, index) => (
                <div key={index} className="player-card">
                  <div className="player-info">
                    <span className="player-avatar">👤</span>
                    <span className="player-name">
                      {player}
                      {player === currentPlayer && (
                        <span className="you-badge"> (You)</span>
                      )}
                    </span>
                  </div>
                  <div className="player-status">
                    {teamAReady[index] ? (
                      <span className="status-ready">✓ Ready</span>
                    ) : (
                      <span className="status-waiting">○ Waiting</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* VS Divider */}
        <div className="vs-divider">
          <span className="vs-text">VS</span>
        </div>

        {/* Team B */}
        <div className="team-panel team-red">
          <div className="team-header">
            <h2 className="team-title">
              <span className="team-icon">🔴</span>
              TEAM B
            </h2>
            <span className="team-count">{teamB.length} Players</span>
          </div>
          <div className="team-players">
            {teamB.length === 0 ? (
              <div className="empty-team">Waiting for players...</div>
            ) : (
              teamB.map((player, index) => (
                <div key={index} className="player-card">
                  <div className="player-info">
                    <span className="player-avatar">👤</span>
                    <span className="player-name">
                      {player}
                      {player === currentPlayer && (
                        <span className="you-badge"> (You)</span>
                      )}
                    </span>
                  </div>
                  <div className="player-status">
                    {teamBReady[index] ? (
                      <span className="status-ready">✓ Ready</span>
                    ) : (
                      <span className="status-waiting">○ Waiting</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="lobby-room-actions">
        {isLeader ? (
          <>
            <button
              className="btn btn-primary btn-large"
              onClick={onStartGame}
              disabled={totalPlayers < 2}
            >
              🎮 START GAME
            </button>
            <button
              className="btn btn-danger"
              onClick={onLeaveLobby}
            >
              EXIT LOBBY
            </button>
          </>
        ) : (
          <>
            <button
              className={`btn btn-large ${playerReady ? 'btn-ready-active' : 'btn-ready'}`}
              onClick={onToggleReady}
            >
              {playerReady ? '✓ READY' : 'READY UP'}
            </button>
            <button
              className="btn btn-danger"
              onClick={onLeaveLobby}
            >
              LEAVE LOBBY
            </button>
          </>
        )}
      </div>

      {/* Waiting Message */}
      {isLeader && totalPlayers < 2 && (
        <div className="waiting-message">
          ⏳ Waiting for at least 2 players to start the game...
        </div>
      )}
    </div>
  );
}

export default LobbyRoom;
