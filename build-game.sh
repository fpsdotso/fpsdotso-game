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


cargo build --release --target wasm32-unknown-emscripten -p fpsdotso-game

# Check if build succeeded
if [ $? -eq 0 ]; then
    # Copy the output files from deps directory (note: wasm file uses underscores)
    echo "Copying game output files to app/public/..."
    cp target/wasm32-unknown-emscripten/release/deps/fpsdotso_game.js app/public/fpsdotso-game.js
    cp target/wasm32-unknown-emscripten/release/deps/fpsdotso_game.wasm app/public/fpsdotso_game.wasm

    # Copy the .data file (contains preloaded assets like cyber.fbx)
    if [ -f target/wasm32-unknown-emscripten/release/deps/fpsdotso_game.data ]; then
        echo "Copying assets data file (fpsdotso_game.data)..."
        cp target/wasm32-unknown-emscripten/release/deps/fpsdotso_game.data app/public/fpsdotso_game.data
        echo "✅ Copied fpsdotso_game.data ($(du -h target/wasm32-unknown-emscripten/release/deps/fpsdotso_game.data | cut -f1))"
    else
        echo "⚠️  No .data file found (assets may not be embedded)"
    fi

    echo ""
    echo "✅ Build complete!"
    echo ""
    echo "Output files:"
    echo "  Solana client (wasm-bindgen):"
    echo "    - app/public/solana-client/"
    echo "  Raylib game (Emscripten):"
    echo "    - app/public/fpsdotso-game.js"
    echo "    - app/public/fpsdotso_game.wasm"
    if [ -f app/public/fpsdotso_game.data ]; then
        echo "    - app/public/fpsdotso_game.data (embedded assets)"
    fi
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
