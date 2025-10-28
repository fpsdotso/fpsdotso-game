# WebSocket-Based Real-Time Multiplayer

## Overview

This document describes the WebSocket-based real-time multiplayer synchronization system that replaced the original HTTP polling approach.

## Architecture

### Previous Implementation (HTTP Polling)
- **Method**: HTTP requests every 33ms (30 ticks/second)
- **Issues**:
  - High latency (request/response round-trip time)
  - Inefficient bandwidth usage (constant polling even when no changes)
  - Server load from frequent HTTP requests
  - Not suitable for fast-paced multiplayer games

### New Implementation (WebSocket Subscriptions)
- **Method**: WebSocket connection on port 7800 with account subscriptions
- **Benefits**:
  - Real-time push notifications when player positions change
  - Lower latency (no request/response overhead)
  - Efficient bandwidth (only sends data when changes occur)
  - Reduced server load (persistent connection vs. repeated requests)
  - Perfect for fast-paced multiplayer games

## Components

### 1. WebSocket Manager (`app/src/websocket-game-manager.js`)

A JavaScript module that manages WebSocket connections to the ephemeral rollup.

**Key Features**:
- Automatic reconnection with exponential backoff
- Account subscription management
- Message routing and handling
- Error handling and recovery

**API**:
```javascript
// Connect to WebSocket
await websocketGameManager.connect();

// Subscribe to account updates
await websocketGameManager.subscribeToAccount(accountPubkey, callback);

// Subscribe to multiple GamePlayer accounts
await websocketGameManager.subscribeToGamePlayers(gamePlayerPubkeys, callback);

// Unsubscribe and cleanup
await websocketGameManager.unsubscribeFromGamePlayers(gamePlayerPubkeys);
websocketGameManager.disconnect();
```

### 2. Game Bridge Extensions (`app/src/game-bridge.js`)

New functions exposed to the Rust/WASM game for WebSocket operations.

**New Functions**:
- `connectWebSocket()` - Establish WebSocket connection
- `disconnectWebSocket()` - Close WebSocket connection
- `subscribeToGamePlayers(gamePubkey)` - Subscribe to all players in a game
- `unsubscribeFromGamePlayers(gamePubkey)` - Unsubscribe from game players
- `getWebSocketPlayerUpdates()` - Retrieve pending player updates

### 3. Game State Updates (`game/src/game/game_state.rs`)

Rust game logic updated to use WebSocket subscriptions instead of HTTP polling.

**Key Changes**:
- Removed `sync_timer` and `sync_interval` fields (no more polling)
- Added `websocket_subscribed` flag
- New `setup_websocket_subscriptions()` - Initialize WebSocket when game starts
- New `process_websocket_player_updates()` - Process incoming WebSocket notifications
- New `cleanup_websocket_subscriptions()` - Clean up when leaving game
- Removed `fetch_and_sync_players()` - HTTP polling no longer needed

## Data Flow

