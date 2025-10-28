# WebSocket Multiplayer - Debug Guide

## Understanding the Architecture

### Important Distinction

The WebSocket implementation **does NOT replace all HTTP requests**. Here's what it does:

**HTTP/RPC (Still Required)**:
- ✅ Sending your own player input → `sendPlayerInput()` → Transaction to blockchain
- ✅ Creating games, joining games, setting ready state → Transactions
- ✅ Initial fetch of player list when joining a game

**WebSocket (New)**:
- ✅ Real-time notifications when OTHER players move
- ✅ Replaces the 33ms polling loop for OTHER players' positions
- ✅ Push-based updates instead of pull-based polling

## How It Works

### Step 1: Game Starts
1. User joins a game and sets ready
2. Game state changes to "Active" (state = 1)
3. [App.js:218](app/src/App.js:218) calls `gameBridge.setCurrentGame(gamePublicKey)`
4. [game-bridge.js:225](app/src/game-bridge.js:225) forwards to Rust `_set_current_game_js`
5. [game_state.rs:87](game/src/game/game_state.rs:87) receives it and calls `setup_websocket_subscriptions`

### Step 2: WebSocket Setup
6. [game_state.rs:95](game/src/game/game_state.rs:95) executes JavaScript to:
   - Connect to WebSocket at `ws://host:7800`
   - Fetch all players in the game
   - Subscribe to each player's GamePlayer account

### Step 3: During Gameplay
7. **Your Player Moves**:
   - Rust detects input (WASD, mouse)
   - [game_state.rs:319](game/src/game/game_state.rs:319) calls `send_player_input()`
   - JavaScript sends HTTP transaction to update YOUR GamePlayer account
   - ⚠️ **This is HTTP and that's CORRECT!**

8. **Other Players Move**:
   - Their client sends transaction to update THEIR GamePlayer account
   - Ephemeral rollup updates the account on-chain
   - WebSocket server detects the account change
   - WebSocket pushes `accountNotification` to all subscribers
   - Your [game-bridge.js:272](app/src/game-bridge.js:272) callback receives it
   - Data is decoded and stored in `window.___websocket_player_updates`
   - [game_state.rs:337](game/src/game/game_state.rs:337) reads it every frame
   - [game_state.rs:450](game/src/game/game_state.rs:450) processes and updates `other_players` list
   - Smooth interpolation displays their movement

## Debug Checklist

### 1. Verify WebSocket Connection

**Check Browser Console** for these logs when game starts:

```
✅ Expected Logs:
🔌 Connecting to WebSocket...
✅ WebSocket connected
📡 Subscribing to game players...
✅ Subscribed to N players
```

**If you see these errors**:
```
❌ Failed to connect WebSocket: Error connecting
→ Check if ephemeral rollup is running on port 7800
→ Verify REACT_APP_EPHEMERAL_WEBSOCKET_RPC_URL in .env

❌ Failed to subscribe to game players
→ Check if GamePlayer accounts exist
→ Verify players have set ready=true (creates GamePlayer)
```

### 2. Verify Subscriptions Are Active

**Look for these logs**:
```
✅ RPC response for message N: <subscription_id>
```

This means subscription was successful.

### 3. Verify Updates Are Received

**When another player moves**, you should see:
```
🔔 WebSocket notification received for subscription N
📦 Account data: { value: { ... } }
[Game Bridge] 📡 Received WebSocket update for: <account_pubkey>
[Game Bridge] ✅ Decoded GamePlayer data: { positionX: ..., positionY: ..., ... }
```

**In Rust console**, you should see:
```
📡 Processing WebSocket update (pre-parsed)
➕ Added new player: USERNAME (authority)
```

### 4. Check What HTTP Requests Remain

Open **Network tab** and filter by `fetch/XHR`:

**Expected HTTP Requests (GOOD)**:
- ✅ `processInput` - Your player movement transactions (every frame)
- ✅ `getGame`, `getPlayer` - Initial game data fetches
- ✅ `setReadyState`, `initGamePlayer` - Game setup transactions

**Unexpected HTTP Requests (BAD)**:
- ❌ `getGamePlayers` every 33ms - This means WebSocket isn't working
- ❌ Repeated account fetches for the same players

## Troubleshooting

### Problem: No WebSocket Connection

**Symptoms**: Console shows "Failed to connect WebSocket"

**Solutions**:
1. Check ephemeral rollup is running: `curl http://localhost:7800`
2. Verify environment variable in `.env`:
   ```bash
   REACT_APP_EPHEMERAL_WEBSOCKET_RPC_URL=ws://172.28.244.146:7800
   ```
