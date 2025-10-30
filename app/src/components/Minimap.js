import React, { useEffect, useState, useRef } from 'react';
import './Minimap.css';

/**
 * Modern web-based minimap component for FPS.SO
 * Shows player position, direction, and other players on the map
 */
const Minimap = ({ gamePublicKey }) => {
  const canvasRef = useRef(null);
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [mapObjects, setMapObjects] = useState([]);

  // Map configuration (must match game world coordinates)
  const MAP_SIZE = 50.0; // World map is -25 to +25 on X and Z
  const MINIMAP_SIZE = 200; // Pixel size of minimap

  // Get current player position from Rust game
  useEffect(() => {
    const updateInterval = setInterval(() => {
      // Check if game bridge is available and get player position
      if (window.Module && window.Module._get_player_position) {
        try {
          // Allocate memory for player position struct (x, y, z, yaw)
          const posPtr = window.Module._malloc(16); // 4 floats * 4 bytes

          // Call Rust function to get player position
          window.Module._get_player_position(posPtr);

          // Read the position data
          const HEAPF32 = window.Module.HEAPF32;
          const offset = posPtr / 4; // Convert byte offset to float offset
          const x = HEAPF32[offset];
          const y = HEAPF32[offset + 1];
          const z = HEAPF32[offset + 2];
          const yaw = HEAPF32[offset + 3];

          // Free the memory
          window.Module._free(posPtr);

          setCurrentPlayer({ x, y, z, yaw });
        } catch (error) {
          console.warn('[Minimap] Failed to get player position from Rust:', error);
        }
      }
    }, 50); // Update 20 times per second

    return () => clearInterval(updateInterval);
  }, []);

  // Get other players' positions from WebSocket updates
  useEffect(() => {
    if (!gamePublicKey) return;

    const updateInterval = setInterval(() => {
      if (window.___websocket_player_updates) {
        const updates = window.___websocket_player_updates;
        const playerList = [];

        for (const [accountPubkey, update] of Object.entries(updates)) {
          if (update.parsed) {
            playerList.push({
              publicKey: accountPubkey,
              x: update.parsed.positionX || 0,
              z: update.parsed.positionZ || 0,
              yaw: update.parsed.rotationY || 0,
              team: update.parsed.team || 0,
              isAlive: update.parsed.isAlive !== undefined ? update.parsed.isAlive : true,
            });
          }
        }

        setPlayers(playerList);
      }
    }, 100); // Update 10 times per second

    return () => clearInterval(updateInterval);
  }, [gamePublicKey]);

  // Load map objects from blockchain
  useEffect(() => {
    if (!gamePublicKey) return;

    const loadMapObjects = async () => {
      try {
        // Get the game account to find the map ID
        if (window.gameBridge && window.gameBridge.getGame) {
          const gameAccount = await window.gameBridge.getGame(gamePublicKey);
          const mapId = gameAccount?.mapId;

          if (mapId && window.gameBridge.getMapObjectsData) {
            console.log('[Minimap] Loading map objects for mapId:', mapId);
            const objects = await window.gameBridge.getMapObjectsData(mapId);
            
            if (objects && objects.length > 0) {
              console.log('[Minimap] Loaded', objects.length, 'map objects');
              setMapObjects(objects);
            }
          }
        }
      } catch (error) {
        console.warn('[Minimap] Failed to load map objects:', error);
      }
    };

    loadMapObjects();
  }, [gamePublicKey]);

  // Render the minimap on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size with device pixel ratio for crisp rendering
    canvas.width = MINIMAP_SIZE * dpr;
    canvas.height = MINIMAP_SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Helper function to convert world coordinates to minimap coordinates
    const worldToMinimap = (worldX, worldZ) => {
      const normX = (worldX + MAP_SIZE / 2) / MAP_SIZE; // Normalize to 0-1
      const normZ = (worldZ + MAP_SIZE / 2) / MAP_SIZE;
      return {
        x: normX * MINIMAP_SIZE,
        y: normZ * MINIMAP_SIZE
      };
    };

    // Draw map grid
    ctx.strokeStyle = 'rgba(156, 81, 255, 0.2)';
    ctx.lineWidth = 1;
    const gridSize = MINIMAP_SIZE / 5;
    for (let i = 0; i <= 5; i++) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(i * gridSize, 0);
      ctx.lineTo(i * gridSize, MINIMAP_SIZE);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, i * gridSize);
      ctx.lineTo(MINIMAP_SIZE, i * gridSize);
      ctx.stroke();
    }

    // Draw corner markers (spawn points)
    const corners = [
      { x: -20, z: -20 }, // Top-left
      { x: 20, z: -20 },  // Top-right
      { x: -20, z: 20 },  // Bottom-left
      { x: 20, z: 20 }    // Bottom-right
    ];

    corners.forEach((corner) => {
      const pos = worldToMinimap(corner.x, corner.z);
      ctx.fillStyle = 'rgba(156, 81, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw map objects (walls, obstacles, etc.)
    mapObjects.forEach((obj) => {
      // Skip spawn points as they're already indicated by other means
      if (obj.modelType?.spawnPointBlue !== undefined || 
          obj.modelType?.spawnPointRed !== undefined) {
        return;
      }

      const objPos = worldToMinimap(obj.position.x, obj.position.z);
      
      // Calculate object size on minimap based on its scale
      const sizeX = (obj.scale.x / MAP_SIZE) * MINIMAP_SIZE;
      const sizeZ = (obj.scale.z / MAP_SIZE) * MINIMAP_SIZE;
      const avgSize = (sizeX + sizeZ) / 2;

      // Determine object color (use the object's color but make it semi-transparent)
      const objColor = `rgba(${obj.color.r}, ${obj.color.g}, ${obj.color.b}, 0.6)`;
      
      // Draw different shapes based on model type
      if (obj.modelType?.cube !== undefined || 
          obj.modelType?.rectangle !== undefined) {
        // Draw as rectangle/square
        ctx.fillStyle = objColor;
        ctx.fillRect(
          objPos.x - sizeX / 2,
          objPos.y - sizeZ / 2,
          sizeX,
          sizeZ
        );
        // Draw border
        ctx.strokeStyle = `rgba(${obj.color.r}, ${obj.color.g}, ${obj.color.b}, 0.8)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(
          objPos.x - sizeX / 2,
          objPos.y - sizeZ / 2,
          sizeX,
          sizeZ
        );
      } else if (obj.modelType?.sphere !== undefined) {
        // Draw as circle
        ctx.fillStyle = objColor;
        ctx.beginPath();
        ctx.arc(objPos.x, objPos.y, avgSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${obj.color.r}, ${obj.color.g}, ${obj.color.b}, 0.8)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (obj.modelType?.cylinder !== undefined) {
        // Draw as circle (top-down view of cylinder)
        ctx.fillStyle = objColor;
        ctx.beginPath();
        ctx.arc(objPos.x, objPos.y, avgSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${obj.color.r}, ${obj.color.g}, ${obj.color.b}, 0.8)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (obj.modelType?.triangle !== undefined) {
        // Draw as triangle
        ctx.fillStyle = objColor;
        ctx.beginPath();
        ctx.moveTo(objPos.x, objPos.y - avgSize / 2);
        ctx.lineTo(objPos.x - avgSize / 2, objPos.y + avgSize / 2);
        ctx.lineTo(objPos.x + avgSize / 2, objPos.y + avgSize / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(${obj.color.r}, ${obj.color.g}, ${obj.color.b}, 0.8)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // Default: draw as small square
        ctx.fillStyle = objColor;
        ctx.fillRect(
          objPos.x - avgSize / 2,
          objPos.y - avgSize / 2,
          avgSize,
          avgSize
        );
      }
    });

    // Draw other players
    players.forEach((player) => {
      if (!player.isAlive) return; // Skip dead players

      const pos = worldToMinimap(player.x, player.z);

      // Determine player color based on team (Team 1 = Blue, Team 2 = Red)
      const playerColor = player.team === 1 ? 'rgba(0, 150, 255, 0.8)' : 'rgba(255, 50, 50, 0.8)';

      // Draw player dot
      ctx.fillStyle = playerColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw player direction indicator
      // Note: yaw is already in radians from WebSocket
      const dirLength = 12;
      const dirEndX = pos.x + Math.cos(player.yaw) * dirLength;
      const dirEndY = pos.y + Math.sin(player.yaw) * dirLength;

      ctx.strokeStyle = playerColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(dirEndX, dirEndY);
      ctx.stroke();
    });

    // Draw current player (highlighted with team color + white border)
    if (currentPlayer) {
      const pos = worldToMinimap(currentPlayer.x, currentPlayer.z);

      // Get current player's team color
      // We need to get the team from WebSocket data for the current player
      const currentPlayerEphemeralKey = window.gameBridge?.getCurrentPlayerEphemeralKey?.();
      let currentPlayerTeam = 1; // Default to team 1 (blue)

      if (currentPlayerEphemeralKey && window.___websocket_player_updates) {
        for (const [accountPubkey, update] of Object.entries(window.___websocket_player_updates)) {
          if (update.parsed?.authority === currentPlayerEphemeralKey) {
            currentPlayerTeam = update.parsed.team || 1;
            break;
          }
        }
      }

      const teamColor = currentPlayerTeam === 1 ? 'rgba(0, 150, 255, 1)' : 'rgba(255, 50, 50, 1)';

      // Draw pulsing white ring around current player
      const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Draw player dot with team color
      ctx.fillStyle = teamColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw direction indicator with team color
      // Note: yaw is already in radians from Rust
      const dirLength = 15;
      const dirEndX = pos.x + Math.cos(currentPlayer.yaw) * dirLength;
      const dirEndY = pos.y + Math.sin(currentPlayer.yaw) * dirLength;

      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(dirEndX, dirEndY);
      ctx.stroke();

      // Draw arrowhead
      const arrowSize = 5;
      const angle1 = currentPlayer.yaw + Math.PI * 0.75;
      const angle2 = currentPlayer.yaw - Math.PI * 0.75;
      ctx.beginPath();
      ctx.moveTo(dirEndX, dirEndY);
      ctx.lineTo(dirEndX + Math.cos(angle1) * arrowSize, dirEndY + Math.sin(angle1) * arrowSize);
      ctx.moveTo(dirEndX, dirEndY);
      ctx.lineTo(dirEndX + Math.cos(angle2) * arrowSize, dirEndY + Math.sin(angle2) * arrowSize);
      ctx.stroke();
    }
  }, [currentPlayer, players, mapObjects]);

  return (
    <div className="minimap-container">
      <div className="minimap-header">
        <span className="minimap-title">MINIMAP</span>
        <span className="minimap-players">{players.length} players</span>
      </div>
      <div className="minimap-wrapper">
        <canvas
          ref={canvasRef}
          className="minimap-canvas"
          style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
        />
      </div>
      <div className="minimap-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#00f294' }}></span>
          <span>You</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#0096ff' }}></span>
          <span>Team A</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#ff3232' }}></span>
          <span>Team B</span>
        </div>
      </div>
    </div>
  );
};

export default Minimap;