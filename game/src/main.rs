use raylib::prelude::*;
use raylib_imgui::RaylibGui;

mod map;
mod menu;
mod game;

use map::MapBuilder;
use menu::{MenuState, MenuTab, LobbyTab, WeaponsTab};
use game::{GameState, GameMode, DebugMenu};

/// Apply Solana-themed modern colors to ImGui
pub fn apply_solana_ui_colors(_ui: &imgui::Ui) {
    // Note: Due to imgui 0.12 API limitations, we can't easily mutate the global style
    // Instead, we'll use inline styling with push_style_color calls where needed
    // The dark purple background is set via the Raylib clear_background call
}

/// Draw the main menu UI with Valorant-style tabs
fn draw_menu_ui(
    ui: &imgui::Ui,
    menu_state: &mut MenuState,
    map_builder: &mut MapBuilder,
    viewport_width: f32,
    style_applied: &mut bool
) -> bool {
    let [window_width, window_height] = ui.io().display_size;

    // For Map Editor, draw top bar separately without fullscreen background
    if menu_state.current_tab == MenuTab::MapEditor {
        // Draw top bar in a transparent window
        let top_bar_token = ui.window("Top Bar")
            .position([0.0, 0.0], imgui::Condition::Always)
            .size([window_width, 90.0], imgui::Condition::Always)
            .title_bar(false)
            .resizable(false)
            .movable(false)
            .scrollable(false)
            .bg_alpha(0.95)
            .begin();

        if let Some(_token) = top_bar_token {
            draw_top_bar(ui, menu_state);
        }

        // Draw map editor UI below the tab bar
        return map_builder.draw_imgui_ui(ui, viewport_width, style_applied);
    }

    // For other tabs (Lobby, Weapons), use fullscreen window with background
    let window_token = ui.window("Main Menu")
        .position([0.0, 0.0], imgui::Condition::Always)
        .size([window_width, window_height], imgui::Condition::Always)
        .title_bar(false)
        .resizable(false)
        .movable(false)
        .scrollable(false)
        .bring_to_front_on_focus(false)
        .focus_on_appearing(false)
        .begin();

    if let Some(_token) = window_token {
        // Top bar with game title and tabs
        draw_top_bar(ui, menu_state);

        ui.dummy([0.0, 10.0]);

        // Content area based on selected tab
        match menu_state.current_tab {
            MenuTab::Lobby => {
                LobbyTab::draw(menu_state, ui);
            },
            MenuTab::Weapons => {
                WeaponsTab::draw(menu_state, ui);
            },
            MenuTab::MapEditor => {
                // Should not reach here since we handle it above
            }
        };

        return true; // Menu tabs are fullscreen
    }

    true // If window somehow didn't open, assume UI is covering
}

/// Draw the Valorant-style top navigation bar
fn draw_top_bar(ui: &imgui::Ui, menu_state: &mut MenuState) {
    let window_width = ui.io().display_size[0];
    let current_tab = menu_state.current_tab; // Copy the current tab before the closure

    let mut new_tab = None;

    ui.child_window("top_bar")
        .size([window_width, 80.0])
        .border(false)
        .bg_alpha(1.0)
        .build(|| {
            // Top bar background color applied inside the child window
            let _bg_color = ui.push_style_color(imgui::StyleColor::ChildBg, [0.08, 0.08, 0.10, 1.0]);
            ui.dummy([0.0, 10.0]);

            // Game title/logo on the left
            ui.dummy([20.0, 0.0]);
            ui.same_line();

            let _title_color = ui.push_style_color(imgui::StyleColor::Text, [0.60, 0.27, 1.0, 1.0]);
            ui.set_window_font_scale(2.0);
            ui.text("FPS.SO");
            ui.set_window_font_scale(1.0);
            drop(_title_color);

            ui.same_line();
            ui.dummy([80.0, 0.0]);
            ui.same_line();

            // Tabs
            let tab_width = 150.0;
            let tab_height = 50.0;

            // Draw tabs and collect click events
            if draw_tab_button(ui, current_tab, MenuTab::Lobby, "LOBBY", tab_width, tab_height) {
                new_tab = Some(MenuTab::Lobby);
            }
            ui.same_line();
            if draw_tab_button(ui, current_tab, MenuTab::Weapons, "WEAPONS", tab_width, tab_height) {
                new_tab = Some(MenuTab::Weapons);
            }
            ui.same_line();
            if draw_tab_button(ui, current_tab, MenuTab::MapEditor, "MAP EDITOR", tab_width, tab_height) {
                new_tab = Some(MenuTab::MapEditor);
            }

            drop(_bg_color);
        });

    // Apply tab change after the closure
    if let Some(tab) = new_tab {
        menu_state.current_tab = tab;
    }
}