3. Check firewall isn't blocking port 7800
4. Verify WebSocket protocol (ws:// not wss:// for local dev)

### Problem: WebSocket Connected But No Notifications

**Symptoms**: "WebSocket connected" but no "notification received" logs

**Possible Causes**:
1. **No Other Players**: WebSocket only notifies when OTHER players move
   - Solution: Have 2 clients join the same game and move around

2. **GamePlayer Not Created**: Player didn't set ready=true
   - Solution: Ensure all players click "Ready" button
   - Verify `GamePlayer` account exists with: `solana account <pubkey>`

3. **Subscription Failed**: Check for "RPC error" logs
   - Solution: Verify account pubkeys are correct
   - Check game program is deployed on ephemeral rollup

### Problem: Still Seeing HTTP Polling

**Symptoms**: `getGamePlayers` requests every 33ms in Network tab

**This means**: WebSocket setup is not being called

**Solutions**:
1. Check `set_current_game` is being called:
   - Add breakpoint in [App.js:219](app/src/App.js:219)
   - Verify `gamePublicKey` is not null

2. Check Rust is receiving the call:
   - Look for log: `📞 JavaScript called set_current_game_js: <pubkey>`
   - Look for log: `🔌 Setting up WebSocket subscriptions for game: <pubkey>`

3. Rebuild the Rust game if code was updated:
   ```bash
   cd game
   cargo build --target wasm32-unknown-emscripten --release
   ```

### Problem: WebSocket Disconnects Frequently

**Symptoms**: "WebSocket disconnected" followed by reconnection attempts

**Solutions**:
1. Check network stability
2. Increase reconnect attempts in [websocket-game-manager.js:14](app/src/websocket-game-manager.js:14)
3. Check ephemeral rollup logs for errors
4. Verify WebSocket server has enough resources

## Testing WebSocket is Working

### Test 1: Solo Player (Should See HTTP)
1. Start game alone
2. Move around
3. **Expected**: Only see `processInput` HTTP requests (YOUR movement)
4. **Expected**: NO WebSocket notifications (no other players)

### Test 2: Two Players (Should See WebSocket)
1. Start game with 2 players in same lobby
2. Player 1 moves
3. **Player 2 Expected**:
   ```
   🔔 WebSocket notification received for subscription N
   📡 Processing WebSocket update (pre-parsed)
   ```
4. Player 2 moves
5. **Player 1 Expected**: Same WebSocket notifications

### Test 3: Verify No HTTP Polling
1. Join game with multiple players
2. Stand still for 5 seconds
3. Open Network tab
4. **Expected**: NO `getGamePlayers` requests during idle period
5. **Expected**: Only `processInput` when you move

## Performance Metrics

### Before (HTTP Polling)
- Request every 33ms = 30 req/sec per player
- 4 players = 120 requests/sec total
- Latency: 50-100ms per update

### After (WebSocket)
- 4 persistent connections
- Updates only when players move
- Latency: 5-10ms per update
- **Bandwidth savings: ~90% during idle periods**

## Console Commands for Debugging

```javascript
// Check if WebSocket is connected
websocketGameManager.isConnected

// Check active subscriptions
websocketGameManager.subscriptions.size

// Check pending player updates
Object.keys(window.___websocket_player_updates || {}).length

// Get WebSocket connection URL
websocketGameManager.ws?.url

// Manually trigger WebSocket connection
await window.gameBridge.connectWebSocket()

// Check subscription status
window.gameBridge.subscribeToGamePlayers('<game_pubkey>')
```

## Log Patterns to Look For

### Successful WebSocket Flow
```
// Game start
[Game Bridge] setCurrentGame called: <pubkey>
📞 JavaScript called set_current_game_js: <pubkey>
🎮 Setting current game: <pubkey>
🔌 Setting up WebSocket subscriptions for game: <pubkey>

// WebSocket setup
🔌 Connecting to WebSocket...
✅ WebSocket connected
📡 Subscribing to game players...
[Game Bridge] Found N players to subscribe to
✅ RPC response for message 1: <subscription_id_1>
✅ RPC response for message 2: <subscription_id_2>
...
✅ Subscribed to all GamePlayer accounts
[Game Bridge] Subscribed to all GamePlayer accounts

// During gameplay (when other player moves)
🔔 WebSocket notification received for subscription N
📦 Account data: { value: { data: [...] } }
[Game Bridge] 📡 Received WebSocket update for: <account_pubkey>
[Game Bridge] ✅ Decoded GamePlayer data: { positionX: 1.5, ... }
📡 Processing WebSocket update (pre-parsed)
```

## Common Mistakes

1. **Expecting no HTTP at all**: Your own input MUST use HTTP transactions
2. **Testing alone**: WebSocket only matters with 2+ players
3. **Not setting ready**: GamePlayer account isn't created until ready=true
4. **Wrong port**: WebSocket port (7800) is different from HTTP RPC port (7799)
5. **Not rebuilding Rust**: Changes to game_state.rs require rebuild

## Next Steps

If WebSocket is still not working after following this guide:

1. Enable verbose logging in [websocket-game-manager.js](app/src/websocket-game-manager.js)
2. Check ephemeral rollup logs for WebSocket server errors
3. Verify Solana RPC supports `accountSubscribe` method
4. Test WebSocket connection manually with `wscat`:
   ```bash
   npm install -g wscat
   wscat -c ws://172.28.244.146:7800
   > {"jsonrpc":"2.0","id":1,"method":"accountSubscribe","params":["<account_pubkey>",{"encoding":"base64"}]}
   ```
