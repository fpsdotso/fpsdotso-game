use super::menu_state::MenuState;
use imgui::Ui;

pub struct WalletMenu {
    pub is_open: bool,
    pub wallet_connected: bool,
    pub wallet_address: String,
    pub balance: f64,
    pub player_initialized: bool,
    pub player_username: String,
    pub player_data: Option<PlayerData>,
    pub show_game_browser: bool,
    pub games: Vec<GameInfo>,
    pub games_loading: bool,
}

#[derive(Clone)]
pub struct PlayerData {
    pub username: String,
    pub level: u32,
    pub total_matches: u32,
    pub team: String,
    pub authority: String,
    pub signing_key: String,
}

#[derive(Clone)]
pub struct GameInfo {
    pub public_key: String,
    pub lobby_name: String,
    pub map_name: String,
    pub total_players: u32,
    pub max_players: u32,
    pub created_by: String,
    pub is_joinable: bool,
    pub is_private: bool,
}

impl WalletMenu {
    pub fn new() -> Self {
        Self {
            is_open: false,
            wallet_connected: false,
            wallet_address: String::new(),
            balance: 0.0,
            player_initialized: false,
            player_username: String::new(),
            player_data: None,
            show_game_browser: false,
            games: Vec::new(),
            games_loading: false,
        }
    }

    pub fn draw(&mut self, ui: &Ui, menu_state: &mut MenuState) {
        let window_width = ui.io().display_size[0];
        let window_height = ui.io().display_size[1];
        
        // Right-side menu bar - always visible as a thin bar
        let menu_bar_width = if self.is_open { 300.0 } else { 60.0 };
        
        // Use a regular window instead of child window to avoid ImGui assertion issues
        let window_token = ui.window("Wallet Menu")
            .position([window_width - menu_bar_width, 0.0], imgui::Condition::Always)
            .size([menu_bar_width, window_height], imgui::Condition::Always)
            .title_bar(false)
            .resizable(false)
            .movable(false)
            .scrollable(false)
            .bring_to_front_on_focus(false)
            .focus_on_appearing(false)
            .begin();
        
        if let Some(_token) = window_token {
            // Apply background styling
            let _menu_bg = ui.push_style_color(imgui::StyleColor::WindowBg, [0.08, 0.08, 0.10, 0.95]);
            let _menu_border = ui.push_style_color(imgui::StyleColor::Border, [0.3, 0.2, 0.4, 0.8]);
            
            if self.is_open {
                self.draw_expanded_menu(ui, menu_state);
            } else {
                self.draw_collapsed_menu(ui);
            }
            
            drop(_menu_bg);
            drop(_menu_border);
        }
    }

    fn draw_collapsed_menu(&mut self, ui: &Ui) {
        ui.dummy([0.0, 20.0]);
        
        // Wallet status indicator
        let status_color = if self.wallet_connected {
            [0.08, 0.95, 0.58, 1.0] // Green
        } else {
            [0.8, 0.3, 0.3, 1.0] // Red
        };
        
        let _status_color = ui.push_style_color(imgui::StyleColor::Text, status_color);
        ui.text("●");
        drop(_status_color);
        
        ui.dummy([0.0, 10.0]);
        
        // Player status indicator
        let player_color = if self.player_initialized {
            [0.08, 0.95, 0.58, 1.0] // Green
        } else {
            [0.8, 0.6, 0.0, 1.0] // Orange
        };
        
        let _player_color = ui.push_style_color(imgui::StyleColor::Text, player_color);
        ui.text("👤");
        drop(_player_color);
        
        ui.dummy([0.0, 20.0]);
        
        // Toggle button
        let _toggle_color = ui.push_style_color(imgui::StyleColor::Button, [0.38, 0.17, 0.60, 1.0]);
        let _toggle_hover = ui.push_style_color(imgui::StyleColor::ButtonHovered, [0.48, 0.25, 0.75, 1.0]);
        
        if ui.button_with_size("☰", [40.0, 40.0]) {
            self.is_open = true;
        }
        
        drop(_toggle_color);
        drop(_toggle_hover);
    }

