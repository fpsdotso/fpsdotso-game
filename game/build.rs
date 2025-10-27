use std::env;

fn main() {
    // Set appropriate flags for WASM builds
    // These flags only apply to the final binary, not to library dependencies
    let target = env::var("TARGET").unwrap_or_default();
    let package_name = env::var("CARGO_PKG_NAME").unwrap_or_default();

    // Only apply these settings to our main package, not dependencies
    if target == "wasm32-unknown-emscripten" && package_name == "fpsdotso-game" {
        // Export main and our custom game control functions
        println!("cargo:rustc-link-arg=-sEXPORTED_FUNCTIONS=['_main','_start_game','_stop_game','_set_current_game_js','_malloc','_free']");
        println!("cargo:rustc-link-arg=-sEXPORTED_RUNTIME_METHODS=['cwrap','lengthBytesUTF8','stringToUTF8']");
        //println!("cargo:rustc-link-arg=-sMODULARIZE=1");
    }
}