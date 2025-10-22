use raylib::prelude::*;
use std::fs;

use super::map::{Map, MapObject, ModelType, WORLD_SIZE, WORLD_HALF_SIZE};

/// Editor mode states
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EditorMode {
    Placing,
    Selecting,
    Moving,
    Rotating,
    Scaling,
}

/// Axis for manipulation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Axis {
    X,
    Y,
    Z,
    All,
}

/// Map builder/editor for creating 3D maps
pub struct MapBuilder {
    /// The map being edited
    pub map: Map,

    /// Current editor mode
    pub mode: EditorMode,

    /// Currently selected object index
    pub selected_object: Option<usize>,

    /// Current model type to place
    pub current_model_type: ModelType,

    /// Current color for new objects
    pub current_color: Color,

    /// Camera for 3D view
    pub camera: Camera3D,

    /// Preview position for placing objects
    pub preview_position: Vector3,

    /// Current manipulation axis
    pub current_axis: Axis,

    /// Manipulation speed multiplier
    pub manipulation_speed: f32,

    /// Grid snap enabled
    pub grid_snap: bool,
    pub grid_size: f32,

    /// Show grid
    pub show_grid: bool,

    /// UI state
    pub show_help: bool,
    pub status_message: String,
    pub status_timer: f32,
}

impl MapBuilder {
    /// Create a new map builder
    pub fn new(map_name: String) -> Self {
        let camera = Camera3D::perspective(
            Vector3::new(20.0, 20.0, 20.0),
            Vector3::new(0.0, 0.0, 0.0),
            Vector3::new(0.0, 1.0, 0.0),
            60.0,
        );

        Self {
            map: Map::new(map_name),
            mode: EditorMode::Placing,
            selected_object: None,
            current_model_type: ModelType::Cube,
            current_color: Color::WHITE,
            camera,
            preview_position: Vector3::new(0.0, 1.0, 0.0), // Start at 1 unit above ground
            current_axis: Axis::All,
            manipulation_speed: 1.0,
            grid_snap: true,
            grid_size: 1.0,
            show_grid: true,
            show_help: true, // Show help by default
            status_message: "Welcome! Press H to toggle help".to_string(),
            status_timer: 5.0,
        }
    }

    /// Load a map from file
    pub fn load_map(path: &str) -> Result<Self, String> {
        let bytes = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
        let map = Map::from_json_bytes(&bytes).map_err(|e| format!("Failed to parse map: {}", e))?;

        let mut builder = Self::new(map.name.clone());
        builder.map = map;
        builder.set_status("Map loaded successfully");

        Ok(builder)
    }

    /// Save the map to file
    pub fn save_map(&self, path: &str) -> Result<(), String> {
        let bytes = self.map.to_json_bytes().map_err(|e| format!("Failed to serialize map: {}", e))?;

        if bytes.len() > 10240 {
            return Err(format!("Map size ({} bytes) exceeds 10KB limit!", bytes.len()));
        }

        fs::write(path, bytes).map_err(|e| format!("Failed to write file: {}", e))?;
        Ok(())
    }

