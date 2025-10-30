use raylib::prelude::*;
use crate::map::Map;
use super::Player;
use crate::game::touch_controls::TouchControls;

// Emscripten bindings for JavaScript interop
extern "C" {
    fn emscripten_run_script(script: *const std::os::raw::c_char);
    fn emscripten_run_script_string(script: *const std::os::raw::c_char) -> *const std::os::raw::c_char;
    fn emscripten_get_now() -> f64; // Returns current time in milliseconds
}

/// Represents the current state of the game
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum GameMode {
    /// In the debug menu (not playing)
    DebugMenu,
    /// Actively playing the game
    Playing,
}

/// Represents another player in the game (from blockchain)
#[derive(Debug, Clone)]
pub struct OtherPlayer {
    pub authority: String,
    pub username: String,
    pub team: String,
    pub position: Vector3,
    pub rotation: Vector3,
    pub is_alive: bool,
    // Interpolation fields for smooth movement
    pub target_position: Vector3,
    pub target_rotation: Vector3,
    // Dead reckoning fields for latency compensation
    pub velocity: Vector3,           // Estimated velocity for prediction
    pub last_update_time: f64,       // Timestamp of last server update
}

/// Represents a bullet trail/tracer effect
#[derive(Debug, Clone)]
pub struct BulletTrail {
    pub start: Vector3,
    pub end: Vector3,
    pub timer: f32, // Time remaining for trail visibility
}

/// Main game state that manages the FPS game
pub struct GameState {
    /// Current game mode
    pub mode: GameMode,

    /// The loaded map (if any)
    pub map: Option<Map>,

    /// The player character
    pub player: Option<Player>,

    /// Whether mouse is captured for FPS controls
    pub mouse_captured: bool,

    /// Whether WebSocket subscriptions are active
    websocket_subscribed: bool,

    /// Current game public key (for fetching other players)
    current_game_pubkey: Option<String>,

    /// Current player authority (wallet public key)
    current_player_authority: Option<String>,

    /// Other players in the game (from blockchain)
    other_players: Vec<OtherPlayer>,

    /// Optional touch controls for mobile
    pub touch_controls: Option<TouchControls>,

    /// Muzzle flash timer (time remaining for flash effect)
    muzzle_flash_timer: f32,

    /// Screen flash timer (time remaining for screen flash)
    screen_flash_timer: f32,

    /// Active bullet trails
    bullet_trails: Vec<BulletTrail>,

    /// Virtual joystick input state
    joystick_input: (bool, bool, bool, bool), // (forward, backward, left, right)

    /// Current bullet count (for ammo tracking)
    current_bullet_count: u8,

    /// Whether reload is in progress (to show "Press R to reload" message)
    show_reload_prompt: bool,

    /// Reload animation progress (0.0 to 1.0, 0.0 when not reloading)
    reload_progress: f32,

    /// Whether reload has been initiated
    reload_initiated: bool,

    /// Local timestamp when reload was initiated (for immediate animation start)
    reload_start_time: f64,
}

impl GameState {
    /// Create a new game state
    pub fn new() -> Self {
        Self {
            mode: GameMode::DebugMenu,
            map: None,
            player: None,
            mouse_captured: false,
            websocket_subscribed: false,
            current_game_pubkey: None,
            current_player_authority: None,
            other_players: Vec::new(),
            touch_controls: None,
            muzzle_flash_timer: 0.0,
            screen_flash_timer: 0.0,
            bullet_trails: Vec::new(),
            joystick_input: (false, false, false, false),
            current_bullet_count: 10, // Start with full magazine
            show_reload_prompt: false,
            reload_progress: 0.0,
            reload_initiated: false,
            reload_start_time: 0.0,
        }
    }

