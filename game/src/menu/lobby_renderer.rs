use raylib::prelude::*;
use super::lobby_ui::*;
use super::menu_state::{MenuState, MenuTab};

/// Main lobby renderer using custom Raylib UI
pub struct LobbyRenderer {
    pub colors: UIColors,
    pub team_a_roster: TeamRoster,
    pub team_b_roster: TeamRoster,
    pub games_list: GamesList,
    pub create_game_button: UIButton,
    pub join_game_button: UIButton,
    pub leave_game_button: UIButton,
    pub start_game_button: UIButton,
    pub ready_button: UIButton,
    pub refresh_button: UIButton,
}

impl LobbyRenderer {
    pub fn new(screen_width: i32, screen_height: i32) -> Self {
        let colors = UIColors::new();
        let w = screen_width as f32;
        let h = screen_height as f32;

        // Layout dimensions
        let roster_width = 350.0;
        let roster_height = 450.0;
        let roster_margin = 30.0;

        let games_list_width = 500.0;
        let games_list_height = 500.0;

        let button_width = 180.0;
        let button_height = 50.0;

        // Team rosters on left and right
        let team_a_roster = TeamRoster::new(
            roster_margin,
            150.0,
            roster_width,
            roster_height,
            "ATTACKERS".to_string(),
            colors.accent_green,
        );

        let team_b_roster = TeamRoster::new(
            w - roster_width - roster_margin,
            150.0,
            roster_width,
            roster_height,
            "DEFENDERS".to_string(),
            colors.accent_red,
        );

        // Games list in center
        let games_list = GamesList::new(
            (w - games_list_width) / 2.0,
            100.0,
            games_list_width,
            games_list_height,
        );

        // Buttons at bottom center
        let button_y = h - 100.0;
        let button_spacing = 20.0;
        let total_button_width = (button_width * 3.0) + (button_spacing * 2.0);
        let button_start_x = (w - total_button_width) / 2.0;

        let create_game_button = UIButton::new(
            button_start_x,
            button_y,
            button_width,
            button_height,
            "CREATE GAME".to_string(),
        );

        let join_game_button = UIButton::new(
            button_start_x + button_width + button_spacing,
            button_y,
            button_width,
            button_height,
            "JOIN GAME".to_string(),
        );

        let leave_game_button = UIButton::new(
            button_start_x + (button_width + button_spacing) * 2.0,
            button_y,
            button_width,
            button_height,
            "LEAVE GAME".to_string(),
        );

        // Additional buttons on the sides
        let start_game_button = UIButton::new(
            roster_margin,
            roster_height + 170.0,
            roster_width,
            button_height,
            "START GAME".to_string(),
        );

        let ready_button = UIButton::new(
            w - roster_width - roster_margin,
            roster_height + 170.0,
            roster_width,
            button_height,
            "READY".to_string(),
        );

        let refresh_button = UIButton::new(
            (w - games_list_width) / 2.0 + games_list_width - 120.0,
            70.0,
            100.0,
            40.0,
            "REFRESH".to_string(),
        );

        Self {
            colors,
            team_a_roster,
            team_b_roster,
            games_list,
            create_game_button,
            join_game_button,
            leave_game_button,
            start_game_button,
            ready_button,
            refresh_button,
        }
    }

    /// Update lobby state from MenuState data
    pub fn update_from_menu_state(&mut self, menu_state: &MenuState) {
        // Update team rosters if in a lobby
        if menu_state.in_lobby {
            self.update_team_rosters(menu_state);

            // Update button states based on current state
            self.update_button_states(menu_state);
        } else {
            // Clear team rosters if not in a lobby
            self.team_a_roster.players.clear();
            self.team_b_roster.players.clear();

            // Enable create/join, disable leave/start/ready
            self.create_game_button.is_enabled = true;
            self.join_game_button.is_enabled = self.games_list.selected_index.is_some();
            self.leave_game_button.is_enabled = false;
            self.start_game_button.is_enabled = false;
            self.ready_button.is_enabled = false;
        }

        // Update games list
        self.update_games_list(menu_state);
    }

