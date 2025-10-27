use std::env;
use std::path::PathBuf;

fn main() {
    // Set appropriate flags for WASM builds
    // These flags only apply to the final binary, not to library dependencies
    let target = env::var("TARGET").unwrap_or_default();
    let package_name = env::var("CARGO_PKG_NAME").unwrap_or_default();

    // Only apply these settings to our main package, not dependencies
    if target == "wasm32-unknown-emscripten" && package_name == "fpsdotso-game" {
        // Export main and our custom game control functions
        println!("cargo:rustc-link-arg=-sEXPORTED_FUNCTIONS=['_main','_start_game','_stop_game','_set_current_game_js','_malloc','_free']");
        println!("cargo:rustc-link-arg=-sEXPORTED_RUNTIME_METHODS=['cwrap','lengthBytesUTF8','stringToUTF8', 'HEAPF32']");
        //println!("cargo:rustc-link-arg=-sMODULARIZE=1");

        // Get the manifest directory (where Cargo.toml is)
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let assets_path = PathBuf::from(&manifest_dir).join("assets");

        // Embed the assets directory for WASM build with absolute path
        if assets_path.exists() {
            let assets_str = assets_path.to_str().unwrap();
            println!("cargo:warning=Embedding assets from: {}", assets_str);
            println!("cargo:rustc-link-arg=--preload-file");
            println!("cargo:rustc-link-arg={}@/assets", assets_str);
        } else {
            println!("cargo:warning=Assets directory not found at: {:?}", assets_path);
        }
    }

    // Tell cargo to rerun this build script if assets change
    println!("cargo:rerun-if-changed=assets/");
}