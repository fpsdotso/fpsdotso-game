use raylib::prelude::*;

/// Modern color palette with vibrant accents
pub struct UIColors {
    pub primary_bg: Color,
    pub secondary_bg: Color,
    pub card_bg: Color,
    pub accent_green: Color,
    pub accent_red: Color,
    pub accent_cyan: Color,
    pub accent_purple: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
    pub text_dim: Color,
    pub panel_border: Color,
    pub button_hover: Color,
    pub glow_green: Color,
    pub glow_red: Color,
}

impl UIColors {
    pub fn new() -> Self {
        Self {
            primary_bg: Color::new(8, 12, 18, 250),         // Deep dark blue
            secondary_bg: Color::new(15, 20, 30, 220),      // Card background
            card_bg: Color::new(22, 28, 40, 200),           // Elevated cards
            accent_green: Color::new(0, 255, 180, 255),     // Bright cyan-green
            accent_red: Color::new(255, 60, 90, 255),       // Vibrant red
            accent_cyan: Color::new(0, 200, 255, 255),      // Electric blue
            accent_purple: Color::new(150, 100, 255, 255),  // Purple accent
            text_primary: Color::new(255, 255, 255, 255),   // Pure white
            text_secondary: Color::new(160, 180, 200, 255), // Muted cyan
            text_dim: Color::new(100, 120, 140, 200),       // Very dim
            panel_border: Color::new(60, 80, 110, 180),     // Subtle blue border
            button_hover: Color::new(0, 255, 180, 60),      // Glow effect
            glow_green: Color::new(0, 255, 180, 40),        // Ambient glow
            glow_red: Color::new(255, 60, 90, 40),          // Red ambient glow
        }
    }
}

/// UI button with Valorant-style angular design
pub struct UIButton {
    pub rect: Rectangle,
    pub text: String,
    pub is_hovered: bool,
    pub is_enabled: bool,
}

impl UIButton {
    pub fn new(x: f32, y: f32, width: f32, height: f32, text: String) -> Self {
        Self {
            rect: Rectangle::new(x, y, width, height),
            text,
            is_hovered: false,
            is_enabled: true,
        }
    }

    pub fn update(&mut self, mouse_pos: Vector2) -> bool {
        self.is_hovered = self.rect.check_collision_point_rec(mouse_pos);
        self.is_hovered && self.is_enabled
    }