    /// Update the map builder state
    pub fn update(&mut self, rl: &RaylibHandle, delta: f32) {
        // Update status timer
        if self.status_timer > 0.0 {
            self.status_timer -= delta;
        }

        // Camera controls
        self.update_camera(rl, delta);

        // Handle input based on mode
        match self.mode {
            EditorMode::Placing => self.handle_placing_mode(rl),
            EditorMode::Selecting => self.handle_selecting_mode(rl),
            EditorMode::Moving => self.handle_moving_mode(rl, delta),
            EditorMode::Rotating => self.handle_rotating_mode(rl, delta),
            EditorMode::Scaling => self.handle_scaling_mode(rl, delta),
        }

        // Mode switching
        if rl.is_key_pressed(KeyboardKey::KEY_ONE) {
            self.mode = EditorMode::Placing;
            self.set_status("Mode: Placing");
        } else if rl.is_key_pressed(KeyboardKey::KEY_TWO) {
            self.mode = EditorMode::Selecting;
            self.set_status("Mode: Selecting");
        } else if rl.is_key_pressed(KeyboardKey::KEY_THREE) && self.selected_object.is_some() {
            self.mode = EditorMode::Moving;
            self.set_status("Mode: Moving");
        } else if rl.is_key_pressed(KeyboardKey::KEY_FOUR) && self.selected_object.is_some() {
            self.mode = EditorMode::Rotating;
            self.set_status("Mode: Rotating");
        } else if rl.is_key_pressed(KeyboardKey::KEY_FIVE) && self.selected_object.is_some() {
            self.mode = EditorMode::Scaling;
            self.set_status("Mode: Scaling");
        }

        // Axis switching (for manipulation modes)
        if rl.is_key_pressed(KeyboardKey::KEY_X) {
            self.current_axis = Axis::X;
            self.set_status("Axis: X");
        } else if rl.is_key_pressed(KeyboardKey::KEY_Y) {
            self.current_axis = Axis::Y;
            self.set_status("Axis: Y");
        } else if rl.is_key_pressed(KeyboardKey::KEY_Z) {
            self.current_axis = Axis::Z;
            self.set_status("Axis: Z");
        } else if rl.is_key_pressed(KeyboardKey::KEY_A) {
            self.current_axis = Axis::All;
            self.set_status("Axis: All");
        }

        // Model type switching (in placing mode)
        if self.mode == EditorMode::Placing {
            if rl.is_key_pressed(KeyboardKey::KEY_C) {
                self.current_model_type = ModelType::Cube;
                self.set_status("Model: Cube");
            } else if rl.is_key_pressed(KeyboardKey::KEY_T) {
                self.current_model_type = ModelType::Triangle;
                self.set_status("Model: Triangle");
            } else if rl.is_key_pressed(KeyboardKey::KEY_S) {
                self.current_model_type = ModelType::Sphere;
                self.set_status("Model: Sphere");
            } else if rl.is_key_pressed(KeyboardKey::KEY_L) {
                self.current_model_type = ModelType::Cylinder;
                self.set_status("Model: Cylinder");
            } else if rl.is_key_pressed(KeyboardKey::KEY_P) {
                self.current_model_type = ModelType::Plane;
                self.set_status("Model: Plane");
            }
        }

        // Delete selected object
        if rl.is_key_pressed(KeyboardKey::KEY_DELETE) || rl.is_key_pressed(KeyboardKey::KEY_BACKSPACE) {
            if let Some(index) = self.selected_object {
                self.map.remove_object(index);
                self.selected_object = None;
                self.set_status("Object deleted");
            }
        }

        // Toggle grid
        if rl.is_key_pressed(KeyboardKey::KEY_G) {
            self.show_grid = !self.show_grid;
        }

        // Toggle grid snap
        if rl.is_key_pressed(KeyboardKey::KEY_N) {
            self.grid_snap = !self.grid_snap;
            self.set_status(&format!("Grid snap: {}", if self.grid_snap { "ON" } else { "OFF" }));
        }

        // Toggle help
        if rl.is_key_pressed(KeyboardKey::KEY_H) || rl.is_key_pressed(KeyboardKey::KEY_F1) {
            self.show_help = !self.show_help;
        }
    }

