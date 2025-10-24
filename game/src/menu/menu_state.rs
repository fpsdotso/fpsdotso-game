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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableMap {
    pub id: String,
    pub name: String,
    pub description: String,
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
    pub available_maps: Vec<AvailableMap>,
    pub maps_loaded: bool,
    pub maps_loading: bool,

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

    /// Lobby interface state
    pub in_lobby: bool,
    pub current_lobby_id: Option<String>,
    pub lobby_team_a: Vec<String>,
    pub lobby_team_b: Vec<String>,
    pub lobby_leader: Option<String>,
    pub is_lobby_leader: bool,
    pub joining_lobby_pending: bool,
    pub starting_game_pending: bool,

    /// Game state tracking
    pub current_game_state: u8, // 0=waiting, 1=active, 2=ended, 3=paused
    pub game_should_start: bool, // Flag to signal game should transition to playing

    /// Player state polling
    pub check_player_game_pending: bool, // Flag to indicate we're checking player's current game
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
            selected_map_for_room: String::new(),
            available_maps: Vec::new(),
            maps_loaded: false,
            maps_loading: false,
            selected_weapon: None,
            show_map_editor: false,
            create_game_pending: false,
            pending_room_name: String::new(),
            pending_room_map: String::new(),
            pending_room_max_players: 10,
            in_lobby: false,
            current_lobby_id: None,
            lobby_team_a: Vec::new(),
            lobby_team_b: Vec::new(),
            lobby_leader: None,
            is_lobby_leader: false,
            joining_lobby_pending: false,
            starting_game_pending: false,
            current_game_state: 0,
            game_should_start: false,
            check_player_game_pending: false,
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
            pub fn emscripten_run_script(script: *const i8);
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
            pub fn emscripten_run_script(script: *const i8);
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

                    // Automatically join the created lobby (open lobby view)
                    println!("🚪 Automatically entering the created lobby...");
                    self.in_lobby = true;
                    self.current_lobby_id = Some(pda_str.to_string());
                    self.is_lobby_leader = true; // Creator is always the leader

                    // Initialize team rosters with creator on Team A
                    self.lobby_team_a.clear();
                    self.lobby_team_b.clear();
                    self.lobby_team_a.push("You".to_string());

                    // Set lobby leader
                    self.lobby_leader = Some("You".to_string());

                    // Fetch full lobby data from blockchain
                    self.fetch_lobby_data();

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

    /// Fetch user maps from Solana (for Emscripten/web builds)
    #[cfg(target_os = "emscripten")]
    pub fn fetch_user_maps(&mut self) {
        use std::ffi::CString;

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }

        if self.maps_loading {
            return;
        }

        self.maps_loading = true;

        let js_code = r#"
        (async function() {
            try {
                if (!window.solanaMapBridge) {
                    console.warn('Solana bridge not initialized');
                    Module.userMapsData = JSON.stringify([]);
                    return;
                }

                // Fetch user's maps
                const userMaps = await window.solanaMapBridge.getUserMaps();

                if (!userMaps || !userMaps.mapIds || userMaps.mapIds.length === 0) {
                    console.log('No maps found for user');
                    Module.userMapsData = JSON.stringify([]);
                    return;
                }

                // Fetch metadata for each map
                const mapsWithMetadata = [];
                for (const mapId of userMaps.mapIds) {
                    try {
                        const metadata = await window.solanaMapBridge.getMapMetadata(mapId);
                        if (metadata) {
                            mapsWithMetadata.push({
                                id: mapId,
                                name: metadata.name,
                                description: metadata.description || ''
                            });
                        }
                    } catch (error) {
                        console.error('Failed to fetch metadata for map:', mapId, error);
                    }
                }

                Module.userMapsData = JSON.stringify(mapsWithMetadata);
                console.log('Loaded', mapsWithMetadata.length, 'user maps');
            } catch (error) {
                console.error('Error fetching user maps:', error);
                Module.userMapsData = JSON.stringify([]);
            }
        })();
        "#;

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }
    }

    /// Check if maps have been loaded from Solana and update the state
    #[cfg(target_os = "emscripten")]
    pub fn check_loaded_maps(&mut self) {
        use std::ffi::CString;

        extern "C" {
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
            pub fn emscripten_run_script(script: *const i8);
        }

        if !self.maps_loading || self.maps_loaded {
            return;
        }

        let js_check = CString::new("typeof Module.userMapsData !== 'undefined' ? Module.userMapsData : ''").unwrap();

        unsafe {
            let result_ptr = emscripten_run_script_string(js_check.as_ptr());
            if result_ptr.is_null() {
                return;
            }

            let c_str = std::ffi::CStr::from_ptr(result_ptr);
            if let Ok(json_str) = c_str.to_str() {
                if !json_str.is_empty() {
                    // Parse the JSON
                    if let Ok(maps) = serde_json::from_str::<Vec<AvailableMap>>(json_str) {
                        self.available_maps = maps;
                        self.maps_loaded = true;
                        self.maps_loading = false;

                        // Set default selected map if available
                        if !self.available_maps.is_empty() && self.selected_map_for_room.is_empty() {
                            self.selected_map_for_room = self.available_maps[0].id.clone();
                        }

                        // Clear the JavaScript variable
                        let clear_js = CString::new("delete Module.userMapsData;").unwrap();
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn fetch_user_maps(&mut self) {
        // Not available outside of browser
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_loaded_maps(&mut self) {
        // Not available outside of browser
    }

    // ===== LOBBY INTERFACE FUNCTIONS =====

    /// Join a lobby by calling joinGame
    #[cfg(target_os = "emscripten")]
    pub fn join_lobby(&mut self, game_id: String) {
        println!("🎮 Joining lobby: {}", game_id);
        self.joining_lobby_pending = true;

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }
        use std::ffi::CString;

        let js_code = format!(
            r#"
            (async function() {{
                try {{
                    console.log('🎮 Joining game: {}');
                    const result = await window.gameBridge.joinGame('{}');
                    if (result && result.transaction) {{
                        Module.joinGameResult = JSON.stringify({{ success: true, transaction: result.transaction }});
                    }} else if (result && result.error) {{
                        Module.joinGameResult = JSON.stringify({{ error: result.error, message: result.message }});
                    }} else {{
                        Module.joinGameResult = JSON.stringify({{ error: 'Unknown error' }});
                    }}
                }} catch (error) {{
                    Module.joinGameResult = JSON.stringify({{ error: error.message }});
                }}
            }})();
            "#,
            game_id, game_id
        );

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn join_lobby(&mut self, _game_id: String) {
        println!("🎮 Join lobby not available in native build");
    }

    /// Leave the current lobby
    #[cfg(target_os = "emscripten")]
    pub fn leave_lobby(&mut self) {
        println!("🚪 Leaving lobby...");
        
        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }
        use std::ffi::CString;

        let js_code = r#"
        (async function() {
            try {
                console.log('🚪 Leaving current game...');
                const result = await window.gameBridge.leaveCurrentGame();
                if (result && result.transaction) {
                    Module.leaveGameResult = JSON.stringify({ success: true, transaction: result.transaction });
                } else if (result && result.error) {
                    Module.leaveGameResult = JSON.stringify({ error: result.error, message: result.message });
                } else {
                    Module.leaveGameResult = JSON.stringify({ error: 'Unknown error' });
                }
            } catch (error) {
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
    pub fn leave_lobby(&mut self) {
        println!("🚪 Leave lobby not available in native build");
    }

    /// Start the lobby game (leader only)
    #[cfg(target_os = "emscripten")]
    pub fn start_lobby_game(&mut self) {
        if let Some(lobby_id) = &self.current_lobby_id {
            println!("🎮 Starting game: {}", lobby_id);
            self.starting_game_pending = true;

            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }
            use std::ffi::CString;

            let js_code = format!(
                r#"
                (async function() {{
                    try {{
                        console.log('🎮 Starting game: {}');
                        const result = await window.gameBridge.startGame('{}');
                        if (result && result.transaction) {{
                            Module.startGameResult = JSON.stringify({{ success: true, transaction: result.transaction }});
                        }} else if (result && result.error) {{
                            Module.startGameResult = JSON.stringify({{ error: result.error, message: result.message }});
                        }} else {{
                            Module.startGameResult = JSON.stringify({{ error: 'Unknown error' }});
                        }}
                    }} catch (error) {{
                        Module.startGameResult = JSON.stringify({{ error: error.message }});
                    }}
                }})();
                "#,
                lobby_id, lobby_id
            );

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn start_lobby_game(&mut self) {
        println!("🎮 Start lobby game not available in native build");
    }

    /// Fetch lobby data to update team rosters
    #[cfg(target_os = "emscripten")]
    pub fn fetch_lobby_data(&mut self) {
        if let Some(lobby_id) = &self.current_lobby_id {
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }
            use std::ffi::CString;

            let js_code = format!(
                r#"
                (async function() {{
                    try {{
                        console.log('📊 Fetching lobby data: {}');
                        const result = await window.gameBridge.getGame('{}');
                        if (result) {{
                            Module.lobbyDataResult = JSON.stringify({{ success: true, game: result }});
                        }} else {{
                            Module.lobbyDataResult = JSON.stringify({{ error: 'Failed to fetch game data' }});
                        }}
                    }} catch (error) {{
                        Module.lobbyDataResult = JSON.stringify({{ error: error.message }});
                    }}
                }})();
                "#,
                lobby_id, lobby_id
            );

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn fetch_lobby_data(&mut self) {
        // Not available outside of browser
    }

    /// Check for lobby data response and populate team rosters
    #[cfg(target_os = "emscripten")]
    pub fn check_lobby_data_response(&mut self) {
        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }
        use std::ffi::CString;

        let check_js = CString::new("Module.lobbyDataResult || null").unwrap();
        let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };
        
        if !result_ptr.is_null() {
            let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
            let result_str = result_cstr.to_string_lossy();
            
            if result_str != "null" && !result_str.is_empty() {
                println!("🔍 Lobby data result: {}", result_str);
                
                if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                    if let Some(success) = result.get("success") {
                        if success.as_bool().unwrap_or(false) {
                            if let Some(game) = result.get("game") {
                                self.populate_team_rosters(game);
                            }
                        }
                    }
                }
                
                // Clear the result
                let clear_js = CString::new("Module.lobbyDataResult = null").unwrap();
                unsafe {
                    emscripten_run_script(clear_js.as_ptr());
                }
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_lobby_data_response(&mut self) {
        // Not available outside of browser
    }

    /// Populate team rosters from game data
    fn populate_team_rosters(&mut self, game: &serde_json::Value) {
        // Clear existing rosters
        self.lobby_team_a.clear();
        self.lobby_team_b.clear();

        // Get team counts from game data
        let team_a_count = game.get("currentPlayersTeamA")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;
        let team_b_count = game.get("currentPlayersTeamB")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;

        // Get and check game state
        let game_state = game.get("gameState")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u8;

        let old_game_state = self.current_game_state;
        self.current_game_state = game_state;

        // If game state changed from 0 (waiting) to 1 (active), signal game should start
        if old_game_state == 0 && game_state == 1 {
            println!("🎮 GAME STATE CHANGED TO ACTIVE! Signaling game start...");
            self.game_should_start = true;
        }

        // Get lobby leader info
        if let Some(created_by) = game.get("createdBy") {
            if let Some(leader_pubkey) = created_by.as_str() {
                self.lobby_leader = Some(leader_pubkey.to_string());

                // Check if current player is the leader
                // We'll need to get the current wallet public key from JavaScript
                self.check_if_current_player_is_leader(leader_pubkey);
            }
        }

        // Populate Team A with placeholder players
        for i in 1..=team_a_count {
            self.lobby_team_a.push(format!("Player {}", i));
        }

        // Populate Team B with placeholder players
        for i in 1..=team_b_count {
            self.lobby_team_b.push(format!("Player {}", i));
        }

        println!("📊 Updated team rosters - Team A: {} players, Team B: {} players, Game State: {}",
                 team_a_count, team_b_count, game_state);

        // After populating with placeholder players, fetch real player data
        self.fetch_team_players();
    }

    /// Fetch actual player usernames from the blockchain
    #[cfg(target_os = "emscripten")]
    fn fetch_team_players(&mut self) {
        if let Some(lobby_id) = &self.current_lobby_id {
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }
            use std::ffi::CString;

            let js_code = format!(
                r#"
                (async function() {{
                    try {{
                        console.log('👥 Fetching team players for lobby: {}');
                        const players = await window.gameBridge.getAllPlayersInGame('{}');
                        if (players) {{
                            Module.teamPlayersResult = JSON.stringify({{ success: true, players: players }});
                        }} else {{
                            Module.teamPlayersResult = JSON.stringify({{ error: 'Failed to fetch players' }});
                        }}
                    }} catch (error) {{
                        Module.teamPlayersResult = JSON.stringify({{ error: error.message }});
                    }}
                }})();
                "#,
                lobby_id, lobby_id
            );

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    fn fetch_team_players(&mut self) {
        // Not available outside of browser
    }

    /// Check if current player is the lobby leader
    #[cfg(target_os = "emscripten")]
    fn check_if_current_player_is_leader(&mut self, leader_pubkey: &str) {
        extern "C" {
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }
        use std::ffi::CString;

        let js_code = r#"
        (function() {
            try {
                if (window.solana && window.solana.publicKey) {
                    return window.solana.publicKey.toString();
                }
                return null;
            } catch (error) {
                return null;
            }
        })();
        "#;

        let c_str = CString::new(js_code).unwrap();
        let result_ptr = unsafe { emscripten_run_script_string(c_str.as_ptr()) };
        
        if !result_ptr.is_null() {
            let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
            let current_pubkey = result_cstr.to_string_lossy();
            
            if current_pubkey != "null" && !current_pubkey.is_empty() {
                self.is_lobby_leader = current_pubkey == leader_pubkey;
                println!("🔍 Current player: {}, Leader: {}, Is leader: {}", 
                         current_pubkey, leader_pubkey, self.is_lobby_leader);
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    fn check_if_current_player_is_leader(&mut self, _leader_pubkey: &str) {
        // Not available outside of browser
        self.is_lobby_leader = false;
    }

    /// Check for join game response
    #[cfg(target_os = "emscripten")]
    pub fn check_join_game_response(&mut self) {
        if !self.joining_lobby_pending {
            return;
        }

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }
        use std::ffi::CString;

        let check_js = CString::new("Module.joinGameResult || null").unwrap();
        let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };
        
        if !result_ptr.is_null() {
            let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
            let result_str = result_cstr.to_string_lossy();
            
            if result_str != "null" && !result_str.is_empty() {
                println!("🔍 Join game result: {}", result_str);
                
                if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                    if let Some(success) = result.get("success") {
                        if success.as_bool().unwrap_or(false) {
                            println!("✅ Successfully joined game!");
                            self.in_lobby = true;
                            self.joining_lobby_pending = false;
                            // Set the lobby ID if not already set
                            if self.current_lobby_id.is_none() {
                                // This should have been set when join_lobby was called
                                println!("⚠️ Warning: current_lobby_id not set when joining game");
                            }
                            // Fetch lobby data to populate teams
                            self.fetch_lobby_data();
                        } else if let Some(error) = result.get("error") {
                            println!("❌ Failed to join game: {}", error);
                            self.joining_lobby_pending = false;
                        }
                    }
                }
                
                // Clear the result
                let clear_js = CString::new("Module.joinGameResult = null").unwrap();
                unsafe {
                    emscripten_run_script(clear_js.as_ptr());
                }
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_join_game_response(&mut self) {
        // Not available outside of browser
    }

    /// Check for start game response
    #[cfg(target_os = "emscripten")]
    pub fn check_start_game_response(&mut self) {
        if !self.starting_game_pending {
            return;
        }

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }
        use std::ffi::CString;

        let check_js = CString::new("Module.startGameResult || null").unwrap();
        let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };
        
        if !result_ptr.is_null() {
            let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
            let result_str = result_cstr.to_string_lossy();
            
            if result_str != "null" && !result_str.is_empty() {
                println!("🔍 Start game result: {}", result_str);
                
                if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                    if let Some(success) = result.get("success") {
                        if success.as_bool().unwrap_or(false) {
                            println!("✅ Game started successfully!");
                            if let Some(transaction) = result.get("transaction") {
                                println!("Transaction: {}", transaction);
                            }
                            self.starting_game_pending = false;
                        } else if let Some(error) = result.get("error") {
                            println!("❌ Failed to start game: {}", error);
                            self.starting_game_pending = false;
                        }
                    }
                }
                
                // Clear the result
                let clear_js = CString::new("Module.startGameResult = null").unwrap();
                unsafe {
                    emscripten_run_script(clear_js.as_ptr());
                }
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_start_game_response(&mut self) {
        // Not available outside of browser
    }

    /// Check for team players response and update rosters with real usernames
    #[cfg(target_os = "emscripten")]
    pub fn check_team_players_response(&mut self) {
        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }
        use std::ffi::CString;

        let check_js = CString::new("Module.teamPlayersResult || null").unwrap();
        let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };
        
        if !result_ptr.is_null() {
            let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
            let result_str = result_cstr.to_string_lossy();
            
            if result_str != "null" && !result_str.is_empty() {
                println!("🔍 Team players result: {}", result_str);
                
                if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                    if let Some(success) = result.get("success") {
                        if success.as_bool().unwrap_or(false) {
                            if let Some(players) = result.get("players") {
                                self.update_rosters_with_real_usernames(players);
                            }
                        }
                    }
                }
                
                // Clear the result
                let clear_js = CString::new("Module.teamPlayersResult = null").unwrap();
                unsafe {
                    emscripten_run_script(clear_js.as_ptr());
                }
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_team_players_response(&mut self) {
        // Not available outside of browser
    }

    /// Update team rosters with real usernames from player data
    fn update_rosters_with_real_usernames(&mut self, players: &serde_json::Value) {
        // Clear existing rosters
        self.lobby_team_a.clear();
        self.lobby_team_b.clear();
        
        if let Some(players_array) = players.as_array() {
            for player in players_array {
                if let Some(username) = player.get("username").and_then(|v| v.as_str()) {
                    if let Some(team) = player.get("team").and_then(|v| v.as_str()) {
                        match team {
                            "A" => self.lobby_team_a.push(username.to_string()),
                            "B" => self.lobby_team_b.push(username.to_string()),
                            _ => {}
                        }
                    }
                }
            }
        }
        
        println!("📊 Updated rosters with real usernames - Team A: {:?}, Team B: {:?}",
                 self.lobby_team_a, self.lobby_team_b);
    }

    /// Check if player is currently in a game (for auto-reconnect)
    #[cfg(target_os = "emscripten")]
    pub fn check_player_current_game(&mut self) {
        // Don't check if already in a lobby or if a check is pending
        if self.in_lobby || self.check_player_game_pending {
            return;
        }

        self.check_player_game_pending = true;

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }
        use std::ffi::CString;

        let js_code = r#"
            (async function() {
                try {
                    console.log('🔍 Checking if player is in a game...');
                    const currentGame = await window.gameBridge.getPlayerCurrentGame();
                    if (currentGame) {
                        Module.playerCurrentGameResult = JSON.stringify({ success: true, gameId: currentGame });
                    } else {
                        Module.playerCurrentGameResult = JSON.stringify({ success: true, gameId: null });
                    }
                } catch (error) {
                    Module.playerCurrentGameResult = JSON.stringify({ error: error.message });
                }
            })();
        "#;

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_player_current_game(&mut self) {
        // Not available outside of browser
    }

    /// Check for player current game response and auto-enter lobby if in game
    #[cfg(target_os = "emscripten")]
    pub fn check_player_current_game_response(&mut self) {
        if !self.check_player_game_pending {
            return;
        }

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }
        use std::ffi::CString;

        let check_js = CString::new("Module.playerCurrentGameResult || null").unwrap();
        let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

        if !result_ptr.is_null() {
            let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
            let result_str = result_cstr.to_string_lossy();

            if result_str != "null" && !result_str.is_empty() {
                println!("🔍 Player current game result: {}", result_str);

                if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                    if let Some(success) = result.get("success") {
                        if success.as_bool().unwrap_or(false) {
                            if let Some(game_id) = result.get("gameId") {
                                if !game_id.is_null() {
                                    if let Some(game_id_str) = game_id.as_str() {
                                        println!("🎮 Player is already in game: {}", game_id_str);

                                        // Auto-enter lobby
                                        self.in_lobby = true;
                                        self.current_lobby_id = Some(game_id_str.to_string());

                                        // Fetch lobby data to populate teams and check if leader
                                        self.fetch_lobby_data();

                                        println!("✅ Auto-reconnected to lobby!");
                                    }
                                } else {
                                    println!("✅ Player is not in any game");
                                }
                            }
                        }
                    }
                }

                // Clear the result
                let clear_js = CString::new("Module.playerCurrentGameResult = null").unwrap();
                unsafe {
                    emscripten_run_script(clear_js.as_ptr());
                }
            }

            self.check_player_game_pending = false;
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_player_current_game_response(&mut self) {
        // Not available outside of browser
    }
}
