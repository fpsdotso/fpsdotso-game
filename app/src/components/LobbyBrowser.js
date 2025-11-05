import React, { useState, useEffect } from "react";
import "./LobbyBrowser.css";

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
  onClose,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMap, setSelectedMap] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [availableMaps, setAvailableMaps] = useState([]);
  const [defaultMaps, setDefaultMaps] = useState([]);
  const [userMaps, setUserMaps] = useState([]);
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
      console.log("🗺️ Loading maps from blockchain...");
      
      const defaultMapId = "cube-in-center-default";
      const fetchedDefaultMaps = [];
      const fetchedUserMaps = [];
      
      // Try to fetch the default map first
      try {
        console.log(`🔍 Checking for default map: ${defaultMapId}...`);
        const defaultMapMetadata = await window.solanaMapBridge.getMapMetadata(defaultMapId);
        
        if (defaultMapMetadata) {
          console.log("✅ Default map found:", defaultMapMetadata);
          fetchedDefaultMaps.push({
            id: defaultMapId,
            name: defaultMapMetadata.name || "Cube in Center Map",
          });
        } else {
          console.log("⚠️ Default map metadata not found");
        }
      } catch (error) {
        console.log(`ℹ️ Default map "${defaultMapId}" not available:`, error.message);
      }

      // Load user's maps
      const userMapIndex = await window.solanaMapBridge.getUserMaps();
      console.log("✅ Loaded user map index:", userMapIndex);

      // UserMapIndex has structure: { owner, map_count, map_ids: string[] }
      // In JavaScript, Anchor converts snake_case to camelCase
      if (
        userMapIndex &&
        userMapIndex.mapIds &&
        userMapIndex.mapIds.length > 0
      ) {
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
            console.warn(
              `⚠️ Could not fetch metadata for map ${mapId}:`,
              error
            );
            // Return map with ID as name if metadata fetch fails
            return {
              id: mapId,
              name: mapId,
            };
          }
        });

        const resolvedUserMaps = await Promise.all(mapPromises);
        fetchedUserMaps.push(...resolvedUserMaps);
      } else {
        console.log("ℹ️ No user maps found");
      }

      // Store maps separately
      setDefaultMaps(fetchedDefaultMaps);
      setUserMaps(fetchedUserMaps);
      
      // Combine all maps for availability check
      const allMaps = [...fetchedDefaultMaps, ...fetchedUserMaps];
      setAvailableMaps(allMaps);

      // Set the first map as selected if any exist
      if (allMaps.length > 0) {
        setSelectedMap(allMaps[0].id); // Set first map (default or user's first) as selected
        console.log(`✅ Loaded ${fetchedDefaultMaps.length} default maps and ${fetchedUserMaps.length} user maps`);
      } else {
        console.log("⚠️ No maps available (neither default nor user-created)");
        setSelectedMap("");
      }
    } catch (error) {
      console.error("❌ Error loading maps:", error);
      // On error, assume no maps
      setDefaultMaps([]);
      setUserMaps([]);
      setAvailableMaps([]);
      setSelectedMap("");
    } finally {
      setLoadingMaps(false);
    }
  };

  const handleCreateRoom = () => {
    if (!selectedMap) {
      alert("Please select a map");
      return;
    }
    onCreateRoom(selectedMap, maxPlayers);
    setShowCreateModal(false);
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
          {loading ? "⏳ LOADING..." : "🔄 REFRESH"}
        </button>
        {onClose && (
          <button className="btn btn-tertiary" onClick={onClose}>
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
        ) : (
          (() => {
            const visibleGames = Array.isArray(games)
              ? games.filter(
                  (game) =>
                    (game?.totalPlayers || game?.current_players || 0) > 0
                )
              : [];
            return visibleGames.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎮</div>
                <h3>No Active Games</h3>
                <p>Be the first to create a match!</p>
              </div>
            ) : (
              visibleGames.map((game, index) => (
                <div key={game.publicKey || index} className="room-card">
                  <div className="room-info">
                    <h3 className="room-name">
                      {game.hostUsername && game.hostUsername !== "Unknown"
                        ? `${game.hostUsername}'s Lobby`
                        : game.createdBy
                        ? `${game.createdBy
                            .toString()
                            .slice(0, 4)}...${game.createdBy
                            .toString()
                            .slice(-4)}'s Lobby`
                        : `Lobby #${index + 1}`}
                    </h3>
                    <div className="room-details">
                      <span className="room-detail">
                        🗺️{" "}
                        {game.mapId ||
                          game.map_id ||
                          game.mapName ||
                          game.map ||
                          "Default Map"}
                      </span>
                      <span className="room-detail">
                        👥 {game.totalPlayers || game.current_players || 0}/
                        {game.maxPlayers || game.max_players || 10}
                      </span>
                      <span className="room-detail">
                        🎯 Host:{" "}
                        {game.hostUsername ||
                          (game.createdBy
                            ? `${game.createdBy
                                .toString()
                                .slice(0, 4)}...${game.createdBy
                                .toString()
                                .slice(-4)}`
                            : game.host || "Unknown")}
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
                            onClick={() =>
                              onJoinAsSpectator(game.publicKey || game.id)
                            }
                            style={{ marginLeft: "8px" }}
                          >
                            👁️ SPECTATE
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="room-status">
                        {game.isPrivate ? "🔒 PRIVATE" : "⛔ FULL"}
                      </span>
                    )}
                  </div>
                </div>
              ))
            );
          })()
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Create New Room</h2>

            <div className="form-group">
              <label>Map {loadingMaps && "⏳"}</label>
              <select
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
                className="form-select"
                disabled={loadingMaps || availableMaps.length === 0}
              >
                {loadingMaps ? (
                  <option>Loading maps...</option>
                ) : availableMaps.length === 0 ? (
                  <option>No maps available</option>
                ) : (
                  <>
                    {defaultMaps.length > 0 && (
                      <optgroup label="🎮 Default Maps">
                        {defaultMaps.map((map) => (
                          <option key={map.id} value={map.id}>
                            {map.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {userMaps.length > 0 && (
                      <optgroup label="🗺️ Your Custom Maps">
                        {userMaps.map((map) => (
                          <option key={map.id} value={map.id}>
                            {map.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
              {!loadingMaps && availableMaps.length === 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "rgba(255, 193, 7, 0.9)",
                    fontWeight: "600",
                  }}
                >
                  ⚠️ No maps found. The default map may not be deployed yet, or create your own in the Map Editor!
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
                disabled={loadingMaps || availableMaps.length === 0}
                style={{
                  opacity: loadingMaps || availableMaps.length === 0 ? 0.5 : 1,
                  cursor:
                    loadingMaps || availableMaps.length === 0
                      ? "not-allowed"
                      : "pointer",
                }}
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
