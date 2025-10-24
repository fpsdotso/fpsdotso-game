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
}

impl MenuState {
    pub fn new() -> Self {
        Self {
            current_tab: MenuTab::Lobby,
            available_rooms: vec![
                Room {
                    id: "room_1".to_string(),
                    name: "Pro Players Only".to_string(),
                    map: "Dust 2".to_string(),
                    current_players: 8,
                    max_players: 10,
                    host: "xX_ProGamer_Xx".to_string(),
                },
                Room {
                    id: "room_2".to_string(),
                    name: "Casual Fun".to_string(),
                    map: "Mirage".to_string(),
                    current_players: 4,
                    max_players: 10,
                    host: "CoolPlayer123".to_string(),
                },
                Room {
                    id: "room_3".to_string(),
                    name: "Team Deathmatch".to_string(),
                    map: "Inferno".to_string(),
                    current_players: 10,
                    max_players: 10,
                    host: "AdminBot".to_string(),
                },
            ],
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
        }
    }

    pub fn create_room(&mut self) {
        if !self.new_room_name.is_empty() {
            let new_room = Room {
                id: format!("room_{}", self.available_rooms.len() + 1),
                name: self.new_room_name.clone(),
                map: self.selected_map_for_room.clone(),
                current_players: 1,
                max_players: self.new_room_max_players as u32,
                host: "You".to_string(),
            };
            self.available_rooms.push(new_room);

            // Reset create room form
            self.new_room_name.clear();
            self.new_room_max_players = 10;
            self.show_create_room_popup = false;
        }
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
}
