use super::menu_state::MenuState;

pub struct LobbyView;

impl LobbyView {
    pub fn draw(menu_state: &mut MenuState, ui: &imgui::Ui) {
        // Check for async responses
        menu_state.check_join_game_response();
        menu_state.check_start_game_response();
        menu_state.check_set_ready_response();

        // Main container with padding
        ui.dummy([0.0, 20.0]); // Top padding

        // Title
        let _title_color = ui.push_style_color(imgui::StyleColor::Text, [0.08, 0.95, 0.58, 1.0]);
        ui.set_window_font_scale(1.5);
        ui.text("GAME LOBBY");
        ui.set_window_font_scale(1.0);
        drop(_title_color);

        ui.dummy([0.0, 20.0]);

        // Lobby info header
        if let Some(lobby_id) = &menu_state.current_lobby_id {
            ui.text_colored([0.8, 0.8, 0.8, 1.0], &format!("Lobby ID: {}...{}", 
                &lobby_id[0..8], 
                &lobby_id[lobby_id.len()-8..]
            ));
        }

        ui.dummy([0.0, 20.0]);

        // Team sections side by side
        let window_width = ui.window_size()[0];
        let team_section_width = (window_width - 40.0) / 2.0; // Account for padding

        // Team A Section
        ui.child_window("Team A")
            .size([team_section_width, 300.0])
            .build(|| {
                let _team_color = ui.push_style_color(imgui::StyleColor::Text, [0.2, 0.8, 1.0, 1.0]);
                ui.set_window_font_scale(1.2);
                ui.text("TEAM A");
                ui.set_window_font_scale(1.0);
                drop(_team_color);

                ui.dummy([0.0, 10.0]);

                // Show team A players
                for (i, player) in menu_state.lobby_team_a.iter().enumerate() {
                    let is_ready = menu_state.lobby_team_a_ready.get(i).copied().unwrap_or(false);
                    let ready_indicator = if is_ready { "✓" } else { "○" };
                    let color = if is_ready { [0.2, 1.0, 0.2, 1.0] } else { [0.9, 0.9, 0.9, 1.0] };
                    ui.text_colored(color, &format!("{}. {} {}", i + 1, ready_indicator, player));
                }

                // Show empty slots
                let max_players = 5; // Default max players per team
                for i in menu_state.lobby_team_a.len()..max_players {
                    ui.text_colored([0.5, 0.5, 0.5, 1.0], &format!("{}. Empty Slot", i + 1));
                }
            });

        ui.same_line();
        ui.dummy([20.0, 0.0]);
        ui.same_line();

        // Team B Section
        ui.child_window("Team B")
            .size([team_section_width, 300.0])
            .build(|| {
                let _team_color = ui.push_style_color(imgui::StyleColor::Text, [1.0, 0.4, 0.4, 1.0]);
                ui.set_window_font_scale(1.2);
                ui.text("TEAM B");
                ui.set_window_font_scale(1.0);
                drop(_team_color);

                ui.dummy([0.0, 10.0]);

                // Show team B players
                for (i, player) in menu_state.lobby_team_b.iter().enumerate() {
                    let is_ready = menu_state.lobby_team_b_ready.get(i).copied().unwrap_or(false);
                    let ready_indicator = if is_ready { "✓" } else { "○" };
                    let color = if is_ready { [0.2, 1.0, 0.2, 1.0] } else { [0.9, 0.9, 0.9, 1.0] };
                    ui.text_colored(color, &format!("{}. {} {}", i + 1, ready_indicator, player));
                }

                // Show empty slots
                let max_players = 5; // Default max players per team
                for i in menu_state.lobby_team_b.len()..max_players {
                    ui.text_colored([0.5, 0.5, 0.5, 1.0], &format!("{}. Empty Slot", i + 1));
                }
            });

        ui.dummy([0.0, 30.0]);

        // Action buttons
        let _button_color = ui.push_style_color(imgui::StyleColor::Button, [0.38, 0.17, 0.60, 1.0]);
        let _button_hover = ui.push_style_color(imgui::StyleColor::ButtonHovered, [0.48, 0.25, 0.75, 1.0]);
        let _button_active = ui.push_style_color(imgui::StyleColor::ButtonActive, [0.58, 0.35, 0.85, 1.0]);

        // Leave Lobby button (all players)
        if ui.button_with_size("LEAVE LOBBY", [150.0, 40.0]) {
            menu_state.leave_lobby();
            menu_state.in_lobby = false;
            menu_state.current_lobby_id = None;
            menu_state.lobby_team_a.clear();
            menu_state.lobby_team_b.clear();
            menu_state.lobby_leader = None;
            menu_state.is_lobby_leader = false;
        }

        ui.same_line();
        ui.dummy([20.0, 0.0]);
        ui.same_line();

        // Ready/Unready button (all players)
        let ready_text = if menu_state.player_ready_state { "UNREADY" } else { "READY" };
        let ready_color = if menu_state.player_ready_state {
            [0.8, 0.4, 0.0, 1.0] // Orange for unready
        } else {
            [0.2, 0.8, 0.2, 1.0] // Green for ready
        };

        let _ready_btn_color = ui.push_style_color(imgui::StyleColor::Button, ready_color);
        let _ready_btn_hover = ui.push_style_color(imgui::StyleColor::ButtonHovered, [
            ready_color[0] + 0.1,
            ready_color[1] + 0.1,
            ready_color[2] + 0.1,
            1.0
        ]);
        let _ready_btn_active = ui.push_style_color(imgui::StyleColor::ButtonActive, [
            ready_color[0] + 0.2,
            ready_color[1] + 0.2,
            ready_color[2] + 0.2,
            1.0
        ]);

        if ui.button_with_size(ready_text, [150.0, 40.0]) {
            println!("🖱️ READY button clicked!");
            menu_state.toggle_ready_state();
        }

        drop(_ready_btn_color);
        drop(_ready_btn_hover);
        drop(_ready_btn_active);

        ui.same_line();
        ui.dummy([20.0, 0.0]);
        ui.same_line();

        // Start Game button (leader only)
        if menu_state.is_lobby_leader {
            let _start_color = ui.push_style_color(imgui::StyleColor::Button, [0.2, 0.8, 0.2, 1.0]);
            let _start_hover = ui.push_style_color(imgui::StyleColor::ButtonHovered, [0.3, 0.9, 0.3, 1.0]);
            let _start_active = ui.push_style_color(imgui::StyleColor::ButtonActive, [0.4, 1.0, 0.4, 1.0]);

            if ui.button_with_size("START GAME", [150.0, 40.0]) {
                menu_state.start_lobby_game();
            }

            drop(_start_color);
            drop(_start_hover);
            drop(_start_active);
        }

        ui.same_line();
        ui.dummy([20.0, 0.0]);
        ui.same_line();

        // Refresh button
        if ui.button_with_size("REFRESH", [120.0, 40.0]) {
            menu_state.fetch_lobby_data();
        }

        drop(_button_color);
        drop(_button_hover);
        drop(_button_active);

        ui.dummy([0.0, 20.0]);

        // Status messages
        if menu_state.joining_lobby_pending {
            ui.text_colored([0.8, 0.8, 0.0, 1.0], "Joining lobby...");
        }

        if menu_state.starting_game_pending {
            ui.text_colored([0.8, 0.8, 0.0, 1.0], "Starting game...");
        }

        // Show lobby leader info
        if menu_state.is_lobby_leader {
            ui.text_colored([0.0, 1.0, 0.0, 1.0], "You are the lobby leader");
        } else if let Some(leader) = &menu_state.lobby_leader {
            ui.text_colored([0.8, 0.8, 0.8, 1.0], &format!("Lobby leader: {}...{}", 
                &leader[0..8], 
                &leader[leader.len()-8..]
            ));
        }
    }
}
