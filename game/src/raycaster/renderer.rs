use raylib::prelude::*;
use super::Map2D;

/// Raycaster renderer using DDA (Digital Differential Analysis) algorithm
/// Similar to Wolfenstein 3D / Doom rendering
pub struct Raycaster {
    /// Screen width
    width: i32,
    /// Screen height
    height: i32,
    /// Wall texture (optional)
    wall_texture: Option<Texture2D>,
    /// Wall texture as image for pixel sampling
    wall_image: Option<Image>,
}

impl Raycaster {
    pub fn new(width: i32, height: i32) -> Self {
        Self {
            width,
            height,
            wall_texture: None,
            wall_image: None,
        }
    }

    /// Set the wall texture
    pub fn set_wall_texture(&mut self, texture: Texture2D, image: Image) {
        // Store both texture and image for rendering
        self.wall_texture = Some(texture);
        self.wall_image = Some(image);
    }

    /// Render the 3D view using raycasting
    /// pos_x, pos_y: player position in the 2D map
    /// dir_x, dir_y: player direction vector
    /// plane_x, plane_y: camera plane (perpendicular to direction, determines FOV)
    /// pitch: vertical look angle in degrees (-89 to 89)
    pub fn render(
        &mut self,
        d: &mut RaylibDrawHandle,
        map: &Map2D,
        pos_x: f32,
        pos_y: f32,
        dir_x: f32,
        dir_y: f32,
        plane_x: f32,
        plane_y: f32,
        pitch: f32,
    ) {
        // Cast a ray for each vertical stripe of the screen
        for x in 0..self.width {
            // Calculate ray position and direction
            // camera_x goes from -1 (left) to 1 (right)
            let camera_x = 2.0 * x as f32 / self.width as f32 - 1.0;

            // Ray direction = dir + plane * camera_x
            let ray_dir_x = dir_x + plane_x * camera_x;
            let ray_dir_y = dir_y + plane_y * camera_x;

            // Which box of the map we're in
            let mut map_x = pos_x as i32;
            let mut map_y = pos_y as i32;

            // Length of ray from current position to next x or y-side
            let mut side_dist_x: f32;
            let mut side_dist_y: f32;

            // Length of ray from one x or y-side to next x or y-side
            let delta_dist_x = if ray_dir_x == 0.0 {
                1e30
            } else {
                (1.0 / ray_dir_x).abs()
            };
            let delta_dist_y = if ray_dir_y == 0.0 {
                1e30
            } else {
                (1.0 / ray_dir_y).abs()
            };

            // What direction to step in x or y-direction (either +1 or -1)
            let step_x: i32;
            let step_y: i32;

            // Calculate step and initial sideDist
            if ray_dir_x < 0.0 {
                step_x = -1;
                side_dist_x = (pos_x - map_x as f32) * delta_dist_x;
            } else {
                step_x = 1;
                side_dist_x = (map_x as f32 + 1.0 - pos_x) * delta_dist_x;
            }

            if ray_dir_y < 0.0 {
                step_y = -1;
                side_dist_y = (pos_y - map_y as f32) * delta_dist_y;
            } else {
                step_y = 1;
                side_dist_y = (map_y as f32 + 1.0 - pos_y) * delta_dist_y;
            }

            // Perform DDA
            let mut hit = false;
            let mut side = 0; // 0 = x-side, 1 = y-side

            // DDA loop
            while !hit {
                // Jump to next map square, either in x-direction, or in y-direction
                if side_dist_x < side_dist_y {
                    side_dist_x += delta_dist_x;
                    map_x += step_x;
                    side = 0;
                } else {
                    side_dist_y += delta_dist_y;
                    map_y += step_y;
                    side = 1;
                }

                // Check if ray has hit a wall
                if map.get_wall(map_x, map_y) > 0 {
                    hit = true;
                }
            }

            // Calculate distance to wall (perpendicular distance to avoid fisheye effect)
            let perp_wall_dist = if side == 0 {
                (map_x as f32 - pos_x + (1.0 - step_x as f32) / 2.0) / ray_dir_x
            } else {
                (map_y as f32 - pos_y + (1.0 - step_y as f32) / 2.0) / ray_dir_y
            };

            // Calculate height of line to draw on screen
            let line_height = if perp_wall_dist == 0.0 {
                self.height
            } else {
                (self.height as f32 / perp_wall_dist) as i32
            };

            // Apply pitch offset (looking up/down)
            // Pitch is in degrees, convert to screen space offset
            let pitch_offset = (pitch / 90.0 * (self.height as f32 / 2.0)) as i32;

            // Calculate lowest and highest pixel to fill in current stripe
            let mut draw_start = -line_height / 2 + self.height / 2 + pitch_offset;
            if draw_start < 0 {
                draw_start = 0;
            }

            let mut draw_end = line_height / 2 + self.height / 2 + pitch_offset;
            if draw_end >= self.height {
                draw_end = self.height - 1;
            }

            // Get wall color
            let wall_type = map.get_wall(map_x, map_y);
            let mut color = map.get_wall_color(wall_type);

            // Make y-sides darker for depth perception
            if side == 1 {
                color = Color::new(
                    color.r / 2,
                    color.g / 2,
                    color.b / 2,
                    color.a,
                );
            }

            // Apply flashlight effect (distance-based lighting)
            // Maximum flashlight range is about 15 units
            let max_flashlight_range = 15.0;
            let light_intensity = (1.0 - (perp_wall_dist / max_flashlight_range).min(1.0)).max(0.0);

            // Apply darkness with flashlight cone
            let darkness_factor = 0.15; // Base darkness level (15% brightness)
            let final_brightness = darkness_factor + (1.0 - darkness_factor) * light_intensity;

            color = Color::new(
                (color.r as f32 * final_brightness) as u8,
                (color.g as f32 * final_brightness) as u8,
                (color.b as f32 * final_brightness) as u8,
                color.a,
            );

            // Draw the ceiling (above the wall) with darkness
            let ceiling_base = Color::new(20, 20, 30, 255); // Very dark ceiling
            let ceiling_brightness = darkness_factor * 0.5; // Even darker than walls
            let ceiling_color = Color::new(
                (ceiling_base.r as f32 * ceiling_brightness) as u8,
                (ceiling_base.g as f32 * ceiling_brightness) as u8,
                (ceiling_base.b as f32 * ceiling_brightness) as u8,
                255,
            );
            d.draw_line(x, 0, x, draw_start, ceiling_color);

            // Draw the wall stripe with texture if available
            if let Some(ref mut image) = self.wall_image {
                // Calculate texture X coordinate (where did the wall get hit?)
                let wall_x = if side == 0 {
                    pos_y + perp_wall_dist * ray_dir_y
                } else {
                    pos_x + perp_wall_dist * ray_dir_x
                };
                let wall_x = wall_x - wall_x.floor(); // Get fractional part

                // X coordinate on the texture
                let tex_x = (wall_x * image.width as f32) as i32;
                let tex_x = if (side == 0 && ray_dir_x > 0.0) || (side == 1 && ray_dir_y < 0.0) {
                    image.width - tex_x - 1
                } else {
                    tex_x
                };

                // Draw textured wall column
                for y in draw_start..=draw_end {
                    // Calculate texture Y coordinate
                    let d_val = y - pitch_offset - self.height / 2 + line_height / 2;
                    let tex_y = ((d_val * image.height) / line_height).max(0).min(image.height - 1);

                    // Sample the texture pixel
                    let brick_color = image.get_color(tex_x, tex_y);

                    // Apply lighting
                    let lit_color = Color::new(
                        (brick_color.r as f32 * final_brightness) as u8,
                        (brick_color.g as f32 * final_brightness) as u8,
                        (brick_color.b as f32 * final_brightness) as u8,
                        255,
                    );

                    d.draw_pixel(x, y, lit_color);
                }
            } else {
                // No texture, draw solid color
                d.draw_line(x, draw_start, x, draw_end, color);
            }

            // Draw the floor (below the wall) with distance-based lighting
            let floor_base = Color::new(40, 40, 45, 255); // Dark gray floor
            let floor_brightness = darkness_factor + (1.0 - darkness_factor) * light_intensity * 0.6;
            let floor_color = Color::new(
                (floor_base.r as f32 * floor_brightness) as u8,
                (floor_base.g as f32 * floor_brightness) as u8,
                (floor_base.b as f32 * floor_brightness) as u8,
                255,
            );
            d.draw_line(x, draw_end, x, self.height, floor_color);
        }
    }

