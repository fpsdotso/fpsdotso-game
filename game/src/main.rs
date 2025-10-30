use raylib::prelude::*;
use raylib_imgui::RaylibGui;
use std::cell::RefCell;
use std::ffi::CString;
use std::ffi::CStr;
use serde_json::Value;

mod map;
mod menu;
mod game;

use map::{MapBuilder, map::Map};
use menu::{MenuState, MenuTab};
use game::GameState;

// Emscripten bindings for JavaScript interop
extern "C" {
    fn emscripten_run_script_string(script: *const std::os::raw::c_char) -> *const std::os::raw::c_char;
    fn emscripten_run_script(script: *const std::os::raw::c_char);
}

// Global game state for JavaScript interop
// Using thread_local since Emscripten is single-threaded
thread_local! {
    static GAME_STATE: RefCell<Option<*mut GameState>> = RefCell::new(None);
}

/// Set the game state pointer for JavaScript interop
fn set_game_state_ptr(state: *mut GameState) {
    GAME_STATE.with(|gs| {
        *gs.borrow_mut() = Some(state);
    });
}

/// JavaScript-callable function to start playing mode
#[no_mangle]
pub extern "C" fn start_game() {
    use std::ffi::{CString, CStr};
    use serde_json::Value;

    println!("📞 JavaScript called start_game()");

    GAME_STATE.with(|gs| {
        if let Some(state_ptr) = *gs.borrow() {
            unsafe {
                // First, check if JavaScript has already fetched map data
                println!("🗺️ Checking for pre-fetched map data in Module.mapDataResult...");
                let check_js = CString::new("Module.mapDataResult || null").unwrap();
                let result_ptr = emscripten_run_script_string(check_js.as_ptr());

                if !result_ptr.is_null() {
                    let result_str = CStr::from_ptr(result_ptr).to_str().unwrap_or("null");

                    if result_str != "null" {
                        println!("🗺️ Map data found in Module.mapDataResult, attempting to load...");

                        // Parse JSON and load map
                        match serde_json::from_str::<Value>(result_str) {
                            Ok(json_value) => {
                                if let Some(base64_data) = json_value.get("data").and_then(|v| v.as_str()) {
                                    println!("🗺️ Decoding base64 map data...");

                                    use base64::{Engine as _, engine::general_purpose};
                                    match general_purpose::STANDARD.decode(base64_data) {
                                        Ok(bytes) => {
                                            println!("🗺️ Decoded {} bytes, deserializing Borsh...", bytes.len());

                                            match Map::from_borsh_bytes(&bytes) {
                                                Ok(map) => {
                                                    println!("✅ Map deserialized successfully: '{}' with {} objects", map.name, map.objects.len());
                                                    (*state_ptr).load_map(map);
                                                    println!("✅ Map loaded into game state!");
                                                }
                                                Err(e) => {
                                                    println!("❌ Failed to deserialize map from Borsh: {:?}", e);
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            println!("❌ Failed to decode base64: {:?}", e);
                                        }
                                    }
                                } else {
                                    println!("⚠️ No 'data' field in mapDataResult JSON");
                                }
                            }
                            Err(e) => {
                                println!("❌ Failed to parse mapDataResult JSON: {:?}", e);
                            }
                        }

                        // Clear the result after processing
                        let clear_js = CString::new("Module.mapDataResult = null").unwrap();
                        emscripten_run_script(clear_js.as_ptr());
                        println!("🧹 Cleared Module.mapDataResult");
                    } else {
                        println!("⚠️ Module.mapDataResult is null - no map data available");
                    }
                } else {
                    println!("⚠️ Module.mapDataResult is not set");
                }

                // Start playing mode
                (*state_ptr).start_playing();
                println!("✅ Game mode set to Playing");
            }
        } else {
            println!("⚠️ Game state not initialized");
        }
    });
}

/// JavaScript-callable function to stop playing mode
#[no_mangle]
pub extern "C" fn stop_game() {
    println!("📞 JavaScript called stop_game()");
    GAME_STATE.with(|gs| {
        if let Some(state_ptr) = *gs.borrow() {
            unsafe {
                (*state_ptr).stop_playing();
            }
        } else {
            println!("⚠️ Game state not initialized");
        }
    });
}

/// JavaScript-callable function to set current game for sync
#[no_mangle]
pub extern "C" fn set_current_game_js(game_pubkey_ptr: *const std::os::raw::c_char) {
    let game_pubkey = unsafe {
        std::ffi::CStr::from_ptr(game_pubkey_ptr)
            .to_string_lossy()
            .into_owned()
    };

    println!("📞 JavaScript called set_current_game_js: {}", game_pubkey);
    GAME_STATE.with(|gs| {
        if let Some(state_ptr) = *gs.borrow() {
            unsafe {
                (*state_ptr).set_current_game(game_pubkey);
            }
        } else {
            println!("⚠️ Game state not initialized");
        }
    });
}

/// JavaScript-callable: set whether settings overlay is open (to pause input and show cursor)
#[no_mangle]
pub extern "C" fn set_settings_open(is_open: bool) {
    GAME_STATE.with(|gs| {
        if let Some(state_ptr) = *gs.borrow() {
            unsafe {
                let state = &mut *state_ptr;
                state.show_settings = is_open;
            }
        }
    });
}

/// JavaScript-callable: set mouse sensitivity from web UI
#[no_mangle]
pub extern "C" fn set_mouse_sensitivity(value: f32) {
    GAME_STATE.with(|gs| {
        if let Some(state_ptr) = *gs.borrow() {
            unsafe {
                let state = &mut *state_ptr;
                if let Some(ref mut player) = state.player {
                    player.mouse_sensitivity = value;
                }
            }
        }
    });
}

/// JavaScript-callable: get current mouse sensitivity
#[no_mangle]
pub extern "C" fn get_mouse_sensitivity() -> f32 {
    let mut sens = 0.01f32;
    GAME_STATE.with(|gs| {
        if let Some(state_ptr) = *gs.borrow() {
            unsafe {
                let state = &mut *state_ptr;
                if let Some(ref player) = state.player {
                    sens = player.mouse_sensitivity;
                }
            }
        }
    });
    sens
}

/// JavaScript-callable function to get player position for minimap
/// Writes position data (x, y, z, yaw) to the provided pointer
#[no_mangle]
pub extern "C" fn get_player_position(out_ptr: *mut f32) {
    GAME_STATE.with(|gs| {
        if let Some(state_ptr) = *gs.borrow() {
            unsafe {
                let state = &*state_ptr;
                if let Some(ref player) = state.player {
                    // Write position and yaw to output buffer
                    *out_ptr.offset(0) = player.position.x;
                    *out_ptr.offset(1) = player.position.y;
                    *out_ptr.offset(2) = player.position.z;
                    *out_ptr.offset(3) = player.yaw;
                } else {
                    // No player, return zeros
                    *out_ptr.offset(0) = 0.0;
                    *out_ptr.offset(1) = 0.0;
                    *out_ptr.offset(2) = 0.0;
                    *out_ptr.offset(3) = 0.0;
                }
            }
        }
    });
}

/// Apply Solana-themed modern colors to ImGui
pub fn apply_solana_ui_colors(_ui: &imgui::Ui) {
    // Note: Due to imgui 0.12 API limitations, we can't easily mutate the global style
    // Instead, we'll use inline styling with push_style_color calls where needed
    // The dark purple background is set via the Raylib clear_background call
}

/// Draw the map editor UI (only UI element remaining in ImGUI)
fn draw_editor_ui(
    ui: &imgui::Ui,
    map_builder: &mut MapBuilder,
    viewport_width: f32,
    style_applied: &mut bool
) -> bool {
    // Draw map editor UI with a simple top label
    let [window_width, _window_height] = ui.io().display_size;

    // Draw minimal top bar for editor
    let top_bar_token = ui.window("Editor Bar")
        .position([0.0, 0.0], imgui::Condition::Always)
        .size([window_width, 50.0], imgui::Condition::Always)
        .title_bar(false)
        .resizable(false)
        .movable(false)
        .scrollable(false)
        .bg_alpha(0.95)
        .begin();

    if let Some(_token) = top_bar_token {
        ui.dummy([20.0, 0.0]);
        ui.same_line();
        let _title_color = ui.push_style_color(imgui::StyleColor::Text, [0.60, 0.27, 1.0, 1.0]);
        ui.set_window_font_scale(1.5);
        ui.text("MAP EDITOR");
        ui.set_window_font_scale(1.0);
        drop(_title_color);
    }

    // Draw map editor UI below the title bar
    map_builder.draw_imgui_ui(ui, viewport_width, style_applied)
}

fn main() {
    // Initialize the Raylib window with MSAA for better quality
    let (mut rl, thread) = raylib::init()
        .size(1280, 720)
        .title("fps.so")
        .msaa_4x()  // Enable 4x Multi-Sample Anti-Aliasing
        .build();

    rl.set_target_fps(60);

    // Set clipping planes to reduce z-fighting (depth precision issues)
    // Default is usually (0.01, 1000) which can cause z-fighting
    // Using (0.1, 200) gives better depth precision for close objects
    unsafe {
        raylib::ffi::rlSetClipPlanes(0.1, 200.0);
    }

    // Initialize audio
    let mut audio = RaylibAudio::init_audio_device().expect("Failed to initialize audio device");

    // Initialize imgui
    let mut gui = RaylibGui::new(&mut rl, &thread);

    // Create menu state (not used when auto-starting)
    let mut menu_state = MenuState::new();

    // Create game state
    let mut game_state = GameState::new();

    // Initialize touch controls only on touch-enabled devices
    let screen_w = rl.get_screen_width() as f32;
    let screen_h = rl.get_screen_height() as f32;

    // Check if device has touch support via JavaScript
    let is_touch_device = unsafe {
        let js_code = std::ffi::CString::new(
            r#"
            (function() {
                // Check if device has touch support
                return ('ontouchstart' in window) ||
                       (navigator.maxTouchPoints > 0) ||
                       (navigator.msMaxTouchPoints > 0);
            })()
            "#
        ).unwrap();

        let result_ptr = emscripten_run_script_string(js_code.as_ptr());
        let result_str = std::ffi::CStr::from_ptr(result_ptr).to_str().unwrap_or("false");
        result_str == "true"
    };

    // Disable built-in touch controls - we use React VirtualJoystick instead
    println!("🎮 Using React VirtualJoystick - built-in touch controls disabled");

    // Set the game state pointer for JavaScript interop
    set_game_state_ptr(&mut game_state as *mut GameState);
    println!("✅ Game state pointer set for JavaScript interop");

    // Create a new map builder
    let mut map_builder = MapBuilder::new("My Map".to_string());

    // Viewport width (70% of screen)
    let viewport_width = (1280.0 * 0.7) as i32;

    // Track if mouse is over UI
    let mut mouse_over_ui = false;

    // Track if style has been applied
    let mut style_applied = false;

    // Main game loop
    while !rl.window_should_close() {
        let delta = rl.get_frame_time();

        // Handle save/load
        if rl.is_key_pressed(KeyboardKey::KEY_F5) {
            match map_builder.save_map("map.json") {
                Ok(_) => println!("Map saved successfully!"),
                Err(e) => eprintln!("Failed to save map: {}", e),
            }
        }
        if rl.is_key_pressed(KeyboardKey::KEY_F9) {
            match MapBuilder::load_map("map.json") {
                Ok(loaded) => {
                    map_builder = loaded;
                    println!("Map loaded successfully!");
                }
                Err(e) => eprintln!("Failed to load map: {}", e),
            }
        }

        // Start imgui frame
        let ui = gui.begin(&mut rl);

        // Toggle between editor and gameplay with Tab key
        if rl.is_key_pressed(KeyboardKey::KEY_TAB) {
            match game_state.mode {
                game::GameMode::Playing => {
                    menu_state.current_tab = MenuTab::MapEditor;
                    game_state.mode = game::GameMode::DebugMenu;
                },
                game::GameMode::DebugMenu => {
                    if menu_state.current_tab == MenuTab::MapEditor {
                        game_state.mode = game::GameMode::Playing;
                    }
                }
            }
        }

        // Check for async responses from blockchain (still needed for gameplay)
        menu_state.check_load_games_response();
        menu_state.check_create_game_response();
        menu_state.check_join_game_response();
        menu_state.check_start_game_response();
        menu_state.check_lobby_data_response();
        menu_state.check_team_players_response();
        menu_state.check_player_current_game_response();
        menu_state.check_set_ready_response();

        // Check if game should start (when game state changes to 1)
        if menu_state.game_should_start {
            println!("🎮 Starting game - transitioning to gameplay!");

            // Fetch the map from blockchain using JavaScript
            if let Some(map_id) = menu_state.current_map_name.clone() {
                println!("🗺️ Fetching map data for ID: '{}'", map_id);
                menu_state.fetch_map_data(&map_id);
                menu_state.game_should_start = false;
                menu_state.waiting_for_map_data = true;
            } else {
                println!("⚠️ No map ID in game data, cannot start game");
                menu_state.game_should_start = false;
            }
        }

        // Check if map data has been loaded and start the game
        if menu_state.waiting_for_map_data {
            menu_state.check_map_data_response(&mut game_state, &mut rl);
        }

        // Update game state if playing
        game_state.update(&mut rl, &mut audio, delta);

        // Capture mouse if in playing mode
        game_state.capture_mouse_if_playing(&mut rl);

        // Show map editor UI when in editor mode
        if game_state.mode == game::GameMode::DebugMenu && menu_state.current_tab == MenuTab::MapEditor {
            mouse_over_ui = draw_editor_ui(ui, &mut map_builder, viewport_width as f32, &mut style_applied);
            map_builder.update(&rl, delta, mouse_over_ui);
        }

        // Render 3D scene
        let mut d = rl.begin_drawing(&thread);
        d.clear_background(Color::new(13, 13, 17, 255)); // Dark purple-tinted background to match Solana theme

        // Render based on mode
        match game_state.mode {
            game::GameMode::Playing => {
                game_state.render(&mut d, &thread);
            },
            game::GameMode::DebugMenu => {
                if menu_state.current_tab == MenuTab::MapEditor {
                    map_builder.render(&mut d, &thread, viewport_width);
                }
            }
        }

        // End imgui frame - this draws the imgui overlay
        gui.end();
    }
}
