use raylib::prelude::*;

fn main() {
    // Initialize the Raylib window
    let (mut rl, thread) = raylib::init()
        .size(800, 600) // Set the window size
        .title("Hello, World!") // Set the window title
        .build();

    // Main game loop
    while !rl.window_should_close() {
        // Begin drawing
        let mut d = rl.begin_drawing(&thread);

        // Clear the background with a color
        d.clear_background(Color::RAYWHITE);

        // Draw "Hello, World!" text on the screen
        d.draw_text("Hello, World!", 350, 280, 20, Color::BLACK);
    }
}