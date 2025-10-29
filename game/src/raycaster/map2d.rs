use raylib::prelude::*;
use crate::map::{Map, MapObject};

/// 2D grid-based map for raycasting
/// Each cell contains a wall type (0 = empty, >0 = wall with different textures)
pub struct Map2D {
    /// Width of the map in cells
    pub width: usize,
    /// Height of the map in cells
    pub height: usize,
    /// Grid data (0 = empty, 1+ = wall type)
    pub grid: Vec<Vec<i32>>,
}

impl Map2D {
    /// Create a new empty map
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            grid: vec![vec![0; height]; width],
        }
    }

    /// Create a demo map for testing (like Wolfenstein 3D)
    pub fn create_demo() -> Self {
        let width = 24;
        let height = 24;
        let mut map = Self::new(width, height);

        // Create a border around the map
        for x in 0..width {
            map.grid[x][0] = 1;
            map.grid[x][height - 1] = 1;
        }
        for y in 0..height {
            map.grid[0][y] = 1;
            map.grid[width - 1][y] = 1;
        }

        // Create some interior walls for gameplay
        // Vertical wall
        for y in 5..15 {
            map.grid[8][y] = 2;
        }

        // Horizontal wall
        for x in 5..15 {
            map.grid[x][12] = 3;
        }

        // Create a room in the corner
        for x in 15..20 {
            map.grid[x][15] = 4;
            map.grid[x][20] = 4;
        }
        for y in 15..21 {
            map.grid[15][y] = 4;
            map.grid[20][y] = 4;
        }
        // Add a door
        map.grid[17][15] = 0;

        map
    }

    /// Get wall type at position (returns 0 if out of bounds)
    pub fn get_wall(&self, x: i32, y: i32) -> i32 {
        if x < 0 || y < 0 || x >= self.width as i32 || y >= self.height as i32 {
            return 1; // Out of bounds is treated as a wall
        }
        self.grid[x as usize][y as usize]
    }

    /// Check if position is solid (has a wall)
    pub fn is_solid(&self, x: f32, y: f32) -> bool {
        self.get_wall(x as i32, y as i32) > 0
    }

    /// Get wall color based on wall type
    pub fn get_wall_color(&self, wall_type: i32) -> Color {
        match wall_type {
            1 => Color::new(180, 180, 180, 255), // Gray
            2 => Color::new(180, 70, 70, 255),   // Red
            3 => Color::new(70, 180, 70, 255),   // Green
            4 => Color::new(70, 70, 180, 255),   // Blue
            5 => Color::new(180, 180, 70, 255),  // Yellow
            6 => Color::new(0, 255, 163, 255),   // Solana cyan
            7 => Color::new(156, 81, 255, 255),  // Solana purple
            8 => Color::new(220, 31, 255, 255),  // Solana magenta
            _ => Color::new(200, 200, 200, 255), // Default white
        }
    }

    /// Create a 50x50 grid map from the existing Map objects or use default with Solana corners
    pub fn from_map_or_default(map: Option<&Map>) -> Self {
        // Create a 50x50 grid to match the world size
        let width = 50;
        let height = 50;
        let mut map2d = Self::new(width, height);

        // Create border walls
        for x in 0..width {
            map2d.grid[x][0] = 1;
            map2d.grid[x][height - 1] = 1;
        }
        for y in 0..height {
            map2d.grid[0][y] = 1;
            map2d.grid[width - 1][y] = 1;
        }

        // Add Solana-themed corner decorations
        // Top-left corner (Cyan)
        for i in 2..8 {
            map2d.grid[i][2] = 6;
            map2d.grid[2][i] = 6;
        }

        // Top-right corner (Purple)
        for i in 2..8 {
            map2d.grid[width - i - 1][2] = 7;
            map2d.grid[width - 3][i] = 7;
        }

        // Bottom-left corner (Magenta)
        for i in 2..8 {
            map2d.grid[i][height - 3] = 8;
            map2d.grid[2][height - i - 1] = 8;
        }

        // Bottom-right corner (Cyan)
        for i in 2..8 {
            map2d.grid[width - i - 1][height - 3] = 6;
            map2d.grid[width - 3][height - i - 1] = 6;
        }

        // If we have a map, convert its objects to 2D walls
        if let Some(map) = map {
            for obj in &map.objects {
                let pos = obj.get_position();
                let scale = obj.get_scale();

                // Convert 3D position to 2D grid coordinates
                // Map spans from -25 to 25, grid spans from 0 to 49
                let center_x = ((pos.x + 25.0) / 50.0 * width as f32) as i32;
                let center_z = ((pos.z + 25.0) / 50.0 * height as f32) as i32;

                // Create wall blocks based on object size
                let size_x = (scale.x / 2.0).max(0.5) as i32;
                let size_z = (scale.z / 2.0).max(0.5) as i32;

                // Fill in the grid cells covered by this object
                for dx in -size_x..=size_x {
                    for dz in -size_z..=size_z {
                        let grid_x = center_x + dx;
                        let grid_z = center_z + dz;

                        if grid_x >= 0 && grid_x < width as i32 && grid_z >= 0 && grid_z < height as i32 {
                            // Determine wall type based on object color
                            let color_r = obj.color_r;
                            let color_g = obj.color_g;
                            let color_b = obj.color_b;

                            let wall_type = if color_r > 200 && color_g < 100 && color_b < 100 {
                                2 // Red
                            } else if color_r < 100 && color_g > 200 && color_b < 100 {
                                3 // Green
                            } else if color_r < 100 && color_g < 100 && color_b > 200 {
                                4 // Blue
                            } else if color_r > 200 && color_g > 200 && color_b < 100 {
                                5 // Yellow
                            } else {
                                1 // Default gray
                            };

                            map2d.grid[grid_x as usize][grid_z as usize] = wall_type;
                        }
                    }
                }
            }
        }

        map2d
    }
}
