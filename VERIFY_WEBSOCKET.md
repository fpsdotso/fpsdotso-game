# WebSocket Verification Guide

## The Question: "Is HTTP polling still happening?"

**TLDR**: Some HTTP requests are EXPECTED and CORRECT. Only repeated `getGamePlayers` polling is bad.

## Expected HTTP Requests (✅ GOOD)

These HTTP requests should ALWAYS happen during gameplay:

1. **`processInput` / transaction submissions** - Every frame when you move
   - This sends YOUR player input to the blockchain
   - This is NOT polling - it's writing your position to the chain
   - WebSocket will notify OTHER players about your movement

2. **`getGamePlayers` ONCE at game start** - One-time fetch
   - Happens when `subscribeToGamePlayers` is called
   - Gets initial list of players to subscribe to via WebSocket
   - Should only happen ONCE when game starts

3. **`getGame`, `getPlayer`, etc.** - Initial game setup
   - Fetching game state, player data, matchmaking info
   - Happens at game start, not during gameplay

## Bad HTTP Requests (❌ BAD)

These indicate WebSocket is NOT working:

1. **`getGamePlayers` repeatedly (every 33ms or constantly)** - HTTP polling
   - This means WebSocket subscriptions failed
   - Old polling loop is still active somehow

2. **`fetch` calls to GamePlayer accounts repeatedly** - HTTP polling
   - Fetching individual player positions via HTTP
   - Should be replaced by WebSocket notifications

## How to Verify WebSocket is Working

### Step 1: Check Rust Console Logs

When game starts, you MUST see these logs:

```
📞 JavaScript called set_current_game_js: <pubkey>
🎮 Setting current game: <pubkey>
🔌 ==========================================
🔌 SETTING UP WEBSOCKET SUBSCRIPTIONS
🔌 Game: <pubkey>
🔌 This should only happen ONCE per game!
🔌 ==========================================
✅ ==========================================
✅ WEBSOCKET SUBSCRIPTIONS SETUP COMPLETE!
✅ From now on, player updates via WebSocket
✅ NO MORE HTTP POLLING should occur!
✅ ==========================================
```

**If you DON'T see these logs**, WebSocket setup is not being called!

### Step 2: Check Browser Console Logs

When game starts, you should see:

```javascript
[Game Bridge] setCurrentGame called: <pubkey>
🔌 Connecting to WebSocket...
✅ WebSocket connected
📡 Subscribing to game players...
[Game Bridge] Found N players to subscribe to
✅ RPC response for message 1: <subscription_id>
✅ RPC response for message 2: <subscription_id>
...
[Game Bridge] Subscribed to all GamePlayer accounts
```

**If you DON'T see these logs**, JavaScript WebSocket setup failed!

### Step 3: Monitor Network Tab

Open Browser DevTools → Network tab → Filter by "Fetch/XHR"

**During Idle Period (standing still for 5 seconds)**:

✅ **GOOD**:
- NO requests at all (you're not moving, no input to send)

❌ **BAD**:
- `getGamePlayers` requests every 33ms
- Repeated fetches to same accounts

**During Active Gameplay (moving around)**:

✅ **GOOD**:
- `processInput` / transaction submissions (YOUR input only)
- Frequency matches your movement (not constant 33ms)

❌ **BAD**:
- `getGamePlayers` every 33ms regardless of movement
- Fetches happening more than input sending

### Step 4: Check WebSocket Traffic

Open Browser DevTools → Network tab → Filter by "WS" (WebSocket)

You should see:
- ✅ **Connection to `ws://host:7800`** - WebSocket connection active
- ✅ **Messages being sent** - Subscription requests
- ✅ **Messages being received** - `accountNotification` when players move

**Click on the WebSocket connection to see messages:**

**Outgoing (Sent)**:
```json
{"jsonrpc":"2.0","id":1,"method":"accountSubscribe","params":["<account>",{"encoding":"jsonParsed","commitment":"confirmed"}]}
```

**Incoming (Received)** when other player moves:
```json
{"jsonrpc":"2.0","method":"accountNotification","params":{"subscription":12345,"result":{"value":{...}}}}
```

### Step 5: Test with 2 Players

**Setup**:
1. Open game in 2 browser windows/devices
2. Both players join same game and set ready
3. Game starts

**Player 1 Test**:
1. Player 1: Stand still
2. Player 2: Move around
3. **Player 1 should see**:
   - `🔔 WebSocket notification received` in console
   - Player 2 moving smoothly on screen
   - NO `getGamePlayers` requests in Network tab

**Player 2 Test**:
1. Player 2: Stand still
2. Player 1: Move around
3. **Player 2 should see**:
   - `🔔 WebSocket notification received` in console
   - Player 1 moving smoothly on screen
   - NO `getGamePlayers` requests in Network tab

## Debugging: WebSocket Not Working

### Problem 1: No Rust Console Logs

**Symptoms**: Don't see "SETTING UP WEBSOCKET SUBSCRIPTIONS" logs

**Possible Causes**:
1. `set_current_game` not being called from App.js
2. Game state not transitioning to "Active" (state != 1)
3. `currentLobbyData.gamePublicKey` is null/undefined

**Debug Steps**:
1. Add breakpoint in [App.js:218](app/src/App.js:218)
2. Check `currentLobbyData?.gamePublicKey` has a value
3. Check `gameState === 1` (game is active)
4. Verify `window.gameBridge.setCurrentGame` exists

**Fix**:
- Ensure game transitions to Active state properly
- Verify gamePublicKey is set in lobby data

### Problem 2: No Browser Console Logs

**Symptoms**: Rust logs appear, but no JavaScript WebSocket logs

**Possible Causes**:
1. JavaScript execution failed (syntax error)
2. `window.gameBridge` not defined
3. WebSocket connection blocked by firewall/network

**Debug Steps**:
1. Open Browser Console, check for JavaScript errors
2. Run manually: `await window.gameBridge.connectWebSocket()`
3. Check WebSocket URL: `console.log(process.env.REACT_APP_EPHEMERAL_WEBSOCKET_RPC_URL)`
4. Try connecting manually:
   ```javascript
   const ws = new WebSocket('ws://172.28.244.146:7800');
   ws.onopen = () => console.log('Connected!');
   ws.onerror = (e) => console.error('Error:', e);
   ```

**Fix**:
- Verify ephemeral rollup is running on port 7800
- Check `.env` has correct `REACT_APP_EPHEMERAL_WEBSOCKET_RPC_URL`
- Restart ephemeral rollup with WebSocket enabled

### Problem 3: WebSocket Connected But No Notifications

**Symptoms**: WebSocket connects, but no `accountNotification` received

**Possible Causes**:
1. No other players in the game (you can't see your own updates via WebSocket)
2. Other players haven't created GamePlayer accounts (didn't set ready)
3. Subscription failed silently
4. Account encoding mismatch

**Debug Steps**:
1. Ensure 2+ players in game
2. Check all players set `ready = true`
3. Verify GamePlayer accounts exist:
   ```bash
   solana account <game_player_pda> --url http://localhost:7799
   ```
4. Check subscription IDs were returned:
   - Look for `✅ RPC response for message N` logs
5. Manually test subscription:
   ```javascript
   await websocketGameManager.subscribeToAccount('<account_pubkey>', (data) => {
     console.log('Notification:', data);
   });
   ```

**Fix**:
- Ensure all players click "Ready" to create GamePlayer accounts
- Verify game program is deployed on ephemeral rollup
- Check account exists before subscribing

### Problem 4: Still Seeing getGamePlayers Polling

**Symptoms**: `getGamePlayers` appears every 33ms in Network tab

**This means**: WebSocket setup is NOT being called at all!

**Root Cause**: Old polling code still exists somewhere

**Debug Steps**:
1. Search codebase for polling intervals:
   ```bash
   grep -r "setInterval.*33" .
   grep -r "0.033" .
   ```
2. Check if old Rust code is still compiled:
   ```bash
   cd game
   cargo clean
   cargo build --target wasm32-unknown-emscripten --release
   ```
3. Verify WASM file is updated:
   ```bash
   ls -lh app/public/fpsdotso_game.wasm
   ```
4. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

**Fix**:
- Rebuild Rust game from scratch
- Clear browser cache
- Verify no old polling code remains

## Success Criteria

WebSocket is working correctly when:

✅ **Rust Console**:
- "SETTING UP WEBSOCKET SUBSCRIPTIONS" logs appear once at game start
- "WEBSOCKET SUBSCRIPTIONS SETUP COMPLETE!" appears
- "Processing WebSocket update" appears when other players move

✅ **Browser Console**:
- "WebSocket connected" appears
- "Subscribed to N players" appears
- "WebSocket notification received" when players move

✅ **Network Tab**:
- WebSocket connection to `ws://host:7800` stays open
- NO `getGamePlayers` requests during gameplay (after initial setup)
- Only `processInput` transactions when YOU move

✅ **Gameplay**:
- Other players' positions update smoothly
- No lag or stuttering
- Movement is real-time (not delayed by 33ms polling)

## Performance Comparison

### Before WebSocket (HTTP Polling)
- **Idle (4 players)**: 120 HTTP requests/second (30 req/sec × 4 players)
- **Active (4 players)**: 120+ HTTP requests/second
- **Latency**: 50-100ms per update
- **Network Tab**: Constant stream of `getGamePlayers` requests

### After WebSocket
- **Idle (4 players)**: 0 HTTP requests (no movement = no data)
- **Active (4 players)**: N requests/second (where N = players actively moving)
- **Latency**: 5-10ms per update
- **Network Tab**: Only `processInput` when YOU move, WebSocket shows incoming notifications

## Common Misunderstandings

### ❌ MYTH: "WebSocket eliminates all HTTP"
**✅ TRUTH**: WebSocket replaces HTTP POLLING for reading other players' positions. Your own input still uses HTTP transactions.

### ❌ MYTH: "I see HTTP requests, WebSocket isn't working"
**✅ TRUTH**: Check WHAT requests and HOW OFTEN. `processInput` is normal. `getGamePlayers` every 33ms is bad.

### ❌ MYTH: "Testing solo shows no difference"
**✅ TRUTH**: WebSocket only matters with 2+ players. Solo gameplay won't show WebSocket benefits.

### ❌ MYTH: "WebSocket should show zero Network activity"
**✅ TRUTH**: YOUR movement creates HTTP transactions (blockchain writes). OTHER players' movement arrives via WebSocket.

## Quick Test Command

Run this in browser console while game is running:

```javascript
// Test 1: Check WebSocket status
console.log('WebSocket connected?', websocketGameManager?.isConnected);
console.log('Active subscriptions:', websocketGameManager?.subscriptions.size);

// Test 2: Check if subscribed flag is set
// (This requires accessing Rust state, only works if exposed)

// Test 3: Monitor for 10 seconds and count getGamePlayers
let count = 0;
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0]?.toString().includes('getGamePlayers')) {
    count++;
    console.warn(`⚠️ getGamePlayers called ${count} times`);
  }
  return originalFetch.apply(this, args);
};
setTimeout(() => {
  console.log(`Total getGamePlayers in 10s: ${count}`);
  console.log(count > 1 ? '❌ HTTP POLLING STILL ACTIVE!' : '✅ WebSocket working!');
}, 10000);
```

Expected result after 10 seconds:
- ✅ **0-1 calls**: WebSocket is working (1 call is initial setup)
- ❌ **300+ calls**: HTTP polling active (30 calls/sec × 10 sec)

