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
            selected_map_for_room: "test-map-1".to_string(),
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
}