### Game Start
1. User joins/creates a game
2. Game calls `set_current_game(game_pubkey)`
3. Rust calls `setup_websocket_subscriptions()`
4. JavaScript connects to WebSocket (ws://host:7800)
5. Fetches list of all GamePlayer accounts in the game
6. Subscribes to each GamePlayer account via WebSocket
7. WebSocket server sends `accountNotification` when any player moves

### During Gameplay
1. Player moves/rotates (local client-side prediction)
2. Rust sends player input to game contract via `sendPlayerInput()`
3. Game contract updates player's GamePlayer account on ephemeral rollup
4. WebSocket server detects account change
5. WebSocket pushes `accountNotification` to all subscribed clients
6. JavaScript callback receives notification, stores in `window.___websocket_player_updates`
7. Rust calls `process_websocket_player_updates()` every frame
8. Rust extracts player data and updates `other_players` list
9. Smooth interpolation applied for buttery movement

### Game Exit
1. User leaves game or returns to menu
2. Rust calls `cleanup_websocket_subscriptions()`
3. JavaScript unsubscribes from all GamePlayer accounts
4. JavaScript disconnects WebSocket
5. Clears `other_players` list

## Environment Configuration

The WebSocket RPC URL is configured via environment variable:

```bash
REACT_APP_EPHEMERAL_WEBSOCKET_RPC_URL=ws://172.28.244.146:7800
```

- **Default**: `ws://127.0.0.1:7800`
- **Port**: 7800 (ephemeral rollup WebSocket port)
- **Protocol**: WebSocket (ws://)

## Performance Improvements

### Latency Comparison

| Metric | HTTP Polling (33ms) | WebSocket |
|--------|---------------------|-----------|
| Update Frequency | 30 Hz (fixed) | Event-driven (instant) |
| Network Round-Trip | ~50-100ms | ~5-10ms |
| Idle Bandwidth | High (constant polling) | Low (no data when idle) |
| Active Bandwidth | High | Moderate |
| Server Load | High (30 req/sec/player) | Low (1 connection/player) |

### Example Scenario (4 Players)
- **HTTP Polling**: 120 requests/second (30 req/sec × 4 players)
- **WebSocket**: 4 persistent connections, data only sent when players move

## WebSocket Message Format

### Account Subscription Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "accountSubscribe",
  "params": [
    "ACCOUNT_PUBKEY",
    {
      "encoding": "jsonParsed",
      "commitment": "confirmed"
    }
  ]
}
```

### Account Notification (Player Update)
```json
{
  "jsonrpc": "2.0",
  "method": "accountNotification",
  "params": {
    "subscription": 12345,
    "result": {
      "value": {
        "data": {
          "parsed": {
            "authority": "PLAYER_EPHEMERAL_KEY",
            "gameId": "GAME_PUBKEY",
            "team": 0,
            "positionX": 1.5,
            "positionY": 0.0,
            "positionZ": 2.3,
            "rotationX": 0.0,
            "rotationY": 1.57,
            "rotationZ": 0.0,
            "health": 100.0,
            "isAlive": true,
            "kills": 0,
            "deaths": 0,
            "score": 0,
            "username": "Player1"
          }
        }
      }
    }
  }
}
```

## Error Handling

### Connection Failures
- Automatic reconnection with exponential backoff
- Max 10 reconnection attempts
- Initial delay: 1 second, doubles each attempt

### Subscription Failures
- Logged to console with detailed error messages
- Game continues with degraded multiplayer (no updates for failed subscriptions)
- Player can reconnect by restarting the game

### Data Parsing Errors
- Invalid JSON silently ignored
- Missing fields use default values
- Game continues with available data

## Testing

### Local Testing
1. Start ephemeral rollup with WebSocket enabled on port 7800
2. Configure `.env` with correct WebSocket URL
3. Join a game with multiple players
4. Verify real-time position updates in console logs

### Console Logs to Monitor
- `🔌 Connecting to WebSocket...` - Connection attempt
- `✅ WebSocket connected` - Connection success
- `📡 Subscribing to game players...` - Subscription start
- `✅ Subscribed to N players` - Subscription complete
- `➕ Added new player: USERNAME` - New player detected
- `❌ WebSocket error:` - Connection/subscription errors

## Future Improvements

1. **Compression**: Use binary encoding instead of JSON for lower bandwidth
2. **Batching**: Batch multiple player updates into single messages
3. **Interpolation Tuning**: Adjust interpolation speed based on network latency
4. **State Reconciliation**: Add client-side prediction error correction
5. **Dead Reckoning**: Predict player movement during brief disconnections
6. **Priority System**: Prioritize nearby players for more frequent updates

## Migration Notes

If you need to temporarily revert to HTTP polling:

1. Restore the old `sync_timer` and `sync_interval` fields in `GameState`
2. Re-add `fetch_and_sync_players()` function
3. Replace `process_websocket_player_updates()` with polling logic in `update()`
4. Remove WebSocket setup/cleanup calls

However, **this is not recommended** as WebSocket provides superior performance for multiplayer games.

## References

- [Solana WebSocket API Documentation](https://docs.solana.com/api/websocket)
- [WebSocket Account Subscribe](https://docs.solana.com/api/websocket#accountsubscribe)
- [Magicblock Ephemeral Rollup Documentation](https://docs.magicblock.gg/)
