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

# Build the project
cargo build --release --target wasm32-unknown-emscripten

# Copy the output files (note: wasm file uses underscores)
cp target/wasm32-unknown-emscripten/release/fpsdotso-game.js app/public/fpsdotso-game.js
cp target/wasm32-unknown-emscripten/release/fpsdotso_game.wasm app/public/fpsdotso_game.wasm

echo "Build complete! Open index.html in a web server to run the app."
echo "You can use: python3 -m http.server 8000"