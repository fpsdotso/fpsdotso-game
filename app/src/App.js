import React, { useEffect } from 'react';
import './App.css';

function App() {
  useEffect(() => {
    // Ensure the canvas element exists
    const canvas = document.getElementById('canvas');
    if (!canvas) {
      console.error('Canvas element not found!');
      return;
    }

    // Define the Module object for Emscripten
    window.Module = {
      canvas: canvas,
      locateFile: function (path) {
        if (path.endsWith('.wasm')) {
          return `${process.env.PUBLIC_URL}/fpsdotso_game.wasm`;
        }
        return path;
      },
    };

    // Check if the script is already loaded
    const existingScript = document.querySelector(`script[src="${process.env.PUBLIC_URL}/rust-raylib.js"]`);
    if (!existingScript) {
      // Dynamically load the rust-raylib.js script
      const script = document.createElement('script');
      script.src = `${process.env.PUBLIC_URL}/fpsdotso-game.js`;
      script.async = true;

      // Append the script to the document
      document.body.appendChild(script);

      // Cleanup the script when the component unmounts
      return () => {
        document.body.removeChild(script);
      };
    }
  }, []);

  return (
    <div id="container">
      <h1>Rust + Raylib WebAssembly Demo</h1>
      <canvas id="canvas" onContextMenu={(e) => e.preventDefault()}></canvas>
    </div>
  );
}

export default App;