use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MenuTab {
    Lobby,
    Weapons,
    MapEditor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub map: String,
    pub current_players: u32,
    pub max_players: u32,
    pub host: String,
}

pub struct MenuState {
    /// Current active tab
    pub current_tab: MenuTab,

    /// Lobby state
    pub available_rooms: Vec<Room>,
    pub selected_room: Option<usize>,
    pub show_create_room_popup: bool,
    pub new_room_name: String,
    pub new_room_max_players: i32,
    pub selected_map_for_room: String,

    /// Weapons state
    pub selected_weapon: Option<usize>,

    /// Map editor state
    pub show_map_editor: bool,

    /// Create game response handling
    pub create_game_pending: bool,
    
    /// Store room data for async response handling
    pub pending_room_name: String,
    pub pending_room_map: String,
    pub pending_room_max_players: i32,
}

impl MenuState {
    pub fn new() -> Self {
        let mut state = Self {
            current_tab: MenuTab::Lobby,
            available_rooms: vec![], // Start with empty rooms - will be loaded from blockchain
            selected_room: None,
            show_create_room_popup: false,
            new_room_name: String::new(),
            new_room_max_players: 10,
            selected_map_for_room: "test-map-1".to_string(),
            selected_weapon: None,
            show_map_editor: false,
            create_game_pending: false,
            pending_room_name: String::new(),
            pending_room_map: String::new(),
            pending_room_max_players: 10,
        };
        
        // Games will be loaded manually via the REFRESH button
        // This ensures the wallet is connected before attempting to load games
        
        state
    }

    pub fn create_room(&mut self) {
        println!("🔍 Debug: create_room function called");
        println!("🔍 Debug: Room name: '{}'", self.new_room_name);
        if !self.new_room_name.is_empty() {
            println!("🔍 Debug: Starting create_room function");
            #[cfg(target_os = "emscripten")]
            {
                println!("🔍 Debug: Using Emscripten path (web)");
                use std::ffi::CString;

                extern "C" {
                    pub fn emscripten_run_script(script: *const i8);
                }

                let js_code = format!(
                    r#"
                    (async function() {{
                        try {{
                            console.log('🎮 JavaScript createGame called from Rust');
                            
                            // Check if game bridge is available
                            if (!window.gameBridge) {{
                                console.error('❌ Game bridge not available');
                                throw new Error('Game bridge not initialized. Please connect your wallet first.');
                            }}

                            console.log('✅ Game bridge available');

                            const lobbyName = '{}';
                            const mapName = '{}';

                            console.log('📝 Creating game:', lobbyName, 'on map:', mapName);

                            // Call Solana bridge via game bridge
                            const result = await window.gameBridge.createGame(lobbyName, mapName);

                            if (result) {{
                                console.log('✅ Game created successfully:', result);
                                console.log('📤 Setting Module.createGameResult...');
                                Module.createGameResult = JSON.stringify(result);
                                console.log('✅ Module.createGameResult set to:', Module.createGameResult);
                                console.log('🔍 Module object keys:', Object.keys(Module));
                                console.log('🔍 Module.createGameResult type:', typeof Module.createGameResult);
                            }} else {{
                                console.error('❌ Failed to create game - result is null');
                                Module.createGameResult = JSON.stringify({{ error: 'Failed to create game' }});
                                console.log('❌ Set error result:', Module.createGameResult);
                            }}
                        }} catch (error) {{
                            console.error('❌ Error creating game:', error);
                            Module.createGameResult = JSON.stringify({{ error: error.message }});
                        }}
                    }})();
                    "#,
                    self.new_room_name.replace("'", "\\'"),
                    self.selected_map_for_room.replace("'", "\\'")
                );

                println!("🎮 Calling JavaScript to create game...");
                println!("📝 Room name: {}", self.new_room_name);
                println!("🗺️ Map: {}", self.selected_map_for_room);
                
                let c_str = CString::new(js_code).unwrap();
                unsafe {
                    emscripten_run_script(c_str.as_ptr());
                }

                // Store pending data before clearing form
                self.pending_room_name = self.new_room_name.clone();
                self.pending_room_map = self.selected_map_for_room.clone();
                self.pending_room_max_players = self.new_room_max_players;
                
                // Set pending state
                self.create_game_pending = true;
                println!("⏳ Game creation pending...");
            }

            #[cfg(not(target_os = "emscripten"))]
            {
                println!("🔍 Debug: Using native path (not web)");
                // For native builds, just add to local rooms
                let new_room = Room {
                    id: format!("room_{}", self.available_rooms.len() + 1),
                    name: self.new_room_name.clone(),
                    map: self.selected_map_for_room.clone(),
                    current_players: 1,
                    max_players: self.new_room_max_players as u32,
                    host: "You".to_string(),
                };
                self.available_rooms.push(new_room);
            }

            // Reset create room form
            self.new_room_name.clear();
            self.new_room_max_players = 10;
            self.show_create_room_popup = false;
            
            println!("🔍 Debug: create_room function completed");
        }
    }