    fn draw_expanded_menu(&mut self, ui: &Ui, menu_state: &mut MenuState) {
        // Header
        ui.dummy([0.0, 10.0]);
        
        let _title_color = ui.push_style_color(imgui::StyleColor::Text, [0.60, 0.27, 1.0, 1.0]);
        ui.set_window_font_scale(1.2);
        ui.text("WALLET & PLAYER");
        ui.set_window_font_scale(1.0);
        drop(_title_color);
        
        ui.dummy([0.0, 10.0]);
        ui.separator();
        ui.dummy([0.0, 10.0]);
        
        // Close button
        let _close_color = ui.push_style_color(imgui::StyleColor::Button, [0.8, 0.2, 0.2, 1.0]);
        if ui.button_with_size("✕", [30.0, 30.0]) {
            self.is_open = false;
        }
        drop(_close_color);
        
        ui.same_line();
        ui.dummy([10.0, 0.0]);
        ui.same_line();
        
        
        // Wallet section
        {
            let wallet_connected = self.wallet_connected;
            let wallet_address = self.wallet_address.clone();
            let balance = self.balance;
            self.draw_wallet_section(ui, wallet_connected, wallet_address, balance);
        }
        
        ui.dummy([0.0, 15.0]);
        ui.separator();
        ui.dummy([0.0, 10.0]);
        
        // Player section
        self.draw_player_section(ui);
        
        ui.dummy([0.0, 15.0]);
        ui.separator();
        ui.dummy([0.0, 10.0]);
        
        // Game browser section
        self.draw_game_browser_section(ui, menu_state);
    }


    fn draw_wallet_section(&mut self, ui: &Ui, wallet_connected: bool, wallet_address: String, balance: f64) {
        ui.text("WALLET");
        ui.dummy([0.0, 5.0]);
        
        if wallet_connected {
            ui.text_colored([0.08, 0.95, 0.58, 1.0], "✅ Connected");
            ui.text_colored([0.7, 0.7, 0.7, 1.0], 
                format!("{}...{}", 
                    &wallet_address[0..4.min(wallet_address.len())],
                    &wallet_address[wallet_address.len().saturating_sub(4)..]
                )
            );
            ui.text_colored([0.7, 0.7, 0.7, 1.0], 
                format!("Balance: {:.4} SOL", balance)
            );
            
            ui.dummy([0.0, 5.0]);
            
            let _refresh_color = ui.push_style_color(imgui::StyleColor::Button, [0.3, 0.3, 0.6, 1.0]);
            if ui.button_with_size("Refresh Balance", [0.0, 25.0]) {
                self.refresh_balance();
            }
            drop(_refresh_color);
            
            ui.dummy([0.0, 5.0]);
            
            let _fund_color = ui.push_style_color(imgui::StyleColor::Button, [0.08, 0.95, 0.58, 1.0]);
            if ui.button_with_size("Fund Game Wallet", [0.0, 25.0]) {
                self.fund_game_wallet();
            }
            drop(_fund_color);
        } else {
            ui.text_colored([0.8, 0.3, 0.3, 1.0], "❌ Not Connected");
            
            ui.dummy([0.0, 5.0]);
            
            let _connect_color = ui.push_style_color(imgui::StyleColor::Button, [0.38, 0.17, 0.60, 1.0]);
            if ui.button_with_size("Connect Wallet", [0.0, 30.0]) {
                self.connect_wallet();
            }
            drop(_connect_color);
        }
    }

