use raylib::prelude::*;
use imgui::*;

/// Virtual joystick for mobile touch controls
#[derive(Debug, Clone)]
pub struct VirtualJoystick {
    pub center: Vector2,
    pub radius: f32,
    pub knob_radius: f32,
    pub knob_position: Vector2,
    pub is_active: bool,
    pub touch_id: Option<i32>,
    pub deadzone: f32,
}

impl VirtualJoystick {
    pub fn new(center: Vector2, radius: f32) -> Self {
        Self {
            center,
            radius,
            knob_radius: radius * 0.3,
            knob_position: center,
            is_active: false,
            touch_id: None,
            deadzone: 0.1,
        }
    }

    pub fn update(&mut self, rl: &RaylibHandle) {
        // Check for touch input
        let touch_count = rl.get_touch_point_count();
        
        if touch_count > 0 {
            for i in 0..touch_count {
                let touch_point = rl.get_touch_position(i);
                let distance = self.center.distance_to(touch_point);
                
                // Check if touch is within joystick area
                if distance <= self.radius && !self.is_active {
                    self.is_active = true;
                    self.touch_id = Some(i as i32);
                    self.knob_position = touch_point;
                    break;
                }
                
                // Update knob position if this is our active touch
                if self.is_active && self.touch_id == Some(i as i32) {
                    let clamped_distance = distance.min(self.radius);
                    let direction = (touch_point - self.center).normalized();
                    self.knob_position = self.center + direction * clamped_distance;
                }
            }
        } else {
            // No touches, reset joystick
            self.is_active = false;
            self.touch_id = None;
            self.knob_position = self.center;
        }
    }

    pub fn get_direction(&self) -> Vector2 {
        if !self.is_active {
            return Vector2::zero();
        }

        let direction = (self.knob_position - self.center) / self.radius;
        
        // Apply deadzone
        if direction.length() < self.deadzone {
            return Vector2::zero();
        }

        direction
    }

    pub fn draw(&self, d: &mut RaylibDrawHandle) {
        // Draw joystick background
        d.draw_circle_v(self.center, self.radius, Color::new(100, 100, 100, 150));
        d.draw_circle_lines_v(self.center, self.radius, Color::new(200, 200, 200, 200));
        
        // Draw knob
        let knob_color = if self.is_active {
            Color::new(255, 255, 255, 200)
        } else {
            Color::new(200, 200, 200, 150)
        };
        
        d.draw_circle_v(self.knob_position, self.knob_radius, knob_color);
        d.draw_circle_lines_v(self.knob_position, self.knob_radius, Color::new(255, 255, 255, 255));
    }
}

/// Touch button for mobile controls
#[derive(Debug, Clone)]
pub struct TouchButton {
    pub position: Vector2,
    pub size: Vector2,
    pub is_pressed: bool,
    pub touch_id: Option<i32>,
    pub label: String,
}

impl TouchButton {
    pub fn new(position: Vector2, size: Vector2, label: String) -> Self {
        Self {
            position,
            size,
            is_pressed: false,
            touch_id: None,
            label,
        }
    }

    pub fn update(&mut self, rl: &RaylibHandle) {
        self.is_pressed = false;
        
        let touch_count = rl.get_touch_point_count();
        
        if touch_count > 0 {
            for i in 0..touch_count {
                let touch_point = rl.get_touch_position(i);
                
                // Check if touch is within button area
                if touch_point.x >= self.position.x - self.size.x / 2.0
                    && touch_point.x <= self.position.x + self.size.x / 2.0
                    && touch_point.y >= self.position.y - self.size.y / 2.0
                    && touch_point.y <= self.position.y + self.size.y / 2.0
                {
                    self.is_pressed = true;
                    self.touch_id = Some(i as i32);
                    break;
                }
            }
        } else {
            self.touch_id = None;
        }
    }

    pub fn draw(&self, d: &mut RaylibDrawHandle) {
        let button_color = if self.is_pressed {
            Color::new(255, 255, 255, 200)
        } else {
            Color::new(150, 150, 150, 150)
        };
        
        let border_color = if self.is_pressed {
            Color::new(255, 255, 255, 255)
        } else {
            Color::new(200, 200, 200, 200)
        };
        
        // Draw button background
        d.draw_rectangle_v(
            Vector2::new(self.position.x - self.size.x / 2.0, self.position.y - self.size.y / 2.0),
            self.size,
            button_color
        );
        
        // Draw button border
        d.draw_rectangle_lines_ex(
            Rectangle::new(
                self.position.x - self.size.x / 2.0,
                self.position.y - self.size.y / 2.0,
                self.size.x,
                self.size.y
            ),
            2.0,
            border_color
        );
        
        // Draw label
        let font_size = 16;
        let text_width = d.measure_text(&self.label, font_size);
        let text_pos = Vector2::new(
            self.position.x - text_width as f32 / 2.0,
            self.position.y - font_size as f32 / 2.0
        );

        d.draw_text(&self.label, text_pos.x as i32, text_pos.y as i32, font_size, Color::WHITE);
    }
}