    pub fn draw(&self, d: &mut RaylibDrawHandle, colors: &UIColors) {
        // Glow effect when hovered
        if self.is_hovered && self.is_enabled {
            let glow_rect = Rectangle::new(
                self.rect.x - 4.0,
                self.rect.y - 4.0,
                self.rect.width + 8.0,
                self.rect.height + 8.0,
            );
            d.draw_rectangle_rec(glow_rect, colors.glow_green);
        }

        let bg_color = if !self.is_enabled {
            Color::new(25, 30, 40, 180)
        } else if self.is_hovered {
            Color::new(0, 255, 180, 120)
        } else {
            Color::new(22, 28, 40, 200)
        };

        // Main button background
        d.draw_rectangle_rec(self.rect, bg_color);

        // Gradient overlay effect
        if self.is_enabled {
            let gradient_height = self.rect.height / 3.0;
            d.draw_rectangle_gradient_v(
                self.rect.x as i32,
                self.rect.y as i32,
                self.rect.width as i32,
                gradient_height as i32,
                Color::new(0, 255, 180, 30),
                Color::new(0, 255, 180, 0),
            );
        }

        // Border with accent color
        let border_color = if self.is_enabled {
            if self.is_hovered {
                Color::new(0, 255, 200, 255)
            } else {
                colors.accent_green
            }
        } else {
            colors.panel_border
        };
        d.draw_rectangle_lines_ex(self.rect, 2.0, border_color);

        // Corner decorations - more prominent
        let corner_len = 12.0;
        let corner_thick = 3.0;

        // Top-left
        d.draw_rectangle_rec(Rectangle::new(self.rect.x, self.rect.y, corner_len, corner_thick), border_color);
        d.draw_rectangle_rec(Rectangle::new(self.rect.x, self.rect.y, corner_thick, corner_len), border_color);

        // Top-right
        d.draw_rectangle_rec(Rectangle::new(self.rect.x + self.rect.width - corner_len, self.rect.y, corner_len, corner_thick), border_color);
        d.draw_rectangle_rec(Rectangle::new(self.rect.x + self.rect.width - corner_thick, self.rect.y, corner_thick, corner_len), border_color);

        // Bottom-left
        d.draw_rectangle_rec(Rectangle::new(self.rect.x, self.rect.y + self.rect.height - corner_thick, corner_len, corner_thick), border_color);
        d.draw_rectangle_rec(Rectangle::new(self.rect.x, self.rect.y + self.rect.height - corner_len, corner_thick, corner_len), border_color);

        // Bottom-right
        d.draw_rectangle_rec(Rectangle::new(self.rect.x + self.rect.width - corner_len, self.rect.y + self.rect.height - corner_thick, corner_len, corner_thick), border_color);
        d.draw_rectangle_rec(Rectangle::new(self.rect.x + self.rect.width - corner_thick, self.rect.y + self.rect.height - corner_len, corner_thick, corner_len), border_color);

        // Button text
        let text_color = if self.is_enabled {
            colors.text_primary
        } else {
            colors.text_dim
        };

        let font_size = 22;
        let text_width = d.measure_text(&self.text, font_size);
        let text_x = (self.rect.x + self.rect.width / 2.0 - text_width as f32 / 2.0) as i32;
        let text_y = (self.rect.y + self.rect.height / 2.0 - font_size as f32 / 2.0) as i32;

        // Text shadow for depth
        if self.is_enabled {
            d.draw_text(&self.text, text_x + 2, text_y + 2, font_size, Color::new(0, 0, 0, 100));
        }
        d.draw_text(&self.text, text_x, text_y, font_size, text_color);
    }

    fn draw_corner_accent(&self, d: &mut RaylibDrawHandle, x: f32, y: f32, _size: f32, color: Color) {
        d.draw_rectangle(x as i32 - 1, y as i32 - 1, 3, 3, color);
    }

    pub fn is_clicked(&self, mouse_button: MouseButton, rl: &RaylibHandle) -> bool {
        self.is_hovered && self.is_enabled && rl.is_mouse_button_pressed(mouse_button)
    }
}

/// UI Panel for containing content
pub struct UIPanel {
    pub rect: Rectangle,
    pub title: String,
    pub accent_color: Color,
}

impl UIPanel {
    pub fn new(x: f32, y: f32, width: f32, height: f32, title: String, accent_color: Color) -> Self {
        Self {
            rect: Rectangle::new(x, y, width, height),
            title,
            accent_color,
        }
    }