    /// Render sprites (players, items, etc.) using raycasting
    /// This should be called after rendering walls
    pub fn render_sprites(
        &self,
        d: &mut RaylibDrawHandle,
        pos_x: f32,
        pos_y: f32,
        dir_x: f32,
        dir_y: f32,
        plane_x: f32,
        plane_y: f32,
        sprites: &[(f32, f32, Color)], // (x, y, color)
    ) {
        // Calculate sprite distances and sort by distance (far to near)
        let mut sprite_order: Vec<(usize, f32)> = sprites
            .iter()
            .enumerate()
            .map(|(i, &(sprite_x, sprite_y, _))| {
                let dist = (pos_x - sprite_x).powi(2) + (pos_y - sprite_y).powi(2);
                (i, dist)
            })
            .collect();

        // Sort from far to near
        sprite_order.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Render each sprite
        for &(i, _) in &sprite_order {
            let (sprite_x, sprite_y, sprite_color) = sprites[i];

            // Translate sprite position to relative to camera
            let sprite_rel_x = sprite_x - pos_x;
            let sprite_rel_y = sprite_y - pos_y;

            // Transform sprite with the inverse camera matrix
            // [ plane_x   dir_x ] -1                                       [ dir_y      -dir_x ]
            // [ plane_y   dir_y ]       =  1/(plane_x*dir_y-dir_x*plane_y) [ -plane_y  plane_x ]
            let inv_det = 1.0 / (plane_x * dir_y - dir_x * plane_y);

            let transform_x = inv_det * (dir_y * sprite_rel_x - dir_x * sprite_rel_y);
            let transform_y = inv_det * (-plane_y * sprite_rel_x + plane_x * sprite_rel_y);

            // Skip sprites behind player
            if transform_y <= 0.0 {
                continue;
            }

            // Calculate sprite screen x position
            let sprite_screen_x = ((self.width / 2) as f32 * (1.0 + transform_x / transform_y)) as i32;

            // Calculate sprite height and width
            // Make sprites represent a 2-unit tall player
            let sprite_height = ((self.height as f32 * 2.0 / transform_y).abs()) as i32;
            let sprite_width = (sprite_height as f32 * 0.6) as i32; // Slightly narrower than tall

            // Calculate sprite drawing bounds
            let draw_start_y = (-sprite_height / 2 + self.height / 2).max(0);
            let draw_end_y = (sprite_height / 2 + self.height / 2).min(self.height - 1);

            let draw_start_x = (-sprite_width / 2 + sprite_screen_x).max(0);
            let draw_end_x = (sprite_width / 2 + sprite_screen_x).min(self.width - 1);

            // Apply flashlight lighting to sprite based on distance
            let sprite_distance = transform_y;
            let max_flashlight_range = 15.0;
            let light_intensity = (1.0 - (sprite_distance / max_flashlight_range).min(1.0)).max(0.0);
            let darkness_factor = 0.15;
            let brightness = darkness_factor + (1.0 - darkness_factor) * light_intensity;

            let lit_color = Color::new(
                (sprite_color.r as f32 * brightness) as u8,
                (sprite_color.g as f32 * brightness) as u8,
                (sprite_color.b as f32 * brightness) as u8,
                sprite_color.a,
            );

            // Draw sprite as a simple rectangle (can be enhanced with textures later)
            d.draw_rectangle(
                draw_start_x,
                draw_start_y,
                draw_end_x - draw_start_x,
                draw_end_y - draw_start_y,
                lit_color,
            );
        }
    }

