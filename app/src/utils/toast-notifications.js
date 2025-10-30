/**
 * Toast Notifications Utility
 * Handles transaction notifications with Solscan links
 */

import toast from 'react-hot-toast';
import { logTransaction } from './debug-logger.js';

// Get RPC URL from environment
const RPC_URL = process.env.REACT_APP_SOLANA_RPC_URL || 'http://127.0.0.1:8899';

/**
 * Extract custom RPC cluster parameter for Solscan
 * Formats the RPC URL to be used as a query parameter
 */
const getCustomRpcParam = () => {
  try {
    // Encode the RPC URL for use in query parameters
    return encodeURIComponent(RPC_URL);
  } catch (error) {
    console.error('Error encoding RPC URL:', error);
    return '';
  }
};

/**
 * Generate Solscan transaction URL with custom RPC
 * @param {string} signature - Transaction signature
 * @returns {string} Solscan URL with custom cluster parameter
 */
const getSolscanUrl = (signature) => {
  const customRpc = getCustomRpcParam();
  // Use custom cluster parameter to point Solscan to our local/custom RPC
  return `https://solscan.io/tx/${signature}?cluster=custom&customUrl=${customRpc}`;
};

/**
 * Show a loading toast for a pending transaction
 * @param {string} message - Message to display
 * @param {string} signature - Transaction signature (optional)
 * @returns {string} Toast ID for updating later
 */
export const showTransactionPending = (message, signature = null) => {
  const toastId = toast.loading(
    <div className="toast-content">
      <div className="toast-message">{message}</div>
      {signature && (
        <a
          href={getSolscanUrl(signature)}
          target="_blank"
          rel="noopener noreferrer"
          className="toast-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on Solscan →
        </a>
      )}
    </div>,
    {
      duration: Infinity, // Don't auto-dismiss
      position: 'bottom-right',
    }
  );
  return toastId;
};

/**
 * Update a pending toast to success
 * @param {string} toastId - ID of the toast to update
 * @param {string} message - Success message
 * @param {string} signature - Transaction signature
 */
export const showTransactionSuccess = (toastId, message, signature) => {
  toast.success(
    <div className="toast-content">
      <div className="toast-message">{message}</div>
      <a
        href={getSolscanUrl(signature)}
        target="_blank"
        rel="noopener noreferrer"
        className="toast-link"
        onClick={(e) => e.stopPropagation()}
      >
        View on Solscan →
      </a>
    </div>,
    {
      id: toastId,
      duration: 5000, // 5 seconds
      position: 'bottom-right',
    }
  );
};

/**
 * Update a pending toast to error
 * @param {string} toastId - ID of the toast to update
 * @param {string} message - Error message
 */
export const showTransactionError = (toastId, message) => {
  toast.error(message, {
    id: toastId,
    duration: 5000, // 5 seconds
    position: 'bottom-right',
  });
};

/**
 * Show a matchmaking transaction notification
 * @param {string} action - Action being performed (e.g., "Creating Game", "Joining Game")
 * @param {Promise} txPromise - Promise that resolves to transaction signature
 * @param {string} functionName - Optional function name being called
 */
export const showMatchmakingTransaction = async (action, txPromise, functionName = null) => {
  const toastId = showTransactionPending(`${action}...`);
  
  // Log to debug console - pending
  logTransaction({
    type: 'Matchmaking',
    action,
    functionName,
    endpoint: RPC_URL,
    status: 'pending',
  });
  
  try {
    const signature = await txPromise;
    showTransactionSuccess(toastId, `${action} successful!`, signature);
    
    // Log to debug console - success
    logTransaction({
      type: 'Matchmaking',
      action,
      functionName,
      signature,
      endpoint: RPC_URL,
      status: 'success',
    });
    
    return signature;
  } catch (error) {
    showTransactionError(toastId, `${action} failed: ${error.message}`);
    
    // Log to debug console - error
    logTransaction({
      type: 'Matchmaking',
      action,
      functionName,
      endpoint: RPC_URL,
      status: 'error',
      error: error.message,
    });
    
    throw error;
  }
};

/**
 * Show a map registry transaction notification
 * @param {string} action - Action being performed (e.g., "Creating Map", "Updating Map")
 * @param {Promise} txPromise - Promise that resolves to transaction signature
 * @param {string} functionName - Optional function name being called
 */
export const showMapRegistryTransaction = async (action, txPromise, functionName = null) => {
  const toastId = showTransactionPending(`${action}...`);
  
  // Log to debug console - pending
  logTransaction({
    type: 'Map Registry',
    action,
    functionName,
    endpoint: RPC_URL,
    status: 'pending',
  });
  
  try {
    const signature = await txPromise;
    showTransactionSuccess(toastId, `${action} successful!`, signature);
    
    // Log to debug console - success
    logTransaction({
      type: 'Map Registry',
      action,
      functionName,
      signature,
      endpoint: RPC_URL,
      status: 'success',
    });
    
    return signature;
  } catch (error) {
    showTransactionError(toastId, `${action} failed: ${error.message}`);
    
    // Log to debug console - error
    logTransaction({
      type: 'Map Registry',
      action,
      functionName,
      endpoint: RPC_URL,
      status: 'error',
      error: error.message,
    });
    
    throw error;
  }
};

/**
 * Show a generic transaction notification with custom messages
 * @param {string} pendingMessage - Message to show while pending
 * @param {string} successMessage - Message to show on success
 * @param {Promise} txPromise - Promise that resolves to transaction signature
 */
export const showTransaction = async (pendingMessage, successMessage, txPromise) => {
  const toastId = showTransactionPending(pendingMessage);
  
  try {
    const signature = await txPromise;
    showTransactionSuccess(toastId, successMessage, signature);
    return signature;
  } catch (error) {
    showTransactionError(toastId, `Transaction failed: ${error.message}`);
    throw error;
  }
};