    pub fn draw(&self, d: &mut RaylibDrawHandle, colors: &UIColors) {
        // Subtle glow behind panel
        let glow_rect = Rectangle::new(
            self.rect.x - 2.0,
            self.rect.y - 2.0,
            self.rect.width + 4.0,
            self.rect.height + 4.0,
        );
        let glow_color = Color::new(
            self.accent_color.r / 4,
            self.accent_color.g / 4,
            self.accent_color.b / 4,
            30,
        );
        d.draw_rectangle_rec(glow_rect, glow_color);

        // Panel background
        d.draw_rectangle_rec(self.rect, colors.card_bg);

        // Subtle gradient overlay
        let gradient_height = 60.0;
        d.draw_rectangle_gradient_v(
            self.rect.x as i32,
            self.rect.y as i32,
            self.rect.width as i32,
            gradient_height as i32,
            Color::new(self.accent_color.r, self.accent_color.g, self.accent_color.b, 20),
            Color::new(0, 0, 0, 0),
        );

        // Border with double line effect
        d.draw_rectangle_lines_ex(self.rect, 2.0, self.accent_color);
        let inner_rect = Rectangle::new(
            self.rect.x + 3.0,
            self.rect.y + 3.0,
            self.rect.width - 6.0,
            self.rect.height - 6.0,
        );
        d.draw_rectangle_lines_ex(inner_rect, 1.0, Color::new(
            self.accent_color.r,
            self.accent_color.g,
            self.accent_color.b,
            80,
        ));

        // Top accent bar - thicker and with gradient
        d.draw_rectangle_gradient_h(
            self.rect.x as i32,
            self.rect.y as i32,
            (self.rect.width / 2.0) as i32,
            4,
            self.accent_color,
            Color::new(self.accent_color.r, self.accent_color.g, self.accent_color.b, 100),
        );
        d.draw_rectangle_gradient_h(
            (self.rect.x + self.rect.width / 2.0) as i32,
            self.rect.y as i32,
            (self.rect.width / 2.0) as i32,
            4,
            Color::new(self.accent_color.r, self.accent_color.g, self.accent_color.b, 100),
            self.accent_color,
        );

        // Title with better styling
        if !self.title.is_empty() {
            let font_size = 26;
            let title_x = self.rect.x as i32 + 20;
            let title_y = self.rect.y as i32 + 18;

            // Title shadow
            d.draw_text(&self.title, title_x + 2, title_y + 2, font_size, Color::new(0, 0, 0, 150));
            // Title text
            d.draw_text(&self.title, title_x, title_y, font_size, colors.text_primary);

            // Accent line under title
            let line_y = title_y + font_size + 8;
            d.draw_rectangle(
                title_x,
                line_y,
                d.measure_text(&self.title, font_size),
                3,
                self.accent_color,
            );
        }

        // Enhanced corner decorations
        let corner_len = 15;
        let corner_thick = 3;

        // Top-left corner
        d.draw_rectangle(self.rect.x as i32, self.rect.y as i32, corner_len, corner_thick, self.accent_color);
        d.draw_rectangle(self.rect.x as i32, self.rect.y as i32, corner_thick, corner_len, self.accent_color);

        // Top-right corner
        d.draw_rectangle((self.rect.x + self.rect.width) as i32 - corner_len, self.rect.y as i32, corner_len, corner_thick, self.accent_color);
        d.draw_rectangle((self.rect.x + self.rect.width) as i32 - corner_thick, self.rect.y as i32, corner_thick, corner_len, self.accent_color);

        // Bottom-left corner
        d.draw_rectangle(self.rect.x as i32, (self.rect.y + self.rect.height) as i32 - corner_thick, corner_len, corner_thick, self.accent_color);
        d.draw_rectangle(self.rect.x as i32, (self.rect.y + self.rect.height) as i32 - corner_len, corner_thick, corner_len, self.accent_color);

        // Bottom-right corner
        d.draw_rectangle((self.rect.x + self.rect.width) as i32 - corner_len, (self.rect.y + self.rect.height) as i32 - corner_thick, corner_len, corner_thick, self.accent_color);
        d.draw_rectangle((self.rect.x + self.rect.width) as i32 - corner_thick, (self.rect.y + self.rect.height) as i32 - corner_len, corner_thick, corner_len, self.accent_color);
    }

    fn draw_corner_decoration(&self, d: &mut RaylibDrawHandle, x: f32, y: f32, size: i32, color: Color) {
        // Draw small angular corner decorations
        d.draw_rectangle(x as i32 - 2, y as i32 - 2, 4, 4, color);
        d.draw_line(
            x as i32 - size,
            y as i32,
            x as i32,
            y as i32,
            color,
        );
        d.draw_line(
            x as i32,
            y as i32 - size,
            x as i32,
            y as i32,
            color,
        );
    }
}

/// Player entry in team roster
pub struct PlayerEntry {
    pub username: String,
    pub is_ready: bool,
    pub is_leader: bool,
}

/// Team roster panel
pub struct TeamRoster {
    pub panel: UIPanel,
    pub players: Vec<PlayerEntry>,
    pub max_players: usize,
}

impl TeamRoster {
    pub fn new(x: f32, y: f32, width: f32, height: f32, team_name: String, accent_color: Color) -> Self {
        Self {
            panel: UIPanel::new(x, y, width, height, team_name, accent_color),
            players: Vec::new(),
            max_players: 5,
        }
    }