    /// Render bullet trails as glowing lines in screen space
    /// Trails are drawn as bright lines that appear to go from gun muzzle to hit point
    pub fn render_bullet_trails(
        &self,
        d: &mut RaylibDrawHandle,
        trails: &[(i32, i32, i32, i32, f32)], // (start_x, start_y, end_x, end_y, alpha) in screen space
    ) {
        for &(start_x, start_y, end_x, end_y, alpha) in trails {
            let alpha_u8 = (alpha * 255.0).min(255.0) as u8;

            // Draw multiple layers for glow effect
            // Outer glow (widest, most transparent)
            for thickness in (1..=4).rev() {
                let layer_alpha = (alpha_u8 as f32 * (0.3 + 0.175 * (5 - thickness) as f32)) as u8;
                d.draw_line_ex(
                    Vector2::new(start_x as f32, start_y as f32),
                    Vector2::new(end_x as f32, end_y as f32),
                    thickness as f32,
                    Color::new(255, 255, 150, layer_alpha),
                );
            }

            // Core trail (brightest, thinnest)
            d.draw_line_ex(
                Vector2::new(start_x as f32, start_y as f32),
                Vector2::new(end_x as f32, end_y as f32),
                1.0,
                Color::new(255, 255, 255, alpha_u8),
            );
        }
    }

