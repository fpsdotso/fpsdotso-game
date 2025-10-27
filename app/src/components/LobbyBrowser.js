import React, { useState, useEffect } from 'react';
import './LobbyBrowser.css';

/**
 * LobbyBrowser - Main lobby interface showing available games
 * Recreates the ImGUI lobby functionality in React
 */
function LobbyBrowser({
  games,
  loading,
  onRefresh,
  onCreateRoom,
  onJoinRoom,
  onClose
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedMap, setSelectedMap] = useState('Default Map');
  const [maxPlayers, setMaxPlayers] = useState(10);

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      alert('Please enter a room name');
      return;
    }
    onCreateRoom(newRoomName, selectedMap, maxPlayers);
    setShowCreateModal(false);
    setNewRoomName('');
  };

  return (
    <div className="lobby-browser">
      {/* Header */}
      <div className="lobby-header">
        <h1 className="lobby-title">
          <span className="fps-text">FPS</span>
          <span className="so-text">.SO</span>
        </h1>
        <p className="lobby-subtitle">Find or Create a Match</p>
      </div>

      {/* Action Buttons */}
      <div className="lobby-actions">
        <button
          className="btn btn-primary btn-large"
          onClick={() => setShowCreateModal(true)}
        >
          + CREATE ROOM
        </button>
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? '⏳ LOADING...' : '🔄 REFRESH'}
        </button>
        {onClose && (
          <button
            className="btn btn-tertiary"
            onClick={onClose}
          >
            ✕ CLOSE
          </button>
        )}
      </div>

      {/* Room List */}
      <div className="room-list">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading games from blockchain...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎮</div>
            <h3>No Active Games</h3>
            <p>Be the first to create a match!</p>
          </div>
        ) : (
          games.map((game, index) => (
            <div key={game.publicKey || index} className="room-card">
              <div className="room-info">
                <h3 className="room-name">{game.lobbyName || game.name}</h3>
                <div className="room-details">
                  <span className="room-detail">
                    🗺️ {game.mapName || game.map}
                  </span>
                  <span className="room-detail">
                    👥 {game.totalPlayers || game.current_players}/{game.maxPlayers || game.max_players}
                  </span>
                  <span className="room-detail">
                    🎯 Host: {game.createdBy ? `${game.createdBy.toString().slice(0, 4)}...${game.createdBy.toString().slice(-4)}` : game.host}
                  </span>
                </div>
              </div>
              <div className="room-actions">
                {game.isJoinable !== false ? (
                  <button
                    className="btn btn-join"
                    onClick={() => onJoinRoom(game.publicKey || game.id)}
                  >
                    JOIN →
                  </button>
                ) : (
                  <span className="room-status">
                    {game.isPrivate ? '🔒 PRIVATE' : '⛔ FULL'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Create New Room</h2>

            <div className="form-group">
              <label>Room Name</label>
              <input
                type="text"
                placeholder="Enter room name..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="form-input"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Map</label>
              <select
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
                className="form-select"
              >
                <option>Default Map</option>
                <option>Dust 2</option>
                <option>Mirage</option>
                <option>Inferno</option>
              </select>
            </div>

            <div className="form-group">
              <label>Max Players</label>
              <input
                type="number"
                min="2"
                max="20"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="form-input"
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleCreateRoom}
              >
                CREATE
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LobbyBrowser;