    fn draw_player_section(&mut self, ui: &Ui) {
        ui.text("PLAYER");
        ui.dummy([0.0, 5.0]);
        
        if self.player_initialized {
            ui.text_colored([0.08, 0.95, 0.58, 1.0], "✅ Initialized");
            
            if let Some(player_data) = &self.player_data {
                ui.text_colored([0.7, 0.7, 0.7, 1.0], 
                    format!("Username: {}", player_data.username)
                );
                ui.text_colored([0.7, 0.7, 0.7, 1.0], 
                    format!("Level: {}", player_data.level)
                );
                ui.text_colored([0.7, 0.7, 0.7, 1.0], 
                    format!("Matches: {}", player_data.total_matches)
                );
                ui.text_colored([0.7, 0.7, 0.7, 1.0], 
                    format!("Team: {}", player_data.team)
                );
            }
            
            ui.dummy([0.0, 5.0]);
            
            let _refresh_color = ui.push_style_color(imgui::StyleColor::Button, [0.08, 0.95, 0.58, 1.0]);
            if ui.button_with_size("Refresh Player", [0.0, 25.0]) {
                self.refresh_player_data();
            }
            drop(_refresh_color);
        } else {
            ui.text_colored([0.8, 0.6, 0.0, 1.0], "⚠️ Not Initialized");
            
            ui.dummy([0.0, 5.0]);
            
            ui.text("Username:");
            ui.input_text("##player_username", &mut self.player_username)
                .build();
            
            ui.dummy([0.0, 5.0]);
            
            let can_init = self.wallet_connected && !self.player_username.trim().is_empty();
            
            if !can_init {
                ui.text_disabled("Initialize Player");
                if !self.wallet_connected {
                    ui.same_line();
                    ui.text_colored([0.7, 0.3, 0.3, 1.0], "(Connect wallet first)");
                } else if self.player_username.trim().is_empty() {
                    ui.same_line();
                    ui.text_colored([0.7, 0.3, 0.3, 1.0], "(Enter username)");
                }
            } else {
                let _init_color = ui.push_style_color(imgui::StyleColor::Button, [0.08, 0.95, 0.58, 1.0]);
                if ui.button_with_size("Initialize Player", [0.0, 25.0]) {
                    self.initialize_player();
                }
                drop(_init_color);
            }
            
            ui.dummy([0.0, 5.0]);
            
            let _check_color = ui.push_style_color(imgui::StyleColor::Button, [0.2, 0.6, 0.9, 1.0]);
            if ui.button_with_size("Check Player", [0.0, 25.0]) {
                self.check_player();
            }
            drop(_check_color);
        }
    }

    fn draw_game_browser_section(&mut self, ui: &Ui, _menu_state: &mut MenuState) {
        ui.text("GAME BROWSER");
        ui.dummy([0.0, 5.0]);
        
        if !self.show_game_browser {
            let _browse_color = ui.push_style_color(imgui::StyleColor::Button, [0.2, 0.6, 0.9, 1.0]);

            drop(_browse_color);
        } else {
            // Game browser controls
            let _refresh_color = ui.push_style_color(imgui::StyleColor::Button, [0.08, 0.95, 0.58, 1.0]);
            if ui.button_with_size("Refresh Games", [0.0, 25.0]) {
                self.load_games();
            }
            drop(_refresh_color);
            
            ui.dummy([0.0, 5.0]);
            
            let _create_color = ui.push_style_color(imgui::StyleColor::Button, [0.8, 0.6, 0.0, 1.0]);
            if ui.button_with_size("Create Game", [0.0, 25.0]) {
                self.create_game();
            }
            drop(_create_color);
            
            ui.dummy([0.0, 5.0]);
            
            let _close_color = ui.push_style_color(imgui::StyleColor::Button, [0.8, 0.2, 0.2, 1.0]);
            if ui.button_with_size("Close Browser", [0.0, 25.0]) {
                self.show_game_browser = false;
            }
            drop(_close_color);
            
            ui.dummy([0.0, 10.0]);
            
            // Games list
            ui.text("Available Games:");
            ui.dummy([0.0, 5.0]);
            
            if self.games_loading {
                ui.text_colored([0.7, 0.7, 0.0, 1.0], "Loading games...");
            } else if self.games.is_empty() {
                ui.text_colored([0.6, 0.6, 0.6, 1.0], "No games available");
                ui.text_colored([0.6, 0.6, 0.6, 1.0], "Create a new game!");
            } else {
                // Use a simple scrollable area instead of child window
                ui.text("Available Games:");
                ui.dummy([0.0, 5.0]);
                
                let mut join_game_id: Option<String> = None;
                
                // Simple list without scrollable region to avoid ImGui issues
                for game in &self.games {
                    ui.text_colored([0.9, 0.9, 0.9, 1.0], &game.lobby_name);
                    ui.text_colored([0.6, 0.6, 0.6, 1.0], 
                        format!("Map: {} | Players: {}/{}", 
                            game.map_name, game.total_players, game.max_players)
                    );
                    
                    if game.is_joinable {
                        let _join_color = ui.push_style_color(imgui::StyleColor::Button, [0.08, 0.95, 0.58, 1.0]);
                        if ui.button_with_size("Join", [60.0, 20.0]) {
                            join_game_id = Some(game.public_key.clone());
                        }
                        drop(_join_color);
                    } else {
                        ui.text_disabled(if game.is_private { "Private" } else { "Full" });
                    }
                    
                    ui.dummy([0.0, 5.0]);
                }
                
                // Handle join after the loop to avoid borrowing conflicts
                if let Some(game_id) = join_game_id {
                    self.join_game(&game_id);
                }
            }
        }
    }

