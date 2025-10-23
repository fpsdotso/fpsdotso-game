use super::menu_state::MenuState;

pub struct LobbyTab;

impl LobbyTab {
    pub fn draw(menu_state: &mut MenuState, ui: &imgui::Ui) {
        // Main container with padding
        ui.dummy([0.0, 20.0]); // Top padding

        // Title
        let _title_color = ui.push_style_color(imgui::StyleColor::Text, [0.08, 0.95, 0.58, 1.0]);
        ui.set_window_font_scale(1.5);
        ui.text("FIND OR CREATE A MATCH");
        ui.set_window_font_scale(1.0);
        drop(_title_color);

        ui.dummy([0.0, 10.0]);

        // Create Room Button - prominent
        let _button_color = ui.push_style_color(imgui::StyleColor::Button, [0.38, 0.17, 0.60, 1.0]);
        let _button_hover = ui.push_style_color(imgui::StyleColor::ButtonHovered, [0.48, 0.25, 0.75, 1.0]);
        let _button_active = ui.push_style_color(imgui::StyleColor::ButtonActive, [0.58, 0.35, 0.85, 1.0]);

        if ui.button_with_size("+ CREATE ROOM", [200.0, 40.0]) {
            menu_state.show_create_room_popup = true;
        }

        drop(_button_color);
        drop(_button_hover);
        drop(_button_active);

        ui.same_line();
        ui.dummy([20.0, 0.0]);
        ui.same_line();

        // Refresh button
        if ui.button_with_size("REFRESH", [120.0, 40.0]) {
            // TODO: Fetch rooms from server
        }

        ui.dummy([0.0, 20.0]);
        ui.separator();
        ui.dummy([0.0, 10.0]);

        // Room list header
        ui.text("AVAILABLE ROOMS");
        ui.dummy([0.0, 5.0]);

        // Room list
        ui.child_window("room_list")
            .size([0.0, -50.0]) // Leave space for bottom buttons
            .border(true)
            .build(|| {
                if menu_state.available_rooms.is_empty() {
                    ui.dummy([0.0, 100.0]);
                    ui.text_colored([0.5, 0.5, 0.5, 1.0], "No rooms available");
                    ui.text_colored([0.5, 0.5, 0.5, 1.0], "Create your own room to get started!");
                } else {
                    for (i, room) in menu_state.available_rooms.iter().enumerate() {
                        let is_selected = menu_state.selected_room == Some(i);
                        let is_full = room.current_players >= room.max_players;

                        // Room card background
                        let bg_color = if is_selected {
                            [0.25, 0.18, 0.35, 1.0]
                        } else {
                            [0.12, 0.12, 0.15, 1.0]
                        };

                        let _card_bg = ui.push_style_color(imgui::StyleColor::ChildBg, bg_color);
                        let _card_border = ui.push_style_color(imgui::StyleColor::Border, [0.3, 0.2, 0.4, 0.8]);

                        ui.child_window(format!("room_{}", i))
                            .size([0.0, 100.0])
                            .border(true)
                            .build(|| {
                                ui.dummy([0.0, 5.0]);

                                // Room name
                                let _name_color = ui.push_style_color(imgui::StyleColor::Text, [0.95, 0.95, 0.98, 1.0]);
                                ui.set_window_font_scale(1.2);
                                ui.text(&room.name);
                                ui.set_window_font_scale(1.0);
                                drop(_name_color);

                                ui.dummy([0.0, 5.0]);

                                // Room info
                                ui.text_colored([0.7, 0.7, 0.7, 1.0], format!("Map: {}", room.map));
                                ui.text_colored([0.7, 0.7, 0.7, 1.0], format!("Host: {}", room.host));

                                ui.same_line();
                                ui.dummy([200.0, 0.0]);
                                ui.same_line();

                                // Player count
                                let player_color = if is_full {
                                    [1.0, 0.3, 0.3, 1.0] // Red if full
                                } else {
                                    [0.08, 0.95, 0.58, 1.0] // Solana teal
                                };
                                ui.text_colored(player_color, format!("{}/{} Players", room.current_players, room.max_players));

                                ui.same_line();
                                ui.dummy([50.0, 0.0]);
                                ui.same_line();

                                // Join button
                                if is_full {
                                    ui.text_disabled("FULL");
                                } else {
                                    let _join_btn = ui.push_style_color(imgui::StyleColor::Button, [0.08, 0.95, 0.58, 0.8]);
                                    let _join_hover = ui.push_style_color(imgui::StyleColor::ButtonHovered, [0.10, 1.0, 0.65, 1.0]);
                                    if ui.button_with_size("JOIN##".to_string() + &i.to_string(), [80.0, 30.0]) {
                                        menu_state.selected_room = Some(i);
                                        // TODO: Join room logic
                                    }
                                    drop(_join_btn);
                                    drop(_join_hover);
                                }
                            });

                        drop(_card_bg);
                        drop(_card_border);

                        ui.dummy([0.0, 10.0]); // Space between cards
                    }
                }
            });

        // Create Room Popup
        if menu_state.show_create_room_popup {
            ui.open_popup("Create Room");
        }

        ui.popup("Create Room", || {
                ui.text("CREATE NEW ROOM");
                ui.separator();
                ui.dummy([0.0, 10.0]);

                ui.text("Room Name:");
                ui.input_text("##room_name", &mut menu_state.new_room_name)
                    .build();

                ui.dummy([0.0, 10.0]);

                ui.text("Max Players:");
                ui.slider("##max_players", 2, 16, &mut menu_state.new_room_max_players);

                ui.dummy([0.0, 10.0]);

                ui.text("Select Map:");
                // TODO: Fetch available maps from Solana
                let maps = vec![
                    ("test-map-1".to_string(), "Test Map 1"),
                    ("test-map-2".to_string(), "Test Map 2"),
                    ("dust-2".to_string(), "Dust 2"),
                    ("mirage".to_string(), "Mirage"),
                ];
                for (id, name) in maps {
                    if ui.radio_button(name, &mut &menu_state.selected_map_for_room, &id) {
                        menu_state.selected_map_for_room = id;
                    }
                }

                ui.dummy([0.0, 20.0]);
                ui.separator();
                ui.dummy([0.0, 10.0]);

                let can_create = !menu_state.new_room_name.is_empty();

                if !can_create {
                    ui.text_disabled("CREATE");
                } else {
                    let _create_btn = ui.push_style_color(imgui::StyleColor::Button, [0.08, 0.95, 0.58, 0.8]);
                    if ui.button("CREATE") {
                        menu_state.create_room();
                        ui.close_current_popup();
                    }
                    drop(_create_btn);
                }

                ui.same_line();

                if ui.button("CANCEL") {
                    menu_state.show_create_room_popup = false;
                    ui.close_current_popup();
                }
            });
    }
}
