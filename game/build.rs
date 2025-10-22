use std::env;

fn main() {
    // Set appropriate flags for WASM builds
    // These flags only apply to the final binary, not to library dependencies
    let target = env::var("TARGET").unwrap_or_default();
    let package_name = env::var("CARGO_PKG_NAME").unwrap_or_default();

    // Only apply these settings to our main package, not dependencies
    if target == "wasm32-unknown-emscripten" && package_name == "fpsdotso-game" {
        // Only export _main for our binary target
        println!("cargo:rustc-link-arg=-sEXPORTED_FUNCTIONS=['_main']");
        println!("cargo:rustc-link-arg=-sEXPORTED_RUNTIME_METHODS=['cwrap']");
        //println!("cargo:rustc-link-arg=-sMODULARIZE=1");
    }
}