    fn update_team_rosters(&mut self, menu_state: &MenuState) {
        // Clear existing rosters
        self.team_a_roster.players.clear();
        self.team_b_roster.players.clear();

        // Get leader pubkey for crown indicator
        let leader_pubkey = menu_state.lobby_leader.clone().unwrap_or_default();

        // Add Team A players
        for (i, username) in menu_state.lobby_team_a.iter().enumerate() {
            let is_ready = menu_state.lobby_team_a_ready.get(i).copied().unwrap_or(false);
            let entry = PlayerEntry {
                username: username.clone(),
                is_ready,
                is_leader: username == &leader_pubkey || (i == 0 && menu_state.is_lobby_leader),
            };
            self.team_a_roster.players.push(entry);
        }

        // Add Team B players
        for (i, username) in menu_state.lobby_team_b.iter().enumerate() {
            let is_ready = menu_state.lobby_team_b_ready.get(i).copied().unwrap_or(false);
            let entry = PlayerEntry {
                username: username.clone(),
                is_ready,
                is_leader: username == &leader_pubkey,
            };
            self.team_b_roster.players.push(entry);
        }
    }

    fn update_button_states(&mut self, menu_state: &MenuState) {
        let is_leader = menu_state.is_lobby_leader;
        let is_ready = menu_state.player_ready_state;

        // Check if all players are ready
        let team_a_all_ready = menu_state.lobby_team_a_ready.iter().all(|&r| r) && !menu_state.lobby_team_a.is_empty();
        let team_b_all_ready = menu_state.lobby_team_b_ready.iter().all(|&r| r) && !menu_state.lobby_team_b.is_empty();
        let all_ready = team_a_all_ready && team_b_all_ready;

        // In a lobby: disable create/join, enable leave/ready, enable start if leader and all ready
        self.create_game_button.is_enabled = false;
        self.join_game_button.is_enabled = false;
        self.leave_game_button.is_enabled = true;
        self.ready_button.is_enabled = !menu_state.set_ready_pending; // Disable during pending operation
        self.start_game_button.is_enabled = is_leader && all_ready && !menu_state.starting_game_pending;

        // Update ready button text based on state
        if is_ready {
            self.ready_button.text = "UNREADY".to_string();
        } else {
            self.ready_button.text = "READY".to_string();
        }
    }

    fn update_games_list(&mut self, menu_state: &MenuState) {
        self.games_list.games.clear();

        for room in &menu_state.available_rooms {
            let entry = GameEntry {
                game_name: room.name.clone(),
                map_name: room.map.clone(),
                player_count: room.current_players as usize,
                max_players: room.max_players as usize,
                game_pubkey: room.id.clone(),
            };
            self.games_list.games.push(entry);
        }
    }

    /// Draw the entire lobby interface
    pub fn draw(&mut self, d: &mut RaylibDrawHandle) {
        let screen_width = d.get_screen_width();
        let screen_height = d.get_screen_height();

        // Draw background with subtle gradient
        d.draw_rectangle_gradient_v(
            0, 0, screen_width, screen_height / 2,
            Color::new(8, 12, 18, 255),
            Color::new(5, 8, 12, 255),
        );
        d.draw_rectangle_gradient_v(
            0, screen_height / 2, screen_width, screen_height / 2,
            Color::new(5, 8, 12, 255),
            Color::new(3, 5, 8, 255),
        );

        // Draw header
        self.draw_header(d, screen_width, screen_height);

        // Draw team rosters
        self.team_a_roster.draw(d, &self.colors);
        self.team_b_roster.draw(d, &self.colors);

        // Draw games list
        self.games_list.draw(d, &self.colors);

        // Draw buttons
        self.create_game_button.draw(d, &self.colors);
        self.join_game_button.draw(d, &self.colors);
        self.leave_game_button.draw(d, &self.colors);
        self.start_game_button.draw(d, &self.colors);
        self.ready_button.draw(d, &self.colors);
        self.refresh_button.draw(d, &self.colors);

        // Update button hover states - get mouse from draw handle
        let mouse_pos = d.get_mouse_position();
        self.create_game_button.update(mouse_pos);
        self.join_game_button.update(mouse_pos);
        self.leave_game_button.update(mouse_pos);
        self.start_game_button.update(mouse_pos);
        self.ready_button.update(mouse_pos);
        self.refresh_button.update(mouse_pos);

        // Update games list
        let mouse_wheel = d.get_mouse_wheel_move();
        self.games_list.update(mouse_pos, mouse_wheel);
    }

