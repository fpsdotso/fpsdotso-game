use raylib::prelude::*;

/// Player character with FPS camera and movement
pub struct Player {
    /// Player position in 3D space
    pub position: Vector3,

    /// Camera for first-person view
    pub camera: Camera3D,

    /// Player movement speed (units per second)
    pub move_speed: f32,

    /// Mouse sensitivity for looking around
    pub mouse_sensitivity: f32,

    /// Camera yaw (horizontal rotation)
    pub yaw: f32,

    /// Camera pitch (vertical rotation)
    pub pitch: f32,

    /// Player height (eye level)
    pub height: f32,

    /// Is player currently crouching
    pub is_crouching: bool,

    /// Is player currently running
    pub is_running: bool,

    /// Player health (0-100)
    pub health: f32,

    /// Maximum health
    pub max_health: f32,

    /// Is player dead (health <= 0)
    pub is_dead: bool,

    /// Timestamp when player died (for respawn cooldown)
    pub death_timestamp: f64,

    /// Target position for server reconciliation (smooth interpolation)
    pub target_position: Vector3,

    /// Target rotation for server reconciliation
    pub target_yaw: f32,
    pub target_pitch: f32,
}

impl Player {
    /// Create a new player at the specified position
    pub fn new(position: Vector3) -> Self {
        let height = 1.7; // Average human eye level in meters

        // Create camera at player eye level
        let camera_pos = Vector3::new(position.x, position.y + height, position.z);
        let camera_target = Vector3::new(position.x, position.y + height, position.z - 1.0);
        let camera = Camera3D::perspective(
            camera_pos,
            camera_target,
            Vector3::new(0.0, 1.0, 0.0),
            70.0,
        );

        Self {
            position,
            camera,
            move_speed: 5.0, // 5 units per second
            mouse_sensitivity: 0.1,
            yaw: -90.0, // Start facing forward (negative Z)
            pitch: 0.0,
            height,
            is_crouching: false,
            is_running: false,
            health: 100.0,
            max_health: 100.0,
            is_dead: false,
            death_timestamp: 0.0,
            target_position: position, // Initialize to current position
            target_yaw: -90.0,
            target_pitch: 0.0,
        }
    }

    /// Update player movement and camera based on input
    pub fn update(&mut self, rl: &RaylibHandle, delta: f32, joystick_input: Option<(bool, bool, bool, bool)>, mobile_camera_input: Option<(f32, f32)>) {
        // Check for running (Shift key)
        self.is_running = rl.is_key_down(KeyboardKey::KEY_LEFT_SHIFT) || rl.is_key_down(KeyboardKey::KEY_RIGHT_SHIFT);

        // Check for crouching (Ctrl key)
        self.is_crouching = rl.is_key_down(KeyboardKey::KEY_LEFT_CONTROL) || rl.is_key_down(KeyboardKey::KEY_RIGHT_CONTROL);

        // Mouse look
        let mouse_delta = rl.get_mouse_delta();

        // Update yaw (horizontal) and pitch (vertical)
        self.yaw += mouse_delta.x * self.mouse_sensitivity;
        self.pitch -= mouse_delta.y * self.mouse_sensitivity;

        // Mobile camera input (touch drag)
        if let Some((delta_x, delta_y)) = mobile_camera_input {
            self.yaw += delta_x;
            self.pitch -= delta_y;
        }

        // Clamp pitch to prevent camera flipping
        self.pitch = self.pitch.clamp(-89.0, 89.0);

        // Log rotation every frame for debugging
        /*println!("🎯 Rotation - Yaw: {:.2}°, Pitch: {:.2}° | Radians - Yaw: {:.4}, Pitch: {:.4}",
                 self.yaw, self.pitch,
                 self.yaw.to_radians(), self.pitch.to_radians());*/

        // Calculate camera direction from yaw and pitch
        let yaw_rad = self.yaw.to_radians();
        let pitch_rad = self.pitch.to_radians();

        let direction = Vector3::new(
            yaw_rad.cos() * pitch_rad.cos(),
            pitch_rad.sin(),
            yaw_rad.sin() * pitch_rad.cos(),
        );

        // Calculate right vector for strafing (perpendicular to forward)
        // Right vector is 90 degrees to the left of forward in XZ plane
        let right = Vector3::new(
            (yaw_rad + 90.0_f32.to_radians()).cos(),
            0.0,
            (yaw_rad + 90.0_f32.to_radians()).sin(),
        );

        // WASD movement + joystick input
        let mut movement = Vector3::zero();

        // Check for forward movement (W key or joystick forward)
        let forward_pressed = rl.is_key_down(KeyboardKey::KEY_W) || 
            joystick_input.map_or(false, |(fwd, _, _, _)| fwd);
        if forward_pressed {
            // Move forward (ignore Y component for ground movement)
            let forward = Vector3::new(direction.x, 0.0, direction.z).normalized();
            movement = movement + forward;
        }
        
        // Check for backward movement (S key or joystick backward)
        let backward_pressed = rl.is_key_down(KeyboardKey::KEY_S) || 
            joystick_input.map_or(false, |(_, back, _, _)| back);
        if backward_pressed {
            // Move backward
            let forward = Vector3::new(direction.x, 0.0, direction.z).normalized();
            movement = movement - forward;
        }
        
        // Check for left movement (A key or joystick left)
        let left_pressed = rl.is_key_down(KeyboardKey::KEY_A) || 
            joystick_input.map_or(false, |(_, _, left, _)| left);
        if left_pressed {
            // Strafe left
            movement = movement - right;
        }
        
        // Check for right movement (D key or joystick right)
        let right_pressed = rl.is_key_down(KeyboardKey::KEY_D) || 
            joystick_input.map_or(false, |(_, _, _, right)| right);
        if right_pressed {
            // Strafe right
            movement = movement + right;
        }

        // Normalize movement vector if moving diagonally
        if movement.length() > 0.0 {
            movement = movement.normalized();
        }

        // Calculate effective move speed based on running/crouching
        let mut effective_speed = self.move_speed;
        if self.is_running && !self.is_crouching {
            effective_speed *= 2.0; // Running is 2x normal speed
        } else if self.is_crouching {
            effective_speed *= 0.5; // Crouching is 0.5x normal speed
        }

        // Apply movement
        let velocity = movement * effective_speed * delta;
        self.position = self.position + velocity;

        // Clamp position to map boundaries (50x50 map = -25 to +25)
        let boundary = 25.0;
        self.position.x = self.position.x.clamp(-boundary, boundary);
        self.position.z = self.position.z.clamp(-boundary, boundary);

        // Log position every frame for debugging
        //println!("📍 Position - X: {:.2}, Y: {:.2}, Z: {:.2}",
        //         self.position.x, self.position.y, self.position.z);

        // Calculate effective height based on crouching
        let effective_height = if self.is_crouching {
            self.height * 0.6 // Crouch to 60% of normal height
        } else {
            self.height
        };

        // Update camera position and target (rebuild camera to update immutable fields)
        let camera_pos = Vector3::new(
            self.position.x,
            self.position.y + effective_height,
            self.position.z,
        );
        let camera_target = camera_pos + direction;

        self.camera = Camera3D::perspective(
            camera_pos,
            camera_target,
            Vector3::new(0.0, 1.0, 0.0),
            70.0,
        );
    }

