use raylib::prelude::*;

mod map;

use map::MapBuilder;

fn main() {
    // Initialize the Raylib window
    let (mut rl, thread) = raylib::init()
        .size(1280, 720)
        .title("FPS.so Map Builder")
        .build();

    rl.set_target_fps(60);

    // Create a new map builder
    let mut map_builder = MapBuilder::new("My Map".to_string());

    // Main game loop
    while !rl.window_should_close() {
        let delta = rl.get_frame_time();

        // Update map builder
        map_builder.update(&rl, delta);

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

        // Render
        let mut d = rl.begin_drawing(&thread);
        d.clear_background(Color::SKYBLUE);

        map_builder.render(&mut d, &thread);

        // Save/Load instructions
        d.draw_text("F5: Save | F9: Load", 10, 540, 20, Color::BLACK);
    }
}