    /// Update camera controls
    fn update_camera(&mut self, rl: &RaylibHandle, delta: f32) {
        let camera_speed = 10.0 * delta;

        // Get camera vectors
        let cam_pos = self.camera.position;
        let cam_target = self.camera.target;

        let mut new_pos = cam_pos;
        let mut new_target = cam_target;

        // Camera movement (WASD + Q/E for up/down)
        if rl.is_key_down(KeyboardKey::KEY_W) {
            let forward = Vector3::new(
                new_target.x - new_pos.x,
                0.0,
                new_target.z - new_pos.z,
            ).normalized();
            new_pos = new_pos + forward * camera_speed;
            new_target = new_target + forward * camera_speed;
        }
        if rl.is_key_down(KeyboardKey::KEY_S) {
            let forward = Vector3::new(
                new_target.x - new_pos.x,
                0.0,
                new_target.z - new_pos.z,
            ).normalized();
            new_pos = new_pos - forward * camera_speed;
            new_target = new_target - forward * camera_speed;
        }
        if rl.is_key_down(KeyboardKey::KEY_A) {
            let right = Vector3::new(
                new_target.z - new_pos.z,
                0.0,
                -(new_target.x - new_pos.x),
            ).normalized();
            new_pos = new_pos - right * camera_speed;
            new_target = new_target - right * camera_speed;
        }
        if rl.is_key_down(KeyboardKey::KEY_D) {
            let right = Vector3::new(
                new_target.z - new_pos.z,
                0.0,
                -(new_target.x - new_pos.x),
            ).normalized();
            new_pos = new_pos + right * camera_speed;
            new_target = new_target + right * camera_speed;
        }
        if rl.is_key_down(KeyboardKey::KEY_Q) {
            new_pos.y += camera_speed;
            new_target.y += camera_speed;
        }
        if rl.is_key_down(KeyboardKey::KEY_E) {
            new_pos.y -= camera_speed;
            new_target.y -= camera_speed;
        }

        // Update camera
        self.camera = Camera3D::perspective(new_pos, new_target, Vector3::new(0.0, 1.0, 0.0), 60.0);
    }

    /// Handle placing mode
    fn handle_placing_mode(&mut self, rl: &RaylibHandle) {
        // By default, preview follows camera target but snaps to ground
        self.preview_position = self.camera.target;
        self.preview_position.y = 0.5; // Default to 0.5 units above ground (half a unit cube)

        // Override with manual positioning if keys are pressed
        let move_speed = if rl.is_key_down(KeyboardKey::KEY_LEFT_SHIFT) { 0.1 } else { 0.5 };

        let mut manual_move = false;

        // Arrow keys for XZ movement
        if rl.is_key_down(KeyboardKey::KEY_LEFT) {
            self.preview_position.x -= move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_RIGHT) {
            self.preview_position.x += move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_UP) {
            self.preview_position.z -= move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_DOWN) {
            self.preview_position.z += move_speed;
            manual_move = true;
        }

        // Page Up/Down for Y movement
        if rl.is_key_down(KeyboardKey::KEY_PAGE_UP) {
            self.preview_position.y += move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_PAGE_DOWN) {
            self.preview_position.y -= move_speed;
            manual_move = true;
        }

        // Also support NumPad
        if rl.is_key_down(KeyboardKey::KEY_KP_4) {
            self.preview_position.x -= move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_KP_6) {
            self.preview_position.x += move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_KP_8) {
            self.preview_position.z -= move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_KP_2) {
            self.preview_position.z += move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_KP_ADD) {
            self.preview_position.y += move_speed;
            manual_move = true;
        }
        if rl.is_key_down(KeyboardKey::KEY_KP_SUBTRACT) {
            self.preview_position.y -= move_speed;
            manual_move = true;
        }

        // Clamp preview position to world bounds
        self.preview_position = self.clamp_to_world(self.preview_position);

        // Ensure objects don't go below ground
        if self.preview_position.y < 0.1 {
            self.preview_position.y = 0.5;
        }

        // Place object at preview position
        if rl.is_mouse_button_pressed(MouseButton::MOUSE_BUTTON_LEFT) || rl.is_key_pressed(KeyboardKey::KEY_SPACE) {
            let mut obj = MapObject::new(self.current_model_type);
            obj.set_position(self.snap_to_grid(self.preview_position));
            obj.set_color(self.current_color);
            self.map.add_object(obj);
            self.set_status(&format!("Object placed ({} total)", self.map.objects.len()));
        }
    }

