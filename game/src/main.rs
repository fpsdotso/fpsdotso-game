use raylib::prelude::*;

fn main() {
    // Initialize the Raylib window
    let (mut rl, thread) = raylib::init()
        .size(800, 600) // Set the window size
        .title("FPS.so - Solana Game") // Set the window title
        .build();

    // Main game loop
    while !rl.window_should_close() {
        // Begin drawing
        let mut d = rl.begin_drawing(&thread);

        // Clear the background with a color
        d.clear_background(Color::RAYWHITE);

        // Draw text on the screen
        d.draw_text("FPS.so - Solana Game", 300, 280, 20, Color::BLACK);
        d.draw_text("Solana integration via JavaScript bridge", 220, 320, 16, Color::DARKGRAY);
    }
}