    /// Get joystick input from JavaScript global variable
    fn get_joystick_input_from_js(&self) -> Option<(bool, bool, bool, bool)> {
        use std::os::raw::c_char;
        use std::ffi::CString;

        let js_code = r#"
            (() => {
                if (window.joystickInput) {
                    return JSON.stringify({
                        forward: window.joystickInput.forward,
                        backward: window.joystickInput.backward,
                        left: window.joystickInput.left,
                        right: window.joystickInput.right
                    });
                }
                return '{}';
            })();
        "#;

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            let result_ptr = emscripten_run_script_string(c_str.as_ptr());

            if !result_ptr.is_null() {
                let result_str = std::ffi::CStr::from_ptr(result_ptr)
                    .to_string_lossy()
                    .into_owned();

                if !result_str.is_empty() && result_str != "{}" {
                    // Parse JSON response
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&result_str) {
                        if let (Some(forward), Some(backward), Some(left), Some(right)) = (
                            parsed.get("forward").and_then(|v| v.as_bool()),
                            parsed.get("backward").and_then(|v| v.as_bool()),
                            parsed.get("left").and_then(|v| v.as_bool()),
                            parsed.get("right").and_then(|v| v.as_bool()),
                        ) {
                            return Some((forward, backward, left, right));
                        }
                    }
                }
            }
        }

        None
    }

    /// Get mobile camera input from JavaScript global variable
    fn get_mobile_camera_input_from_js(&self) -> Option<(f32, f32)> {
        use std::os::raw::c_char;
        use std::ffi::CString;

        let js_code = r#"
            (() => {
                if (window.cameraInput) {
                    return JSON.stringify({
                        deltaX: window.cameraInput.deltaX,
                        deltaY: window.cameraInput.deltaY
                    });
                }
                return '{}';
            })();
        "#;

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            let result_ptr = emscripten_run_script_string(c_str.as_ptr());

            if !result_ptr.is_null() {
                let result_str = std::ffi::CStr::from_ptr(result_ptr)
                    .to_string_lossy()
                    .into_owned();

                if !result_str.is_empty() && result_str != "{}" {
                    // Parse JSON response
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&result_str) {
                        if let (Some(delta_x), Some(delta_y)) = (
                            parsed.get("deltaX").and_then(|v| v.as_f64()),
                            parsed.get("deltaY").and_then(|v| v.as_f64()),
                        ) {
                            return Some((delta_x as f32, delta_y as f32));
                        }
                    }
                }
            }
        }
        None
    }

    /// Get mobile shoot input from JavaScript global variable
    fn get_mobile_shoot_input_from_js(&self) -> bool {
        use std::os::raw::c_char;
        use std::ffi::CString;

        let js_code = r#"
            (() => {
                if (window.shootInput) {
                    return window.shootInput;
                }
                return false;
            })();
        "#;

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            let result_ptr = emscripten_run_script_string(c_str.as_ptr());

            if !result_ptr.is_null() {
                let result_str = std::ffi::CStr::from_ptr(result_ptr)
                    .to_string_lossy()
                    .into_owned();

                if result_str == "true" {
                    return true;
                }
            }
        }
        false
    }

    /// Get current bullet count from WebSocket data
    fn get_bullet_count_from_websocket(&mut self) -> u8 {
        use std::ffi::CString;

        // Use the simple global variable that game-bridge.js sets
        let js_code = r#"
            (() => {
                try {
                    // Check the simple global variable first (set by game-bridge.js)
                    if (typeof window.___current_player_bullet_count === 'number') {
                        console.log('[Rust] Reading bullet count:', window.___current_player_bullet_count);
                        return window.___current_player_bullet_count;
                    }
                    
                    // Fallback: Try to read from WebSocket updates
                    const ephemeralKey = window.gameBridge?.getCurrentPlayerEphemeralKey();
                    if (!ephemeralKey || !window.___websocket_player_updates) {
                        console.log('[Rust] No ephemeral key or websocket updates, defaulting to 10');
                        return 10;
                    }
                    
                    for (const [accountPubkey, update] of Object.entries(window.___websocket_player_updates)) {
                        if (update.parsed && update.parsed.authority === ephemeralKey) {
                            console.log('[Rust] Found player data, bullet count:', update.parsed.bulletCount);
                            return update.parsed.bulletCount || 10;
                        }
                    }
                    
                    console.log('[Rust] Player not found in websocket updates, defaulting to 10');
                    return 10;
                } catch (e) {
                    console.error('[Rust] Error getting bullet count:', e);
                    return 10;
                }
            })();
        "#;

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            let result_ptr = emscripten_run_script_string(c_str.as_ptr());

            if !result_ptr.is_null() {
                let result_str = std::ffi::CStr::from_ptr(result_ptr)
                    .to_string_lossy();
                
                if let Ok(count) = result_str.parse::<u8>() {
                    // Update internal state
                    self.current_bullet_count = count;
                    
                    // Also update the UI via game bridge
                    let update_ui_code = format!(r#"
                        (() => {{
                            if (window.gameBridge && window.gameBridge.updateUIAmmo) {{
                                window.gameBridge.updateUIAmmo({});
                            }}
                        }})();
                    "#, count);
                    
                    let update_c_str = CString::new(update_ui_code).unwrap();
                    emscripten_run_script(update_c_str.as_ptr());
                    
                    println!("🔫 Rust: Bullet count updated to: {} (UI notified)", count);
                    return count;
                }
            }
        }

        println!("⚠️ Rust: Failed to get bullet count, defaulting to 10");
        10
    }

    /// Get reload timestamp from WebSocket to check if reloading
    fn get_reload_timestamp(&self) -> u64 {
        use std::ffi::CString;

        let js_code = r#"
            (() => {
                try {
                    const ephemeralKey = window.gameBridge?.getCurrentPlayerEphemeralKey();
                    if (!ephemeralKey || !window.___websocket_player_updates) {
                        return 0;
                    }
                    
                    for (const [accountPubkey, update] of Object.entries(window.___websocket_player_updates)) {
                        if (update.parsed && update.parsed.authority === ephemeralKey) {
                            const reloadTimestamp = update.parsed.reloadStartTimestamp || 0;
                            return reloadTimestamp;
                        }
                    }
                    return 0;
                } catch (e) {
                    console.error('❌ JS: Error getting reload timestamp:', e);
                    return 0;
                }
            })();
        "#;

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            let result_ptr = emscripten_run_script_string(c_str.as_ptr());

            if !result_ptr.is_null() {
                let result_str = std::ffi::CStr::from_ptr(result_ptr)
                    .to_string_lossy();
                
                if let Ok(timestamp) = result_str.parse::<u64>() {
                    return timestamp;
                }
            }
        }

        0
    }

    /// Start reload process (Step 1: Call blockchain to record timestamp)
    fn start_reload(&mut self) {
        if self.reload_initiated {
            return; // Already reloading
        }

        if let Some(ref game_pubkey) = self.current_game_pubkey {
            use std::ffi::CString;

            let js_code = format!(r#"
                (async () => {{
                    try {{
                        if (window.gameBridge && window.gameBridge.startReload) {{
                            await window.gameBridge.startReload('{}');
                        }}
                    }} catch (e) {{
                        console.error('❌ Start reload failed:', e);
                    }}
                }})();
            "#, game_pubkey);

            unsafe {
                let c_str = CString::new(js_code).unwrap();
                emscripten_run_script(c_str.as_ptr());
            }

            // Start the animation immediately using local time
            self.reload_initiated = true;
            self.reload_progress = 0.0;
            self.reload_start_time = unsafe { emscripten_get_now() / 1000.0 }; // Store start time in seconds
            self.show_reload_prompt = false; // Hide prompt when reload starts
        }
    }

    /// Finish reload process (Step 2: Call blockchain to refill ammo after 1 second)
    fn finish_reload(&mut self) {
        if !self.reload_initiated {
            return;
        }

        if let Some(ref game_pubkey) = self.current_game_pubkey {
            use std::ffi::CString;

            let js_code = format!(r#"
                (async () => {{
                    try {{
                        if (window.gameBridge && window.gameBridge.finishReload) {{
                            await window.gameBridge.finishReload('{}');
                        }}
                    }} catch (e) {{
                        console.error('❌ Finish reload failed:', e);
                    }}
                }})();
            "#, game_pubkey);

            unsafe {
                let c_str = CString::new(js_code).unwrap();
                emscripten_run_script(c_str.as_ptr());
            }

            self.reload_initiated = false;
            self.reload_progress = 0.0;
            self.reload_start_time = 0.0;
        }
    }

    /// Set virtual joystick input
    pub fn set_joystick_input(&mut self, forward: bool, backward: bool, left: bool, right: bool) {
        self.joystick_input = (forward, backward, left, right);
    }

    /// Initialize touch controls
    pub fn init_touch_controls(&mut self, screen_width: f32, screen_height: f32) {
        self.touch_controls = Some(TouchControls::new(screen_width, screen_height));
    }

    /// Handle shooting - play sound and trigger visual effects
    pub fn shoot(&mut self) {
        // Check bullet count first
        let bullet_count = self.get_bullet_count_from_websocket();
        
        // If no bullets, show reload prompt and prevent shooting
        if bullet_count == 0 {
            self.show_reload_prompt = true;
            return; // Don't shoot
        }

        // Use emscripten to play the sound via Web Audio API
        // This is more reliable than raylib's audio system for WASM
        use std::os::raw::c_char;
        use std::ffi::CString;

        let js_code = r#"
            (function() {
                try {
                    // Create or get cached audio element
                    if (!window.gunshotAudioElement) {
                        window.gunshotAudioElement = new Audio('/assets/gun/audio/submachinegun-gunshot.mp3');
                        window.gunshotAudioElement.volume = 0.3;
                        // Preload the audio
                        window.gunshotAudioElement.load();
                    }
                    // Clone to allow overlapping sounds
                    const audio = window.gunshotAudioElement.cloneNode();
                    audio.volume = 0.3;
                    audio.play().catch(e => console.error('Gunshot play error:', e));
                } catch (error) {
                    console.error('Gunshot audio error:', error);
                }
            })();
        "#;

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            emscripten_run_script(c_str.as_ptr());
        }

        // Create bullet trail from gun muzzle
        if let Some(ref player) = self.player {
            // Calculate gun muzzle position (in front of camera)
            let yaw_rad = player.yaw.to_radians();
            let pitch_rad = player.pitch.to_radians();

            // Direction the gun is pointing
            let direction = Vector3::new(
                yaw_rad.cos() * pitch_rad.cos(),
                pitch_rad.sin(),
                yaw_rad.sin() * pitch_rad.cos(),
            );

            // Right vector for gun offset
            let right = Vector3::new(
                (yaw_rad + 90.0_f32.to_radians()).cos(),
                0.0,
                (yaw_rad + 90.0_f32.to_radians()).sin(),
            );

            // Up vector
            let up = right.cross(direction).normalized();

            // Calculate effective height based on crouching
            let effective_height = if player.is_crouching {
                player.height * 0.6
            } else {
                player.height
            };

            // Camera/eye position
            let camera_pos = Vector3::new(
                player.position.x,
                player.position.y + effective_height,
                player.position.z,
            );

            // Gun muzzle position (in front and to the right, at barrel end)
            let muzzle_pos = camera_pos + direction * 0.8 + right * 0.35 + up * -0.3 + direction * 0.6;

            // Raycast to find where bullet hits
            let max_distance = 100.0; // Maximum bullet travel distance
            let hit_pos = muzzle_pos + direction * max_distance;

            // TODO: Add collision detection with map and players here
            // For now, just draw the trail to max distance

            // Create bullet trail
            self.bullet_trails.push(BulletTrail {
                start: muzzle_pos,
                end: hit_pos,
                timer: 0.1, // Trail visible for 0.1 seconds
            });

            println!("🔫 Bang! Trail from {:?} to {:?}", muzzle_pos, hit_pos);
        }

        // Call blockchain shooting function
        if let Some(ref game_pubkey) = self.current_game_pubkey {
            self.call_blockchain_shoot(game_pubkey);
        }

        // Trigger muzzle flash (lasts 0.05 seconds)
        self.muzzle_flash_timer = 0.05;

        // Trigger screen flash (lasts 0.1 seconds)
        self.screen_flash_timer = 0.1;
    }

    /// Call blockchain shoot instruction via JavaScript
    fn call_blockchain_shoot(&self, game_pubkey: &str) {
        use std::os::raw::c_char;
        use std::ffi::CString;

        let js_code = format!(
            r#"
            (async () => {{
                try {{
                    if (window.gameBridge && window.gameBridge.shootPlayer && window.gameBridge.getOtherPlayerPDAs) {{
                        // Get all other player PDAs for hit detection
                        const otherPlayerPdas = await window.gameBridge.getOtherPlayerPDAs('{}');

                        // Call shoot instruction with 25 damage
                        const result = await window.gameBridge.shootPlayer(25, '{}', otherPlayerPdas);
                        console.log('🎯 Shoot result:', result);

                        // TODO: Check if we got a kill and call awardKill if needed
                        // This would require checking health changes in the returned data
                    }}
                }} catch (error) {{
                    console.error('Error calling blockchain shoot:', error);
                }}
            }})();
            "#,
            game_pubkey,
            game_pubkey
        );

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            emscripten_run_script(c_str.as_ptr());
        }
    }

    /// Call blockchain respawn instruction via JavaScript
    fn call_respawn(&mut self, game_pubkey: &str) {
        use std::os::raw::c_char;
        use std::ffi::CString;

        // Default spawn position (center of map, slightly elevated)
        let spawn_x = 0.0_f32;
        let spawn_y = 1.0_f32;
        let spawn_z = 0.0_f32;

        let js_code = format!(
            r#"
            (async () => {{
                try {{
                    if (window.gameBridge && window.gameBridge.respawnPlayer) {{
                        console.log('♻️ Calling respawn transaction...');
                        const result = await window.gameBridge.respawnPlayer('{}', {}, {}, {});
                        console.log('✅ Respawn transaction sent:', result);
                    }}
                }} catch (error) {{
                    console.error('Error calling respawn:', error);
                }}
            }})();
            "#,
            game_pubkey,
            spawn_x,
            spawn_y,
            spawn_z
        );

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            emscripten_run_script(c_str.as_ptr());
        }

        // Mark that we've attempted respawn (to avoid spamming)
        if let Some(ref mut player) = self.player {
            player.death_timestamp = -1.0; // Negative means respawn requested
        }
    }

    /// Expose death state to JavaScript for React overlay
    fn update_death_state_js(&self, is_dead: bool, timestamp: f64) {
        use std::os::raw::c_char;
        use std::ffi::CString;

        let js_code = format!(
            r#"window.gameDeathState = {{ dead: {}, timestamp: {} }};"#,
            is_dead, timestamp
        );

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            emscripten_run_script(c_str.as_ptr());
        }
    }

    /// Set the current game for blockchain synchronization
    pub fn set_current_game(&mut self, game_pubkey: String) {
        println!("🎮 Setting current game: {}", game_pubkey);
        self.current_game_pubkey = Some(game_pubkey.clone());

        // Initialize WebSocket connection and subscribe to player updates
        self.setup_websocket_subscriptions(&game_pubkey);
    }

    /// Setup WebSocket subscriptions for real-time player updates
    fn setup_websocket_subscriptions(&mut self, game_pubkey: &str) {
        use std::os::raw::c_char;
        use std::ffi::CString;

        if self.websocket_subscribed {
            println!("⚠️ Already subscribed to WebSocket updates");
            return;
        }

        println!("🔌 ==========================================");
        println!("🔌 SETTING UP WEBSOCKET SUBSCRIPTIONS");
        println!("🔌 Game: {}", game_pubkey);
        println!("🔌 This should only happen ONCE per game!");
        println!("🔌 ==========================================" );

        // Call JavaScript to connect WebSocket and subscribe to game players
        let js_code = format!(
            r#"
            (async () => {{
                try {{
                    // Connect to WebSocket
                    console.log('🔌 Connecting to WebSocket...');
                    const connectResult = await window.gameBridge.connectWebSocket();
                    if (!connectResult.success) {{
                        console.error('❌ Failed to connect WebSocket:', connectResult.error);
                        return;
                    }}
                    console.log('✅ WebSocket connected');

                    // Subscribe to all players in the game
                    console.log('📡 Subscribing to game players...');
                    const subscribeResult = await window.gameBridge.subscribeToGamePlayers('{}');
                    if (!subscribeResult.success) {{
                        console.error('❌ Failed to subscribe to game players:', subscribeResult.error);
                        return;
                    }}
                    console.log('✅ Subscribed to', subscribeResult.playerCount, 'players');
                }} catch (error) {{
                    console.error('❌ Error setting up WebSocket:', error);
                }}
            }})();
            "#,
            game_pubkey
        );

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            emscripten_run_script(c_str.as_ptr());
        }

        self.websocket_subscribed = true;
        println!("✅ ==========================================");
        println!("✅ WEBSOCKET SUBSCRIPTIONS SETUP COMPLETE!");
        println!("✅ From now on, player updates via WebSocket");
        println!("✅ NO MORE HTTP POLLING should occur!");
        println!("✅ ==========================================");
    }

    /// Set the current player authority for identifying the local player
    pub fn set_player_authority(&mut self, authority: String) {
        self.current_player_authority = Some(authority);
    }

    /// Load a map and spawn the player
    pub fn load_map(&mut self, map: Map) {
        // Get spawn position from map
        let spawn_pos = Vector3::new(
            map.spawn_x as f32 / 100.0, // Convert from i16 to world units
            0.0, // Always spawn on ground (Y=0), eye height will be added in Player::new
            map.spawn_z as f32 / 100.0,
        );

        // Create player at spawn position (on the ground)
        self.player = Some(Player::new(spawn_pos));

        // Store the map
        self.map = Some(map);

        // Switch to playing mode
        self.mode = GameMode::Playing;
    }

    /// Start the game and switch to Playing mode
    pub fn start_playing(&mut self) {
        println!("🎮 Switching to Playing mode");
        self.mode = GameMode::Playing;
        self.mouse_captured = false; // Will be captured in next frame by capture_mouse_if_playing

        // If no player exists yet, create one at origin
        // Map loading will update the position to spawn point
        if self.player.is_none() {
            println!("⚠️ No player exists, creating default player at origin");
            self.player = Some(Player::new(Vector3::new(0.0, 0.0, 0.0)));
        }

        // If no map exists, log a warning
        if self.map.is_none() {
            println!("⚠️ No map loaded, game will render without map geometry");
        }
    }

    /// Stop the game and release cursor state
    pub fn stop_playing(&mut self) {
        self.mode = GameMode::DebugMenu;
        self.mouse_captured = false;

        // Cleanup WebSocket subscriptions
        self.cleanup_websocket_subscriptions();
    }

    /// Cleanup WebSocket subscriptions when leaving the game
    fn cleanup_websocket_subscriptions(&mut self) {
        use std::os::raw::c_char;
        use std::ffi::CString;

        if !self.websocket_subscribed {
            return;
        }

        println!("🔌 Cleaning up WebSocket subscriptions");

        if let Some(game_pubkey) = &self.current_game_pubkey {
            let js_code = format!(
                r#"
                (async () => {{
                    try {{
                        if (window.gameBridge && window.gameBridge.unsubscribeFromGamePlayers) {{
                            await window.gameBridge.unsubscribeFromGamePlayers('{}');
                            console.log('✅ Unsubscribed from game players');
                        }}
                        if (window.gameBridge && window.gameBridge.disconnectWebSocket) {{
                            window.gameBridge.disconnectWebSocket();
                            console.log('✅ WebSocket disconnected');
                        }}
                    }} catch (error) {{
                        console.error('❌ Error cleaning up WebSocket:', error);
                    }}
                }})();
                "#,
                game_pubkey
            );

            unsafe {
                let c_str = CString::new(js_code).unwrap();
                emscripten_run_script(c_str.as_ptr());
            }
        }

        self.websocket_subscribed = false;
        self.other_players.clear();
        println!("✅ WebSocket cleanup complete");
    }

    /// Capture mouse if in playing mode
    pub fn capture_mouse_if_playing(&mut self, rl: &mut RaylibHandle) {
        if self.mode == GameMode::Playing && !self.mouse_captured {
            rl.disable_cursor();
            self.mouse_captured = true;
        }
    }

    /// Return to debug menu
    pub fn return_to_menu(&mut self, rl: &mut RaylibHandle) {
        self.mode = GameMode::DebugMenu;
        rl.enable_cursor();
        self.mouse_captured = false;
    }

    /// Update game logic
    pub fn update(&mut self, rl: &mut RaylibHandle, audio: &mut RaylibAudio, delta: f32) {
        // ESC to toggle between menu and game
        if rl.is_key_pressed(KeyboardKey::KEY_ESCAPE) {
            if self.mode == GameMode::Playing {
                self.return_to_menu(rl);
            }
        }

        // Update player if in playing mode
        if self.mode == GameMode::Playing {
            // Get joystick input and mobile camera input before borrowing player
            let joystick_input = self.get_joystick_input_from_js();
            let mobile_camera_input = self.get_mobile_camera_input_from_js();
            
            if let Some(ref mut player) = self.player {
                // Update from touch controls if available and active
                // Touch controls disabled - using React VirtualJoystick instead
                if false {
                    if let Some(tc) = &mut self.touch_controls {
                    tc.update(rl);
                    if tc.is_active() {
                        let (fwd, back, left, right) = tc.get_movement_input();
                        let look = tc.get_look_input();
                        let mut mv = Vector2::zero();
                        if fwd { mv.y -= 1.0; }
                        if back { mv.y += 1.0; }
                        if left { mv.x -= 1.0; }
                        if right { mv.x += 1.0; }
                        player.apply_mobile_input(mv, look, delta);
                    } else {
                        player.update(rl, delta, joystick_input, mobile_camera_input);
                    }
                    }
                } else {
                    player.update(rl, delta, joystick_input, mobile_camera_input);
                }
            }

            // Send player input every frame for maximum responsiveness
            if let Some(ref player) = self.player {
                self.send_player_input(rl, player, delta);
            }

            // Handle shooting - left mouse button or mobile shoot button
            let mouse_shoot = rl.is_mouse_button_pressed(MouseButton::MOUSE_BUTTON_LEFT);
            let mobile_shoot = self.get_mobile_shoot_input_from_js();
            let should_shoot = mouse_shoot || mobile_shoot;

            if should_shoot {
                self.shoot();
                
                // Clear mobile shoot input after processing to prevent continuous shooting
                if mobile_shoot {
                    use std::os::raw::c_char;
                    use std::ffi::CString;
                    
                    let js_code = r#"window.shootInput = false;"#;
                    unsafe {
                        let c_str = CString::new(js_code).unwrap();
                        emscripten_run_script(c_str.as_ptr());
                    }
                }
            }

            // Update effect timers
            if self.muzzle_flash_timer > 0.0 {
                self.muzzle_flash_timer -= delta;
            }
            if self.screen_flash_timer > 0.0 {
                self.screen_flash_timer -= delta;
            }

            // Update bullet trails
            for trail in &mut self.bullet_trails {
                trail.timer -= delta;
            }
            // Remove expired trails
            self.bullet_trails.retain(|trail| trail.timer > 0.0);

            // Handle reload animation and progress
            // First, check if we should be in reload state (handles rejoin case)
            let reload_timestamp = self.get_reload_timestamp();
            
            // If reload_timestamp exists but we're not tracking it, sync the state
            if reload_timestamp > 0 && !self.reload_initiated {
                // Check if the reload is already complete (more than 1 second has passed)
                use std::ffi::CString;
                
                let js_code = r#"
                    (() => {
                        try {
                            return Math.floor(Date.now() / 1000);
                        } catch (e) {
                            return 0;
                        }
                    })();
                "#;
                
                let current_time = unsafe {
                    let c_str = CString::new(js_code).unwrap();
                    let result_ptr = emscripten_run_script_string(c_str.as_ptr());
                    
                    if !result_ptr.is_null() {
                        let result_str = std::ffi::CStr::from_ptr(result_ptr).to_string_lossy();
                        result_str.parse::<u64>().unwrap_or(0)
                    } else {
                        0
                    }
                };
                
                let elapsed = current_time.saturating_sub(reload_timestamp);
                
                if elapsed >= 1 {
                    // Reload is already complete, finish it immediately
                    self.reload_initiated = true;
                    self.finish_reload();
                } else {
                    // Reload is still in progress, sync the state
                    self.reload_initiated = true;
                    self.reload_progress = (elapsed as f32).min(1.0);
                }
            }
            
            if self.reload_initiated {
                // Use local time to drive the animation immediately
                let current_time = unsafe { emscripten_get_now() / 1000.0 }; // Convert ms to seconds
                let local_elapsed = current_time - self.reload_start_time;
                
                // Update reload progress based on local time (1 second duration)
                self.reload_progress = (local_elapsed as f32).min(1.0);
                
                // Check blockchain state for actual completion
                if reload_timestamp > 0 {
                    // Get current blockchain timestamp from JavaScript (Solana Clock)
                    use std::ffi::CString;
                    
                    let js_code = r#"
                        (() => {
                            try {
                                return Math.floor(Date.now() / 1000);
                            } catch (e) {
                                console.error('Failed to get current timestamp:', e);
                                return 0;
                            }
                        })();
                    "#;
                    
                    let blockchain_time = unsafe {
                        let c_str = CString::new(js_code).unwrap();
                        let result_ptr = emscripten_run_script_string(c_str.as_ptr());
                        
                        if !result_ptr.is_null() {
                            let result_str = std::ffi::CStr::from_ptr(result_ptr).to_string_lossy();
                            result_str.parse::<u64>().unwrap_or(0)
                        } else {
                            0
                        }
                    };
                    
                    if blockchain_time > 0 {
                        let blockchain_elapsed = blockchain_time.saturating_sub(reload_timestamp);
                        
                        // Auto-finish reload after blockchain confirms 1 second has passed
                        if blockchain_elapsed >= 1 {
                            self.finish_reload();
                        }
                    }
                }
                
                // Also finish locally after 1 second if blockchain hasn't responded yet
                // This ensures the animation completes smoothly even with network latency
                if local_elapsed >= 1.0 {
                    self.finish_reload();
                }
            }

            // Handle R key press for manual reload
            if rl.is_key_pressed(KeyboardKey::KEY_R) {
                let bullet_count = self.get_bullet_count_from_websocket();
                if bullet_count < 10 && !self.reload_initiated {
                    self.start_reload();
                }
            }

            // Smoothly interpolate other players with dead reckoning for latency compensation
            // This runs every frame for buttery smooth movement
            let current_time = unsafe { emscripten_get_now() / 1000.0 };
            for player in &mut self.other_players {
                // Dead reckoning: predict position based on velocity
                // This compensates for network latency by extrapolating movement
                let time_since_update = (current_time - player.last_update_time) as f32;

                // Extrapolate position based on velocity (but limit to prevent overshooting)
                let max_extrapolation_time = 0.2; // Max 200ms of extrapolation
                let extrapolation_time = time_since_update.min(max_extrapolation_time);
                let predicted_position = player.target_position + player.velocity * extrapolation_time;

                // Interpolate towards predicted position (not just target)
                // This makes remote players appear smooth even with latency
                let position_interp_speed = 15.0; // Higher speed for more responsive feel
                player.position = player.position.lerp(predicted_position, delta * position_interp_speed);

                // Interpolate rotation with GENTLER speed to reduce gun jitter
                // Rotation needs to be smoother than position for visual comfort
                let rotation_interp_speed = 8.0; // Slower for smoother gun/direction indicator
                player.rotation = player.rotation.lerp(player.target_rotation, delta * rotation_interp_speed);
            }

            // Client-side prediction for local player with minimal server reconciliation
            // The local player movement is purely client-side for maximum responsiveness
            // We only reconcile if there's a significant mismatch with the server
            if let Some(player) = &mut self.player {
                // Calculate distance between client prediction and server position
                let position_error = (player.position - player.target_position).length();

                // Only reconcile if error is significant (> 0.5 units)
                // This prevents rubber-banding while still correcting major desyncs
                let error_threshold = 0.5;

                if position_error > error_threshold {
                    // Snap correction for large errors (teleportation/major desync)
                    if position_error > 5.0 {
                        player.position = player.target_position;
                        println!("⚠️ Large position error detected ({:.2}), snapping to server position", position_error);
                    } else {
                        // Gentle correction for small errors
                        let correction_speed = 3.0;
                        player.position = player.position.lerp(player.target_position, delta * correction_speed);
                    }
                }

                // Rotation remains purely client-authoritative for responsiveness
                // The server receives and broadcasts our rotation, no reconciliation needed
                player.target_yaw = player.yaw;
                player.target_pitch = player.pitch;
            }

            // Process incoming WebSocket player updates (real-time, no polling!)
            // WebSocket notifications are pushed to us when players move
            self.process_websocket_player_updates();
        }
    }


    /// Send player input to the game contract
    fn send_player_input(&self, rl: &RaylibHandle, player: &Player, delta: f32) {
        use std::os::raw::c_char;
        use std::ffi::CString;

        // Get the game ID - return early if not set
        let game_id = match &self.current_game_pubkey {
            Some(id) => id,
            None => {
                // No game ID set, can't send input
                return;
            }
        };

        // Get player rotation (yaw and pitch) and convert to radians for server
        let yaw_radians = player.yaw.to_radians();
        let pitch_radians = player.pitch.to_radians();

        // Get joystick input to combine with WASD for blockchain
        let joystick_input = self.get_joystick_input_from_js();
        
        // Combine WASD and joystick input for blockchain
        let forward = rl.is_key_down(KeyboardKey::KEY_W) || 
            joystick_input.map_or(false, |(fwd, _, _, _)| fwd);
        let backward = rl.is_key_down(KeyboardKey::KEY_S) || 
            joystick_input.map_or(false, |(_, back, _, _)| back);
        let left = rl.is_key_down(KeyboardKey::KEY_A) || 
            joystick_input.map_or(false, |(_, _, left, _)| left);
        let right = rl.is_key_down(KeyboardKey::KEY_D) || 
            joystick_input.map_or(false, |(_, _, _, right)| right);

        // Prepare input data as JSON - now sending rotation instead of mouse deltas
        let input_json = format!(
            r#"{{
                "forward": {},
                "backward": {},
                "left": {},
                "right": {},
                "rotationX": {},
                "rotationY": {},
                "rotationZ": {},
                "deltaTime": {},
                "gameId": "{}"
            }}"#,
            forward,
            backward,
            left,
            right,
            pitch_radians,  // rotationX (pitch)
            yaw_radians,    // rotationY (yaw) - main horizontal rotation
            0.0,            // rotationZ (roll) - not used for FPS
            delta,          // Use actual frame delta time
            game_id         // Add the game ID (lobby public key)
        );

        // Call JavaScript function to send input
        let js_code = format!(
            r#"
            (async () => {{
                try {{
                    if (window.gameBridge && window.gameBridge.sendPlayerInput) {{
                        const input = {};
                        await window.gameBridge.sendPlayerInput(input);
                    }}
                }} catch (error) {{
                    console.error('Failed to send player input:', error);
                }}
            }})();
            "#,
            input_json
        );

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            emscripten_run_script(c_str.as_ptr());
        }
    }

    /// Process WebSocket player updates (replaces HTTP polling)
    /// This is called every frame to check for new player position updates from WebSocket
    fn process_websocket_player_updates(&mut self) {
        use std::os::raw::c_char;
        use std::ffi::CString;

        // Check if we have WebSocket subscriptions active
        if !self.websocket_subscribed {
            return;
        }

        // Call JavaScript to get any pending WebSocket updates
        let js_code = r#"
            (() => {
                if (window.gameBridge && window.gameBridge.getWebSocketPlayerUpdates) {
                    return window.gameBridge.getWebSocketPlayerUpdates();
                }
                return '{}';
            })();
        "#;

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            let result_ptr = emscripten_run_script_string(c_str.as_ptr());

            if !result_ptr.is_null() {
                let result_str = std::ffi::CStr::from_ptr(result_ptr)
                    .to_string_lossy()
                    .into_owned();

                if !result_str.is_empty() && result_str != "{}" {
                    self.process_websocket_updates_data(&result_str);
                }
            }
        }
    }

    /// Process WebSocket update data
    fn process_websocket_updates_data(&mut self, json_str: &str) {
        use serde_json::Value;

        // Parse the JSON containing WebSocket updates
        if let Ok(updates) = serde_json::from_str::<Value>(json_str) {
            // Updates is a map of accountPubkey -> { timestamp, data, parsed }
            if let Some(updates_obj) = updates.as_object() {
                for (_account_pubkey, update) in updates_obj {
                    // First try to get the parsed data (already decoded by JavaScript)
                    if let Some(parsed) = update.get("parsed") {
                        //println!("📡 Processing WebSocket update (pre-parsed)");
                        self.process_single_player_update(parsed);
                    }
                    // Fallback: try to parse from raw account data
                    else if let Some(account_data) = update.get("data") {
                        if let Some(value) = account_data.get("value") {
                            if let Some(data) = value.get("data") {
                                if let Some(parsed) = data.get("parsed") {
                                    //println!("📡 Processing WebSocket update (fallback parsing)");
                                    self.process_single_player_update(parsed);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /// Process a single player update from WebSocket
    fn process_single_player_update(&mut self, player_data: &serde_json::Value) {
        // Extract player information
        let authority = player_data.get("authority")
            .and_then(|v: &serde_json::Value| v.as_str())
            .unwrap_or("");

        // Get current player's ephemeral key for local player reconciliation
        let current_ephemeral_key = self.get_current_ephemeral_key();
        let is_local_player = authority == current_ephemeral_key;

        // Parse position
        let pos_x = player_data.get("positionX")
            .and_then(|v: &serde_json::Value| v.as_f64())
            .unwrap_or(0.0) as f32;
        let pos_y = player_data.get("positionY")
            .and_then(|v: &serde_json::Value| v.as_f64())
            .unwrap_or(0.0) as f32;
        let pos_z = player_data.get("positionZ")
            .and_then(|v: &serde_json::Value| v.as_f64())
            .unwrap_or(0.0) as f32;

        // Parse rotation (WebSocket sends radians, use directly)
        let rot_x = player_data.get("rotationX")
            .and_then(|v: &serde_json::Value| v.as_f64())
            .unwrap_or(0.0) as f32;
        let rot_y = player_data.get("rotationY")
            .and_then(|v: &serde_json::Value| v.as_f64())
            .unwrap_or(0.0) as f32;
        let rot_z = player_data.get("rotationZ")
            .and_then(|v: &serde_json::Value| v.as_f64())
            .unwrap_or(0.0) as f32;

        // Parse other data
        let username = player_data.get("username")
            .and_then(|v: &serde_json::Value| v.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let team_num = player_data.get("team")
            .and_then(|v: &serde_json::Value| v.as_u64())
            .unwrap_or(1);
        // Team 1 = Team A (Blue), Team 2 = Team B (Red)
        // Store team number directly as "1" or "2" for consistent comparison
        let team = team_num.to_string();

        let is_alive = player_data.get("isAlive")
            .and_then(|v: &serde_json::Value| v.as_bool())
            .unwrap_or(true);

        // Parse health
        let health = player_data.get("health")
            .and_then(|v: &serde_json::Value| v.as_u64())
            .unwrap_or(100) as f32;

        let new_position = Vector3::new(pos_x, pos_y, pos_z);
        let new_rotation = Vector3::new(rot_x, rot_y, rot_z);

        // Handle local player reconciliation
        if is_local_player {
            // Variables to track state changes
            let mut just_died = false;
            let mut should_respawn = false;
            let mut just_respawned = false;
            let mut death_time = 0.0;

            if let Some(player) = &mut self.player {
                // Update target position for smooth server reconciliation
                // This allows the local player to interpolate towards the server's position
                player.target_position = new_position;
                // Convert rotation from radians (server) to degrees (Player struct)
                player.target_yaw = rot_y.to_degrees(); // rotationY is the yaw
                player.target_pitch = rot_x.to_degrees(); // rotationX is the pitch

                // Update health from blockchain
                player.health = health;

                // Check for death
                if player.health <= 0.0 && !player.is_dead {
                    // Player just died
                    player.is_dead = true;
                    let current_time = unsafe { emscripten_get_now() / 1000.0 }; // Convert ms to seconds
                    player.death_timestamp = current_time;
                    println!("💀 Player died! Respawn available in 3 seconds...");

                    just_died = true;
                    death_time = current_time;
                }

                // Check for respawn
                if player.is_dead && !is_alive {
                    let current_time = unsafe { emscripten_get_now() / 1000.0 };
                    let time_since_death = current_time - player.death_timestamp;

                    if time_since_death >= 3.0 {
                        should_respawn = true;
                    }
                } else if is_alive && player.is_dead {
                    // Player respawned successfully
                    player.is_dead = false;
                    player.death_timestamp = 0.0;
                    println!("✅ Player respawned!");

                    just_respawned = true;
                }
            }

            // Handle state changes after releasing the borrow
            if just_died {
                self.update_death_state_js(true, death_time);
            }

            if should_respawn {
                if let Some(game_pubkey) = self.current_game_pubkey.clone() {
                    self.call_respawn(&game_pubkey);
                }
            }

            if just_respawned {
                self.update_death_state_js(false, 0.0);
            }

            return; // Don't add local player to other_players list
        }

        // Get current time for dead reckoning
        let current_time = unsafe { emscripten_get_now() / 1000.0 }; // Convert ms to seconds

        // Update or create remote player
        if let Some(existing) = self.other_players.iter_mut().find(|p| p.authority == authority) {
            // Calculate velocity for dead reckoning (change in position / time)
            let time_delta = current_time - existing.last_update_time;
            if time_delta > 0.001 { // Avoid division by zero
                existing.velocity = (new_position - existing.target_position) / time_delta as f32;
            }

            // Update target position and rotation for smooth interpolation
            existing.target_position = new_position;
            existing.target_rotation = new_rotation;
            existing.username = username;
            existing.team = team;
            existing.is_alive = is_alive;
            existing.last_update_time = current_time;
        } else {
            // New player - create with current position as both start and target
            let other_player = OtherPlayer {
                authority: authority.to_string(),
                username: username.clone(),
                team,
                position: new_position,
                rotation: new_rotation,
                is_alive,
                target_position: new_position,
                target_rotation: new_rotation,
                velocity: Vector3::zero(), // Start with no velocity
                last_update_time: current_time,
            };
            println!("➕ Added new player: {} ({})", username, authority);
            self.other_players.push(other_player);
        }
    }

    /// Get current player's ephemeral key for comparison
    fn get_current_ephemeral_key(&self) -> String {
        use std::os::raw::c_char;
        use std::ffi::CString;

        let js_code = r#"
            (() => {
                if (window.gameBridge && window.gameBridge.getCurrentPlayerEphemeralKey) {
                    return window.gameBridge.getCurrentPlayerEphemeralKey();
                }
                return '';
            })();
        "#;

        unsafe {
            let c_str = CString::new(js_code).unwrap();
            let result_ptr = emscripten_run_script_string(c_str.as_ptr());

            if !result_ptr.is_null() {
                return std::ffi::CStr::from_ptr(result_ptr)
                    .to_string_lossy()
                    .into_owned();
            }
        }

        String::new()
    }


    /// Draw the Solana logo in the sky (visible when looking down)
    fn draw_solana_logo(d3d: &mut RaylibMode3D<RaylibDrawHandle>) {
        // Solana logo positioned high in the sky, facing downward
        let logo_y = -100.0; // Below ground level (so it's visible when looking down)
        let logo_center = Vector3::new(0.0, logo_y, 0.0);

        // Solana colors (gradient from cyan to purple to magenta)
        let color1 = Color::new(0, 255, 163, 255);   // Cyan/teal
        let color2 = Color::new(156, 81, 255, 255);  // Purple
        let color3 = Color::new(220, 31, 255, 255);  // Magenta

        let bar_width = 20.0;
        let bar_height = 2.0;
        let bar_depth = 0.5;
        let spacing = 3.5;

        // Draw three diagonal bars with triangular ends (Solana logo style)
        // Top bar (cyan) - with diagonal angle
        let angle = 15.0_f32.to_radians();
        let offset1 = Vector3::new(-5.0, spacing * 2.0, 0.0);

        // Middle bar (purple)
        let offset2 = Vector3::new(0.0, 0.0, 0.0);

        // Bottom bar (magenta)
        let offset3 = Vector3::new(5.0, -spacing * 2.0, 0.0);

        // Draw bars as cubes with rotation to create diagonal effect
        // Top bar
        d3d.draw_cube(
            logo_center + offset1,
            bar_width, bar_height, bar_depth,
            color1
        );
        // Add triangular end caps using triangles for top bar
        Self::draw_triangle_cap(d3d, logo_center + offset1 + Vector3::new(bar_width / 2.0, 0.0, 0.0), color1, true);
        Self::draw_triangle_cap(d3d, logo_center + offset1 - Vector3::new(bar_width / 2.0, 0.0, 0.0), color1, false);

        // Middle bar
        d3d.draw_cube(
            logo_center + offset2,
            bar_width, bar_height, bar_depth,
            color2
        );
        Self::draw_triangle_cap(d3d, logo_center + offset2 + Vector3::new(bar_width / 2.0, 0.0, 0.0), color2, true);
        Self::draw_triangle_cap(d3d, logo_center + offset2 - Vector3::new(bar_width / 2.0, 0.0, 0.0), color2, false);

        // Bottom bar
        d3d.draw_cube(
            logo_center + offset3,
            bar_width, bar_height, bar_depth,
            color3
        );
        Self::draw_triangle_cap(d3d, logo_center + offset3 + Vector3::new(bar_width / 2.0, 0.0, 0.0), color3, true);
        Self::draw_triangle_cap(d3d, logo_center + offset3 - Vector3::new(bar_width / 2.0, 0.0, 0.0), color3, false);
    }

    /// Draw triangular end cap for logo bars using small cubes
    fn draw_triangle_cap(d3d: &mut RaylibMode3D<RaylibDrawHandle>, position: Vector3, color: Color, facing_right: bool) {
        let size = 1.5;
        let direction = if facing_right { 1.0 } else { -1.0 };

        // Draw a small cube/pyramid shape at the end of each bar
        d3d.draw_cube(
            position + Vector3::new(direction * size, 0.0, 0.0),
            size * 2.0, size, 0.5,
            color
        );
    }

    /// Draw Solana-themed boundary walls at the corners of the map
    fn draw_boundary_walls(d3d: &mut RaylibMode3D<RaylibDrawHandle>) {
        // Map size is 50x50, so boundaries are at +/- 25
        let boundary = 25.0;
        let wall_height = 10.0;
        let wall_thickness = 1.0;
        let wall_length = 15.0; // Length of each corner wall segment

        // Solana colors (gradient from cyan to purple to magenta)
        let color1 = Color::new(0, 255, 163, 255);   // Cyan/teal
        let color2 = Color::new(156, 81, 255, 255);  // Purple
        let color3 = Color::new(220, 31, 255, 255);  // Magenta

        // Corner 1: +X, +Z (top-right) - Cyan walls
        // Wall along X axis
        d3d.draw_cube(
            Vector3::new(boundary - wall_length / 2.0, wall_height / 2.0, boundary),
            wall_length, wall_height, wall_thickness,
            color1
        );
        d3d.draw_cube_wires(
            Vector3::new(boundary - wall_length / 2.0, wall_height / 2.0, boundary),
            wall_length, wall_height, wall_thickness,
            Color::WHITE
        );
        // Wall along Z axis
        d3d.draw_cube(
            Vector3::new(boundary, wall_height / 2.0, boundary - wall_length / 2.0),
            wall_thickness, wall_height, wall_length,
            color1
        );
        d3d.draw_cube_wires(
            Vector3::new(boundary, wall_height / 2.0, boundary - wall_length / 2.0),
            wall_thickness, wall_height, wall_length,
            Color::WHITE
        );

        // Corner 2: -X, +Z (top-left) - Purple walls
        d3d.draw_cube(
            Vector3::new(-boundary + wall_length / 2.0, wall_height / 2.0, boundary),
            wall_length, wall_height, wall_thickness,
            color2
        );
        d3d.draw_cube_wires(
            Vector3::new(-boundary + wall_length / 2.0, wall_height / 2.0, boundary),
            wall_length, wall_height, wall_thickness,
            Color::WHITE
        );
        d3d.draw_cube(
            Vector3::new(-boundary, wall_height / 2.0, boundary - wall_length / 2.0),
            wall_thickness, wall_height, wall_length,
            color2
        );
        d3d.draw_cube_wires(
            Vector3::new(-boundary, wall_height / 2.0, boundary - wall_length / 2.0),
            wall_thickness, wall_height, wall_length,
            Color::WHITE
        );

        // Corner 3: +X, -Z (bottom-right) - Magenta walls
        d3d.draw_cube(
            Vector3::new(boundary - wall_length / 2.0, wall_height / 2.0, -boundary),
            wall_length, wall_height, wall_thickness,
            color3
        );
        d3d.draw_cube_wires(
            Vector3::new(boundary - wall_length / 2.0, wall_height / 2.0, -boundary),
            wall_length, wall_height, wall_thickness,
            Color::WHITE
        );
        d3d.draw_cube(
            Vector3::new(boundary, wall_height / 2.0, -boundary + wall_length / 2.0),
            wall_thickness, wall_height, wall_length,
            color3
        );
        d3d.draw_cube_wires(
            Vector3::new(boundary, wall_height / 2.0, -boundary + wall_length / 2.0),
            wall_thickness, wall_height, wall_length,
            Color::WHITE
        );

        // Corner 4: -X, -Z (bottom-left) - Cyan again (completing the gradient loop)
        d3d.draw_cube(
            Vector3::new(-boundary + wall_length / 2.0, wall_height / 2.0, -boundary),
            wall_length, wall_height, wall_thickness,
            color1
        );
        d3d.draw_cube_wires(
            Vector3::new(-boundary + wall_length / 2.0, wall_height / 2.0, -boundary),
            wall_length, wall_height, wall_thickness,
            Color::WHITE
        );
        d3d.draw_cube(
            Vector3::new(-boundary, wall_height / 2.0, -boundary + wall_length / 2.0),
            wall_thickness, wall_height, wall_length,
            color1
        );
        d3d.draw_cube_wires(
            Vector3::new(-boundary, wall_height / 2.0, -boundary + wall_length / 2.0),
            wall_thickness, wall_height, wall_length,
            Color::WHITE
        );
    }

    /// Render the game world
    pub fn render(&self, d: &mut RaylibDrawHandle, _thread: &RaylibThread) {
        if self.mode != GameMode::Playing {
            return;
        }

        // Get player camera
        if let Some(ref player) = self.player {
            let mut d3d = d.begin_mode3D(player.camera);

            // Draw ground plane to match map size (50x50 units)
            // Using a slightly lighter color for better visibility
            d3d.draw_plane(
                Vector3::new(0.0, -0.01, 0.0), // Slightly below Y=0 to avoid z-fighting
                Vector2::new(50.0, 50.0),
                Color::new(45, 45, 50, 255), // Lighter gray ground for better contrast
            );

            // Draw grid on the ground (1x1 unit spacing for 50x50 map)
            d3d.draw_grid(50, 1.0);

            // Draw Solana logo in the sky (visible when looking down)
            Self::draw_solana_logo(&mut d3d);

            // Draw Solana-themed boundary walls at corners
            Self::draw_boundary_walls(&mut d3d);

            // Draw map if loaded (use the Map's built-in render method for consistency)
            if let Some(ref map) = self.map {
                map.render(&mut d3d);
            }

            // Draw other players from blockchain
            Self::draw_other_players(&mut d3d, &self.other_players);

            // Draw bullet trails
            Self::draw_bullet_trails(&mut d3d, &self.bullet_trails);

            // Draw some simple point lights as visual spheres (for ambient lighting effect)
            // Top light
            d3d.draw_sphere(
                Vector3::new(0.0, 50.0, 0.0),
                0.5,
                Color::new(255, 255, 200, 100), // Semi-transparent warm light
            );

            // Draw gun model in front of camera (viewmodel)
            Self::draw_gun_viewmodel(&mut d3d, &player, self.muzzle_flash_timer, self.reload_progress);
        }

        // Draw 2D UI elements (crosshair, health bar) after 3D rendering
        // Note: Minimap is now rendered in web UI for a modern look
        Self::draw_crosshair(d);

        if let Some(ref player) = self.player {
            // Self::draw_minimap(d, player); // Disabled - now using web-based minimap
            Self::draw_health_bar(d, player, self.show_reload_prompt);
        }

        // Touch controls disabled - using React VirtualJoystick instead
        // if let Some(tc) = &self.touch_controls {
        //     tc.draw(d);
        // }

        // Screen flash effect when shooting (rendered last as overlay)
        if self.screen_flash_timer > 0.0 {
            let intensity = (self.screen_flash_timer / 0.1 * 80.0) as u8; // Max 80 alpha
            d.draw_rectangle(
                0,
                0,
                d.get_screen_width(),
                d.get_screen_height(),
                Color::new(255, 255, 255, intensity),
            );
        }
    }

    /// Draw the gun viewmodel (first-person weapon view) - SIMPLIFIED VERSION
    fn draw_gun_viewmodel(d3d: &mut RaylibMode3D<RaylibDrawHandle>, player: &Player, muzzle_flash_timer: f32, reload_progress: f32) {
        // Calculate gun position relative to camera
        let yaw_rad = player.yaw.to_radians();
        let pitch_rad = player.pitch.to_radians();

        // Direction the camera is facing (forward)
        let direction = Vector3::new(
            yaw_rad.cos() * pitch_rad.cos(),
            pitch_rad.sin(),
            yaw_rad.sin() * pitch_rad.cos(),
        );

        // Right vector for positioning gun to the side
        let right = Vector3::new(
            (yaw_rad + 90.0_f32.to_radians()).cos(),
            0.0,
            (yaw_rad + 90.0_f32.to_radians()).sin(),
        );

        // Up vector (perpendicular to both forward and right)
        let up = right.cross(direction).normalized();

        // Calculate effective height based on crouching
        let effective_height = if player.is_crouching {
            player.height * 0.6
        } else {
            player.height
        };

        // Camera position
        let camera_pos = Vector3::new(
            player.position.x,
            player.position.y + effective_height,
            player.position.z,
        );

        // Enhanced reload animation with multiple stages
        // Stage 1 (0.0-0.3): Gun tilts and moves down
        // Stage 2 (0.3-0.5): Magazine ejects (moves down)
        // Stage 3 (0.5-0.7): New magazine inserts (moves up)
        // Stage 4 (0.7-1.0): Gun returns to normal position and charges
        
        let (reload_offset_y, reload_offset_x, reload_rotation, magazine_offset) = if reload_progress > 0.0 {
            if reload_progress < 0.3 {
                // Stage 1: Tilt and lower gun
                let stage_progress = reload_progress / 0.3;
                let y_offset = -stage_progress * 0.4;
                let x_offset = stage_progress * 0.1; // Move slightly to center
                let rotation = stage_progress * 50.0; // Tilt 50 degrees
                (y_offset, x_offset, rotation, 0.0)
            } else if reload_progress < 0.5 {
                // Stage 2: Eject magazine (magazine drops down)
                let stage_progress = (reload_progress - 0.3) / 0.2;
                let mag_drop = stage_progress * 0.6; // Magazine falls
                (-0.4, 0.1, 50.0, -mag_drop)
            } else if reload_progress < 0.7 {
                // Stage 3: Insert new magazine (magazine rises from below)
                let stage_progress = (reload_progress - 0.5) / 0.2;
                let mag_rise = -0.6 + stage_progress * 0.6; // Magazine rises back
                (-0.4, 0.1, 50.0, mag_rise)
            } else {
                // Stage 4: Return to normal position
                let stage_progress = (reload_progress - 0.7) / 0.3;
                let y_offset = -0.4 + stage_progress * 0.4; // Rise back up
                let x_offset = 0.1 - stage_progress * 0.1; // Move back to side
                let rotation = 50.0 - stage_progress * 50.0; // Straighten
                (y_offset, x_offset, rotation, 0.0)
            }
        } else {
            (0.0, 0.0, 0.0, 0.0)
        };

        // Position gun base in front and to the right of camera using all three vectors
        // Apply reload offset
        let gun_base = camera_pos + direction * 0.8 + right * (0.35 - reload_offset_x) + up * (-0.3 + reload_offset_y);

        // Helper function to transform local gun coordinates to world space with reload rotation
        let to_world = |local_x: f32, local_y: f32, local_z: f32| -> Vector3 {
            // Apply reload rotation around multiple axes for more dynamic animation
            if reload_rotation.abs() > 0.01 {
                let pitch_rad = reload_rotation.to_radians();
                let roll_rad = (reload_rotation * 0.3).to_radians(); // Add some roll
                
                let cos_pitch = pitch_rad.cos();
                let sin_pitch = pitch_rad.sin();
                let cos_roll = roll_rad.cos();
                let sin_roll = roll_rad.sin();
                
                // First apply pitch rotation (around right axis)
                let temp_y = local_y * cos_pitch - local_z * sin_pitch;
                let temp_z = local_y * sin_pitch + local_z * cos_pitch;
                
                // Then apply roll rotation (around forward axis)
                let rotated_y = temp_y * cos_roll - local_x * sin_roll;
                let rotated_x = temp_y * sin_roll + local_x * cos_roll;
                let rotated_z = temp_z;
                
                gun_base + right * rotated_x + up * rotated_y + direction * rotated_z
            } else {
                gun_base + right * local_x + up * local_y + direction * local_z
            }
        };

        // Draw gun as simple spheres with improved colors
        let gun_body_color = Color::new(70, 70, 80, 255);
        let gun_dark_color = Color::new(50, 50, 60, 255);
        let magazine_color = Color::new(90, 90, 100, 255);

        // Gun body - series of spheres along the forward axis
        for i in 0..8 {
            let z = (i as f32 - 4.0) * 0.08;
            let pos = to_world(0.0, 0.0, z);
            d3d.draw_sphere(pos, 0.06, gun_body_color);
        }

        // Barrel extension - forward from gun body
        for i in 0..5 {
            let z = 0.32 + i as f32 * 0.05;
            let pos = to_world(0.0, 0.0, z);
            d3d.draw_sphere(pos, 0.03, gun_dark_color);
        }

        // Magazine (animates during reload) - positioned below gun body
        // Magazine moves down when ejecting, then new one appears from below
        for i in 0..3 {
            let y = -0.12 - i as f32 * 0.04 + magazine_offset;
            let z = -0.05;
            let pos = to_world(0.0, y, z);
            
            // Make magazine dimmer when falling, brighter when inserting
            let mag_alpha = if reload_progress > 0.3 && reload_progress < 0.5 {
                // Ejecting - fade out
                255 - ((reload_progress - 0.3) / 0.2 * 200.0) as u8
            } else if reload_progress >= 0.5 && reload_progress < 0.7 {
                // Inserting - fade in
                (55.0 + (reload_progress - 0.5) / 0.2 * 200.0) as u8
            } else {
                255
            };
            d3d.draw_sphere(pos, 0.04, Color::new(magazine_color.r, magazine_color.g, magazine_color.b, mag_alpha));
        }

        // Magazine release button (small detail)
        let release_button = to_world(0.0, -0.08, -0.03);
        d3d.draw_sphere(release_button, 0.015, Color::new(120, 120, 130, 255));

        // Handle - downward and back from gun body (using up vector)
        for i in 0..4 {
            let y = -0.05 * i as f32;
            let z = -0.2;
            let pos = to_world(0.0, y, z);
            d3d.draw_sphere(pos, 0.05, Color::new(70, 50, 40, 255));
        }

        // Trigger guard - downward from center (using up vector)
        for i in 0..2 {
            let y = -0.08 - i as f32 * 0.03;
            let z = -0.1;
            let pos = to_world(0.0, y, z);
            d3d.draw_sphere(pos, 0.03, Color::new(156, 81, 255, 255)); // Solana purple
        }
        
        // Charging handle (moves back during reload in stage 4)
        let charging_handle_offset = if reload_progress > 0.7 && reload_progress < 0.85 {
            let stage_progress = (reload_progress - 0.7) / 0.15;
            if stage_progress < 0.5 {
                // Pull back
                stage_progress * 2.0 * 0.12
            } else {
                // Release forward
                (1.0 - (stage_progress - 0.5) * 2.0) * 0.12
            }
        } else {
            0.0
        };
        let charging_handle = to_world(0.02, 0.08, 0.15 - charging_handle_offset);
        d3d.draw_sphere(charging_handle, 0.025, Color::new(100, 100, 110, 255));

        // Muzzle flash effect when shooting
        if muzzle_flash_timer > 0.0 {
            // Flash intensity fades with timer
            let intensity = (muzzle_flash_timer / 0.05 * 255.0) as u8;

            // Bright yellow/orange flash at barrel tip
            let flash_pos = to_world(0.0, 0.0, 0.6); // At the end of barrel
            d3d.draw_sphere(flash_pos, 0.15, Color::new(255, 220, 100, intensity));

            // Outer glow
            d3d.draw_sphere(flash_pos, 0.25, Color::new(255, 180, 50, intensity / 2));
        }
    }

    /// Draw crosshair at center of screen
    fn draw_crosshair(d: &mut RaylibDrawHandle) {
        let screen_width = d.get_screen_width();
        let screen_height = d.get_screen_height();
        let center_x = screen_width / 2;
        let center_y = screen_height / 2;

        let crosshair_size = 10;
        let crosshair_thickness = 2;
        let gap = 5;

        // Crosshair color (white with slight transparency)
        let color = Color::new(255, 255, 255, 200);

        // Draw horizontal line (left and right)
        d.draw_rectangle(center_x - crosshair_size - gap, center_y - crosshair_thickness / 2, crosshair_size, crosshair_thickness, color);
        d.draw_rectangle(center_x + gap, center_y - crosshair_thickness / 2, crosshair_size, crosshair_thickness, color);

        // Draw vertical line (top and bottom)
        d.draw_rectangle(center_x - crosshair_thickness / 2, center_y - crosshair_size - gap, crosshair_thickness, crosshair_size, color);
        d.draw_rectangle(center_x - crosshair_thickness / 2, center_y + gap, crosshair_thickness, crosshair_size, color);

        // Draw center dot
        d.draw_circle(center_x, center_y, 2.0, color);
    }

    /// Draw minimap at top right of screen
    fn draw_minimap(d: &mut RaylibDrawHandle, player: &Player) {
        let screen_width = d.get_screen_width();
        let minimap_size = 150;
        let minimap_x = screen_width - minimap_size - 20;
        let minimap_y = 20;

        // Draw minimap background (semi-transparent dark)
        d.draw_rectangle(minimap_x, minimap_y, minimap_size, minimap_size, Color::new(20, 20, 30, 200));
        d.draw_rectangle_lines(minimap_x, minimap_y, minimap_size, minimap_size, Color::new(100, 100, 120, 255));

        // Map boundaries (50x50 world units)
        let map_size = 50.0;
        let scale = minimap_size as f32 / map_size;

        // Draw map bounds
        let bounds_color = Color::new(80, 80, 100, 255);
        d.draw_rectangle_lines(minimap_x + 2, minimap_y + 2, minimap_size - 4, minimap_size - 4, bounds_color);

        // Draw Solana corner walls on minimap
        let wall_size = (15.0 * scale) as i32; // 15 units wall length
        let corner_color = Color::new(156, 81, 255, 180); // Solana purple

        // Convert world position to minimap position
        let to_minimap = |world_x: f32, world_z: f32| -> (i32, i32) {
            let norm_x = (world_x + 25.0) / map_size; // Normalize to 0-1
            let norm_z = (world_z + 25.0) / map_size;
            (
                minimap_x + (norm_x * minimap_size as f32) as i32,
                minimap_y + (norm_z * minimap_size as f32) as i32,
            )
        };

        // Draw corner markers
        let corners = [(25.0, 25.0), (-25.0, 25.0), (25.0, -25.0), (-25.0, -25.0)];
        for corner in corners.iter() {
            let (mx, my) = to_minimap(corner.0, corner.1);
            d.draw_circle(mx, my, 3.0, corner_color);
        }

        // Draw player position and direction
        let (player_mx, player_my) = to_minimap(player.position.x, player.position.z);

        // Player dot
        d.draw_circle(player_mx, player_my, 5.0, Color::new(0, 255, 163, 255)); // Solana cyan

        // Player direction indicator
        let yaw_rad = player.yaw.to_radians();
        let dir_length = 12.0;
        let dir_end_x = player_mx + (yaw_rad.cos() * dir_length) as i32;
        let dir_end_y = player_my + (yaw_rad.sin() * dir_length) as i32;
        d.draw_line(player_mx, player_my, dir_end_x, dir_end_y, Color::new(0, 255, 163, 255));

        // Draw "MINIMAP" label
        d.draw_text("MINIMAP", minimap_x + 5, minimap_y - 18, 12, Color::new(200, 200, 220, 255));
    }

    /// Draw health bar at bottom center of screen
    fn draw_health_bar(d: &mut RaylibDrawHandle, player: &Player, show_reload_prompt: bool) {
        let screen_width = d.get_screen_width();
        let screen_height = d.get_screen_height();

        let bar_width = 300;
        let bar_height = 25;
        let bar_x = (screen_width - bar_width) / 2;
        let bar_y = screen_height - bar_height - 30;

        // Background (dark)
        d.draw_rectangle(bar_x - 2, bar_y - 2, bar_width + 4, bar_height + 4, Color::new(0, 0, 0, 180));
        d.draw_rectangle(bar_x, bar_y, bar_width, bar_height, Color::new(40, 40, 50, 200));

        // Health fill (gradient from green to red based on health percentage)
        let health_percent = player.health / player.max_health;
        let fill_width = (bar_width as f32 * health_percent) as i32;

        // Color based on health percentage
        let health_color = if health_percent > 0.6 {
            Color::new(0, 200, 80, 255) // Green
        } else if health_percent > 0.3 {
            Color::new(220, 180, 0, 255) // Yellow
        } else {
            Color::new(220, 50, 50, 255) // Red
        };

        d.draw_rectangle(bar_x, bar_y, fill_width, bar_height, health_color);

        // Border
        d.draw_rectangle_lines(bar_x, bar_y, bar_width, bar_height, Color::new(150, 150, 170, 255));

        // Health text
        let health_text = format!("{:.0} / {:.0}", player.health, player.max_health);
        let text_width = d.measure_text(&health_text, 16);
        d.draw_text(
            &health_text,
            bar_x + (bar_width - text_width) / 2,
            bar_y + (bar_height - 16) / 2,
            16,
            Color::WHITE,
        );

        // "HEALTH" label
        d.draw_text("HEALTH", bar_x + 5, bar_y - 20, 12, Color::new(200, 200, 220, 255));

        // "Press R to Reload" prompt (centered at top of screen)
        if show_reload_prompt {
            let prompt_text = "PRESS R TO RELOAD";
            let text_width = d.measure_text(prompt_text, 30);
            
            // Draw centered at top-center of screen with pulsing effect
            let pulse = ((unsafe { emscripten_get_now() } / 500.0).sin() * 0.3 + 0.7) as f32;
            let alpha = (255.0 * pulse) as u8;
            
            d.draw_text(
                prompt_text,
                (screen_width - text_width) / 2,
                screen_height / 4,
                30,
                Color::new(255, 255, 0, alpha), // Yellow with pulsing alpha
            );
        }
    }

    /// Draw other players in the game (from blockchain sync)
    fn draw_other_players(d3d: &mut RaylibMode3D<RaylibDrawHandle>, other_players: &[OtherPlayer]) {
        for player in other_players {
            // Skip dead players
            if !player.is_alive {
                continue;
            }

            // Choose color based on team (Team 1 = Blue, Team 2 = Red)
            let player_color = if player.team == "1" {
                Color::new(0, 150, 255, 255) // Blue for Team 1
            } else {
                Color::new(255, 100, 100, 255) // Red for Team 2
            };

            // Draw player as a capsule (cylinder + spheres)
            let height = 1.8; // Player height
            let radius = 0.3; // Player radius

            // Draw body (cylinder)
            d3d.draw_cylinder(
                player.position,
                radius,
                radius,
                height,
                8,
                player_color,
            );

            // Draw head (sphere on top)
            let head_pos = Vector3::new(
                player.position.x,
                player.position.y + height,
                player.position.z,
            );
            d3d.draw_sphere(head_pos, radius * 0.8, player_color);

            // Draw username above player
            // Note: draw_text_3d doesn't exist in raylib, so we'll skip this for now
            // In a real game, you'd use billboard text or UI overlays

            // Draw gun held by other player
            Self::draw_other_player_gun(d3d, player, height);
        }
    }

    /// Draw gun held by another player (third-person view)
    fn draw_other_player_gun(d3d: &mut RaylibMode3D<RaylibDrawHandle>, player: &OtherPlayer, player_height: f32) {
        // rotation.y is yaw in radians from the contract
        // rotation.x is pitch in radians
        let yaw_rad = player.rotation.y;
        let pitch_rad = player.rotation.x;

        // Direction the player is facing (horizontal only for base direction)
        let forward_horizontal = Vector3::new(
            yaw_rad.cos(),
            0.0,
            yaw_rad.sin(),
        );

        // Right vector (perpendicular to forward, horizontal)
        let right = Vector3::new(
            (yaw_rad + std::f32::consts::PI / 2.0).cos(),
            0.0,
            (yaw_rad + std::f32::consts::PI / 2.0).sin(),
        );

        // Up vector (world up)
        let up = Vector3::new(0.0, 1.0, 0.0);

        // Calculate actual direction including pitch (same as first-person calculation)
        let direction = Vector3::new(
            yaw_rad.cos() * pitch_rad.cos(),
            pitch_rad.sin(),
            yaw_rad.sin() * pitch_rad.cos(),
        ).normalized();

        // Gun position (in front and to the right of player, at chest height)
        let gun_base = Vector3::new(
            player.position.x,
            player.position.y + player_height * 0.55, // Chest height
            player.position.z,
        ) + direction * 0.4 + right * 0.2 + up * -0.1;

        // Helper function to transform local gun coordinates to world space
        let to_world = |local_x: f32, local_y: f32, local_z: f32| -> Vector3 {
            gun_base + right * local_x + up * local_y + direction * local_z
        };

        // Gun color (same as first-person view)
        let gun_color = Color::new(80, 80, 90, 255);

        // Gun body - series of spheres along the forward axis
        for i in 0..8 {
            let z = (i as f32 - 4.0) * 0.08;
            let pos = to_world(0.0, 0.0, z);
            d3d.draw_sphere(pos, 0.06, gun_color);
        }

        // Barrel extension - forward from gun body
        for i in 0..5 {
            let z = 0.32 + i as f32 * 0.05;
            let pos = to_world(0.0, 0.0, z);
            d3d.draw_sphere(pos, 0.03, Color::new(60, 60, 70, 255));
        }

        // Handle - downward and back from gun body
        for i in 0..4 {
            let y = -0.05 * i as f32;
            let z = -0.2;
            let pos = to_world(0.0, y, z);
            d3d.draw_sphere(pos, 0.05, Color::new(70, 50, 40, 255));
        }

        // Trigger guard - downward from center
        for i in 0..2 {
            let y = -0.08 - i as f32 * 0.03;
            let z = -0.1;
            let pos = to_world(0.0, y, z);
            d3d.draw_sphere(pos, 0.03, Color::new(156, 81, 255, 255)); // Solana purple
        }
    }

    /// Draw bullet trails/tracers
    fn draw_bullet_trails(d3d: &mut RaylibMode3D<RaylibDrawHandle>, trails: &[BulletTrail]) {
        for trail in trails {
            // Calculate alpha based on remaining time (fade out effect)
            let alpha = ((trail.timer / 0.1) * 255.0) as u8;

            // Draw trail as a bright yellow/orange line
            let trail_color = Color::new(255, 220, 100, alpha);

            // Draw the main trail line
            d3d.draw_line_3D(trail.start, trail.end, trail_color);

            // Draw a thicker glow around the trail for better visibility
            // We do this by drawing multiple slightly offset lines
            let direction = (trail.end - trail.start).normalized();
            let perpendicular1 = Vector3::new(-direction.z, 0.0, direction.x).normalized();
            let perpendicular2 = direction.cross(perpendicular1).normalized();

            let offset = 0.02; // Small offset for glow effect

            // Draw glow lines with lower alpha
            let glow_alpha = alpha / 3;
            let glow_color = Color::new(255, 180, 50, glow_alpha);

            d3d.draw_line_3D(
                trail.start + perpendicular1 * offset,
                trail.end + perpendicular1 * offset,
                glow_color
            );
            d3d.draw_line_3D(
                trail.start - perpendicular1 * offset,
                trail.end - perpendicular1 * offset,
                glow_color
            );
            d3d.draw_line_3D(
                trail.start + perpendicular2 * offset,
                trail.end + perpendicular2 * offset,
                glow_color
            );
            d3d.draw_line_3D(
                trail.start - perpendicular2 * offset,
                trail.end - perpendicular2 * offset,
                glow_color
            );

            // Draw impact point (small sphere at the end)
            d3d.draw_sphere(trail.end, 0.05, Color::new(255, 100, 0, alpha));
        }
    }
}
