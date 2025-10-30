/**
 * Debug Logger Utility
 * Emits transaction events for the Debug Console to display
 */

/**
 * Log a transaction to the Debug Console
 * @param {Object} options - Transaction details
 * @param {string} options.type - Transaction type (e.g., 'Matchmaking', 'Game', 'Map Registry')
 * @param {string} options.action - Action description (e.g., 'Init Player', 'Join Game')
 * @param {string} options.functionName - Function name being called (e.g., 'initPlayer', 'processInput')
 * @param {string} options.signature - Transaction signature
 * @param {string} options.endpoint - RPC endpoint URL
 * @param {string} options.status - Transaction status ('pending', 'success', 'error')
 * @param {string} options.error - Error message (if status is 'error')
 */
export function logTransaction({ type, action, functionName, signature, endpoint, status, error }) {
  const event = new CustomEvent('debug-transaction', {
    detail: {
      type,
      action,
      functionName,
      signature,
      endpoint,
      status,
      error,
      timestamp: new Date().toISOString(),
    },
  });
  
  window.dispatchEvent(event);
  
  // Also log to console for debugging
  /*const emoji = status === 'success' ? '✅' : status === 'error' ? '❌' : '⏳';
  console.log(`${emoji} [${type}] ${functionName || action}`, {
    signature,
    endpoint,
    status,
    error,
  });*/
}

/**
 * Wrap a transaction promise with automatic logging
 * @param {string} type - Transaction type
 * @param {string} action - Action description
 * @param {string} endpoint - RPC endpoint URL
 * @param {Promise} txPromise - Transaction promise
 * @param {string} functionName - Optional function name
 * @returns {Promise} The original promise
 */
export async function logTransactionPromise(type, action, endpoint, txPromise, functionName = null) {
  // Log pending state
  logTransaction({
    type,
    action,
    functionName,
    endpoint,
    status: 'pending',
  });

  try {
    const signature = await txPromise;
    
    // Log success
    logTransaction({
      type,
      action,
      functionName,
      signature,
      endpoint,
      status: 'success',
    });

    return signature;
  } catch (error) {
    // Log error
    logTransaction({
      type,
      action,
      functionName,
      endpoint,
      status: 'error',
      error: error.message || String(error),
    });

    throw error;
  }
}

export default { logTransaction, logTransactionPromise };
