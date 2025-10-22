#!/bin/bash

source emsdk_env.sh

echo "Building for WebAssembly..."

# Check if emscripten is installed
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten is not installed or not in PATH"
    echo "Please install Emscripten: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Add wasm32-unknown-emscripten target if not already added
rustup target add wasm32-unknown-emscripten

# Set Emscripten compiler flags for WASM
export EMCC_CFLAGS="-O3 -sUSE_GLFW=3 -sASSERTIONS=1 -sWASM=1 -sASYNCIFY -sGL_ENABLE_GET_PROC_ADDRESS=1"

echo "Step 1: Building Solana client library (wasm-bindgen)..."
cd solana-client
wasm-pack build --target web --out-dir ../app/public/solana-client
cd ..

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Solana client build failed!"
    exit 1
fi

echo ""
echo "Step 2: Building Raylib game (Emscripten)..."
cargo build --release --target wasm32-unknown-emscripten -p fpsdotso-game

# Check if build succeeded
if [ $? -eq 0 ]; then
    # Copy the output files (note: wasm file uses underscores)
    echo "Copying game output files to app/public/..."
    cp target/wasm32-unknown-emscripten/release/fpsdotso-game.js app/public/fpsdotso-game.js
    cp target/wasm32-unknown-emscripten/release/fpsdotso_game.wasm app/public/fpsdotso_game.wasm

    echo ""
    echo "✅ Build complete!"
    echo ""
    echo "Output files:"
    echo "  Solana client (wasm-bindgen):"
    echo "    - app/public/solana-client/"
    echo "  Raylib game (Emscripten):"
    echo "    - app/public/fpsdotso-game.js"
    echo "    - app/public/fpsdotso_game.wasm"
    echo ""
    echo "These are two separate WASM modules that communicate via JavaScript."
    echo ""
    echo "To run the game, start the React app:"
    echo "  cd app && npm start"
else
    echo ""
    echo "❌ Game build failed! Check the error messages above."
    exit 1
fi