/// Draw an individual tab button with Valorant styling - returns true if clicked
fn draw_tab_button(
    ui: &imgui::Ui,
    current_tab: MenuTab,
    tab: MenuTab,
    label: &str,
    width: f32,
    height: f32,
) -> bool {
    let is_active = current_tab == tab;

    // Tab colors
    let (bg_color, text_color) = if is_active {
        ([0.38, 0.17, 0.60, 1.0], [0.08, 0.95, 0.58, 1.0]) // Active: purple bg, teal text
    } else {
        ([0.12, 0.12, 0.15, 0.6], [0.7, 0.7, 0.7, 1.0]) // Inactive: dark bg, gray text
    };

    let _bg = ui.push_style_color(imgui::StyleColor::Button, bg_color);
    let _bg_hover = ui.push_style_color(
        imgui::StyleColor::ButtonHovered,
        if is_active {
            [0.42, 0.20, 0.65, 1.0]
        } else {
            [0.15, 0.15, 0.18, 0.8]
        },
    );
    let _bg_active = ui.push_style_color(imgui::StyleColor::ButtonActive, [0.48, 0.25, 0.75, 1.0]);
    let _text = ui.push_style_color(imgui::StyleColor::Text, text_color);

    let clicked = ui.button_with_size(label, [width, height]);

    drop(_bg);
    drop(_bg_hover);
    drop(_bg_active);
    drop(_text);

    // Active tab indicator (bottom line)
    if is_active {
        let draw_list = ui.get_window_draw_list();
        let pos = ui.item_rect_min();
        let size = ui.item_rect_size();

        let line_y = pos[1] + size[1] - 2.0;
        let line_start = [pos[0], line_y];
        let line_end = [pos[0] + size[0], line_y];

        draw_list
            .add_line(line_start, line_end, [0.08, 0.95, 0.58, 1.0])
            .thickness(3.0)
            .build();
    }

    clicked
}

fn main() {
    // Initialize the Raylib window
    let (mut rl, thread) = raylib::init()
        .size(1280, 720)
        .title("FPS.so - First Person Shooter on Solana")
        .build();

    rl.set_target_fps(60);

    // Initialize imgui
    let mut gui = RaylibGui::new(&mut rl, &thread);

    // Create game state
    let mut game_state = GameState::new();
    let mut debug_menu = DebugMenu::new();

    // DISABLED: Menu and map editor
    // let mut menu_state = MenuState::new();
    // let mut map_builder = MapBuilder::new("My Map".to_string());
    // let viewport_width = (1280.0 * 0.7) as i32;
    // let mut mouse_over_ui = false;
    // let mut style_applied = false;

    // Main game loop
    while !rl.window_should_close() {
        let delta = rl.get_frame_time();

        // Update game state
        game_state.update(&mut rl, delta);

        // Start imgui frame
        let ui = gui.begin(&mut rl);

        // Draw debug menu or game HUD based on game mode
        if game_state.mode == GameMode::DebugMenu {
            // Show debug menu
            if let Some(map) = debug_menu.draw(&ui) {
                game_state.load_map(map);
                game_state.start_playing(&mut rl);
            }
        } else {
            // Show minimal HUD when playing
            ui.window("HUD")
                .position([10.0, 10.0], imgui::Condition::Always)
                .size([200.0, 100.0], imgui::Condition::Always)
                .title_bar(false)
                .resizable(false)
                .movable(false)
                .bg_alpha(0.3)
                .build(|| {
                    if let Some(ref player) = game_state.player {
                        ui.text(format!("Pos: ({:.1}, {:.1}, {:.1})",
                            player.position.x,
                            player.position.y,
                            player.position.z
                        ));
                    }
                    ui.text_colored([0.7, 0.7, 0.7, 1.0], "ESC - Menu");
                });
        }

        // Render 3D scene
        let mut d = rl.begin_drawing(&thread);
        // Lighter sky color for better visibility and ambient lighting
        d.clear_background(Color::new(60, 70, 90, 255)); // Light blue-gray sky

        // Render the game world
        game_state.render(&mut d, &thread);

        // End imgui frame - this draws the imgui overlay
        gui.end();
    }
}