    /// Handle selecting mode
    fn handle_selecting_mode(&mut self, rl: &RaylibHandle) {
        // Cycle through objects with < and >
        if rl.is_key_pressed(KeyboardKey::KEY_COMMA) {
            if !self.map.objects.is_empty() {
                if let Some(idx) = self.selected_object {
                    self.selected_object = Some(if idx == 0 { self.map.objects.len() - 1 } else { idx - 1 });
                } else {
                    self.selected_object = Some(self.map.objects.len() - 1);
                }
                self.set_status(&format!("Selected object {}", self.selected_object.unwrap()));
            }
        }
        if rl.is_key_pressed(KeyboardKey::KEY_PERIOD) {
            if !self.map.objects.is_empty() {
                if let Some(idx) = self.selected_object {
                    self.selected_object = Some((idx + 1) % self.map.objects.len());
                } else {
                    self.selected_object = Some(0);
                }
                self.set_status(&format!("Selected object {}", self.selected_object.unwrap()));
            }
        }

        // Deselect with Escape
        if rl.is_key_pressed(KeyboardKey::KEY_ESCAPE) {
            self.selected_object = None;
            self.set_status("Deselected");
        }
    }

    /// Handle moving mode
    fn handle_moving_mode(&mut self, rl: &RaylibHandle, delta: f32) {
        if let Some(index) = self.selected_object {
            if index < self.map.objects.len() {
                let move_speed = self.manipulation_speed * delta * 10.0;
                let mut pos = self.map.objects[index].get_position();

                match self.current_axis {
                    Axis::X => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_4) { pos.x -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_6) { pos.x += move_speed; }
                    }
                    Axis::Y => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_2) { pos.y -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_8) { pos.y += move_speed; }
                    }
                    Axis::Z => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_2) { pos.z -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_8) { pos.z += move_speed; }
                    }
                    Axis::All => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_4) { pos.x -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_6) { pos.x += move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_8) { pos.z -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_2) { pos.z += move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_ADD) { pos.y += move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_SUBTRACT) { pos.y -= move_speed; }
                    }
                }

                let snapped_pos = self.snap_to_grid(self.clamp_to_world(pos));
                self.map.objects[index].set_position(snapped_pos);
            }
        }
    }

    /// Handle rotating mode
    fn handle_rotating_mode(&mut self, rl: &RaylibHandle, delta: f32) {
        if let Some(index) = self.selected_object {
            if index < self.map.objects.len() {
                let rot_speed = self.manipulation_speed * delta * 90.0;
                let mut rot = self.map.objects[index].get_rotation();

                match self.current_axis {
                    Axis::X => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_4) { rot.x -= rot_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_6) { rot.x += rot_speed; }
                    }
                    Axis::Y => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_4) { rot.y -= rot_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_6) { rot.y += rot_speed; }
                    }
                    Axis::Z => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_4) { rot.z -= rot_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_6) { rot.z += rot_speed; }
                    }
                    Axis::All => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_4) { rot.y -= rot_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_6) { rot.y += rot_speed; }
                    }
                }

                self.map.objects[index].set_rotation(rot);
            }
        }
    }

    /// Handle scaling mode
    fn handle_scaling_mode(&mut self, rl: &RaylibHandle, delta: f32) {
        if let Some(index) = self.selected_object {
            if index < self.map.objects.len() {
                let scale_speed = self.manipulation_speed * delta * 2.0;
                let mut scale = self.map.objects[index].get_scale();

                match self.current_axis {
                    Axis::X => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_4) { scale.x -= scale_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_6) { scale.x += scale_speed; }
                    }
                    Axis::Y => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_2) { scale.y -= scale_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_8) { scale.y += scale_speed; }
                    }
                    Axis::Z => {
                        if rl.is_key_down(KeyboardKey::KEY_KP_2) { scale.z -= scale_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_8) { scale.z += scale_speed; }
                    }
                    Axis::All => {
                        let mut uniform_scale = (scale.x + scale.y + scale.z) / 3.0;
                        if rl.is_key_down(KeyboardKey::KEY_KP_ADD) { uniform_scale += scale_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_KP_SUBTRACT) { uniform_scale -= scale_speed; }
                        scale = Vector3::new(uniform_scale, uniform_scale, uniform_scale);
                    }
                }

                self.map.objects[index].set_scale(scale);
            }
        }
    }

    /// Render the map builder
    pub fn render(&self, d: &mut RaylibDrawHandle, _thread: &RaylibThread) {
        let mut d3d = d.begin_mode3D(self.camera);

        // Draw world environment (ground, walls, grid)
        self.draw_world_environment(&mut d3d);

        // Render map objects
        self.map.render(&mut d3d);

        // Draw preview in placing mode
        if self.mode == EditorMode::Placing {
            self.draw_preview(&mut d3d);
        }

        // Highlight selected object
        if let Some(index) = self.selected_object {
            if index < self.map.objects.len() {
                self.draw_selection_highlight(&mut d3d, &self.map.objects[index]);
            }
        }

        // Draw spawn point
        self.draw_spawn_point(&mut d3d);

        drop(d3d);

        // Draw UI
        self.draw_ui(d);
    }

    /// Draw world environment (ground, walls, grid)
    fn draw_world_environment(&self, d: &mut RaylibMode3D<RaylibDrawHandle>) {
        let half = WORLD_HALF_SIZE;
        let wall_height = 20.0;
        let wall_thickness = 1.0;

        // Draw ground plane at y=0
        d.draw_plane(
            Vector3::new(0.0, 0.0, 0.0),
            Vector2::new(WORLD_SIZE, WORLD_SIZE),
            Color::DARKGRAY,
        );

        // Draw grid on top of ground
        if self.show_grid {
            d.draw_grid(200, 1.0);
        }

        // Draw four walls around the perimeter (semi-transparent)
        let wall_color = Color::new(120, 120, 120, 100);

        // North wall (positive Z)
        d.draw_cube(
            Vector3::new(0.0, wall_height / 2.0, half),
            WORLD_SIZE,
            wall_height,
            wall_thickness,
            wall_color,
        );

        // South wall (negative Z)
        d.draw_cube(
            Vector3::new(0.0, wall_height / 2.0, -half),
            WORLD_SIZE,
            wall_height,
            wall_thickness,
            wall_color,
        );

        // East wall (positive X)
        d.draw_cube(
            Vector3::new(half, wall_height / 2.0, 0.0),
            wall_thickness,
            wall_height,
            WORLD_SIZE,
            wall_color,
        );

        // West wall (negative X)
        d.draw_cube(
            Vector3::new(-half, wall_height / 2.0, 0.0),
            wall_thickness,
            wall_height,
            WORLD_SIZE,
            wall_color,
        );
    }

    /// Draw preview object
    fn draw_preview(&self, d: &mut RaylibMode3D<RaylibDrawHandle>) {
        let mut preview_obj = MapObject::new(self.current_model_type);
        let preview_pos = self.snap_to_grid(self.preview_position);
        preview_obj.set_position(preview_pos);

        // Make preview semi-transparent yellow
        preview_obj.set_color(Color::new(255, 255, 0, 200));
        preview_obj.draw(d);

        // Draw a marker at preview position
        d.draw_sphere(preview_pos, 0.2, Color::YELLOW);
    }

    /// Draw selection highlight
    fn draw_selection_highlight(&self, d: &mut RaylibMode3D<RaylibDrawHandle>, obj: &MapObject) {
        let pos = obj.get_position();
        let scale = obj.get_scale();
        let max_dim = scale.x.max(scale.y).max(scale.z);
        d.draw_sphere_wires(pos, max_dim * 0.7, 8, 8, Color::YELLOW);
    }

    /// Draw spawn point
    fn draw_spawn_point(&self, d: &mut RaylibMode3D<RaylibDrawHandle>) {
        let spawn = self.map.get_spawn_position();
        d.draw_sphere(spawn, 0.5, Color::GREEN);
        d.draw_line_3D(
            spawn,
            Vector3::new(spawn.x, spawn.y + 2.0, spawn.z),
            Color::GREEN,
        );
    }

    /// Draw UI overlay
    fn draw_ui(&self, d: &mut RaylibDrawHandle) {
        let y_offset = 10;
        let line_height = 20;

        // Mode and info
        d.draw_text(&format!("Mode: {:?}", self.mode), 10, y_offset, 20, Color::BLACK);
        d.draw_text(&format!("Objects: {}/{}", self.map.objects.len(), 400), 10, y_offset + line_height, 20, Color::BLACK);
        d.draw_text(&format!("Size: ~{} bytes", self.map.estimated_size()), 10, y_offset + line_height * 2, 20, Color::BLACK);
        d.draw_text(&format!("Preview: ({:.1}, {:.1}, {:.1})", self.preview_position.x, self.preview_position.y, self.preview_position.z),
            10, y_offset + line_height * 3, 20, Color::BLACK);
        d.draw_text(&format!("Model: {:?}", self.current_model_type), 10, y_offset + line_height * 4, 20, Color::BLACK);

        // Current axis
        if matches!(self.mode, EditorMode::Moving | EditorMode::Rotating | EditorMode::Scaling) {
            d.draw_text(&format!("Axis: {:?}", self.current_axis), 10, y_offset + line_height * 3, 20, Color::BLACK);
        }

        // Status message
        if self.status_timer > 0.0 {
            d.draw_text(&self.status_message, 10, y_offset + line_height * 4, 20, Color::DARKGREEN);
        }

        // Help
        if self.show_help {
            self.draw_help(d);
        } else {
            d.draw_text("Press H for help", 10, 580, 20, Color::GRAY);
        }
    }

    /// Draw help overlay
    fn draw_help(&self, d: &mut RaylibDrawHandle) {
        let help_text = vec![
            "=== FPS.so MAP BUILDER ===",
            "",
            "=== CAMERA ===",
            "WASD: Move camera",
            "Q/E: Move up/down",
            "",
            "=== MODES ===",
            "1: Placing mode",
            "2: Selecting mode",
            "3: Moving mode (need selection)",
            "4: Rotating mode (need selection)",
            "5: Scaling mode (need selection)",
            "",
            "=== PLACING MODE ===",
            "C: Cube   T: Triangle",
            "S: Sphere L: Cylinder",
            "P: Plane",
            "Preview follows camera",
            "Arrow/NumPad: Fine adjust",
            "PgUp/PgDn: Adjust Y",
            "Space/Click: Place object",
            "",
            "=== SELECTING MODE ===",
            ",/.: Prev/Next object",
            "ESC: Deselect",
            "DEL/Backspace: Delete",
            "",
            "=== MANIPULATION ===",
            "X/Y/Z: Lock to axis",
            "A: All axes",
            "NumPad: Adjust values",
            "",
            "=== OTHER ===",
            "G: Toggle grid",
            "N: Toggle grid snap",
            "F5: Save map",
            "F9: Load map",
            "H/F1: Toggle help",
        ];

        let bg_width = 340;
        let bg_height = help_text.len() as i32 * 18 + 20;
        d.draw_rectangle(20, 20, bg_width, bg_height, Color::new(0, 0, 0, 220));

        for (i, line) in help_text.iter().enumerate() {
            d.draw_text(line, 30, 30 + i as i32 * 18, 16, Color::WHITE);
        }
    }

    /// Snap position to grid
    fn snap_to_grid(&self, pos: Vector3) -> Vector3 {
        if self.grid_snap {
            Vector3::new(
                (pos.x / self.grid_size).round() * self.grid_size,
                (pos.y / self.grid_size).round() * self.grid_size,
                (pos.z / self.grid_size).round() * self.grid_size,
            )
        } else {
            pos
        }
    }

    /// Clamp position to world bounds
    fn clamp_to_world(&self, pos: Vector3) -> Vector3 {
        Vector3::new(
            pos.x.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE),
            pos.y.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE),
            pos.z.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE),
        )
    }

    /// Set status message
    fn set_status(&mut self, message: &str) {
        self.status_message = message.to_string();
        self.status_timer = 3.0; // Show for 3 seconds
    }
}