    /// Load available games from the blockchain
    #[cfg(target_os = "emscripten")]
    pub fn load_games_from_blockchain(&mut self) {
        println!("🔍 Loading games from blockchain...");
        println!("🔍 Current rooms count: {}", self.available_rooms.len());
        
        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }

        use std::ffi::CString;

        let js_code = r#"
        (async function() {
            try {
                console.log('🎮 Loading games from blockchain...');
                
                // Check if game bridge is available
                if (!window.gameBridge) {
                    console.error('❌ Game bridge not available');
                    Module.loadGamesResult = JSON.stringify({ error: 'Game bridge not initialized' });
                    return;
                }

                console.log('✅ Game bridge available');

                // Call Solana bridge to get available games
                const games = await window.gameBridge.getAvailableGames();
                
                if (games && Array.isArray(games)) {
                    console.log('✅ Loaded', games.length, 'games from blockchain');
                    Module.loadGamesResult = JSON.stringify({ success: true, games: games });
                } else {
                    console.error('❌ Failed to load games - invalid response');
                    Module.loadGamesResult = JSON.stringify({ error: 'Failed to load games' });
                }
            } catch (error) {
                console.error('❌ Error loading games:', error);
                Module.loadGamesResult = JSON.stringify({ error: error.message });
            }
        })();
        "#;

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }
    }

    /// Check for load games response (web only)
    #[cfg(target_os = "emscripten")]
    pub fn check_load_games_response(&mut self) {
        extern "C" {
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }

        use std::ffi::CString;

        // Check if result is available
        let js_check = CString::new("typeof Module.loadGamesResult !== 'undefined' ? 'true' : 'false'").unwrap();
        let has_result = unsafe {
            let result_ptr = emscripten_run_script_string(js_check.as_ptr());
            if result_ptr.is_null() {
                return;
            }
            let result = std::ffi::CStr::from_ptr(result_ptr).to_str().unwrap_or("false");
            result == "true"
        };

        if !has_result {
            return;
        }

        // Get the result
        let js_get_result = CString::new("Module.loadGamesResult || '{}'").unwrap();
        let result_json = unsafe {
            let result_ptr = emscripten_run_script_string(js_get_result.as_ptr());
            if result_ptr.is_null() {
                return;
            }
            std::ffi::CStr::from_ptr(result_ptr).to_str().unwrap_or("{}")
        };

        // Clear the result
        let js_clear = CString::new("delete Module.loadGamesResult").unwrap();
        unsafe {
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }
            emscripten_run_script(js_clear.as_ptr());
        }

        // Parse and handle result
        println!("🔍 Load games result JSON: {}", result_json);
        if let Ok(result) = serde_json::from_str::<serde_json::Value>(result_json) {
            println!("🔍 Parsed result successfully: {:?}", result);
            if let Some(error) = result.get("error") {
                println!("❌ Failed to load games: {}", error);
                // Add fallback rooms if blockchain loading fails
                self.add_fallback_rooms();
            } else if let Some(games) = result.get("games") {
                if let Some(games_array) = games.as_array() {
                    println!("🔍 Found {} games in blockchain response", games_array.len());
                    // Clear existing rooms
                    self.available_rooms.clear();
                    
                    // Convert blockchain games to Room structs
                    for (i, game) in games_array.iter().enumerate() {
                        println!("🔍 Processing game {}: {:?}", i, game);
                        
                        // Debug: Show all available fields
                        if let Some(game_obj) = game.as_object() {
                            println!("🔍 Available fields in game {}: {:?}", i, game_obj.keys().collect::<Vec<_>>());
                        }
                        
                        if let (Some(public_key), Some(lobby_name), Some(map_name), Some(total_players), Some(max_players), Some(created_by)) = (
                            game.get("publicKey").and_then(|v| v.as_str()),
                            game.get("lobbyName").and_then(|v| v.as_str()),
                            game.get("mapName").and_then(|v| v.as_str()),
                            game.get("totalPlayers").and_then(|v| v.as_u64()),
                            game.get("maxPlayers").and_then(|v| v.as_u64()),
                            game.get("createdBy").and_then(|v| v.as_str())
                        ) {
                            let room = Room {
                                id: public_key.to_string(),
                                name: lobby_name.to_string(),
                                map: map_name.to_string(),
                                current_players: total_players as u32,
                                max_players: max_players as u32,
                                host: format!("{}...{}", 
                                    &created_by[0..4], 
                                    &created_by[created_by.len()-4..]
                                ),
                            };
                            self.available_rooms.push(room);
                        }
                    }
                    println!("✅ Loaded {} games from blockchain", self.available_rooms.len());
                }
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn load_games_from_blockchain(&mut self) {
        println!("🔍 Debug: load_games_from_blockchain called but not in emscripten mode");
        // For native builds, add some dummy data
        self.available_rooms = vec![
            Room {
                id: "native_room_1".to_string(),
                name: "Native Test Room".to_string(),
                map: "test-map-1".to_string(),
                current_players: 2,
                max_players: 10,
                host: "NativeHost".to_string(),
            },
        ];
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_load_games_response(&mut self) {
        // No-op for native builds
    }

    /// Add fallback rooms when blockchain loading fails
    fn add_fallback_rooms(&mut self) {
        println!("🔍 Adding fallback rooms due to blockchain loading failure");
        self.available_rooms = vec![
            Room {
                id: "fallback_1".to_string(),
                name: "Blockchain Loading Failed".to_string(),
                map: "Connection Error".to_string(),
                current_players: 0,
                max_players: 10,
                host: "System".to_string(),
            },
            Room {
                id: "fallback_2".to_string(),
                name: "Please Check Wallet Connection".to_string(),
                map: "Connect Wallet First".to_string(),
                current_players: 0,
                max_players: 10,
                host: "System".to_string(),
            },
        ];
    }

    /// Test blockchain connection
    #[cfg(target_os = "emscripten")]
    pub fn test_blockchain_connection(&mut self) {
        println!("🧪 Testing blockchain connection...");
        
        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }

        use std::ffi::CString;

        let js_code = r#"
        (async function() {
            try {
                console.log('🧪 Testing blockchain connection...');
                
                // Check if game bridge is available
                if (!window.gameBridge) {
                    console.error('❌ Game bridge not available');
                    Module.testResult = JSON.stringify({ error: 'Game bridge not available' });
                    return;
                }

                console.log('✅ Game bridge available');

                // Test the matchmaking program
                const programTest = await window.gameBridge.testMatchmakingProgram();
                console.log('🧪 Program test result:', programTest);

                // Test all program accounts
                const accountsTest = await window.gameBridge.testAllProgramAccounts();
                console.log('🧪 Accounts test result:', accountsTest);

                // Test creating and fetching games
                const gameTest = await window.gameBridge.testCreateAndFetchGame();
                console.log('🧪 Game test result:', gameTest);

                // Set result
                Module.testResult = JSON.stringify({
                    success: true,
                    programTest: programTest,
                    accountsTest: accountsTest,
                    gameTest: gameTest,
                    message: 'Blockchain connection test completed'
                });

            } catch (error) {
                console.error('❌ Blockchain connection test failed:', error);
                Module.testResult = JSON.stringify({ error: error.message });
            }
        })();
        "#;

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn test_blockchain_connection(&mut self) {
        println!("🧪 Blockchain connection test not available in native build");
    }

    /// Leave current game
    #[cfg(target_os = "emscripten")]
    pub fn leave_current_game(&mut self) {
        println!("🚪 Leaving current game...");
        
        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }

        use std::ffi::CString;

        let js_code = r#"
        (async function() {
            try {
                console.log('🚪 JavaScript leaveCurrentGame called from Rust');
                
                // Check if game bridge is available
                if (!window.gameBridge) {
                    console.error('❌ Game bridge not available');
                    Module.leaveGameResult = JSON.stringify({ error: 'Game bridge not available' });
                    return;
                }

                console.log('✅ Game bridge available');

                // Call leave current game
                const result = await window.gameBridge.leaveCurrentGame();

                if (result) {
                    console.log('✅ Left game successfully:', result);
                    Module.leaveGameResult = JSON.stringify(result);
                } else {
                    console.error('❌ Failed to leave game - result is null');
                    Module.leaveGameResult = JSON.stringify({ error: 'Failed to leave game' });
                }
            } catch (error) {
                console.error('❌ Error leaving game:', error);
                Module.leaveGameResult = JSON.stringify({ error: error.message });
            }
        })();
        "#;

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn leave_current_game(&mut self) {
        println!("🚪 Leave current game not available in native build");
    }

    /// Check for create game response (web only)
    #[cfg(target_os = "emscripten")]
    pub fn check_create_game_response(&mut self) {
        if !self.create_game_pending {
            return;
        }
        
        println!("🔍 Checking for create game response... (pending: {})", self.create_game_pending);

        extern "C" {
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }

        use std::ffi::CString;

        // Check if result is available
        let js_check = CString::new("typeof Module.createGameResult !== 'undefined' ? 'true' : 'false'").unwrap();
        let has_result = unsafe {
            let result_ptr = emscripten_run_script_string(js_check.as_ptr());
            if result_ptr.is_null() {
                println!("🔍 JavaScript check returned null");
                return;
            }
            let result = std::ffi::CStr::from_ptr(result_ptr).to_str().unwrap_or("false");
            println!("🔍 JavaScript check result: {}", result);
            result == "true"
        };

        if !has_result {
            println!("🔍 No result yet, continuing to wait...");
            return;
        }
        
        println!("🔍 Result found! Processing...");

        // Get the result
        let js_get_result = CString::new("Module.createGameResult || '{}'").unwrap();
        let result_json = unsafe {
            let result_ptr = emscripten_run_script_string(js_get_result.as_ptr());
            if result_ptr.is_null() {
                println!("🔍 JavaScript get result returned null");
                return;
            }
            let result = std::ffi::CStr::from_ptr(result_ptr).to_str().unwrap_or("{}");
            println!("🔍 JavaScript get result: {}", result);
            result
        };

        // Clear the result
        let js_clear = CString::new("delete Module.createGameResult").unwrap();
        unsafe {
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }
            emscripten_run_script(js_clear.as_ptr());
        }

        // Parse and handle result
        println!("🔍 Result JSON: {}", result_json);
        if let Ok(result) = serde_json::from_str::<serde_json::Value>(result_json) {
            println!("🔍 Parsed result: {:?}", result);
            if let Some(error) = result.get("error") {
                if let Some(error_str) = error.as_str() {
                    if error_str == "PlayerAlreadyInGame" {
                        println!("⚠️ Player is already in a game - cannot create new game");
                        // Add a helpful room to show the error
                        let error_room = Room {
                            id: "error_already_in_game".to_string(),
                            name: "⚠️ Already in a game".to_string(),
                            map: "Leave current game first".to_string(),
                            current_players: 0,
                            max_players: 0,
                            host: "System".to_string(),
                        };
                        self.available_rooms.push(error_room);
                    } else {
                        println!("❌ Failed to create game: {}", error_str);
                        // Add error room
                        let error_room = Room {
                            id: "error_create_failed".to_string(),
                            name: format!("❌ Create failed: {}", error_str),
                            map: "Check console for details".to_string(),
                            current_players: 0,
                            max_players: 0,
                            host: "System".to_string(),
                        };
                        self.available_rooms.push(error_room);
                    }
                }
            } else if let Some(game_pda) = result.get("gamePda") {
                if let Some(pda_str) = game_pda.as_str() {
                    // Create room with on-chain data using stored pending data
                    let new_room = Room {
                        id: pda_str.to_string(),
                        name: self.pending_room_name.clone(),
                        map: self.pending_room_map.clone(),
                        current_players: 1,
                        max_players: self.pending_room_max_players as u32,
                        host: "You".to_string(),
                    };
                    self.available_rooms.push(new_room);
                    println!("✅ Game created successfully on-chain!");
                    
                    // Clear pending data
                    self.pending_room_name.clear();
                    self.pending_room_map.clear();
                    self.pending_room_max_players = 10;
                }
            }
        }

        self.create_game_pending = false;
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_create_game_response(&mut self) {
        println!("🔍 Debug: check_create_game_response called but not in emscripten mode");
        // No-op for native builds
    }
}