    /// Set player position (useful for spawning)
    pub fn set_position(&mut self, position: Vector3) {
        self.position = position;
        self.update_camera();
    }

    /// Update camera based on current position and rotation (without processing input)
    /// This is useful for syncing camera with blockchain-authoritative state
    pub fn update_camera(&mut self) {
        // Calculate look direction from yaw and pitch
        let yaw_rad = self.yaw.to_radians();
        let pitch_rad = self.pitch.to_radians();

        let direction = Vector3::new(
            yaw_rad.cos() * pitch_rad.cos(),
            pitch_rad.sin(),
            yaw_rad.sin() * pitch_rad.cos(),
        );

        // Calculate effective height based on crouching state
        let effective_height = if self.is_crouching {
            self.height * 0.6
        } else {
            self.height
        };

        let camera_pos = Vector3::new(
            self.position.x,
            self.position.y + effective_height,
            self.position.z,
        );
        let camera_target = camera_pos + direction;

        self.camera = Camera3D::perspective(
            camera_pos,
            camera_target,
            Vector3::new(0.0, 1.0, 0.0),
            70.0,
        );
    }

    /// Apply mobile (touch) inputs: 2D movement vector and look delta
    pub fn apply_mobile_input(&mut self, move_vec: Vector2, look_delta: Vector2, delta: f32) {
        // Update yaw/pitch from right joystick look
        self.yaw += look_delta.x * self.mouse_sensitivity * 5.0; // amplify slightly for touch
        self.pitch -= look_delta.y * self.mouse_sensitivity * 5.0;
        self.pitch = self.pitch.clamp(-89.0, 89.0);

        // Recompute direction vectors
        let yaw_rad = self.yaw.to_radians();
        let pitch_rad = self.pitch.to_radians();
        let forward = Vector3::new(yaw_rad.cos() * pitch_rad.cos(), 0.0, yaw_rad.sin() * pitch_rad.cos()).normalized();
        let right = Vector3::new((yaw_rad + 90.0_f32.to_radians()).cos(), 0.0, (yaw_rad + 90.0_f32.to_radians()).sin());

        // Map move_vec x->strafe, y->forward/back
        let mut movement = Vector3::zero();
        movement = movement + forward * (-move_vec.y);
        movement = movement + right * (move_vec.x);

        if movement.length() > 0.0 {
            movement = movement.normalized();
        }

        let effective_speed = self.move_speed;
        let velocity = movement * effective_speed * delta;
        self.position = self.position + velocity;

        // Clamp to bounds
        let boundary = 25.0;
        self.position.x = self.position.x.clamp(-boundary, boundary);
        self.position.z = self.position.z.clamp(-boundary, boundary);

        // Update camera
        self.update_camera();
    }
}