    pub fn draw(&self, d: &mut RaylibDrawHandle, colors: &UIColors) {
        // Draw panel background
        self.panel.draw(d, colors);

        // Draw player entries
        let entry_height = 48.0; // Increased for better spacing
        let start_y = self.panel.rect.y + 70.0; // Below title

        for (i, player) in self.players.iter().enumerate() {
            let entry_y = start_y + (i as f32 * entry_height);
            self.draw_player_entry(d, colors, player, self.panel.rect.x + 15.0, entry_y);
        }

        // Draw empty slots
        for i in self.players.len()..self.max_players {
            let entry_y = start_y + (i as f32 * entry_height);
            self.draw_empty_slot(d, colors, self.panel.rect.x + 15.0, entry_y);
        }

        // Draw player count badge
        let count_text = format!("{}/{}", self.players.len(), self.max_players);
        let count_x = (self.panel.rect.x + self.panel.rect.width - 80.0) as i32;
        let count_y = (self.panel.rect.y + 18.0) as i32;

        // Badge background
        d.draw_rectangle(count_x - 5, count_y - 2, 70, 30, Color::new(30, 40, 55, 200));
        d.draw_rectangle_lines(count_x - 5, count_y - 2, 70, 30, self.panel.accent_color);

        d.draw_text(&count_text, count_x + 12, count_y + 4, 22, self.panel.accent_color);
    }

    fn draw_player_entry(&self, d: &mut RaylibDrawHandle, colors: &UIColors, player: &PlayerEntry, x: f32, y: f32) {
        let entry_width = self.panel.rect.width - 30.0;
        let entry_height = 42.0;

        // Entry background with gradient
        d.draw_rectangle_gradient_h(
            x as i32,
            y as i32,
            (entry_width / 2.0) as i32,
            entry_height as i32,
            Color::new(35, 45, 60, 200),
            Color::new(28, 36, 50, 200),
        );
        d.draw_rectangle_gradient_h(
            (x + entry_width / 2.0) as i32,
            y as i32,
            (entry_width / 2.0) as i32,
            entry_height as i32,
            Color::new(28, 36, 50, 200),
            Color::new(35, 45, 60, 200),
        );

        // Left accent bar
        let accent_width = 4.0;
        let bar_color = if player.is_ready {
            self.panel.accent_color
        } else {
            Color::new(60, 70, 80, 255)
        };
        d.draw_rectangle_rec(
            Rectangle::new(x, y, accent_width, entry_height),
            bar_color,
        );

        // Avatar placeholder circle
        let avatar_size = 28.0;
        let avatar_x = x + 15.0;
        let avatar_y = y + entry_height / 2.0;

        d.draw_circle(
            avatar_x as i32,
            avatar_y as i32,
            avatar_size / 2.0,
            Color::new(60, 80, 110, 255),
        );
        d.draw_circle_lines(
            avatar_x as i32,
            avatar_y as i32,
            avatar_size / 2.0,
            self.panel.accent_color,
        );

        // Leader crown badge
        if player.is_leader {
            let crown_x = (avatar_x - 8.0) as i32;
            let crown_y = (avatar_y - 20.0) as i32;
            // Crown background
            d.draw_circle(crown_x, crown_y, 10.0, Color::new(255, 200, 0, 255));
            d.draw_text("★", crown_x - 6, crown_y - 8, 16, Color::new(50, 40, 0, 255));
        }

        // Username
        let username_x = (x + 50.0) as i32;
        let username_y = (y + 12.0) as i32;
        d.draw_text(&player.username, username_x, username_y, 18, colors.text_primary);

        // Ready status badge
        let badge_x = x + entry_width - 100.0;
        let badge_y = y + 8.0;
        let badge_width = 85.0;
        let badge_height = 26.0;

        if player.is_ready {
            // Green ready badge
            d.draw_rectangle_rec(
                Rectangle::new(badge_x, badge_y, badge_width, badge_height),
                Color::new(0, 255, 180, 60),
            );
            d.draw_rectangle_lines_ex(
                Rectangle::new(badge_x, badge_y, badge_width, badge_height),
                2.0,
                colors.accent_green,
            );
            d.draw_text("✓ READY", (badge_x + 8.0) as i32, (badge_y + 5.0) as i32, 16, colors.accent_green);
        } else {
            // Gray not ready badge
            d.draw_rectangle_rec(
                Rectangle::new(badge_x, badge_y, badge_width, badge_height),
                Color::new(60, 70, 80, 100),
            );
            d.draw_rectangle_lines_ex(
                Rectangle::new(badge_x, badge_y, badge_width, badge_height),
                1.0,
                colors.text_dim,
            );
            d.draw_text("WAITING", (badge_x + 8.0) as i32, (badge_y + 5.0) as i32, 15, colors.text_dim);
        }
    }

