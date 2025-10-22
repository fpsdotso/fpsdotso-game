use raylib::prelude::*;
use raylib_imgui::RaylibGui;

mod map;

use map::MapBuilder;

fn main() {
    // Initialize the Raylib window
    let (mut rl, thread) = raylib::init()
        .size(1280, 720)
        .title("FPS.so Map Builder")
        .build();

    rl.set_target_fps(60);

    // Initialize imgui
    let mut gui = RaylibGui::new(&mut rl, &thread);

    // Create a new map builder
    let mut map_builder = MapBuilder::new("My Map".to_string());

    // Viewport width (70% of screen)
    let viewport_width = (1280.0 * 0.7) as i32;

    // Track if mouse is over UI
    let mut mouse_over_ui = false;

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

        // Draw imgui UI (Unity-style panels) and check if mouse is over UI
        mouse_over_ui = map_builder.draw_imgui_ui(ui, viewport_width as f32);

        // Update map builder (after imgui, so we know if mouse is over UI)
        map_builder.update(&rl, delta, mouse_over_ui);

        // Render 3D scene
        let mut d = rl.begin_drawing(&thread);
        d.clear_background(Color::new(40, 40, 45, 255)); // Dark gray like Unity

        // Render 3D viewport
        map_builder.render(&mut d, &thread, viewport_width);

        // End imgui frame - this draws the imgui overlay
        gui.end();
    }
}
