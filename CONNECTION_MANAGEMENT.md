# Connection Management & Adaptive Rate Limiting

## Overview
This document describes the implementation of **Solution 1 (Connection Refresh)** and **Solution 3 (Adaptive Send Rate)** to prevent ephemeral RPC latency from increasing over time (40ms → 1000+ms).

## Problem
When sending high-frequency HTTP RPC transactions to the ephemeral rollup (even at 20 tx/s), latency would continuously increase due to:
- Connection state degradation over time
- Network resource accumulation
- Transaction queue buildup

## Solution Architecture

### 1. Connection Refresh (Every 60 seconds)
**Location**: `app/src/solana-bridge.js`

#### New Global Variables
```javascript
let lastConnectionRefresh = Date.now();
const CONNECTION_REFRESH_INTERVAL = 60000; // 60 seconds
let transactionCount = 0;
```

#### Implementation
**Function**: `refreshEphemeralConnection()`
- Checks if 60 seconds have passed since last refresh
- Creates new `Connection` instance for ephemeral RPC
- Recreates `ephemeralProvider` and `gameProgram`
- Resets transaction counter
- Updates global `window.ephemeralConnection` reference

**Automatic Trigger**:
- Called in `sendPlayerInput()` before sending each input
- Only refreshes if time threshold reached
- No gameplay disruption (seamless connection swap)

```javascript
// Auto-refresh check in sendPlayerInput()
const timeSinceRefresh = Date.now() - lastConnectionRefresh;
if (timeSinceRefresh >= CONNECTION_REFRESH_INTERVAL) {
    console.log(`🔄 Auto-refreshing connection (${(timeSinceRefresh / 1000).toFixed(0)}s since last refresh)`);
    await refreshEphemeralConnection();
}
```

### 2. Adaptive Send Rate (Latency-Based Throttling)
**Location**: `app/src/solana-bridge.js` + `game/src/game/game_state.rs`

#### New Global Variables
```javascript
let recentLatencies = [];
let currentInputInterval = 0.1; // Start at 100ms (10 tx/s)
```

#### JavaScript Implementation
**Function**: `adjustInputRateBasedOnLatency(latencyMs)`
- Tracks last 10 latency measurements
- Calculates average latency
- Adjusts `currentInputInterval` based on thresholds:
  - **avgLatency > 500ms**: 0.15s interval (~6.7 tx/s) - Very high latency
  - **avgLatency > 300ms**: 0.10s interval (10 tx/s) - High latency
  - **avgLatency > 150ms**: 0.075s interval (~13 tx/s) - Moderate latency
  - **avgLatency < 100ms**: 0.05s interval (20 tx/s) - Low latency (baseline)
- Updates `window.currentInputInterval` for Rust consumption

**Integration**:
- Called automatically in `LatencyDisplay.js` after each latency measurement (every 2 seconds)
- Exposed via `window.solanaBridge.adjustInputRateBasedOnLatency`

```javascript
// In LatencyDisplay.js measureLatency()
const rtt = endTime - startTime;
setLatency(Math.round(rtt));

// Adjust input rate based on latency
if (window.solanaBridge && window.solanaBridge.adjustInputRateBasedOnLatency) {
    window.solanaBridge.adjustInputRateBasedOnLatency(rtt);
}
```

#### Rust Implementation
**Location**: `game/src/game/game_state.rs`

**New Helper Function**: `get_current_input_interval_from_js()`
- Reads `window.currentInputInterval` from JavaScript
- Defaults to 0.05 (50ms) if not available
- Returns adaptive interval as `f32`

**Updated Game Loop**:
```rust
// Adaptive rate limiting based on network latency
self.input_update_timer += delta;

// Get adaptive interval from JavaScript (defaults to 0.05)
let input_interval = self.get_current_input_interval_from_js();

if self.input_update_timer >= input_interval {
    if let Some(ref player) = self.player {
        self.send_player_input(rl, player, delta);
    }
    self.input_update_timer -= input_interval;
}
```

**Key Change**: Replaced hardcoded `const INPUT_UPDATE_INTERVAL: f32 = 0.05` with dynamic `get_current_input_interval_from_js()`.

## Flow Diagram