    fn draw_empty_slot(&self, d: &mut RaylibDrawHandle, colors: &UIColors, x: f32, y: f32) {
        let entry_width = self.panel.rect.width - 30.0;
        d.draw_rectangle_lines_ex(
            Rectangle::new(x, y, entry_width, 35.0),
            1.0,
            Color::new(60, 70, 80, 150),
        );
        d.draw_text("Empty Slot", x as i32 + 10, y as i32 + 8, 16, colors.text_secondary);
    }
}

/// Game entry in available games list
pub struct GameEntry {
    pub game_name: String,
    pub map_name: String,
    pub player_count: usize,
    pub max_players: usize,
    pub game_pubkey: String,
}

/// Available games list
pub struct GamesList {
    pub panel: UIPanel,
    pub games: Vec<GameEntry>,
    pub selected_index: Option<usize>,
    pub scroll_offset: f32,
}

impl GamesList {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self {
            panel: UIPanel::new(x, y, width, height, "AVAILABLE GAMES".to_string(), Color::new(0, 255, 150, 255)),
            games: Vec::new(),
            selected_index: None,
            scroll_offset: 0.0,
        }
    }

    pub fn draw(&self, d: &mut RaylibDrawHandle, colors: &UIColors) {
        self.panel.draw(d, colors);

        let entry_height = 76.0; // Increased for better card design
        let entry_spacing = 6.0; // Space between cards
        let start_y = self.panel.rect.y + 70.0;
        let content_height = self.panel.rect.height - 80.0;

        // Enable scissor mode to clip content
        unsafe {
            raylib::ffi::BeginScissorMode(
                self.panel.rect.x as i32 + 10,
                start_y as i32,
                (self.panel.rect.width - 20.0) as i32,
                content_height as i32,
            );
        }

        for (i, game) in self.games.iter().enumerate() {
            let entry_y = start_y + (i as f32 * (entry_height + entry_spacing)) - self.scroll_offset;

            // Only draw if visible
            if entry_y + entry_height >= start_y && entry_y <= start_y + content_height {
                let is_selected = self.selected_index == Some(i);
                self.draw_game_entry(d, colors, game, self.panel.rect.x + 15.0, entry_y, is_selected);
            }
        }

        unsafe {
            raylib::ffi::EndScissorMode();
        }

        // Draw "No games available" if list is empty
        if self.games.is_empty() {
            let text = "No games available";
            let subtext = "Click REFRESH or CREATE GAME to get started";

            let text_width = d.measure_text(text, 24);
            let subtext_width = d.measure_text(subtext, 14);

            let text_x = (self.panel.rect.x + self.panel.rect.width / 2.0 - text_width as f32 / 2.0) as i32;
            let subtext_x = (self.panel.rect.x + self.panel.rect.width / 2.0 - subtext_width as f32 / 2.0) as i32;
            let text_y = (start_y + content_height / 2.0 - 30.0) as i32;

            d.draw_text(text, text_x, text_y, 24, colors.text_secondary);
            d.draw_text(subtext, subtext_x, text_y + 35, 14, colors.text_dim);
        }
    }

    fn draw_game_entry(&self, d: &mut RaylibDrawHandle, colors: &UIColors, game: &GameEntry, x: f32, y: f32, is_selected: bool) {
        let entry_width = self.panel.rect.width - 30.0;
        let entry_height = 70.0;

        // Glow effect for selected
        if is_selected {
            let glow_rect = Rectangle::new(x - 3.0, y - 3.0, entry_width + 6.0, entry_height + 6.0);
            d.draw_rectangle_rec(glow_rect, colors.glow_green);
        }

        // Card background with gradient
        let bg_color = if is_selected {
            Color::new(25, 80, 70, 220)
        } else {
            Color::new(30, 38, 52, 200)
        };
        d.draw_rectangle_rec(Rectangle::new(x, y, entry_width, entry_height), bg_color);

        // Top gradient overlay
        d.draw_rectangle_gradient_v(
            x as i32,
            y as i32,
            entry_width as i32,
            20,
            Color::new(0, 255, 180, if is_selected { 50 } else { 15 }),
            Color::new(0, 0, 0, 0),
        );

        // Left accent bar
        let accent_color = if is_selected {
            colors.accent_cyan
        } else {
            colors.panel_border
        };
        d.draw_rectangle_rec(Rectangle::new(x, y, 4.0, entry_height), accent_color);

        // Border
        if is_selected {
            d.draw_rectangle_lines_ex(
                Rectangle::new(x, y, entry_width, entry_height),
                2.0,
                colors.accent_green,
            );
        } else {
            d.draw_rectangle_lines_ex(
                Rectangle::new(x, y, entry_width, entry_height),
                1.0,
                Color::new(60, 80, 100, 120),
            );
        }

        // Game name with shadow
        let name_x = x as i32 + 15;
        let name_y = y as i32 + 12;
        d.draw_text(&game.game_name, name_x + 1, name_y + 1, 22, Color::new(0, 0, 0, 150));
        d.draw_text(&game.game_name, name_x, name_y, 22, colors.text_primary);

        // Map name with icon
        let map_text = format!("🗺 {}", game.map_name);
        d.draw_text(&map_text, name_x, name_y + 28, 15, colors.text_secondary);

        // Player count badge
        let badge_x = x + entry_width - 90.0;
        let badge_y = y + 20.0;
        let badge_width = 75.0;
        let badge_height = 30.0;

        // Badge background
        let player_ratio = game.player_count as f32 / game.max_players as f32;
        let badge_bg = if player_ratio >= 0.8 {
            Color::new(255, 200, 0, 100) // Nearly full - yellow
        } else if player_ratio >= 0.5 {
            Color::new(0, 255, 180, 60) // Half full - green
        } else {
            Color::new(100, 120, 140, 80) // Low players - gray
        };

        d.draw_rectangle_rec(
            Rectangle::new(badge_x, badge_y, badge_width, badge_height),
            badge_bg,
        );
        d.draw_rectangle_lines_ex(
            Rectangle::new(badge_x, badge_y, badge_width, badge_height),
            1.5,
            accent_color,
        );

        // Player count text
        let count_text = format!("{}/{}", game.player_count, game.max_players);
        let count_text_x = (badge_x + badge_width / 2.0 - d.measure_text(&count_text, 18) as f32 / 2.0) as i32;
        d.draw_text(&count_text, count_text_x, (badge_y + 7.0) as i32, 18, colors.text_primary);

        // Players label
        d.draw_text("PLAYERS", (badge_x + 8.0) as i32, (y + 8.0) as i32, 10, colors.text_dim);
    }

    pub fn update(&mut self, mouse_pos: Vector2, mouse_wheel: f32) -> Option<usize> {
        // Handle scrolling
        if self.panel.rect.check_collision_point_rec(mouse_pos) {
            self.scroll_offset -= mouse_wheel * 20.0;
            self.scroll_offset = self.scroll_offset.max(0.0);

            let max_scroll = (self.games.len() as f32 * 60.0 - (self.panel.rect.height - 70.0)).max(0.0);
            self.scroll_offset = self.scroll_offset.min(max_scroll);
        }

        // Check for clicks on entries
        if self.panel.rect.check_collision_point_rec(mouse_pos) {
            let start_y = self.panel.rect.y + 60.0;
            let relative_y = mouse_pos.y - start_y + self.scroll_offset;
            let entry_index = (relative_y / 60.0) as usize;

            if entry_index < self.games.len() {
                self.selected_index = Some(entry_index);
                return Some(entry_index);
            }
        }

        None
    }
}