    fn draw_header(&self, d: &mut RaylibDrawHandle, screen_width: i32, _screen_height: i32) {
        let header_height = 90;

        // Header background with gradient
        d.draw_rectangle_gradient_v(
            0, 0, screen_width, header_height / 2,
            Color::new(10, 15, 25, 255),
            Color::new(8, 12, 18, 255),
        );
        d.draw_rectangle(0, header_height / 2, screen_width, header_height / 2, Color::new(8, 12, 18, 255));

        // Top accent line
        d.draw_rectangle_gradient_h(
            0, 0, screen_width / 2, 3,
            self.colors.accent_cyan,
            self.colors.accent_green,
        );
        d.draw_rectangle_gradient_h(
            screen_width / 2, 0, screen_width / 2, 3,
            self.colors.accent_green,
            self.colors.accent_cyan,
        );

        // Bottom accent line with glow
        d.draw_rectangle(0, header_height - 4, screen_width, 4, Color::new(0, 255, 180, 30));
        d.draw_rectangle_gradient_h(
            0, header_height - 4, screen_width / 2, 4,
            self.colors.accent_green,
            Color::new(0, 255, 180, 100),
        );
        d.draw_rectangle_gradient_h(
            screen_width / 2, header_height - 4, screen_width / 2, 4,
            Color::new(0, 255, 180, 100),
            self.colors.accent_green,
        );

        // Game title with shadow and glow
        let title = "FPS.SO";
        let subtitle = "MULTIPLAYER LOBBY";
        let title_font_size = 48;
        let subtitle_font_size = 14;

        let title_width = d.measure_text(title, title_font_size);
        let subtitle_width = d.measure_text(subtitle, subtitle_font_size);

        let title_x = (screen_width - title_width) / 2;
        let title_y = 18;
        let subtitle_x = (screen_width - subtitle_width) / 2;
        let subtitle_y = title_y + title_font_size + 2;

        // Title shadow
        d.draw_text(title, title_x + 3, title_y + 3, title_font_size, Color::new(0, 0, 0, 180));

        // Title with gradient effect (simulated with colored text)
        d.draw_text(title, title_x, title_y, title_font_size, self.colors.accent_green);

        // Subtitle
        d.draw_text(subtitle, subtitle_x, subtitle_y, subtitle_font_size, self.colors.text_secondary);

        // Decorative corner brackets
        let bracket_size = 40;
        let bracket_thickness = 3;
        let margin = 15;

        // Top-left bracket
        d.draw_rectangle(margin, margin, bracket_size, bracket_thickness, self.colors.accent_cyan);
        d.draw_rectangle(margin, margin, bracket_thickness, bracket_size, self.colors.accent_cyan);

        // Top-right bracket
        d.draw_rectangle(screen_width - margin - bracket_size, margin, bracket_size, bracket_thickness, self.colors.accent_cyan);
        d.draw_rectangle(screen_width - margin - bracket_thickness, margin, bracket_thickness, bracket_size, self.colors.accent_cyan);

        // Small accent dots
        d.draw_circle(margin + bracket_size, margin + bracket_size, 4.0, self.colors.accent_green);
        d.draw_circle(screen_width - margin - bracket_size, margin + bracket_size, 4.0, self.colors.accent_green);
    }

    /// Handle input and return user actions
    pub fn handle_input(&mut self, rl: &RaylibHandle) -> Option<LobbyAction> {
        if self.create_game_button.is_clicked(MouseButton::MOUSE_BUTTON_LEFT, rl) {
            return Some(LobbyAction::CreateGame);
        }

        if self.join_game_button.is_clicked(MouseButton::MOUSE_BUTTON_LEFT, rl) {
            if let Some(index) = self.games_list.selected_index {
                if index < self.games_list.games.len() {
                    return Some(LobbyAction::JoinGame(self.games_list.games[index].game_pubkey.clone()));
                }
            }
        }

        if self.leave_game_button.is_clicked(MouseButton::MOUSE_BUTTON_LEFT, rl) {
            return Some(LobbyAction::LeaveGame);
        }

        if self.start_game_button.is_clicked(MouseButton::MOUSE_BUTTON_LEFT, rl) {
            return Some(LobbyAction::StartGame);
        }

        if self.ready_button.is_clicked(MouseButton::MOUSE_BUTTON_LEFT, rl) {
            return Some(LobbyAction::ToggleReady);
        }

        if self.refresh_button.is_clicked(MouseButton::MOUSE_BUTTON_LEFT, rl) {
            return Some(LobbyAction::RefreshGames);
        }

        None
    }
}

/// Actions that can be triggered from the lobby UI
#[derive(Debug, Clone)]
pub enum LobbyAction {
    CreateGame,
    JoinGame(String),
    LeaveGame,
    StartGame,
    ToggleReady,
    RefreshGames,
}