```
┌─────────────────────────────────────────────────┐
│ LatencyDisplay Component (every 2 seconds)      │
│ - Measures ephemeralConnection.getSlot() RTT    │
│ - Calls adjustInputRateBasedOnLatency(rtt)      │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ adjustInputRateBasedOnLatency(latencyMs)        │
│ - Tracks recent latencies (last 10)             │
│ - Calculates average                            │
│ - Updates window.currentInputInterval           │
│   • High latency → Slow down (0.10-0.15s)       │
│   • Low latency → Speed up (0.05s)              │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ Rust Game Loop (game_state.rs)                  │
│ - Reads window.currentInputInterval             │
│ - Dynamically adjusts send rate                 │
│ - Sends input when timer threshold reached      │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ sendPlayerInput() (solana-bridge.js)            │
│ - Checks connection refresh timer (60s)         │
│ - Refreshes ephemeral connection if needed      │
│ - Sends transaction to ephemeral rollup         │
│ - Tracks transaction count                      │
└─────────────────────────────────────────────────┘
```

## Expected Behavior

### Connection Refresh (Solution 1)
- Every 60 seconds, connection is recreated
- Transaction counter resets
- Prevents connection state degradation
- Console logs: `🔄 Auto-refreshing connection (60s since last refresh)`
- Seamless for gameplay (no freezes or errors)

### Adaptive Rate (Solution 3)
- **Initial State**: 10 tx/s (conservative start)
- **High Latency**: Automatically reduces to ~7 tx/s
- **Low Latency**: Speeds up to 20 tx/s (baseline)
- Console logs show rate adjustments:
  ```
  ⚠️ High latency detected (523ms), reducing to ~7 tx/s
  ✅ Low latency detected (42ms), increasing to 20 tx/s
  ```

### Combined Effect
1. Connection refresh prevents long-term degradation
2. Adaptive rate prevents short-term spikes
3. System self-regulates based on network conditions
4. No manual intervention required

## Testing Checklist

### Before Testing
- [ ] Build game: `./build-game.sh`
- [ ] Start React app: `cd app && npm start`
- [ ] Open browser console to monitor logs

### During Gameplay
- [ ] Check initial latency (should start around 40-100ms)
- [ ] Play for 2+ minutes, verify latency doesn't climb
- [ ] Look for connection refresh logs every 60 seconds
- [ ] Verify adaptive rate adjustments in console
- [ ] Check `window.currentInputInterval` value (F12 console):
  ```javascript
  window.currentInputInterval
  // Should be 0.05-0.15 depending on latency
  ```

### Verification
- [ ] Latency stays stable (<150ms) during extended gameplay
- [ ] No connection errors or freezes during refresh
- [ ] Input send rate adjusts based on latency measurements
- [ ] Transaction count resets every 60 seconds

## Troubleshooting

### If latency still increases:
1. Check console for connection refresh logs
2. Verify `window.currentInputInterval` is updating
3. Check network tab for failed transactions
4. Verify ephemeral RPC endpoint is responsive

### If input feels sluggish:
1. Check `window.currentInputInterval` value
2. Should be 0.05 (20 tx/s) for good latency
3. If higher (0.10+), network latency is high
4. Check ephemeral RPC status

### Manual connection refresh:
```javascript
// In browser console
window.solanaBridge.refreshEphemeralConnection()
```

## Files Modified

### JavaScript Files
1. **app/src/solana-bridge.js**
   - Added connection refresh variables (lines 70-78)
   - Added `refreshEphemeralConnection()` function (lines 397-438)
   - Added `adjustInputRateBasedOnLatency()` function (lines 440-483)
   - Updated `initSolanaClient()` to expose functions (line 523)
   - Added auto-refresh in `sendPlayerInput()` (lines 2666-2670)

2. **app/src/components/LatencyDisplay.js**
   - Added adaptive rate adjustment calls (lines 48-52, 56-60)

### Rust Files
3. **game/src/game/game_state.rs**
   - Added `get_current_input_interval_from_js()` helper (lines 335-363)
   - Updated game loop to use adaptive interval (lines 930-940)

## Performance Metrics

### Before Implementation
- Initial latency: ~40ms
- After 5 minutes: ~500ms
- After 10 minutes: ~1000+ms
- Transaction frequency: Fixed 20 tx/s

### After Implementation (Expected)
- Initial latency: ~40-80ms
- After 5 minutes: ~50-100ms (stable)
- After 10 minutes: ~60-120ms (stable)
- Transaction frequency: Adaptive 7-20 tx/s

## Future Improvements
1. **Exponential Backoff**: Add retry logic with backoff for failed transactions
2. **Connection Pooling**: Maintain multiple connections and round-robin
3. **Health Monitoring**: Track connection health metrics and preemptively refresh
4. **Smart Batching**: Batch multiple inputs in high-latency scenarios
5. **WebSocket Fallback**: Explore alternative transport for state sync (read-only)
