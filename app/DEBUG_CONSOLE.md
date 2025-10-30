# Debug Console

## Overview
The Debug Console is a developer tool that displays all blockchain transactions in real-time, including both Solana RPC transactions and Ephemeral Rollup transactions.

## Features
- **Real-time Transaction Logging**: See all transactions as they happen
- **Pause/Resume Recording**: Stop recording new transactions to examine existing logs
- **Dual Network Support**: Tracks both Solana mainnet/devnet/localnet and Ephemeral Rollup transactions
- **Transaction Details**: View signatures, endpoints, actions, function names, and status
- **Copy to Clipboard**: Easily copy transaction signatures
- **Solscan Integration**: Open transactions directly in Solscan with custom RPC
- **Filterable by Status**: Pending (⏳), Success (✅), Error (❌)
- **Last 300 Transactions**: Keeps a rolling buffer of recent activity

## Usage

### Opening the Console
Press the **`/`** key anywhere in the app to toggle the debug console.

### Closing the Console
- Press **`/`** again to toggle it off
- Click the **X** button in the top-right corner

### Features in the Console
- **Pause Button**: Click **⏸️ Pause** to stop recording new transactions (button changes to **▶️ Resume**)
- **Clear Button**: Clears all logged transactions
- **Transaction List**: Shows most recent transactions first
- **Endpoint Badges**: 
  - Purple badge = Ephemeral Rollup
  - Green badge = Solana Network
- **Copy Signatures**: Click the 📋 icon or the signature itself to copy
- **Solscan Links**: Click **🔍 Solscan** to view transaction with custom RPC

## Transaction Types
The console tracks these transaction types:

### Matchmaking
- Init Player
- Create Game
- Join Game
- Leave Game
- Start Game
- Set Ready State

### Map Registry
- Create Map
- Update Map
- Delete Map

### Game Input
- Process Player Input (high-frequency transactions to ephemeral rollup)

## Developer Notes

### Adding New Transaction Logging
To log a new transaction type, use the `logTransaction` or `logTransactionPromise` utility:

```javascript
import { logTransaction, logTransactionPromise } from './utils/debug-logger.js';

// For immediate logging
logTransaction({
  type: 'Custom Type',
  action: 'My Action',
  signature: 'txSignatureHere',
  endpoint: 'https://api.mainnet-beta.solana.com',
  status: 'success', // or 'pending', 'error'
  error: 'Optional error message',
});

// For promise-based transactions
const signature = await logTransactionPromise(
  'Custom Type',
  'My Action',
  'https://api.mainnet-beta.solana.com',
  txPromise
);
```

### Custom Events
The console listens for `debug-transaction` events on the window object. Any component can dispatch these events:

```javascript
const event = new CustomEvent('debug-transaction', {
  detail: {
    type: 'Transaction Type',
    action: 'Description',
    signature: 'optional-signature',
    endpoint: 'https://rpc.url',
    status: 'success',
    timestamp: new Date().toISOString(),
  },
});
window.dispatchEvent(event);
```

## Keyboard Shortcut
**`/`** - Toggle debug console visibility

*Note: The shortcut won't trigger when typing in input fields or textareas.*

## Styling
The console uses a cyberpunk theme matching the game's aesthetic:
- Neon blue (#00d4ff) accents
- Dark gradient background
- Glowing effects on hover
- Smooth animations

## Mobile Support
The console is fully responsive and adapts to mobile screens, taking up most of the viewport on smaller devices.
