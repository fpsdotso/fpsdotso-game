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
    pub show_hierarchy: bool,
    pub status_message: String,
    pub status_timer: f32,

    /// Solana upload popup state
    pub show_upload_popup: bool,
    pub upload_map_id: String,
    pub upload_map_name: String,
    pub upload_map_description: String,

    /// My Maps view state
    pub show_my_maps: bool,
    pub user_map_ids: Vec<String>,
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
            current_color: Color::new(70, 130, 180, 255), // Prototype/blueprint style: dark blue
            camera,
            preview_position: Vector3::new(0.0, 1.0, 0.0), // Start at 1 unit above ground
            current_axis: Axis::All,
            manipulation_speed: 1.0,
            grid_snap: true,
            grid_size: 1.0,
            show_grid: true,
            show_help: true, // Show help by default
            show_hierarchy: true, // Show hierarchy by default
            status_message: "Welcome! Press H for help, U for hierarchy".to_string(),
            status_timer: 5.0,
            show_upload_popup: false,
            upload_map_id: String::new(),
            upload_map_name: String::new(),
            upload_map_description: String::new(),
            show_my_maps: false,
            user_map_ids: Vec::new(),
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
    pub fn update(&mut self, rl: &RaylibHandle, delta: f32, mouse_over_ui: bool) {
        // Update status timer
        if self.status_timer > 0.0 {
            self.status_timer -= delta;
        }

        // Check for uploaded map file (Emscripten only)
        #[cfg(target_os = "emscripten")]
        self.check_uploaded_map();

        // Check for loaded map data from Solana (Emscripten only)
        #[cfg(target_os = "emscripten")]
        self.check_loaded_map_from_solana();

        // Camera controls
        self.update_camera(rl, delta);

        // Handle input based on mode
        match self.mode {
            EditorMode::Placing => self.handle_placing_mode(rl, mouse_over_ui),
            EditorMode::Selecting => self.handle_selecting_mode(rl),
            EditorMode::Moving => self.handle_moving_mode(rl, delta),
            EditorMode::Rotating => self.handle_rotating_mode(rl, delta),
            EditorMode::Scaling => self.handle_scaling_mode(rl, delta),
        }

        // Only process keyboard shortcuts when not hovering over UI
        if !mouse_over_ui {
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
                } else if rl.is_key_pressed(KeyboardKey::KEY_R) {
                    self.current_model_type = ModelType::Rectangle;
                    self.set_status("Model: Rectangle");
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
                } else if rl.is_key_pressed(KeyboardKey::KEY_B) {
                    self.current_model_type = ModelType::SpawnPointBlue;
                    self.set_status("Model: Blue Spawn Point");
                } else if rl.is_key_pressed(KeyboardKey::KEY_D) {
                    self.current_model_type = ModelType::SpawnPointRed;
                    self.set_status("Model: Red Spawn Point");
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

        // Toggle hierarchy
        if rl.is_key_pressed(KeyboardKey::KEY_U) {
            self.show_hierarchy = !self.show_hierarchy;
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
    fn handle_placing_mode(&mut self, rl: &RaylibHandle, mouse_over_ui: bool) {
        // Use mouse raycast to determine placement position
        if !mouse_over_ui {
            let mouse_pos = rl.get_mouse_position();
            let viewport_width = 1280.0 * 0.7; // 70% of screen for viewport

            // Only calculate if mouse is in viewport
            if mouse_pos.x < viewport_width {
                // Manual raycast calculation
                // The viewport is the full height but only 70% of the width
                let screen_width = 1280.0;
                let screen_height = 720.0;

                // Normalize to -1 to 1 range, but consider the full screen width for proper aspect ratio
                let ndc_x = (2.0 * mouse_pos.x / screen_width) - 1.0;
                let ndc_y = 1.0 - (2.0 * mouse_pos.y / screen_height);

                // Calculate ray direction from camera
                let camera_pos = self.camera.position;
                let camera_target = self.camera.target;
                let camera_up = self.camera.up;

                // Camera forward vector
                let forward = Vector3::new(
                    camera_target.x - camera_pos.x,
                    camera_target.y - camera_pos.y,
                    camera_target.z - camera_pos.z,
                ).normalized();

                // Camera right vector (cross product: forward x up)
                let right = Vector3::new(
                    forward.y * camera_up.z - forward.z * camera_up.y,
                    forward.z * camera_up.x - forward.x * camera_up.z,
                    forward.x * camera_up.y - forward.y * camera_up.x,
                ).normalized();

                // Camera actual up vector (cross product: right x forward)
                let up = Vector3::new(
                    right.y * forward.z - right.z * forward.y,
                    right.z * forward.x - right.x * forward.z,
                    right.x * forward.y - right.y * forward.x,
                ).normalized();

                // FOV and aspect ratio
                let fov_rad = 60.0_f32.to_radians();
                let aspect = screen_width / screen_height;
                let half_height = (fov_rad / 2.0).tan();
                let half_width = half_height * aspect;

                // Calculate ray direction
                let ray_dir = Vector3::new(
                    forward.x + right.x * ndc_x * half_width + up.x * ndc_y * half_height,
                    forward.y + right.y * ndc_x * half_width + up.y * ndc_y * half_height,
                    forward.z + right.z * ndc_x * half_width + up.z * ndc_y * half_height,
                ).normalized();

                // Raycast to ground plane (y = 0)
                if ray_dir.y != 0.0 {
                    let t = (0.0 - camera_pos.y) / ray_dir.y;
                    if t > 0.0 {
                        let hit_point = Vector3::new(
                            camera_pos.x + ray_dir.x * t,
                            0.5, // Place slightly above ground
                            camera_pos.z + ray_dir.z * t,
                        );

                        // Clamp to world bounds
                        self.preview_position = self.clamp_to_world(hit_point);
                    }
                }
            }
        }

        // Ensure objects don't go below ground
        if self.preview_position.y < 0.1 {
            self.preview_position.y = 0.5;
        }

        // Place object at preview position (only if not over UI)
        if !mouse_over_ui && rl.is_mouse_button_pressed(MouseButton::MOUSE_BUTTON_LEFT) {
            let mut obj = MapObject::new(self.current_model_type);
            obj.set_position(self.snap_to_grid(self.preview_position));
            obj.set_color(self.current_color);
            self.map.add_object(obj);
            self.set_status(&format!("Object placed ({} total)", self.map.objects.len()));
        }
    }

    /// Handle selecting mode
    fn handle_selecting_mode(&mut self, rl: &RaylibHandle) {
        // Quick select with number keys (0-9)
        let number_keys = [
            KeyboardKey::KEY_ZERO, KeyboardKey::KEY_ONE, KeyboardKey::KEY_TWO,
            KeyboardKey::KEY_THREE, KeyboardKey::KEY_FOUR, KeyboardKey::KEY_FIVE,
            KeyboardKey::KEY_SIX, KeyboardKey::KEY_SEVEN, KeyboardKey::KEY_EIGHT,
            KeyboardKey::KEY_NINE,
        ];

        for (i, key) in number_keys.iter().enumerate() {
            if rl.is_key_pressed(*key) && i < self.map.objects.len() {
                self.selected_object = Some(i);
                self.set_status(&format!("Selected object {}: {:?}", i, self.map.objects[i].model_type));
                return;
            }
        }

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
                        if rl.is_key_down(KeyboardKey::KEY_LEFT) { pos.x -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_RIGHT) { pos.x += move_speed; }
                    }
                    Axis::Y => {
                        if rl.is_key_down(KeyboardKey::KEY_DOWN) { pos.y -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_UP) { pos.y += move_speed; }
                    }
                    Axis::Z => {
                        if rl.is_key_down(KeyboardKey::KEY_DOWN) { pos.z -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_UP) { pos.z += move_speed; }
                    }
                    Axis::All => {
                        if rl.is_key_down(KeyboardKey::KEY_LEFT) { pos.x -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_RIGHT) { pos.x += move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_UP) { pos.z -= move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_DOWN) { pos.z += move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_PAGE_UP) { pos.y += move_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_PAGE_DOWN) { pos.y -= move_speed; }
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
                        if rl.is_key_down(KeyboardKey::KEY_LEFT) { rot.x -= rot_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_RIGHT) { rot.x += rot_speed; }
                    }
                    Axis::Y => {
                        if rl.is_key_down(KeyboardKey::KEY_LEFT) { rot.y -= rot_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_RIGHT) { rot.y += rot_speed; }
                    }
                    Axis::Z => {
                        if rl.is_key_down(KeyboardKey::KEY_LEFT) { rot.z -= rot_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_RIGHT) { rot.z += rot_speed; }
                    }
                    Axis::All => {
                        if rl.is_key_down(KeyboardKey::KEY_LEFT) { rot.y -= rot_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_RIGHT) { rot.y += rot_speed; }
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
                        if rl.is_key_down(KeyboardKey::KEY_LEFT) { scale.x -= scale_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_RIGHT) { scale.x += scale_speed; }
                    }
                    Axis::Y => {
                        if rl.is_key_down(KeyboardKey::KEY_DOWN) { scale.y -= scale_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_UP) { scale.y += scale_speed; }
                    }
                    Axis::Z => {
                        if rl.is_key_down(KeyboardKey::KEY_DOWN) { scale.z -= scale_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_UP) { scale.z += scale_speed; }
                    }
                    Axis::All => {
                        let mut uniform_scale = (scale.x + scale.y + scale.z) / 3.0;
                        if rl.is_key_down(KeyboardKey::KEY_UP) { uniform_scale += scale_speed; }
                        if rl.is_key_down(KeyboardKey::KEY_DOWN) { uniform_scale -= scale_speed; }
                        scale = Vector3::new(uniform_scale, uniform_scale, uniform_scale);
                    }
                }

                self.map.objects[index].set_scale(scale);
            }
        }
    }

    /// Render the map builder
    pub fn render(&self, d: &mut RaylibDrawHandle, _thread: &RaylibThread, viewport_width: i32) {
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

        // Draw minimal UI
        self.draw_ui(d, viewport_width);
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

        // Draw grid on top of ground (50x50 units)
        if self.show_grid {
            d.draw_grid(50, 1.0);
        }

        // Walls are invisible but still exist as boundaries
        // (boundaries are enforced in clamp_to_world function)
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

    /// Draw selection highlight and transform gizmos
    fn draw_selection_highlight(&self, d: &mut RaylibMode3D<RaylibDrawHandle>, obj: &MapObject) {
        let pos = obj.get_position();
        let scale = obj.get_scale();
        let max_dim = scale.x.max(scale.y).max(scale.z);

        // Draw selection outline
        d.draw_sphere_wires(pos, max_dim * 0.7, 8, 8, Color::YELLOW);

        // Draw transform gizmos (arrows)
        let gizmo_length = 2.0;
        let arrow_size = 0.3;

        match self.mode {
            EditorMode::Moving => {
                // X axis (red)
                d.draw_line_3D(pos, Vector3::new(pos.x + gizmo_length, pos.y, pos.z), Color::RED);
                d.draw_cube(Vector3::new(pos.x + gizmo_length, pos.y, pos.z), arrow_size, arrow_size, arrow_size, Color::RED);

                // Y axis (green)
                d.draw_line_3D(pos, Vector3::new(pos.x, pos.y + gizmo_length, pos.z), Color::GREEN);
                d.draw_cube(Vector3::new(pos.x, pos.y + gizmo_length, pos.z), arrow_size, arrow_size, arrow_size, Color::GREEN);

                // Z axis (blue)
                d.draw_line_3D(pos, Vector3::new(pos.x, pos.y, pos.z + gizmo_length), Color::BLUE);
                d.draw_cube(Vector3::new(pos.x, pos.y, pos.z + gizmo_length), arrow_size, arrow_size, arrow_size, Color::BLUE);
            }
            EditorMode::Rotating => {
                // Draw rotation rings (using circles)
                d.draw_circle_3D(pos, gizmo_length, Vector3::new(1.0, 0.0, 0.0), 90.0, Color::RED);
                d.draw_circle_3D(pos, gizmo_length, Vector3::new(0.0, 1.0, 0.0), 90.0, Color::GREEN);
                d.draw_circle_3D(pos, gizmo_length, Vector3::new(0.0, 0.0, 1.0), 90.0, Color::BLUE);
            }
            EditorMode::Scaling => {
                // Draw scale handles (cubes at the end of each axis)
                let handle_size = 0.4;
                d.draw_line_3D(pos, Vector3::new(pos.x + gizmo_length, pos.y, pos.z), Color::RED);
                d.draw_cube(Vector3::new(pos.x + gizmo_length, pos.y, pos.z), handle_size, handle_size, handle_size, Color::RED);

                d.draw_line_3D(pos, Vector3::new(pos.x, pos.y + gizmo_length, pos.z), Color::GREEN);
                d.draw_cube(Vector3::new(pos.x, pos.y + gizmo_length, pos.z), handle_size, handle_size, handle_size, Color::GREEN);

                d.draw_line_3D(pos, Vector3::new(pos.x, pos.y, pos.z + gizmo_length), Color::BLUE);
                d.draw_cube(Vector3::new(pos.x, pos.y, pos.z + gizmo_length), handle_size, handle_size, handle_size, Color::BLUE);
            }
            _ => {}
        }
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

    /// Draw UI overlay (minimal - just viewport border)
    fn draw_ui(&self, d: &mut RaylibDrawHandle, viewport_width: i32) {
        // Draw viewport border
        d.draw_line(viewport_width, 0, viewport_width, 720, Color::DARKGRAY);
    }

    /// Draw hierarchy panel
    fn draw_hierarchy(&self, d: &mut RaylibDrawHandle) {
        let panel_x = 900;
        let panel_y = 20;
        let panel_width = 360;
        let panel_height = 680;
        let line_height = 18;

        // Background
        d.draw_rectangle(panel_x, panel_y, panel_width, panel_height, Color::new(0, 0, 0, 200));
        d.draw_rectangle_lines(panel_x, panel_y, panel_width, panel_height, Color::WHITE);

        // Title
        d.draw_text("=== OBJECT HIERARCHY ===", panel_x + 10, panel_y + 10, 18, Color::WHITE);
        d.draw_text("Press number keys to select:", panel_x + 10, panel_y + 30, 14, Color::LIGHTGRAY);

        // List objects
        let start_y = panel_y + 55;
        let visible_objects = 30;

        if self.map.objects.is_empty() {
            d.draw_text("(No objects yet)", panel_x + 10, start_y, 16, Color::GRAY);
        } else {
            for (i, obj) in self.map.objects.iter().enumerate().take(visible_objects) {
                let y = start_y + i as i32 * line_height;
                let is_selected = self.selected_object == Some(i);

                // Highlight selected
                if is_selected {
                    d.draw_rectangle(panel_x + 5, y - 2, panel_width - 10, line_height, Color::new(255, 255, 0, 100));
                }

                // Object info
                let pos = obj.get_position();
                let scale = obj.get_scale();
                let color = obj.get_color();

                let text = format!(
                    "{}: {:?} @ ({:.1},{:.1},{:.1}) S:{:.1}",
                    i,
                    obj.model_type,
                    pos.x,
                    pos.y,
                    pos.z,
                    (scale.x + scale.y + scale.z) / 3.0
                );

                d.draw_text(&text, panel_x + 10, y, 14, if is_selected { Color::YELLOW } else { Color::WHITE });

                // Color indicator
                d.draw_rectangle(panel_x + panel_width - 25, y, 15, 15, color);
            }

            if self.map.objects.len() > visible_objects {
                d.draw_text(
                    &format!("... and {} more", self.map.objects.len() - visible_objects),
                    panel_x + 10,
                    start_y + visible_objects as i32 * line_height,
                    14,
                    Color::GRAY,
                );
            }
        }

        // Instructions
        let instructions_y = panel_y + panel_height - 80;
        d.draw_text("--- SELECTION ---", panel_x + 10, instructions_y, 14, Color::LIGHTGRAY);
        d.draw_text("0-9: Quick select (0-9)", panel_x + 10, instructions_y + 18, 13, Color::WHITE);
        d.draw_text(",/. : Prev/Next", panel_x + 10, instructions_y + 34, 13, Color::WHITE);
        d.draw_text("ESC: Deselect", panel_x + 10, instructions_y + 50, 13, Color::WHITE);
        d.draw_text("DEL: Delete selected", panel_x + 10, instructions_y + 66, 13, Color::WHITE);
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
            "Arrow Keys: Adjust values",
            "PgUp/PgDn: Y-axis adjust",
            "",
            "=== OTHER ===",
            "G: Toggle grid",
            "N: Toggle grid snap",
            "F5: Save map",
            "F9: Load map",
            "U: Toggle hierarchy",
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

    /// Check for uploaded map file from JavaScript (Emscripten only)
    #[cfg(target_os = "emscripten")]
    fn check_uploaded_map(&mut self) {
        use std::ffi::CString;
        use base64::{Engine as _, engine::general_purpose};

        extern "C" {
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
        }

        // Check if there's uploaded data
        let js_check = CString::new("typeof Module.uploadedMapData !== 'undefined' ? 'true' : 'false'").unwrap();
        let has_data = unsafe {
            let result_ptr = emscripten_run_script_string(js_check.as_ptr());
            if result_ptr.is_null() {
                return;
            }
            let result = std::ffi::CStr::from_ptr(result_ptr).to_str().unwrap_or("false");
            result == "true"
        };

        if !has_data {
            return;
        }

        // Get the uploaded data as base64
        let js_get_data = CString::new(r#"
            (function() {
                if (!Module.uploadedMapData) return '';
                var bytes = Module.uploadedMapData;
                var binary = '';
                for (var i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                var base64 = btoa(binary);
                delete Module.uploadedMapData;
                delete Module.uploadedMapFilename;
                return base64;
            })()
        "#).unwrap();

        let base64_data = unsafe {
            let result_ptr = emscripten_run_script_string(js_get_data.as_ptr());
            if result_ptr.is_null() {
                return;
            }
            std::ffi::CStr::from_ptr(result_ptr).to_str().unwrap_or("")
        };

        if base64_data.is_empty() {
            return;
        }

        // Decode base64 and load map
        match general_purpose::STANDARD.decode(base64_data) {
            Ok(bytes) => {
                match Map::from_json_bytes(&bytes) {
                    Ok(map) => {
                        self.map = map;
                        self.selected_object = None;
                        self.set_status(&format!("Map loaded successfully ({} objects)", self.map.objects.len()));
                    }
                    Err(e) => {
                        self.set_status(&format!("Failed to load map: {}", e));
                    }
                }
            }
            Err(e) => {
                self.set_status(&format!("Failed to decode map data: {}", e));
            }
        }
    }

    /// Draw all imgui panels (Unity-style layout)
    /// Returns true if mouse is over any UI element
    pub fn draw_imgui_ui(&mut self, ui: &mut imgui::Ui, viewport_width: f32) -> bool {
        let mut mouse_over_ui = ui.is_any_item_hovered() || ui.is_window_hovered();

        // Menu Bar
        ui.main_menu_bar(|| {
            ui.menu("File", || {
                if ui.menu_item("Create New Map") {
                    self.map = Map::new("Untitled Map".to_string());
                    self.selected_object = None;
                    self.set_status("Created new map");
                }

                ui.separator();

                if ui.menu_item("Save Current Map (.fpssomap)") {
                    match self.map.to_json_bytes() {
                        Ok(bytes) => {
                            use base64::{Engine as _, engine::general_purpose};
                            let base64_string = general_purpose::STANDARD.encode(&bytes);
                            let filename = format!("{}.fpssomap", self.map.name.replace(" ", "_"));

                            // Trigger browser download via Emscripten JavaScript interop
                            #[cfg(target_os = "emscripten")]
                            {
                                use std::ffi::CString;

                                extern "C" {
                                    pub fn emscripten_run_script(script: *const i8);
                                }

                                let js_code = format!(
                                    r#"
                                    (function() {{
                                        var base64Data = '{}';
                                        var filename = '{}';

                                        // Decode base64 to binary
                                        var byteCharacters = atob(base64Data);
                                        var byteNumbers = new Array(byteCharacters.length);
                                        for (var i = 0; i < byteCharacters.length; i++) {{
                                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                                        }}
                                        var byteArray = new Uint8Array(byteNumbers);

                                        // Create blob and download
                                        var blob = new Blob([byteArray], {{type: 'application/octet-stream'}});
                                        var url = URL.createObjectURL(blob);
                                        var a = document.createElement('a');
                                        a.href = url;
                                        a.download = filename;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    }})();
                                    "#,
                                    base64_string, filename
                                );

                                let c_str = CString::new(js_code).unwrap();
                                unsafe {
                                    emscripten_run_script(c_str.as_ptr());
                                }

                                self.set_status(&format!("Map downloaded: {} ({} bytes)", filename, bytes.len()));
                            }

                            #[cfg(not(target_os = "emscripten"))]
                            {
                                // For native builds, save to file
                                if let Err(e) = std::fs::write(&filename, bytes) {
                                    self.set_status(&format!("Failed to save: {}", e));
                                } else {
                                    self.set_status(&format!("Map saved: {}", filename));
                                }
                            }
                        }
                        Err(e) => {
                            self.set_status(&format!("Failed to save: {}", e));
                        }
                    }
                }

                if ui.menu_item("Import from .fpssomap") {
                    // Trigger file picker via Emscripten JavaScript interop
                    #[cfg(target_os = "emscripten")]
                    {
                        use std::ffi::CString;

                        extern "C" {
                            pub fn emscripten_run_script(script: *const i8);
                        }

                        let js_code = r#"
                        (function() {
                            // Create a file input element
                            var input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.fpssomap';

                            input.onchange = function(e) {
                                var file = e.target.files[0];
                                if (!file) return;

                                var reader = new FileReader();
                                reader.onload = function(event) {
                                    var arrayBuffer = event.target.result;
                                    var bytes = new Uint8Array(arrayBuffer);

                                    // Store in Module for Rust to access
                                    Module.uploadedMapData = bytes;
                                    Module.uploadedMapFilename = file.name;

                                    // Signal Rust that file is ready
                                    console.log('Map file loaded: ' + file.name + ' (' + bytes.length + ' bytes)');
                                };
                                reader.readAsArrayBuffer(file);
                            };

                            input.click();
                        })();
                        "#;

                        let c_str = CString::new(js_code).unwrap();
                        unsafe {
                            emscripten_run_script(c_str.as_ptr());
                        }

                        self.set_status("Select .fpssomap file to import...");
                    }

                    #[cfg(not(target_os = "emscripten"))]
                    {
                        self.set_status("Import from .fpssomap - feature only available in browser");
                    }
                }

                ui.separator();

                if ui.menu_item("My Maps") {
                    self.show_my_maps = !self.show_my_maps;
                }

                if ui.menu_item("Upload Map to Solana") {
                    self.show_upload_popup = true;
                    self.upload_map_id = String::new();
                    self.upload_map_name = self.map.name.clone();
                    self.upload_map_description = String::new();
                }

                ui.separator();

                if ui.menu_item("Exit Map Editor") {
                    self.set_status("Use ESC or close window to exit");
                }
            });

            ui.menu("Help", || {
                ui.text_colored([1.0, 1.0, 0.0, 1.0], "CONTROLS");
                ui.separator();

                ui.text("Camera:");
                ui.text("  WASD - Move camera");
                ui.text("  Arrow Keys - Rotate camera");
                ui.text("  Q/E - Move up/down");

                ui.separator();
                ui.text("Modes:");
                ui.text("  1 - Placing Mode");
                ui.text("  2 - Selecting Mode");
                ui.text("  3 - Moving Mode");
                ui.text("  4 - Rotating Mode");
                ui.text("  5 - Scaling Mode");

                ui.separator();
                ui.text("Models (Placing Mode):");
                ui.text("  C - Cube");
                ui.text("  R - Rectangle");
                ui.text("  T - Triangle");
                ui.text("  S - Sphere");
                ui.text("  L - Cylinder");
                ui.text("  P - Plane");
                ui.text("  B - Blue Spawn Point");
                ui.text("  D - Red Spawn Point");

                ui.separator();
                ui.text("Actions:");
                ui.text("  Click - Place/Select object");
                ui.text("  Delete/Backspace - Remove object");
                ui.text("  N - Toggle grid snap");
                ui.text("  G - Toggle grid");

                ui.separator();
                ui.text("Save/Load:");
                ui.text("  F5 - Quick save");
                ui.text("  F9 - Quick load");
            });
        });

        let menu_bar_height = 25.0; // Approximate menu bar height

        // Inspector Panel (right side, top)
        ui.window("Inspector")
            .position([viewport_width + 10.0, menu_bar_height + 5.0], imgui::Condition::Always)
            .size([390.0, 330.0], imgui::Condition::Always)
            .collapsible(false)
            .build(|| {
                ui.text_colored([0.3, 0.8, 1.0, 1.0], "INSPECTOR");
                ui.separator();

                ui.text(format!("Mode: {:?}", self.mode));
                ui.text(format!("Objects: {}/400", self.map.objects.len()));

                // Calculate actual size
                let actual_size = match self.map.to_json_bytes() {
                    Ok(bytes) => bytes.len(),
                    Err(_) => 0,
                };
                let max_size = 10240; // 10 KB in bytes
                let size_percent = (actual_size as f32 / max_size as f32 * 100.0) as u32;

                let size_color = if actual_size > max_size {
                    [1.0, 0.0, 0.0, 1.0] // Red if over limit
                } else if size_percent > 80 {
                    [1.0, 0.8, 0.0, 1.0] // Orange/yellow if getting close
                } else {
                    [0.0, 1.0, 0.0, 1.0] // Green if within limit
                };

                ui.text_colored(
                    size_color,
                    format!("Size: {} / {} bytes ({}%)", actual_size, max_size, size_percent)
                );

                ui.separator();

                if let Some(index) = self.selected_object {
                    if index < self.map.objects.len() {
                        ui.text_colored([1.0, 1.0, 0.0, 1.0], format!("Selected: Object {}", index));
                        ui.text(format!("Type: {:?}", self.map.objects[index].model_type));

                        ui.separator();

                        // Position controls
                        ui.text("Position:");
                        let mut pos = self.map.objects[index].get_position();
                        let mut pos_changed = false;

                        ui.set_next_item_width(120.0);
                        pos_changed |= ui
                            .input_float("X##pos", &mut pos.x)
                            .step(0.1)
                            .step_fast(1.0)
                            .build();
                        ui.set_next_item_width(120.0);
                        pos_changed |= ui
                            .input_float("Y##pos", &mut pos.y)
                            .step(0.1)
                            .step_fast(1.0)
                            .build();
                        ui.set_next_item_width(120.0);
                        pos_changed |= ui
                            .input_float("Z##pos", &mut pos.z)
                            .step(0.1)
                            .step_fast(1.0)
                            .build();

                        if pos_changed {
                            // Clamp position to world bounds (50x50 units = -25 to 25)
                            pos.x = pos.x.clamp(-25.0, 25.0);
                            pos.y = pos.y.clamp(-25.0, 25.0);
                            pos.z = pos.z.clamp(-25.0, 25.0);
                            self.map.objects[index].set_position(pos);
                        }

                        ui.separator();

                        // Rotation controls
                        ui.text("Rotation:");
                        let mut rot = self.map.objects[index].get_rotation();
                        let mut rot_changed = false;

                        ui.set_next_item_width(120.0);
                        rot_changed |= ui
                            .input_float("X##rot", &mut rot.x)
                            .step(1.0)
                            .step_fast(15.0)
                            .build();
                        ui.set_next_item_width(120.0);
                        rot_changed |= ui
                            .input_float("Y##rot", &mut rot.y)
                            .step(1.0)
                            .step_fast(15.0)
                            .build();
                        ui.set_next_item_width(120.0);
                        rot_changed |= ui
                            .input_float("Z##rot", &mut rot.z)
                            .step(1.0)
                            .step_fast(15.0)
                            .build();

                        if rot_changed {
                            // Wrap rotation to 0-360 range
                            rot.x = rot.x.rem_euclid(360.0);
                            rot.y = rot.y.rem_euclid(360.0);
                            rot.z = rot.z.rem_euclid(360.0);
                            self.map.objects[index].set_rotation(rot);
                        }

                        ui.separator();

                        // Scale controls
                        ui.text("Scale:");
                        let mut scale = self.map.objects[index].get_scale();
                        let mut scale_changed = false;

                        ui.set_next_item_width(120.0);
                        scale_changed |= ui
                            .input_float("X##scale", &mut scale.x)
                            .step(0.1)
                            .step_fast(0.5)
                            .build();
                        ui.set_next_item_width(120.0);
                        scale_changed |= ui
                            .input_float("Y##scale", &mut scale.y)
                            .step(0.1)
                            .step_fast(0.5)
                            .build();
                        ui.set_next_item_width(120.0);
                        scale_changed |= ui
                            .input_float("Z##scale", &mut scale.z)
                            .step(0.1)
                            .step_fast(0.5)
                            .build();

                        if scale_changed {
                            // Clamp scale to reasonable values (0.1 to 25.0)
                            scale.x = scale.x.clamp(0.1, 25.0);
                            scale.y = scale.y.clamp(0.1, 25.0);
                            scale.z = scale.z.clamp(0.1, 25.0);
                            self.map.objects[index].set_scale(scale);
                        }

                        ui.separator();

                        // Delete button
                        if ui.button("Delete Object") {
                            self.map.remove_object(index);
                            self.selected_object = None;
                            self.set_status("Object deleted");
                        }
                    }
                } else {
                    ui.text_colored([0.5, 0.5, 0.5, 1.0], "No object selected");
                }
            });

        // Hierarchy Panel (right side, bottom - no gap with Inspector)
        ui.window("Hierarchy")
            .position([viewport_width + 10.0, menu_bar_height + 5.0 + 330.0], imgui::Condition::Always)
            .size([390.0, 365.0], imgui::Condition::Always)
            .collapsible(false)
            .build(|| {
                ui.text_colored([0.3, 0.8, 1.0, 1.0], "HIERARCHY");
                ui.separator();

                if self.map.objects.is_empty() {
                    ui.text_colored([0.5, 0.5, 0.5, 1.0], "(No objects yet)");
                    ui.text("Press Space/Click to place objects");
                } else {
                    let mut new_selection = None;

                    for (i, obj) in self.map.objects.iter().enumerate() {
                        let is_selected = self.selected_object == Some(i);

                        let _header_token = if is_selected {
                            Some(ui.push_style_color(imgui::StyleColor::Header, [0.3, 0.6, 0.8, 0.6]))
                        } else {
                            None
                        };

                        let label = format!("[{}] {:?}##obj{}", i, obj.model_type, i);

                        if ui.selectable_config(&label)
                            .selected(is_selected)
                            .build()
                        {
                            new_selection = Some(i);
                        }
                    }

                    if let Some(i) = new_selection {
                        self.selected_object = Some(i);
                        self.mode = EditorMode::Selecting;
                        self.set_status(&format!("Selected object {}", i));
                    }
                }
            });

        // Tools Panel (left side, full height below menu bar)
        ui.window("Tools")
            .position([10.0, menu_bar_height + 5.0], imgui::Condition::Always)
            .size([200.0, 690.0], imgui::Condition::Always)
            .bg_alpha(0.9)
            .build(|| {
                ui.text_colored([0.3, 0.8, 1.0, 1.0], "TOOLS");
                ui.separator();

                if ui.button("1. Placing Mode") {
                    self.mode = EditorMode::Placing;
                }
                if ui.button("2. Selecting Mode") {
                    self.mode = EditorMode::Selecting;
                }

                ui.separator();
                ui.text("Place Model:");

                if ui.button("C - Cube") {
                    self.current_model_type = ModelType::Cube;
                }
                if ui.button("R - Rectangle") {
                    self.current_model_type = ModelType::Rectangle;
                }
                if ui.button("T - Triangle") {
                    self.current_model_type = ModelType::Triangle;
                }
                if ui.button("S - Sphere") {
                    self.current_model_type = ModelType::Sphere;
                }
                if ui.button("L - Cylinder") {
                    self.current_model_type = ModelType::Cylinder;
                }
                if ui.button("P - Plane") {
                    self.current_model_type = ModelType::Plane;
                }

                ui.separator();
                ui.text("Spawn Points:");

                if ui.button("B - Blue Spawn") {
                    self.current_model_type = ModelType::SpawnPointBlue;
                }
                if ui.button("D - Red Spawn") {
                    self.current_model_type = ModelType::SpawnPointRed;
                }

                ui.separator();
                if self.selected_object.is_some() {
                    if ui.button("3. Move (G)") {
                        self.mode = EditorMode::Moving;
                    }
                    if ui.button("4. Rotate (R)") {
                        self.mode = EditorMode::Rotating;
                    }
                    if ui.button("5. Scale (S)") {
                        self.mode = EditorMode::Scaling;
                    }
                }
            });

        // Status bar at bottom
        if self.status_timer > 0.0 {
            ui.window("Status")
                .position([10.0, 690.0], imgui::Condition::Always)
                .size([viewport_width - 20.0, 20.0], imgui::Condition::Always)
                .no_decoration()
                .bg_alpha(0.7)
                .build(|| {
                    ui.text(&self.status_message);
                });
        }

        // Upload to Solana Window
        if self.show_upload_popup {
            ui.window("Upload to Solana")
                .position([400.0, 200.0], imgui::Condition::Appearing)
                .size([400.0, 300.0], imgui::Condition::Always)
                .collapsible(false)
                .build(|| {
                    ui.text("Upload Map to Solana Blockchain");
                    ui.separator();

                    ui.text("Map ID (unique identifier):");
                    ui.input_text("##mapid", &mut self.upload_map_id).build();

                    ui.text("Map Name:");
                    ui.input_text("##mapname", &mut self.upload_map_name).build();

                    ui.text("Description:");
                    ui.input_text_multiline("##mapdesc", &mut self.upload_map_description, [350.0, 80.0]).build();

                    ui.separator();

                    if ui.button("Upload") {
                        // Call JavaScript to upload map
                        self.upload_map_to_solana();
                        self.show_upload_popup = false;
                    }

                    ui.same_line();

                    if ui.button("Cancel") {
                        self.show_upload_popup = false;
                    }
                });
        }

        // My Maps Window
        if self.show_my_maps {
            // Check for updated map IDs from JavaScript
            #[cfg(target_os = "emscripten")]
            self.check_user_map_ids();

            ui.window("My Maps")
                .position([400.0, 100.0], imgui::Condition::FirstUseEver)
                .size([500.0, 400.0], imgui::Condition::FirstUseEver)
                .build(|| {
                    ui.text_colored([0.3, 0.8, 1.0, 1.0], "MY MAPS");
                    ui.separator();

                    ui.text("Your maps stored on Solana:");
                    ui.separator();

                    // Request user maps from JavaScript
                    #[cfg(target_os = "emscripten")]
                    {
                        if ui.button("Refresh Maps") {
                            self.request_user_maps();
                        }

                        ui.same_line();
                        ui.text_colored([0.7, 0.7, 0.7, 1.0], &format!("({} maps)", self.user_map_ids.len()));
                    }

                    #[cfg(not(target_os = "emscripten"))]
                    {
                        ui.text_colored([1.0, 0.5, 0.0, 1.0], "Solana features only available in browser");
                    }

                    ui.separator();

                    // Display list of user's maps
                    if self.user_map_ids.is_empty() {
                        ui.text_colored([0.7, 0.7, 0.7, 1.0], "No maps found. Create one to get started!");
                    } else {
                        ui.text("Click a map to load it:");
                        ui.separator();

                        let mut map_to_load: Option<String> = None;

                        for (i, map_id) in self.user_map_ids.iter().enumerate() {
                            // Display map ID
                            ui.text(map_id);
                            ui.same_line();

                            // Load button with unique ID
                            let button_label = format!("Load##{}", i);
                            if ui.button(&button_label) {
                                map_to_load = Some(map_id.clone());
                            }
                        }

                        // Load map after iteration to avoid borrow issues
                        if let Some(map_id) = map_to_load {
                            self.load_map_from_solana(&map_id);
                        }
                    }

                    ui.separator();

                    if ui.button("Close") {
                        self.show_my_maps = false;
                    }
                });
        }

        // Update mouse_over_ui after drawing all UI
        mouse_over_ui = mouse_over_ui || ui.is_any_item_hovered() || ui.is_window_hovered();

        // Also check if mouse is in the right panel area (viewport ends at viewport_width)
        let mouse_pos = ui.io().mouse_pos;
        if mouse_pos[0] > viewport_width {
            mouse_over_ui = true;
        }

        mouse_over_ui
    }

    /// Upload current map to Solana
    #[cfg(target_os = "emscripten")]
    fn upload_map_to_solana(&mut self) {
        use std::ffi::CString;
        use base64::{Engine as _, engine::general_purpose};

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }

        match self.map.to_json_bytes() {
            Ok(bytes) => {
                let base64_string = general_purpose::STANDARD.encode(&bytes);

                let js_code = format!(
                    r#"
                    (async function() {{
                        try {{
                            // Check if Solana bridge is available
                            if (!window.solanaMapBridge) {{
                                throw new Error('Solana bridge not initialized. Please connect your wallet first.');
                            }}

                            const mapId = '{}';
                            const name = '{}';
                            const description = '{}';
                            const mapDataBase64 = '{}';

                            // Decode base64 to Uint8Array
                            const byteCharacters = atob(mapDataBase64);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {{
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }}
                            const mapData = new Uint8Array(byteNumbers);

                            // Call Solana bridge via global window object
                            const result = await window.solanaMapBridge.createMap(
                                mapId,
                                name,
                                description,
                                false, // isDefault
                                mapData
                            );

                            if (result) {{
                                console.log('Map uploaded successfully:', result);
                                alert('Map uploaded to Solana successfully!\\nTransaction: ' + result.transaction);
                            }} else {{
                                console.error('Failed to upload map - result is null');
                                alert('Failed to upload map. Check console for details.');
                            }}
                        }} catch (error) {{
                            console.error('Full error details:', error);
                            console.error('Error uploading map:', error);
                            alert('Error: ' + error.message);
                        }}
                    }})();
                    "#,
                    self.upload_map_id.replace("'", "\\'"),
                    self.upload_map_name.replace("'", "\\'"),
                    self.upload_map_description.replace("'", "\\'"),
                    base64_string
                );

                let c_str = CString::new(js_code).unwrap();
                unsafe {
                    emscripten_run_script(c_str.as_ptr());
                }

                self.set_status("Uploading map to Solana...");
            }
            Err(e) => {
                self.set_status(&format!("Failed to serialize map: {}", e));
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    fn upload_map_to_solana(&mut self) {
        self.set_status("Solana upload only available in browser");
    }

    /// Request user's maps from Solana
    #[cfg(target_os = "emscripten")]
    fn request_user_maps(&mut self) {
        use std::ffi::CString;

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }

        let js_code = r#"
        (async function() {
            try {
                // Check if Solana bridge is available
                if (!window.solanaMapBridge) {
                    throw new Error('Solana bridge not initialized. Please connect your wallet first.');
                }

                const userMaps = await window.solanaMapBridge.getUserMaps();
                console.log('User maps:', userMaps);

                // Store map IDs as JSON string for Rust to access
                if (userMaps && userMaps.mapIds) {
                    Module.userMapIdsJson = JSON.stringify(userMaps.mapIds);
                    alert('Found ' + userMaps.mapIds.length + ' maps!');
                } else {
                    Module.userMapIdsJson = '[]';
                    alert('No maps found');
                }
            } catch (error) {
                console.error('Error fetching user maps:', error);
                Module.userMapIdsJson = '[]';
                alert('Error: ' + error.message);
            }
        })();
        "#;

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }

        self.set_status("Fetching maps from Solana...");
    }

    #[cfg(not(target_os = "emscripten"))]
    fn request_user_maps(&mut self) {
        self.set_status("Solana features only available in browser");
    }

    /// Check if map IDs have been loaded from JavaScript
    #[cfg(target_os = "emscripten")]
    fn check_user_map_ids(&mut self) {
        use std::ffi::CString;

        extern "C" {
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
            pub fn emscripten_run_script(script: *const i8);
        }

        // Check if map IDs JSON exists
        let js_check = CString::new("typeof Module.userMapIdsJson !== 'undefined' ? Module.userMapIdsJson : ''").unwrap();

        unsafe {
            let result_ptr = emscripten_run_script_string(js_check.as_ptr());
            if result_ptr.is_null() {
                return;
            }

            let c_str = std::ffi::CStr::from_ptr(result_ptr);
            if let Ok(json_str) = c_str.to_str() {
                if !json_str.is_empty() {
                    // Parse JSON array
                    if let Ok(map_ids) = serde_json::from_str::<Vec<String>>(json_str) {
                        self.user_map_ids = map_ids;

                        // Clear the JavaScript variable so we don't keep re-parsing
                        let clear_js = CString::new("delete Module.userMapIdsJson;").unwrap();
                        emscripten_run_script(clear_js.as_ptr());
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    fn check_user_map_ids(&mut self) {
        // No-op on non-Emscripten platforms
    }

    /// Load a map from Solana by ID
    #[cfg(target_os = "emscripten")]
    fn load_map_from_solana(&mut self, map_id: &str) {
        use std::ffi::CString;

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }

        let js_code = format!(
            r#"
            (async function() {{
                try {{
                    if (!window.solanaMapBridge) {{
                        throw new Error('Solana bridge not initialized.');
                    }}

                    const mapId = '{}';
                    console.log('Loading map:', mapId);

                    // Get map data from Solana
                    const mapData = await window.solanaMapBridge.getMapData(mapId);

                    if (!mapData) {{
                        throw new Error('Map data not found');
                    }}

                    // Convert Uint8Array to base64
                    // getMapData returns the byte array directly, not wrapped in an object
                    const bytes = new Uint8Array(mapData);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {{
                        binary += String.fromCharCode(bytes[i]);
                    }}
                    const base64Data = btoa(binary);

                    // Store for Rust to access
                    Module.loadedMapData = base64Data;
                    Module.loadedMapId = mapId;

                    console.log('Map data loaded successfully');
                }} catch (error) {{
                    console.error('Error loading map:', error);
                    alert('Error loading map: ' + error.message);
                }}
            }})();
            "#,
            map_id.replace("'", "\\'")
        );

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }

        self.set_status(&format!("Loading map {}...", map_id));
    }

    #[cfg(not(target_os = "emscripten"))]
    fn load_map_from_solana(&mut self, _map_id: &str) {
        self.set_status("Solana features only available in browser");
    }

    /// Check if map data has been loaded from Solana and apply it
    #[cfg(target_os = "emscripten")]
    fn check_loaded_map_from_solana(&mut self) {
        use std::ffi::CString;
        use base64::{Engine as _, engine::general_purpose};

        extern "C" {
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
            pub fn emscripten_run_script(script: *const i8);
        }

        // Check if map data exists
        let js_check = CString::new("typeof Module.loadedMapData !== 'undefined' ? Module.loadedMapData : ''").unwrap();

        unsafe {
            let result_ptr = emscripten_run_script_string(js_check.as_ptr());
            if result_ptr.is_null() {
                return;
            }

            let c_str = std::ffi::CStr::from_ptr(result_ptr);
            if let Ok(base64_str) = c_str.to_str() {
                if !base64_str.is_empty() {
                    // Decode base64
                    if let Ok(bytes) = general_purpose::STANDARD.decode(base64_str) {
                        // Parse map from bytes
                        match Map::from_json_bytes(&bytes) {
                            Ok(loaded_map) => {
                                // Get the map ID for status message
                                let js_get_id = CString::new("typeof Module.loadedMapId !== 'undefined' ? Module.loadedMapId : 'unknown'").unwrap();
                                let id_ptr = emscripten_run_script_string(js_get_id.as_ptr());
                                let map_id = if !id_ptr.is_null() {
                                    std::ffi::CStr::from_ptr(id_ptr).to_str().unwrap_or("unknown").to_string()
                                } else {
                                    "unknown".to_string()
                                };

                                self.map = loaded_map;
                                self.selected_object = None;
                                self.mode = EditorMode::Placing;
                                self.show_my_maps = false; // Close the My Maps window
                                self.set_status(&format!("Loaded map '{}' from Solana - Ready to edit!", map_id));

                                // Clear the JavaScript variables
                                let clear_js = CString::new("delete Module.loadedMapData; delete Module.loadedMapId;").unwrap();
                                emscripten_run_script(clear_js.as_ptr());
                            }
                            Err(e) => {
                                self.set_status(&format!("Failed to parse map: {}", e));

                                // Clear the JavaScript variables even on error
                                let clear_js = CString::new("delete Module.loadedMapData; delete Module.loadedMapId;").unwrap();
                                emscripten_run_script(clear_js.as_ptr());
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "emscripten"))]
    fn check_loaded_map_from_solana(&mut self) {
        // No-op on non-Emscripten platforms
    }
}
