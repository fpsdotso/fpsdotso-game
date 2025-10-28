/**
 * WebSocket Game Manager - Real-time game state synchronization
 * This module manages WebSocket connections to the ephemeral rollup for real-time
 * player position updates, replacing the 33ms HTTP polling approach.
 */

const WEBSOCKET_RPC_URL = process.env.REACT_APP_EPHEMERAL_WEBSOCKET_RPC_URL || "ws://127.0.0.1:7800";
console.log(`🔌 WebSocket RPC URL: ${WEBSOCKET_RPC_URL}`);

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
  }

  /**
   * Connect to the WebSocket RPC endpoint
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        console.log("✅ Already connected to WebSocket");
        resolve();
        return;
      }

      console.log(`🔌 Connecting to WebSocket: ${WEBSOCKET_RPC_URL}`);

      try {
        this.ws = new WebSocket(WEBSOCKET_RPC_URL);

        this.ws.onopen = () => {
          console.log("✅ WebSocket connected");
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("🔌 WebSocket disconnected");
          this.isConnected = false;
          this.handleDisconnect();
        };
      } catch (error) {
        console.error("❌ Failed to create WebSocket:", error);
        reject(error);
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

        console.log(`🔔 WebSocket notification received for subscription ${subscriptionId}`);

        if (callback) {
          // Extract account data from the notification
          const accountData = message.params.result;
          console.log("📦 Account data:", accountData);
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
            console.log(`✅ RPC response for message ${message.id}:`, message.result);
            pending.resolve(message.result);
          }
        }
      } else {
        console.log("📬 Other WebSocket message:", message);
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

      console.log(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

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
    if (!this.isConnected) {
      await this.connect();
    }

    console.log(`📡 Subscribing to account: ${accountPubkey}`);

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

      console.log(`✅ Subscribed to account ${accountPubkey}, subscription ID: ${subscriptionId}`);
      return subscriptionId;
    } catch (error) {
      console.error(`❌ Failed to subscribe to account ${accountPubkey}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from account changes
   * @param {string} accountPubkey - The account public key
   */
  async unsubscribeFromAccount(accountPubkey) {
    const subscriptionId = this.accountSubscriptions.get(accountPubkey);

    if (!subscriptionId) {
      console.warn(`⚠️ No subscription found for account: ${accountPubkey}`);
      return;
    }

    try {
      await this.sendRequest("accountUnsubscribe", [subscriptionId]);

      this.subscriptions.delete(subscriptionId);
      this.accountSubscriptions.delete(accountPubkey);

      console.log(`✅ Unsubscribed from account ${accountPubkey}`);
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
    console.log(`📡 Subscribing to ${gamePlayerPubkeys.length} GamePlayer accounts`);

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
    console.log(`✅ Subscribed to all GamePlayer accounts`);
  }

  /**
   * Unsubscribe from all GamePlayer accounts
   * @param {Array<string>} gamePlayerPubkeys - Array of GamePlayer account public keys
   */
  async unsubscribeFromGamePlayers(gamePlayerPubkeys) {
    console.log(`📡 Unsubscribing from ${gamePlayerPubkeys.length} GamePlayer accounts`);

    const unsubscribePromises = gamePlayerPubkeys.map(async (pubkey) => {
      try {
        await this.unsubscribeFromAccount(pubkey);
      } catch (error) {
        console.error(`❌ Failed to unsubscribe from GamePlayer ${pubkey}:`, error);
      }
    });

    await Promise.all(unsubscribePromises);
    console.log(`✅ Unsubscribed from all GamePlayer accounts`);
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
    if (this.ws) {
      console.log("🔌 Disconnecting WebSocket");
      this.isConnected = false;
      this.ws.close();
      this.ws = null;
      this.subscriptions.clear();
      this.accountSubscriptions.clear();
      this.pendingRequests.clear();
    }
  }
}

// Export singleton instance
const websocketGameManager = new WebSocketGameManager();
export default websocketGameManager;
