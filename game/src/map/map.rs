use raylib::prelude::*;
use serde::{Deserialize, Serialize};

/// Maximum world size (200x200 units)
pub const WORLD_SIZE: f32 = 200.0;
pub const WORLD_HALF_SIZE: f32 = WORLD_SIZE / 2.0;

/// Types of 3D models that can be placed in the map
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ModelType {
    Cube,
    Triangle,
    Sphere,
    Cylinder,
    Plane,
}

/// Compact representation of a 3D object in the map
/// Uses 16-bit integers for positions and rotations to save space
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapObject {
    /// Model type
    pub model_type: ModelType,

    /// Position (stored as i16, converted to/from f32)
    /// Range: -100.0 to 100.0 (scaled from i16 range)
    pub pos_x: i16,
    pub pos_y: i16,
    pub pos_z: i16,

    /// Rotation in degrees (0-360, stored as u16)
    pub rot_x: u16,
    pub rot_y: u16,
    pub rot_z: u16,

    /// Scale (stored as u8, divided by 10 to get actual scale)
    /// Range: 0.1 to 25.5
    pub scale_x: u8,
    pub scale_y: u8,
    pub scale_z: u8,

    /// Color (RGB)
    pub color_r: u8,
    pub color_g: u8,
    pub color_b: u8,
}

impl MapObject {
    /// Create a new map object with default values
    pub fn new(model_type: ModelType) -> Self {
        Self {
            model_type,
            pos_x: 0,
            pos_y: 0,
            pos_z: 0,
            rot_x: 0,
            rot_y: 0,
            rot_z: 0,
            scale_x: 10, // 1.0 scale
            scale_y: 10,
            scale_z: 10,
            color_r: 255,
            color_g: 255,
            color_b: 255,
        }
    }

    /// Get position as Vector3
    pub fn get_position(&self) -> Vector3 {
        Vector3::new(
            self.pos_x as f32 / 100.0,
            self.pos_y as f32 / 100.0,
            self.pos_z as f32 / 100.0,
        )
    }

    /// Set position from Vector3 (clamped to world bounds)
    pub fn set_position(&mut self, pos: Vector3) {
        self.pos_x = (pos.x.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE) * 100.0) as i16;
        self.pos_y = (pos.y.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE) * 100.0) as i16;
        self.pos_z = (pos.z.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE) * 100.0) as i16;
    }

    /// Get rotation as Vector3 (in degrees)
    pub fn get_rotation(&self) -> Vector3 {
        Vector3::new(
            self.rot_x as f32,
            self.rot_y as f32,
            self.rot_z as f32,
        )
    }

    /// Set rotation from Vector3 (in degrees, wrapped to 0-360)
    pub fn set_rotation(&mut self, rot: Vector3) {
        self.rot_x = (rot.x.rem_euclid(360.0)) as u16;
        self.rot_y = (rot.y.rem_euclid(360.0)) as u16;
        self.rot_z = (rot.z.rem_euclid(360.0)) as u16;
    }

    /// Get scale as Vector3
    pub fn get_scale(&self) -> Vector3 {
        Vector3::new(
            self.scale_x as f32 / 10.0,
            self.scale_y as f32 / 10.0,
            self.scale_z as f32 / 10.0,
        )
    }

    /// Set scale from Vector3
    pub fn set_scale(&mut self, scale: Vector3) {
        self.scale_x = (scale.x.clamp(0.1, 25.5) * 10.0) as u8;
        self.scale_y = (scale.y.clamp(0.1, 25.5) * 10.0) as u8;
        self.scale_z = (scale.z.clamp(0.1, 25.5) * 10.0) as u8;
    }

    /// Get color as Raylib Color
    pub fn get_color(&self) -> Color {
        Color::new(self.color_r, self.color_g, self.color_b, 255)
    }

    /// Set color from Raylib Color
    pub fn set_color(&mut self, color: Color) {
        self.color_r = color.r;
        self.color_g = color.g;
        self.color_b = color.b;
    }

    /// Draw this object using Raylib
    pub fn draw(&self, d: &mut RaylibMode3D<RaylibDrawHandle>) {
        let position = self.get_position();
        let _rotation = self.get_rotation();
        let scale = self.get_scale();
        let color = self.get_color();

        match self.model_type {
            ModelType::Cube => {
                d.draw_cube(
                    position,
                    scale.x,
                    scale.y,
                    scale.z,
                    color,
                );
            }
            ModelType::Triangle => {
                // Draw a triangular prism
                d.draw_triangle3D(
                    Vector3::new(position.x - scale.x / 2.0, position.y, position.z),
                    Vector3::new(position.x + scale.x / 2.0, position.y, position.z),
                    Vector3::new(position.x, position.y + scale.y, position.z),
                    color,
                );
            }
            ModelType::Sphere => {
                d.draw_sphere(position, scale.x.max(scale.y).max(scale.z) / 2.0, color);
            }
            ModelType::Cylinder => {
                d.draw_cylinder(
                    position,
                    scale.x / 2.0,
                    scale.z / 2.0,
                    scale.y,
                    16,
                    color,
                );
            }
            ModelType::Plane => {
                d.draw_plane(
                    position,
                    Vector2::new(scale.x, scale.z),
                    color,
                );
            }
        }
    }
}

