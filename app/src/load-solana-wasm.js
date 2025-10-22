/**
 * Alternative WASM loader using script injection
 * This bypasses React's module restrictions
 */

export async function loadSolanaWasm() {
  return new Promise((resolve, reject) => {
    // Create a script that will load and initialize the WASM
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import init, { SolanaClient } from '${process.env.PUBLIC_URL}/solana-client/solana_client.js';

      (async () => {
        try {
          console.log('Initializing Solana WASM module...');
          await init('${process.env.PUBLIC_URL}/solana-client/solana_client_bg.wasm');

          // Expose on window
          window.__solanaWasmModule = { SolanaClient };

          // Dispatch event
          window.dispatchEvent(new CustomEvent('solana-wasm-ready'));
          console.log('✅ Solana WASM module ready');
        } catch (error) {
          console.error('Failed to initialize Solana WASM:', error);
          window.dispatchEvent(new CustomEvent('solana-wasm-error', { detail: error }));
        }
      })();
    `;

    // Listen for success
    const successHandler = () => {
      cleanup();
      resolve(window.__solanaWasmModule);
    };

    // Listen for error
    const errorHandler = (event) => {
      cleanup();
      reject(event.detail || new Error('Failed to load Solana WASM'));
    };

    const cleanup = () => {
      window.removeEventListener('solana-wasm-ready', successHandler);
      window.removeEventListener('solana-wasm-error', errorHandler);
    };

    window.addEventListener('solana-wasm-ready', successHandler);
    window.addEventListener('solana-wasm-error', errorHandler);

    // Inject the script
    document.head.appendChild(script);

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!window.__solanaWasmModule) {
        cleanup();
        reject(new Error('Timeout loading Solana WASM'));
      }
    }, 10000);
  });
}
