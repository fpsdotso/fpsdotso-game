use raylib::prelude::*;
use raylib_imgui::RaylibGui;

mod map;
mod menu;

use map::MapBuilder;
use menu::{MenuState, MenuTab, LobbyTab, WeaponsTab};

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

    // Create fullscreen window
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
        let mouse_over_ui = match menu_state.current_tab {
            MenuTab::Lobby => {
                LobbyTab::draw(menu_state, ui);
                true // Menu tabs are fullscreen
            },
            MenuTab::Weapons => {
                WeaponsTab::draw(menu_state, ui);
                true // Menu tabs are fullscreen
            },
            MenuTab::MapEditor => {
                // Draw map editor UI below the tab bar
                map_builder.draw_imgui_ui(ui, viewport_width, style_applied)
            }
        };

        return mouse_over_ui;
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
        .title("FPS.so Map Builder")
        .build();

    rl.set_target_fps(60);

    // Initialize imgui
    let mut gui = RaylibGui::new(&mut rl, &thread);

    // Create menu state
    let mut menu_state = MenuState::new();

    // Create a new map builder
    let mut map_builder = MapBuilder::new("My Map".to_string());

    // Viewport width (70% of screen)
    let viewport_width = (1280.0 * 0.7) as i32;

    // Track if mouse is over UI
    let mut mouse_over_ui = false;

    // Track if style has been applied
    let mut style_applied = false;

    // Main game loop
    while !rl.window_should_close() {
        let delta = rl.get_frame_time();

        // Handle save/load
        if rl.is_key_pressed(KeyboardKey::KEY_F5) {
            match map_builder.save_map("map.json") {
                Ok(_) => println!("Map saved successfully!"),
                Err(e) => eprintln!("Failed to save map: {}", e),
            }
        }
        if rl.is_key_pressed(KeyboardKey::KEY_F9) {
            match MapBuilder::load_map("map.json") {
                Ok(loaded) => {
                    map_builder = loaded;
                    println!("Map loaded successfully!");
                }
                Err(e) => eprintln!("Failed to load map: {}", e),
            }
        }

        // Start imgui frame
        let ui = gui.begin(&mut rl);

        // Always draw the menu UI with tabs - content changes based on selected tab
        mouse_over_ui = draw_menu_ui(ui, &mut menu_state, &mut map_builder, viewport_width as f32, &mut style_applied);

        // Update map builder (after imgui, so we know if mouse is over UI)
        if menu_state.current_tab == MenuTab::MapEditor {
            map_builder.update(&rl, delta, mouse_over_ui);
        }

        // Render 3D scene
        let mut d = rl.begin_drawing(&thread);
        d.clear_background(Color::new(13, 13, 17, 255)); // Dark purple-tinted background to match Solana theme

        // Only render 3D viewport in map editor mode
        if menu_state.current_tab == MenuTab::MapEditor {
            map_builder.render(&mut d, &thread, viewport_width);
        }

        // End imgui frame - this draws the imgui overlay
        gui.end();
    }
}
