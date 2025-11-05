/**
 * WebSocket Game Manager - Real-time game state synchronization
 * This module manages WebSocket connections to the ephemeral rollup for real-time
 * player position updates, replacing the 33ms HTTP polling approach.
 * Includes HTTP RPC fallback when WebSocket fails.
 */

const WEBSOCKET_RPC_URL = process.env.REACT_APP_EPHEMERAL_WEBSOCKET_RPC_URL || "ws://127.0.0.1:7800";
const HTTP_RPC_URL = process.env.REACT_APP_EPHEMERAL_RPC_URL || "http://127.0.0.1:8899";
const HTTP_FALLBACK_POLL_INTERVAL = 100; // Poll every 100ms when using HTTP fallback

class WebSocketGameManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // 1 second
    this.subscriptions = new Map(); // subscription_id -> callback
    this.accountSubscriptions = new Map(); // account_pubkey -> subscription_id
    this.messageId = 1;
    this.pendingRequests = new Map(); // message_id -> { resolve, reject }
    
    // HTTP fallback state
    this.useHttpFallback = false;
    this.httpPollingIntervals = new Map(); // account_pubkey -> interval_id
    this.httpCallbacks = new Map(); // account_pubkey -> callback
  }

  /**
   * Connect to the WebSocket RPC endpoint
   * Falls back to HTTP polling if WebSocket fails
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      try {
        console.log("🔌 Attempting to connect to WebSocket:", WEBSOCKET_RPC_URL);
        this.ws = new WebSocket(WEBSOCKET_RPC_URL);

        const connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            console.warn("⚠️ WebSocket connection timeout, falling back to HTTP RPC");
            this.ws.close();
            this.enableHttpFallback();
            resolve(); // Resolve anyway since we have fallback
          }
        }, 5000); // 5 second timeout

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.useHttpFallback = false;
          this.reconnectAttempts = 0;
          console.log("✅ WebSocket connected successfully");
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error("❌ WebSocket error:", error);
          console.log("🔄 Enabling HTTP RPC fallback...");
          this.enableHttpFallback();
          resolve(); // Resolve with fallback enabled
        };

        this.ws.onclose = () => {
          clearTimeout(connectionTimeout);
          this.isConnected = false;
          this.handleDisconnect();
        };
      } catch (error) {
        console.error("❌ Failed to create WebSocket:", error);
        console.log("🔄 Enabling HTTP RPC fallback...");
        this.enableHttpFallback();
        resolve(); // Resolve with fallback enabled
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      // Handle subscription notifications
      if (message.method === "accountNotification") {
        const subscriptionId = message.params.subscription;
        const callback = this.subscriptions.get(subscriptionId);

        //console.log(`🔔 WebSocket notification received for subscription ${subscriptionId}`);

        if (callback) {
          // Extract account data from the notification
          const accountData = message.params.result;
          //console.log("📦 Account data:", accountData);
          callback(accountData);
        } else {
          console.warn(`⚠️ No callback found for subscription ${subscriptionId}`);
        }
      }
      // Handle RPC responses
      else if (message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);

          if (message.error) {
            console.error(`❌ RPC error for message ${message.id}:`, message.error);
            pending.reject(new Error(message.error.message || "RPC request failed"));
          } else {
            pending.resolve(message.result);
          }
        }
      } else {
        // Ignore other messages
      }
    } catch (error) {
      console.error("❌ Failed to parse WebSocket message:", error);
    }
  }

  /**
   * Handle disconnection and attempt reconnect
   */
  handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error("❌ Reconnect failed:", error);
        });
      }, delay);
    } else {
      console.error("❌ Max reconnection attempts reached");
    }
  }

  /**
   * Send a JSON-RPC request
   */
  async sendRequest(method, params = []) {
    if (!this.isConnected) {
      throw new Error("WebSocket not connected");
    }

    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const request = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }

  /**
   * Subscribe to account changes
   * @param {string} accountPubkey - The account public key to monitor
   * @param {Function} callback - Callback function when account changes
   * @returns {number} Subscription ID
   */
  async subscribeToAccount(accountPubkey, callback) {
    // Use HTTP fallback if WebSocket is not available
    if (this.useHttpFallback) {
      console.log(`📡 Using HTTP fallback for account: ${accountPubkey.slice(0, 8)}...`);
      return this.subscribeViaHttp(accountPubkey, callback);
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const subscriptionId = await this.sendRequest("accountSubscribe", [
        accountPubkey,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
        },
      ]);

      this.subscriptions.set(subscriptionId, callback);
      this.accountSubscriptions.set(accountPubkey, subscriptionId);

      return subscriptionId;
    } catch (error) {
      console.error(`❌ Failed to subscribe to account ${accountPubkey}:`, error);
      console.log(`🔄 Falling back to HTTP polling for ${accountPubkey.slice(0, 8)}...`);
      // Fall back to HTTP if WebSocket subscription fails
      this.enableHttpFallback();
      return this.subscribeViaHttp(accountPubkey, callback);
    }
  }

  /**
   * Enable HTTP fallback mode
   */
  enableHttpFallback() {
    if (!this.useHttpFallback) {
      console.log("🔄 HTTP RPC fallback enabled");
      this.useHttpFallback = true;
    }
  }

  /**
   * Subscribe to account via HTTP polling (fallback)
   * @param {string} accountPubkey - The account public key to monitor
   * @param {Function} callback - Callback function when account changes
   * @returns {string} Pseudo-subscription ID (account pubkey)
   */
  subscribeViaHttp(accountPubkey, callback) {
    // Store callback
    this.httpCallbacks.set(accountPubkey, callback);

    // Start polling interval
    const intervalId = setInterval(async () => {
      try {
        const accountInfo = await this.fetchAccountViaHttp(accountPubkey);
        if (accountInfo) {
          callback(accountInfo);
        }
      } catch (error) {
        console.error(`❌ HTTP polling error for ${accountPubkey.slice(0, 8)}:`, error.message);
      }
    }, HTTP_FALLBACK_POLL_INTERVAL);

    this.httpPollingIntervals.set(accountPubkey, intervalId);
    console.log(`✅ HTTP polling started for ${accountPubkey.slice(0, 8)}... (${HTTP_FALLBACK_POLL_INTERVAL}ms interval)`);

    return accountPubkey; // Return pubkey as pseudo-subscription ID
  }

  /**
   * Fetch account info via HTTP RPC
   * @param {string} accountPubkey - The account public key
   * @returns {Object} Account data in WebSocket notification format
   */
  async fetchAccountViaHttp(accountPubkey) {
    const response = await fetch(HTTP_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          accountPubkey,
          {
            encoding: 'base64',
            commitment: 'confirmed',
          },
        ],
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    // Format to match WebSocket notification structure
    return {
      value: data.result.value,
    };
  }

  /**
   * Unsubscribe from account changes
   * @param {string} accountPubkey - The account public key
   */
  async unsubscribeFromAccount(accountPubkey) {
    // Handle HTTP fallback unsubscribe
    if (this.httpPollingIntervals.has(accountPubkey)) {
      const intervalId = this.httpPollingIntervals.get(accountPubkey);
      clearInterval(intervalId);
      this.httpPollingIntervals.delete(accountPubkey);
      this.httpCallbacks.delete(accountPubkey);
      console.log(`🛑 HTTP polling stopped for ${accountPubkey.slice(0, 8)}...`);
      return;
    }

    const subscriptionId = this.accountSubscriptions.get(accountPubkey);

    if (!subscriptionId) {
      return;
    }

    try {
      await this.sendRequest("accountUnsubscribe", [subscriptionId]);

      this.subscriptions.delete(subscriptionId);
      this.accountSubscriptions.delete(accountPubkey);
    } catch (error) {
      console.error(`❌ Failed to unsubscribe from account ${accountPubkey}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to multiple GamePlayer accounts for real-time position updates
   * @param {Array<string>} gamePlayerPubkeys - Array of GamePlayer account public keys
   * @param {Function} callback - Callback function (accountPubkey, accountData) => void
   */
  async subscribeToGamePlayers(gamePlayerPubkeys, callback) {
    const subscriptionPromises = gamePlayerPubkeys.map(async (pubkey) => {
      try {
        await this.subscribeToAccount(pubkey, (accountData) => {
          callback(pubkey, accountData);
        });
      } catch (error) {
        console.error(`❌ Failed to subscribe to GamePlayer ${pubkey}:`, error);
      }
    });

    await Promise.all(subscriptionPromises);
  }

  /**
   * Unsubscribe from all GamePlayer accounts
   * @param {Array<string>} gamePlayerPubkeys - Array of GamePlayer account public keys
   */
  async unsubscribeFromGamePlayers(gamePlayerPubkeys) {
    const unsubscribePromises = gamePlayerPubkeys.map(async (pubkey) => {
      try {
        await this.unsubscribeFromAccount(pubkey);
      } catch (error) {
        console.error(`❌ Failed to unsubscribe from GamePlayer ${pubkey}:`, error);
      }
    });

    await Promise.all(unsubscribePromises);
  }

  /**
   * Get account info (one-time fetch, not subscription)
   * @param {string} accountPubkey - The account public key
   * @returns {Object} Account data
   */
  async getAccountInfo(accountPubkey) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const accountInfo = await this.sendRequest("getAccountInfo", [
        accountPubkey,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
        },
      ]);

      return accountInfo;
    } catch (error) {
      console.error(`❌ Failed to get account info for ${accountPubkey}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect and clean up
   */
  disconnect() {
    // Clean up HTTP polling intervals
    for (const [accountPubkey, intervalId] of this.httpPollingIntervals.entries()) {
      clearInterval(intervalId);
      console.log(`🛑 Stopped HTTP polling for ${accountPubkey.slice(0, 8)}...`);
    }
    this.httpPollingIntervals.clear();
    this.httpCallbacks.clear();

    // Clean up WebSocket
    if (this.ws) {
      this.isConnected = false;
      this.ws.close();
      this.ws = null;
      this.subscriptions.clear();
      this.accountSubscriptions.clear();
      this.pendingRequests.clear();
    }
    
    this.useHttpFallback = false;
  }
}

// Export singleton instance
const websocketGameManager = new WebSocketGameManager();
export default websocketGameManager;