    /// Render the gun viewmodel (first-person weapon)
    /// muzzle_flash: whether to show muzzle flash effect
    pub fn render_gun(&self, d: &mut RaylibDrawHandle, muzzle_flash: bool) {
        // Gun dimensions (in screen space)
        let gun_width = self.width / 8;
        let gun_height = self.height / 3;

        // Position gun in bottom right of screen
        let gun_x = self.width - gun_width - self.width / 20;
        let gun_y = self.height - gun_height - self.height / 20;

        // Draw gun barrel (simple rectangle for now)
        let barrel_color = Color::new(60, 60, 70, 255);
        d.draw_rectangle(
            gun_x + gun_width / 3,
            gun_y,
            gun_width / 3,
            gun_height / 2,
            barrel_color,
        );

        // Draw gun body
        let body_color = Color::new(80, 80, 90, 255);
        d.draw_rectangle(
            gun_x,
            gun_y + gun_height / 2,
            gun_width,
            gun_height / 2,
            body_color,
        );

        // Draw gun grip
        let grip_color = Color::new(50, 50, 60, 255);
        d.draw_rectangle(
            gun_x + gun_width / 4,
            gun_y + gun_height / 2 + gun_height / 6,
            gun_width / 4,
            gun_height / 3,
            grip_color,
        );

        // Draw trigger guard
        d.draw_rectangle_lines(
            gun_x + gun_width / 3,
            gun_y + gun_height * 2 / 3,
            gun_width / 6,
            gun_height / 6,
            Color::new(100, 100, 110, 255),
        );

        // Muzzle flash effect
        if muzzle_flash {
            let flash_size = gun_width / 2;
            d.draw_rectangle(
                gun_x + gun_width / 3 - flash_size / 4,
                gun_y - flash_size / 2,
                flash_size,
                flash_size / 2,
                Color::new(255, 255, 100, 200),
            );
            d.draw_circle(
                gun_x + gun_width / 2,
                gun_y - flash_size / 4,
                flash_size as f32 / 3.0,
                Color::new(255, 200, 50, 150),
            );
        }

        // Add some detail lines
        d.draw_line(
            gun_x + gun_width / 3,
            gun_y + gun_height / 4,
            gun_x + gun_width * 2 / 3,
            gun_y + gun_height / 4,
            Color::new(100, 100, 110, 255),
        );
    }
}
