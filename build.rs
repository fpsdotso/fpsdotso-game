use std::env;
use dotenv::dotenv;

fn main() {
    // Load the .env file
    dotenv().ok();

    // Read environment variables
    if let Ok(solana_rpc) = env::var("SOLANA_RPC") {
        println!("cargo:rustc-env=SOLANA_RPC={}", solana_rpc);
    }

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
        // Allow memory growth can be useful for dynamic allocation
        // println!("cargo:rustc-link-arg=-sALLOW_MEMORY_GROWTH=1");
    }
}