    // Wallet functions
    fn connect_wallet(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }

            let js_code = r#"
            (async function() {
                try {
                    console.log('🔗 Connecting wallet...');
                    const result = await window.gameBridge.connectWallet();
                    if (result && result.connected) {
                        Module.walletConnectResult = JSON.stringify({
                            success: true,
                            publicKey: result.publicKey,
                            balance: result.balance || 0
                        });
                    } else {
                        Module.walletConnectResult = JSON.stringify({
                            success: false,
                            error: 'Failed to connect wallet'
                        });
                    }
                } catch (error) {
                    Module.walletConnectResult = JSON.stringify({
                        success: false,
                        error: error.message
                    });
                }
            })();
            "#;

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    fn refresh_balance(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }

            let js_code = r#"
            (async function() {
                try {
                    const balance = await window.gameBridge.getBalance();
                    Module.balanceResult = JSON.stringify({
                        success: true,
                        balance: balance
                    });
                } catch (error) {
                    Module.balanceResult = JSON.stringify({
                        success: false,
                        error: error.message
                    });
                }
            })();
            "#;

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    fn fund_game_wallet(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }

            let js_code = r#"
            (async function() {
                try {
                    await window.gameBridge.fundEphemeralWallet(0.1);
                    Module.fundResult = JSON.stringify({
                        success: true,
                        message: "Game wallet funded with 0.1 SOL"
                    });
                } catch (error) {
                    Module.fundResult = JSON.stringify({
                        success: false,
                        error: error.message
                    });
                }
            })();
            "#;

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    // Player functions
    fn initialize_player(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }

            let js_code = format!(
                r#"
                (async function() {{
                    try {{
                        console.log('🎮 Initializing player:', '{}');
                        const result = await window.gameBridge.initPlayer('{}');
                        if (result) {{
                            Module.playerInitResult = JSON.stringify({{
                                success: true,
                                player: result
                            }});
                        }} else {{
                            Module.playerInitResult = JSON.stringify({{
                                success: false,
                                error: 'Failed to initialize player'
                            }});
                        }}
                    }} catch (error) {{
                        Module.playerInitResult = JSON.stringify({{
                            success: false,
                            error: error.message
                        }});
                    }}
                }})();
                "#,
                self.player_username.replace("'", "\\'"),
                self.player_username.replace("'", "\\'")
            );

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    fn check_player(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }

            let js_code = r#"
            (async function() {
                try {
                    const player = await window.gameBridge.getPlayer();
                    if (player) {
                        Module.playerCheckResult = JSON.stringify({
                            success: true,
                            player: player
                        });
                    } else {
                        Module.playerCheckResult = JSON.stringify({
                            success: false,
                            error: 'No player found'
                        });
                    }
                } catch (error) {
                    Module.playerCheckResult = JSON.stringify({
                        success: false,
                        error: error.message
                    });
                }
            })();
            "#;

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    fn refresh_player_data(&mut self) {
        self.check_player();
    }

    // Game browser functions
    fn load_games(&mut self) {
        self.games_loading = true;
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }

            let js_code = r#"
            (async function() {
                try {
                    console.log('🎮 Loading available games...');
                    const games = await window.gameBridge.getAvailableGames();
                    if (games && Array.isArray(games)) {
                        Module.gamesLoadResult = JSON.stringify({
                            success: true,
                            games: games
                        });
                    } else {
                        Module.gamesLoadResult = JSON.stringify({
                            success: false,
                            error: 'Failed to load games'
                        });
                    }
                } catch (error) {
                    Module.gamesLoadResult = JSON.stringify({
                        success: false,
                        error: error.message
                    });
                }
            })();
            "#;

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    fn create_game(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }

            let js_code = r#"
            (async function() {
                try {
                    console.log('🎮 Creating new game...');
                    const result = await window.gameBridge.createGame('My Lobby', 'Default Map');
                    if (result) {
                        Module.gameCreateResult = JSON.stringify({
                            success: true,
                            game: result
                        });
                    } else {
                        Module.gameCreateResult = JSON.stringify({
                            success: false,
                            error: 'Failed to create game'
                        });
                    }
                } catch (error) {
                    Module.gameCreateResult = JSON.stringify({
                        success: false,
                        error: error.message
                    });
                }
            })();
            "#;

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    fn join_game(&mut self, game_public_key: &str) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script(script: *const i8);
            }

            let js_code = format!(
                r#"
                (async function() {{
                    try {{
                        console.log('🎮 Joining game:', '{}');
                        const result = await window.gameBridge.joinGame('{}');
                        if (result) {{
                            Module.gameJoinResult = JSON.stringify({{
                                success: true,
                                game: result
                            }});
                        }} else {{
                            Module.gameJoinResult = JSON.stringify({{
                                success: false,
                                error: 'Failed to join game'
                            }});
                        }}
                    }} catch (error) {{
                        Module.gameJoinResult = JSON.stringify({{
                            success: false,
                            error: error.message
                        }});
                    }}
                }})();
                "#,
                game_public_key, game_public_key
            );

            let c_str = CString::new(js_code).unwrap();
            unsafe {
                emscripten_run_script(c_str.as_ptr());
            }
        }
    }

    // Check for async responses
    pub fn check_responses(&mut self) {
        self.check_wallet_connect_response();
        self.check_balance_response();
        self.check_player_init_response();
        self.check_player_check_response();
        self.check_games_load_response();
        self.check_game_create_response();
        self.check_game_join_response();
        self.check_fund_response();
    }

    fn check_wallet_connect_response(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
                pub fn emscripten_run_script(script: *const i8);
            }

            let check_js = CString::new("Module.walletConnectResult || null").unwrap();
            let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

            if !result_ptr.is_null() {
                let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
                let result_str = result_cstr.to_string_lossy();

                if result_str != "null" && !result_str.is_empty() {
                    if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                        if let Some(success) = result.get("success") {
                            if success.as_bool().unwrap_or(false) {
                                if let Some(public_key) = result.get("publicKey").and_then(|v| v.as_str()) {
                                    self.wallet_connected = true;
                                    self.wallet_address = public_key.to_string();
                                }
                                if let Some(balance) = result.get("balance").and_then(|v| v.as_f64()) {
                                    self.balance = balance;
                                }
                            }
                        }
                    }

                    // Clear the result
                    let clear_js = CString::new("Module.walletConnectResult = null").unwrap();
                    unsafe {
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }

    fn check_balance_response(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
                pub fn emscripten_run_script(script: *const i8);
            }

            let check_js = CString::new("Module.balanceResult || null").unwrap();
            let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

            if !result_ptr.is_null() {
                let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
                let result_str = result_cstr.to_string_lossy();

                if result_str != "null" && !result_str.is_empty() {
                    if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                        if let Some(success) = result.get("success") {
                            if success.as_bool().unwrap_or(false) {
                                if let Some(balance) = result.get("balance").and_then(|v| v.as_f64()) {
                                    self.balance = balance;
                                }
                            }
                        }
                    }

                    // Clear the result
                    let clear_js = CString::new("Module.balanceResult = null").unwrap();
                    unsafe {
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }

    fn check_player_init_response(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
                pub fn emscripten_run_script(script: *const i8);
            }

            let check_js = CString::new("Module.playerInitResult || null").unwrap();
            let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

            if !result_ptr.is_null() {
                let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
                let result_str = result_cstr.to_string_lossy();

                if result_str != "null" && !result_str.is_empty() {
                    if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                        if let Some(success) = result.get("success") {
                            if success.as_bool().unwrap_or(false) {
                                self.player_initialized = true;
                                if let Some(player) = result.get("player") {
                                    self.player_data = Some(PlayerData {
                                        username: player.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                        level: player.get("level").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                                        total_matches: player.get("totalMatchesPlayed").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                                        team: player.get("team").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                        authority: player.get("authority").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                        signing_key: player.get("signingKey").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    });
                                }
                            }
                        }
                    }

                    // Clear the result
                    let clear_js = CString::new("Module.playerInitResult = null").unwrap();
                    unsafe {
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }

    fn check_player_check_response(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
                pub fn emscripten_run_script(script: *const i8);
            }

            let check_js = CString::new("Module.playerCheckResult || null").unwrap();
            let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

            if !result_ptr.is_null() {
                let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
                let result_str = result_cstr.to_string_lossy();

                if result_str != "null" && !result_str.is_empty() {
                    if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                        if let Some(success) = result.get("success") {
                            if success.as_bool().unwrap_or(false) {
                                self.player_initialized = true;
                                if let Some(player) = result.get("player") {
                                    self.player_data = Some(PlayerData {
                                        username: player.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                        level: player.get("level").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                                        total_matches: player.get("totalMatchesPlayed").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                                        team: player.get("team").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                        authority: player.get("authority").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                        signing_key: player.get("signingKey").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    });
                                }
                            }
                        }
                    }

                    // Clear the result
                    let clear_js = CString::new("Module.playerCheckResult = null").unwrap();
                    unsafe {
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }

    fn check_games_load_response(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
                pub fn emscripten_run_script(script: *const i8);
            }

            let check_js = CString::new("Module.gamesLoadResult || null").unwrap();
            let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

            if !result_ptr.is_null() {
                let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
                let result_str = result_cstr.to_string_lossy();

                if result_str != "null" && !result_str.is_empty() {
                    if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                        if let Some(success) = result.get("success") {
                            if success.as_bool().unwrap_or(false) {
                                if let Some(games) = result.get("games").and_then(|v| v.as_array()) {
                                    self.games.clear();
                                    for game in games {
                                        if let (Some(public_key), Some(lobby_name), Some(map_name), Some(total_players), Some(max_players), Some(created_by)) = (
                                            game.get("publicKey").and_then(|v| v.as_str()),
                                            game.get("lobbyName").and_then(|v| v.as_str()),
                                            game.get("mapName").and_then(|v| v.as_str()),
                                            game.get("totalPlayers").and_then(|v| v.as_u64()),
                                            game.get("maxPlayers").and_then(|v| v.as_u64()),
                                            game.get("createdBy").and_then(|v| v.as_str())
                                        ) {
                                            self.games.push(GameInfo {
                                                public_key: public_key.to_string(),
                                                lobby_name: lobby_name.to_string(),
                                                map_name: map_name.to_string(),
                                                total_players: total_players as u32,
                                                max_players: max_players as u32,
                                                created_by: created_by.to_string(),
                                                is_joinable: total_players < max_players,
                                                is_private: false, // Default to false
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Clear the result
                    let clear_js = CString::new("Module.gamesLoadResult = null").unwrap();
                    unsafe {
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
        self.games_loading = false;
    }

    fn check_game_create_response(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
                pub fn emscripten_run_script(script: *const i8);
            }

            let check_js = CString::new("Module.gameCreateResult || null").unwrap();
            let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

            if !result_ptr.is_null() {
                let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
                let result_str = result_cstr.to_string_lossy();

                if result_str != "null" && !result_str.is_empty() {
                    // Refresh games list after creating
                    self.load_games();

                    // Clear the result
                    let clear_js = CString::new("Module.gameCreateResult = null").unwrap();
                    unsafe {
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }

    fn check_game_join_response(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
                pub fn emscripten_run_script(script: *const i8);
            }

            let check_js = CString::new("Module.gameJoinResult || null").unwrap();
            let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

            if !result_ptr.is_null() {
                let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
                let result_str = result_cstr.to_string_lossy();

                if result_str != "null" && !result_str.is_empty() {
                    // Refresh games list after joining
                    self.load_games();

                    // Clear the result
                    let clear_js = CString::new("Module.gameJoinResult = null").unwrap();
                    unsafe {
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }

    fn check_fund_response(&mut self) {
        #[cfg(target_os = "emscripten")]
        {
            use std::ffi::CString;
            extern "C" {
                pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
                pub fn emscripten_run_script(script: *const i8);
            }

            let check_js = CString::new("Module.fundResult || null").unwrap();
            let result_ptr = unsafe { emscripten_run_script_string(check_js.as_ptr()) };

            if !result_ptr.is_null() {
                let result_cstr = unsafe { std::ffi::CStr::from_ptr(result_ptr) };
                let result_str = result_cstr.to_string_lossy();

                if result_str != "null" && !result_str.is_empty() {
                    if let Ok(result) = serde_json::from_str::<serde_json::Value>(&result_str) {
                        if let Some(success) = result.get("success") {
                            if success.as_bool().unwrap_or(false) {
                                // Funding successful, refresh balance
                                self.refresh_balance();
                            }
                        }
                    }

                    // Clear the result
                    let clear_js = CString::new("Module.fundResult = null").unwrap();
                    unsafe {
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }
}
