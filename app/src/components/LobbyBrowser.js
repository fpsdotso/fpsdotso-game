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
  onJoinAsSpectator,
  onClose
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedMap, setSelectedMap] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [availableMaps, setAvailableMaps] = useState([]);
  const [loadingMaps, setLoadingMaps] = useState(false);

  // Load user's maps when modal opens
  useEffect(() => {
    if (showCreateModal && window.solanaMapBridge) {
      loadUserMaps();
    }
  }, [showCreateModal]);

  const loadUserMaps = async () => {
    setLoadingMaps(true);
    try {
      console.log('🗺️ Loading user maps from blockchain...');
      const userMapIndex = await window.solanaMapBridge.getUserMaps();
      console.log('✅ Loaded user map index:', userMapIndex);

      // UserMapIndex has structure: { owner, map_count, map_ids: string[] }
      // In JavaScript, Anchor converts snake_case to camelCase
      if (userMapIndex && userMapIndex.mapIds && userMapIndex.mapIds.length > 0) {
        console.log(`📊 Found ${userMapIndex.mapIds.length} user-created maps`);

        // Fetch metadata for each map to get display names
        const mapPromises = userMapIndex.mapIds.map(async (mapId) => {
          try {
            const metadata = await window.solanaMapBridge.getMapMetadata(mapId);
            return {
              id: mapId,
              name: metadata?.name || mapId, // Use metadata name if available, fallback to ID
            };
          } catch (error) {
            console.warn(`⚠️ Could not fetch metadata for map ${mapId}:`, error);
            // Return map with ID as name if metadata fetch fails
            return {
              id: mapId,
              name: mapId,
            };
          }
        });

        const resolvedMaps = await Promise.all(mapPromises);
        setAvailableMaps(resolvedMaps);
        setSelectedMap(resolvedMaps[0].id); // Set first map as default
      } else {
        console.log('ℹ️ No user maps found, using default maps');
        // Fallback to default maps if user has no maps
        setAvailableMaps([
          { id: 'default', name: 'Default Map' },
          { id: 'dust2', name: 'Dust 2' },
          { id: 'mirage', name: 'Mirage' }
        ]);
        setSelectedMap('default');
      }
    } catch (error) {
      console.error('❌ Error loading maps:', error);
      // Fallback to default maps on error
      setAvailableMaps([
        { id: 'default', name: 'Default Map' },
        { id: 'dust2', name: 'Dust 2' },
        { id: 'mirage', name: 'Mirage' }
      ]);
      setSelectedMap('default');
    } finally {
      setLoadingMaps(false);
    }
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      alert('Please enter a room name');
      return;
    }
    if (!selectedMap) {
      alert('Please select a map');
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
                <h3 className="room-name">
                  {game.lobbyName || game.name || `Game Room #${index + 1}`}
                </h3>
                <div className="room-details">
                  <span className="room-detail">
                    🗺️ {game.mapName || game.map || 'Default Map'}
                  </span>
                  <span className="room-detail">
                    👥 {game.totalPlayers || game.current_players || 0}/{game.maxPlayers || game.max_players || 10}
                  </span>
                  <span className="room-detail">
                    🎯 Host: {game.createdBy ? `${game.createdBy.toString().slice(0, 4)}...${game.createdBy.toString().slice(-4)}` : (game.host || 'Unknown')}
                  </span>
                </div>
              </div>
              <div className="room-actions">
                {game.isJoinable !== false ? (
                  <>
                    <button
                      className="btn btn-join"
                      onClick={() => onJoinRoom(game.publicKey || game.id)}
                    >
                      JOIN →
                    </button>
                    {onJoinAsSpectator && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => onJoinAsSpectator(game.publicKey || game.id)}
                        style={{ marginLeft: '8px' }}
                      >
                        👁️ SPECTATE
                      </button>
                    )}
                  </>
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
              <label>Map {loadingMaps && '⏳'}</label>
              <select
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
                className="form-select"
                disabled={loadingMaps}
              >
                {loadingMaps ? (
                  <option>Loading maps...</option>
                ) : availableMaps.length === 0 ? (
                  <option>No maps available</option>
                ) : (
                  availableMaps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.name}
                    </option>
                  ))
                )}
              </select>
              {!loadingMaps && availableMaps.length === 0 && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'rgba(255, 193, 7, 0.9)',
                  fontWeight: '600'
                }}>
                  ⚠️ No maps found. Create a map in the Map Editor first!
                </div>
              )}
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