/// Map data structure - designed to fit in ~10KB
/// At 24 bytes per object, we can store ~400 objects in 10KB
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Map {
    /// Map metadata
    pub name: String,
    pub version: u8,

    /// Collection of map objects
    pub objects: Vec<MapObject>,

    /// Spawn point for players
    pub spawn_x: i16,
    pub spawn_y: i16,
    pub spawn_z: i16,
}

impl Map {
    /// Create a new empty map
    pub fn new(name: String) -> Self {
        Self {
            name,
            version: 1,
            objects: Vec::new(),
            spawn_x: 0,
            spawn_y: 1000, // 10.0 units up
            spawn_z: 0,
        }
    }

    /// Add an object to the map
    pub fn add_object(&mut self, object: MapObject) {
        self.objects.push(object);
    }

    /// Remove an object by index
    pub fn remove_object(&mut self, index: usize) -> Option<MapObject> {
        if index < self.objects.len() {
            Some(self.objects.remove(index))
        } else {
            None
        }
    }

    /// Get spawn position as Vector3
    pub fn get_spawn_position(&self) -> Vector3 {
        Vector3::new(
            self.spawn_x as f32 / 100.0,
            self.spawn_y as f32 / 100.0,
            self.spawn_z as f32 / 100.0,
        )
    }

    /// Set spawn position
    pub fn set_spawn_position(&mut self, pos: Vector3) {
        self.spawn_x = (pos.x.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE) * 100.0) as i16;
        self.spawn_y = (pos.y.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE) * 100.0) as i16;
        self.spawn_z = (pos.z.clamp(-WORLD_HALF_SIZE, WORLD_HALF_SIZE) * 100.0) as i16;
    }

    /// Render all objects in the map
    pub fn render(&self, d: &mut RaylibMode3D<RaylibDrawHandle>) {
        for object in &self.objects {
            object.draw(d);
        }
    }

    /// Save map to JSON bytes
    pub fn to_json_bytes(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    /// Load map from JSON bytes
    pub fn from_json_bytes(bytes: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(bytes)
    }

    /// Get estimated size in bytes
    pub fn estimated_size(&self) -> usize {
        // Rough estimate: 24 bytes per object + metadata
        self.objects.len() * 24 + 100
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_object_position() {
        let mut obj = MapObject::new(ModelType::Cube);
        obj.set_position(Vector3::new(10.5, -5.2, 3.7));
        let pos = obj.get_position();
        assert!((pos.x - 10.5).abs() < 0.1);
        assert!((pos.y - -5.2).abs() < 0.1);
        assert!((pos.z - 3.7).abs() < 0.1);
    }

    #[test]
    fn test_map_serialization() {
        let mut map = Map::new("Test Map".to_string());
        map.add_object(MapObject::new(ModelType::Cube));

        let bytes = map.to_json_bytes().unwrap();
        let loaded_map = Map::from_json_bytes(&bytes).unwrap();

        assert_eq!(loaded_map.name, "Test Map");
        assert_eq!(loaded_map.objects.len(), 1);
    }
}
