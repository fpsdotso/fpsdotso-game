# 3D Positional Audio Implementation Guide

## Overview
The JavaScript game bridge now detects when other players shoot by monitoring their `bullet_count` via WebSocket updates. When a decrease is detected, it calls `play3DSound()` to play audio at the shooter's 3D position.

## JavaScript Side (COMPLETED ✅)

### What Was Added:
1. **Bullet Count Tracking** (`game-bridge.js`)
   - `previousBulletCounts` object tracks each player's bullet count
   - Detects when bullet count decreases (player shot)
   - Excludes the current player (we don't play sound for our own shots)

2. **3D Sound Trigger Function**
   ```javascript
   function play3DShootingSound(x, y, z, playerPubkey) {
     // Debounces to prevent sound spam (100ms cooldown)
     // Calls window.gameBridge.play3DSound('shoot', x, y, z)
   }
   ```

3. **Game Bridge API**
   ```javascript
   window.gameBridge.play3DSound = (soundName, x, y, z) => {
     // Currently a stub - needs Rust implementation
   }
   ```

## Rust Side (TODO 🚧)

### What Needs to Be Implemented:

#### 1. **Add Raylib Audio Support**
In `game/src/game/game_state.rs`:

```rust
use raylib::audio::{RaylibAudio, Sound, Music};

pub struct GameState {
    // ... existing fields ...
    
    // Audio system
    audio: RaylibAudio,
    shoot_sound: Option<Sound>,
}
```

#### 2. **Load Sound Files**
In the `GameState::new()` constructor:

```rust
// Initialize audio
let audio = RaylibAudio::init_audio_device();

// Load shooting sound (add shoot.wav to assets/)
let shoot_sound = match audio.new_sound("assets/sounds/shoot.wav") {
    Ok(sound) => Some(sound),
    Err(e) => {
        eprintln!("Failed to load shoot sound: {}", e);
        None
    }
};
```

#### 3. **Implement play_3d_sound Function**
Add this function to `game_state.rs`:

```rust
/// Play 3D positional audio at a specific location
/// Volume and panning are calculated based on distance and direction from player
pub fn play_3d_sound(&self, sound_name: &str, x: f32, y: f32, z: f32) {
    if let Some(ref player) = self.player {
        // Calculate distance from player to sound source
        let dx = x - player.position.x;
        let dy = y - player.position.y;
        let dz = z - player.position.z;
        let distance = (dx * dx + dy * dy + dz * dz).sqrt();
        
        // Calculate volume based on distance (max 30 units)
        let max_distance = 30.0;
        let volume = (1.0 - (distance / max_distance).min(1.0)).max(0.0);
        
        // Calculate stereo panning based on relative position
        // Use player's yaw to determine left/right
        let yaw_rad = player.yaw.to_radians();
        let forward = Vector3::new(yaw_rad.cos(), 0.0, yaw_rad.sin());
        let right = Vector3::new(
            (yaw_rad + 90.0_f32.to_radians()).cos(),
            0.0,
            (yaw_rad + 90.0_f32.to_radians()).sin(),
        );
        
        // Project sound direction onto player's right vector
        let sound_dir = Vector3::new(dx, 0.0, dz).normalized();
        let pan = sound_dir.dot(right).clamp(-1.0, 1.0);
        
        // Play the sound with calculated volume and panning
        match sound_name {
            "shoot" => {
                if let Some(ref sound) = self.shoot_sound {
                    // Raylib audio functions
                    unsafe {
                        // Set volume (0.0 to 1.0)
                        raylib::ffi::SetSoundVolume(*sound, volume);
                        
                        // Set panning (-1.0 = left, 0.0 = center, 1.0 = right)
                        raylib::ffi::SetSoundPan(*sound, (pan + 1.0) / 2.0);
                        
                        // Play the sound
                        raylib::ffi::PlaySound(*sound);
                    }
                    
                    println!("🔊 Playing shoot sound at ({:.1}, {:.1}, {:.1}), distance: {:.1}, volume: {:.2}, pan: {:.2}", 
                        x, y, z, distance, volume, pan);
                }
            }
            _ => {
                println!("⚠️ Unknown sound: {}", sound_name);
            }
        }
    }
}
```

#### 4. **Expose to JavaScript via Emscripten**
Add this JavaScript binding function:

```rust
/// JavaScript callable function to play 3D sound
#[cfg(target_arch = "wasm32")]
pub fn register_play_3d_sound_callback(game_state: &mut GameState) {
    use wasm_bindgen::prelude::*;
    
    let js_code = r#"
        // Replace the stub with actual implementation
        window.gameBridge.play3DSound = function(soundName, x, y, z) {
            // Call Rust function via ccall
            if (Module && Module.ccall) {
                Module.ccall(
                    'play_3d_sound_from_js',  // C function name
                    null,                      // Return type
                    ['string', 'number', 'number', 'number'],  // Argument types
                    [soundName, x, y, z]       // Arguments
                );
            }
        };
        console.log("✅ 3D audio system initialized");
    "#;
    
    unsafe {
        emscripten_run_script(js_code.as_ptr() as *const i8);
    }
}

// Export C-callable function for JavaScript
#[no_mangle]
pub extern "C" fn play_3d_sound_from_js(
    sound_name_ptr: *const c_char,
    x: f32,
    y: f32,
    z: f32
) {
    unsafe {
        let sound_name = CStr::from_ptr(sound_name_ptr)
            .to_str()
            .unwrap_or("shoot");
        
        // Get game state from global or passed context
        // This requires storing a static reference or using a different approach
        // For now, we'll need to modify the architecture to support this
        
        // GAME_STATE.play_3d_sound(sound_name, x, y, z);
    }
}
```

#### 5. **Alternative: Direct JavaScript Eval Approach**
A simpler approach without ccall:

```rust
pub fn play_3d_sound_js(&self, sound_name: &str, x: f32, y: f32, z: f32) {
    // Call our Rust function directly
    self.play_3d_sound(sound_name, x, y, z);
}

// In game loop initialization:
let js_code = format!(r#"
    window.gameBridge.play3DSound = function(soundName, x, y, z) {{
        // Create a global flag that Rust can poll
        window.___pending_3d_sounds = window.___pending_3d_sounds || [];
        window.___pending_3d_sounds.push({{
            sound: soundName,
            x: x,
            y: y,
            z: z,
            timestamp: Date.now()
        }});
    }};
    console.log("✅ 3D audio system initialized (polling mode)");
"#);

unsafe { emscripten_run_script(js_code.as_ptr() as *const i8); }
```

Then in your update loop:
```rust
// Poll for pending 3D sounds from JavaScript
pub fn process_pending_3d_sounds(&mut self) {
    let js_code = r#"
        (function() {
            if (window.___pending_3d_sounds && window.___pending_3d_sounds.length > 0) {
                const sounds = JSON.stringify(window.___pending_3d_sounds);
                window.___pending_3d_sounds = [];
                return sounds;
            }
            return '[]';
        })()
    "#;
    
    unsafe {
        let result_ptr = emscripten_run_script_string(js_code.as_ptr() as *const i8);
        let result_str = CStr::from_ptr(result_ptr).to_str().unwrap_or("[]");
        
        // Parse JSON and play sounds
        if let Ok(sounds) = serde_json::from_str::<Vec<SoundEvent>>(result_str) {
            for sound in sounds {
                self.play_3d_sound(&sound.sound, sound.x, sound.y, sound.z);
            }
        }
    }
}

#[derive(Deserialize)]
struct SoundEvent {
    sound: String,
    x: f32,
    y: f32,
    z: f32,
}
```

## Testing

1. **Enable Audio Debug Logging**
   - Set `AUDIO` category to `true` in `debug-config.js`
   
2. **Test Scenario**
   - Create/join a game with 2+ players
   - Have another player shoot
   - You should see console log: `🔫 Player XXXXXXXX shot! Ammo: 10 → 9`
   - You should hear the shooting sound with volume/panning based on their position

3. **Verify 3D Effect**
   - Walk around the other player while they shoot
   - Sound should be louder when closer, quieter when farther
   - Sound should pan left/right based on their position relative to you

## Assets Needed

Add these sound files to `game/assets/sounds/`:
- `shoot.wav` - Gun firing sound
- `reload.wav` - (Optional) Reload sound
- `hit.wav` - (Optional) Bullet hit sound

## Future Enhancements

1. **More Sound Types**
   - Reload sounds
   - Footstep sounds
   - Hit marker sounds
   - Death sounds

2. **Sound Variations**
   - Multiple shot sounds (randomize)
   - Different sounds per weapon type

3. **Advanced 3D Audio**
   - HRTF (Head-Related Transfer Function) for better spatial audio
   - Reverb/echo effects based on environment
   - Distance-based low-pass filtering (muffled when far)

## References

- Raylib Audio API: https://docs.rs/raylib/latest/raylib/audio/
- WebAssembly Audio: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- 3D Audio Principles: https://en.wikipedia.org/wiki/3D_audio_effect
