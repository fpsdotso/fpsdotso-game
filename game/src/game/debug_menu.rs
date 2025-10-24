use raylib::prelude::*;
use crate::map::Map;

/// Debug menu for game development
pub struct DebugMenu {
    /// Path to map file to load
    pub map_path: String,

    /// Status message
    pub status_message: String,

    /// Whether to show file browser
    pub show_file_browser: bool,

    /// Available map files
    pub available_maps: Vec<String>,
}

impl DebugMenu {
    pub fn new() -> Self {
        Self {
            map_path: String::new(),
            status_message: "No map loaded".to_string(),
            show_file_browser: false,
            available_maps: Vec::new(),
        }
    }

    /// Trigger web file picker (for Emscripten/browser builds)
    #[cfg(target_os = "emscripten")]
    fn trigger_web_file_picker(&mut self) {
        use std::ffi::CString;

        extern "C" {
            pub fn emscripten_run_script(script: *const i8);
        }

        let js_code = r#"
        (function() {
            // Create a hidden file input element
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.fpssomap,.map,.json';
            input.style.display = 'none';

            input.onchange = async function(e) {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);

                    // Convert to base64 for passing to Rust
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64Data = btoa(binary);

                    // Store for Rust to access
                    Module.loadedWebMapData = base64Data;
                    Module.loadedWebMapName = file.name;

                    console.log('Map file loaded from web:', file.name);
                } catch (error) {
                    console.error('Error loading map file:', error);
                }

                // Clean up
                document.body.removeChild(input);
            };

            document.body.appendChild(input);
            input.click();
        })();
        "#;

        let c_str = CString::new(js_code).unwrap();
        unsafe {
            emscripten_run_script(c_str.as_ptr());
        }

        self.status_message = "Select a map file from your computer...".to_string();
    }

    /// Check if a map file has been loaded from web and load it
    #[cfg(target_os = "emscripten")]
    pub fn check_web_loaded_map(&mut self) -> Option<Map> {
        use std::ffi::CString;
        use base64::{Engine as _, engine::general_purpose};

        extern "C" {
            pub fn emscripten_run_script_string(script: *const i8) -> *const i8;
            pub fn emscripten_run_script(script: *const i8);
        }

        let js_check = CString::new("typeof Module.loadedWebMapData !== 'undefined' ? Module.loadedWebMapData : ''").unwrap();

        unsafe {
            let result_ptr = emscripten_run_script_string(js_check.as_ptr());
            if result_ptr.is_null() {
                return None;
            }

            let c_str = std::ffi::CStr::from_ptr(result_ptr);
            if let Ok(base64_str) = c_str.to_str() {
                if !base64_str.is_empty() {
                    // Decode base64
                    if let Ok(bytes) = general_purpose::STANDARD.decode(base64_str) {
                        // Get filename
                        let js_name = CString::new("typeof Module.loadedWebMapName !== 'undefined' ? Module.loadedWebMapName : 'unknown.map'").unwrap();
                        let name_ptr = emscripten_run_script_string(js_name.as_ptr());
                        let filename = if !name_ptr.is_null() {
                            std::ffi::CStr::from_ptr(name_ptr).to_str().unwrap_or("unknown.map").to_string()
                        } else {
                            "unknown.map".to_string()
                        };

                        // Parse map from bytes (try Borsh first, fall back to JSON)
                        let map_result = Map::from_borsh_bytes(&bytes)
                            .or_else(|_| Map::from_json_bytes(&bytes).map_err(|e| format!("{}", e)));

                        match map_result {
                            Ok(loaded_map) => {
                                self.status_message = format!("Map '{}' loaded successfully!", filename);
                                self.map_path = filename;

                                // Clear the JavaScript variables
                                let clear_js = CString::new("delete Module.loadedWebMapData; delete Module.loadedWebMapName;").unwrap();
                                emscripten_run_script(clear_js.as_ptr());

                                return Some(loaded_map);
                            }
                            Err(e) => {
                                self.status_message = format!("Failed to parse map: {}", e);

                                // Clear the JavaScript variables even on error
                                let clear_js = CString::new("delete Module.loadedWebMapData; delete Module.loadedWebMapName;").unwrap();
                                emscripten_run_script(clear_js.as_ptr());
                            }
                        }
                    }
                }
            }
        }

        None
    }

    #[cfg(not(target_os = "emscripten"))]
    fn trigger_web_file_picker(&mut self) {
        // Not available outside of browser
    }

    #[cfg(not(target_os = "emscripten"))]
    pub fn check_web_loaded_map(&mut self) -> Option<Map> {
        None
    }

    /// Scan for available maps in the maps directory
    pub fn scan_maps(&mut self) {
        self.available_maps.clear();

        if let Ok(entries) = std::fs::read_dir("maps") {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        if let Some(path_str) = entry.path().to_str() {
                            if path_str.ends_with(".fpssomap") || path_str.ends_with(".map") || path_str.ends_with(".json") {
                                self.available_maps.push(path_str.to_string());
                            }
                        }
                    }
                }
            }
        }

        self.available_maps.sort();
    }

    /// Draw the debug menu UI
    pub fn draw(&mut self, ui: &imgui::Ui) -> Option<Map> {
        let [window_width, window_height] = ui.io().display_size;

        let mut loaded_map = None;

        // Check if a map was loaded from web file picker
        if let Some(web_map) = self.check_web_loaded_map() {
            loaded_map = Some(web_map);
        }

        ui.window("Debug Menu")
            .position([window_width / 2.0 - 300.0, window_height / 2.0 - 200.0], imgui::Condition::FirstUseEver)
            .size([600.0, 400.0], imgui::Condition::FirstUseEver)
            .build(|| {
                ui.text_colored([0.2, 1.0, 0.5, 1.0], "FPS.SO - Debug Menu");
                ui.separator();
                ui.dummy([0.0, 10.0]);

                ui.text("Load Map:");
                ui.input_text("##map_path", &mut self.map_path)
                    .hint("Enter map file path...")
                    .build();

                ui.same_line();

                #[cfg(target_os = "emscripten")]
                {
                    if ui.button("Browse (Web)") {
                        // Trigger web file selection dialog
                        self.trigger_web_file_picker();
                    }
                }

                #[cfg(not(target_os = "emscripten"))]
                {
                    if ui.button("Browse") {
                        self.scan_maps();
                        self.show_file_browser = !self.show_file_browser;
                    }
                }

                ui.dummy([0.0, 5.0]);

                // File browser
                if self.show_file_browser {
                    ui.child_window("map_browser")
                        .size([0.0, 150.0])
                        .border(true)
                        .build(|| {
                            ui.text("Available Maps:");
                            ui.separator();

                            if self.available_maps.is_empty() {
                                ui.text_colored([0.7, 0.7, 0.0, 1.0], "No .map files found in 'maps/' directory");
                            } else {
                                for map_path in &self.available_maps.clone() {
                                    // Get just the filename
                                    let filename = std::path::Path::new(map_path)
                                        .file_name()
                                        .and_then(|n| n.to_str())
                                        .unwrap_or(map_path);

                                    if ui.button(filename) {
                                        self.map_path = map_path.clone();
                                        self.show_file_browser = false;
                                    }
                                }
                            }
                        });

                    ui.dummy([0.0, 5.0]);
                }

                let can_load = !self.map_path.is_empty();

                ui.dummy([0.0, 10.0]);

                if !can_load {
                    ui.text_disabled("LOAD MAP");
                } else {
                    let _load_color = ui.push_style_color(imgui::StyleColor::Button, [0.2, 0.8, 0.4, 1.0]);
                    let _load_hover = ui.push_style_color(imgui::StyleColor::ButtonHovered, [0.3, 0.9, 0.5, 1.0]);

                    if ui.button("LOAD MAP") {
                        // Try to load the map
                        match Map::load(&self.map_path) {
                            Ok(map) => {
                                self.status_message = format!("Map '{}' loaded successfully!", map.name);
                                loaded_map = Some(map);
                            }
                            Err(e) => {
                                self.status_message = format!("Failed to load map: {}", e);
                            }
                        }
                    }

                    drop(_load_color);
                    drop(_load_hover);
                }

                ui.dummy([0.0, 20.0]);
                ui.separator();
                ui.dummy([0.0, 10.0]);

                // Status
                ui.text("Status:");
                ui.text_wrapped(&self.status_message);

                ui.dummy([0.0, 20.0]);

                // Instructions
                ui.text_colored([0.7, 0.7, 0.7, 1.0], "Instructions:");
                ui.text_colored([0.7, 0.7, 0.7, 1.0], "• Load a map to start playing");
                ui.text_colored([0.7, 0.7, 0.7, 1.0], "• WASD to move, Mouse to look");
                ui.text_colored([0.7, 0.7, 0.7, 1.0], "• ESC to return to this menu");
            });

        loaded_map
    }
}