/// Main touch controls manager
#[derive(Debug)]
pub struct TouchControls {
    pub left_joystick: VirtualJoystick,
    pub right_joystick: VirtualJoystick,
    pub jump_button: TouchButton,
    pub crouch_button: TouchButton,
    pub run_button: TouchButton,
    pub shoot_button: TouchButton,
    pub is_mobile: bool,
    pub screen_width: f32,
    pub screen_height: f32,
}

impl TouchControls {
    pub fn new(screen_width: f32, screen_height: f32) -> Self {
        let joystick_radius = 60.0;
        let joystick_margin = 80.0;
        
        // Left joystick for movement (bottom left)
        let left_center = Vector2::new(
            joystick_margin,
            screen_height - joystick_margin
        );
        
        // Right joystick for camera look (bottom right)
        let right_center = Vector2::new(
            screen_width - joystick_margin,
            screen_height - joystick_margin
        );
        
        // Touch buttons (top right area)
        let button_size = Vector2::new(60.0, 40.0);
        let button_spacing = 70.0;
        let button_start_x = screen_width - 270.0;
        let button_y = 100.0;
        // Shoot button (bottom right larger circle-like rectangle)
        let shoot_pos = Vector2::new(screen_width - 100.0, screen_height - 120.0);
        let shoot_size = Vector2::new(90.0, 90.0);
        
        Self {
            left_joystick: VirtualJoystick::new(left_center, joystick_radius),
            right_joystick: VirtualJoystick::new(right_center, joystick_radius),
            jump_button: TouchButton::new(
                Vector2::new(button_start_x, button_y),
                button_size,
                "JUMP".to_string()
            ),
            crouch_button: TouchButton::new(
                Vector2::new(button_start_x + button_spacing, button_y),
                button_size,
                "CROUCH".to_string()
            ),
            run_button: TouchButton::new(
                Vector2::new(button_start_x + button_spacing * 2.0, button_y),
                button_size,
                "RUN".to_string()
            ),
            shoot_button: TouchButton::new(
                shoot_pos,
                shoot_size,
                "SHOOT".to_string()
            ),
            is_mobile: Self::detect_mobile(screen_width, screen_height),
            screen_width,
            screen_height,
        }
    }

    /// Detect if we're on a mobile device based on screen size
    fn detect_mobile(screen_width: f32, screen_height: f32) -> bool {
        // Consider mobile if the shorter side is under 1000px (covers phones + many tablets in landscape).
        let short_side = screen_width.min(screen_height);
        short_side < 1000.0
    }

    pub fn update(&mut self, rl: &RaylibHandle) {
        if !self.is_mobile {
            return;
        }

        self.left_joystick.update(rl);
        self.right_joystick.update(rl);
        self.jump_button.update(rl);
        self.crouch_button.update(rl);
        self.run_button.update(rl);
        self.shoot_button.update(rl);
    }

    pub fn draw(&self, d: &mut RaylibDrawHandle) {
        if !self.is_mobile {
            return;
        }

        self.left_joystick.draw(d);
        self.right_joystick.draw(d);
        self.jump_button.draw(d);
        self.crouch_button.draw(d);
        self.run_button.draw(d);
        self.shoot_button.draw(d);
    }

    /// Get movement input from left joystick (WASD equivalent)
    pub fn get_movement_input(&self) -> (bool, bool, bool, bool) {
        if !self.is_mobile {
            return (false, false, false, false);
        }

        let direction = self.left_joystick.get_direction();
        
        // Convert joystick direction to WASD equivalent
        let forward = direction.y < -0.3;  // Up
        let backward = direction.y > 0.3;  // Down
        let left = direction.x < -0.3;     // Left
        let right = direction.x > 0.3;     // Right

        (forward, backward, left, right)
    }

    /// Get camera look input from right joystick (mouse equivalent)
    pub fn get_look_input(&self) -> Vector2 {
        if !self.is_mobile {
            return Vector2::zero();
        }

        let direction = self.right_joystick.get_direction();
        
        // Scale the input to match mouse sensitivity
        direction * 3.0
    }

    /// Get button states
    pub fn get_jump_pressed(&self) -> bool {
        self.is_mobile && self.jump_button.is_pressed
    }

    pub fn get_crouch_pressed(&self) -> bool {
        self.is_mobile && self.crouch_button.is_pressed
    }

    pub fn get_run_pressed(&self) -> bool {
        self.is_mobile && self.run_button.is_pressed
    }

    pub fn get_shoot_pressed(&self) -> bool {
        self.is_mobile && self.shoot_button.is_pressed
    }

    /// Returns true if any touch control is actively engaged
    pub fn is_active(&self) -> bool {
        if !self.is_mobile { return false; }
        self.left_joystick.is_active
            || self.right_joystick.is_active
            || self.jump_button.is_pressed
            || self.crouch_button.is_pressed
            || self.run_button.is_pressed
            || self.shoot_button.is_pressed
    }
}
