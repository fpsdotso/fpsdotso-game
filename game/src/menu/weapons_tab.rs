use super::menu_state::MenuState;

#[derive(Debug, Clone)]
pub struct Weapon {
    pub name: String,
    pub weapon_type: String,
    pub damage: u32,
    pub fire_rate: u32,
    pub magazine_size: u32,
    pub price: u32,
}

pub struct WeaponsTab;

impl WeaponsTab {
    pub fn get_weapons() -> Vec<Weapon> {
        vec![
            // Rifles
            Weapon {
                name: "Phantom".to_string(),
                weapon_type: "Rifle".to_string(),
                damage: 39,
                fire_rate: 11,
                magazine_size: 30,
                price: 2900,
            },
            Weapon {
                name: "Vandal".to_string(),
                weapon_type: "Rifle".to_string(),
                damage: 40,
                fire_rate: 9,
                magazine_size: 25,
                price: 2900,
            },
            Weapon {
                name: "Guardian".to_string(),
                weapon_type: "Rifle".to_string(),
                damage: 65,
                fire_rate: 5,
                magazine_size: 12,
                price: 2250,
            },
            // SMGs
            Weapon {
                name: "Spectre".to_string(),
                weapon_type: "SMG".to_string(),
                damage: 26,
                fire_rate: 13,
                magazine_size: 30,
                price: 1600,
            },
            Weapon {
                name: "Stinger".to_string(),
                weapon_type: "SMG".to_string(),
                damage: 27,
                fire_rate: 16,
                magazine_size: 20,
                price: 1100,
            },
            // Snipers
            Weapon {
                name: "Operator".to_string(),
                weapon_type: "Sniper".to_string(),
                damage: 150,
                fire_rate: 0,
                magazine_size: 5,
                price: 4700,
            },
            Weapon {
                name: "Marshal".to_string(),
                weapon_type: "Sniper".to_string(),
                damage: 101,
                fire_rate: 1,
                magazine_size: 5,
                price: 950,
            },
            // Shotguns
            Weapon {
                name: "Judge".to_string(),
                weapon_type: "Shotgun".to_string(),
                damage: 17,
                fire_rate: 3,
                magazine_size: 7,
                price: 1850,
            },
            Weapon {
                name: "Bucky".to_string(),
                weapon_type: "Shotgun".to_string(),
                damage: 44,
                fire_rate: 1,
                magazine_size: 5,
                price: 850,
            },
            // Pistols
            Weapon {
                name: "Ghost".to_string(),
                weapon_type: "Pistol".to_string(),
                damage: 30,
                fire_rate: 6,
                magazine_size: 15,
                price: 500,
            },
            Weapon {
                name: "Sheriff".to_string(),
                weapon_type: "Pistol".to_string(),
                damage: 55,
                fire_rate: 4,
                magazine_size: 6,
                price: 800,
            },
        ]
    }

    pub fn draw(menu_state: &mut MenuState, ui: &imgui::Ui) {
        ui.dummy([0.0, 20.0]);

        // Title
        let _title_color = ui.push_style_color(imgui::StyleColor::Text, [0.08, 0.95, 0.58, 1.0]);
        ui.set_window_font_scale(1.5);
        ui.text("ARSENAL");
        ui.set_window_font_scale(1.0);
        drop(_title_color);

        ui.dummy([0.0, 10.0]);
        ui.separator();
        ui.dummy([0.0, 10.0]);

        let weapons = Self::get_weapons();

        // Create columns layout
        ui.columns(2, "weapons_layout", true);

        // Left column - weapon list
        ui.child_window("weapon_list")
            .size([0.0, 0.0])
            .border(true)
            .build(|| {
                ui.text("WEAPON LIST");
                ui.separator();
                ui.dummy([0.0, 5.0]);

                // Group weapons by type
                let mut current_type = "";

                for (i, weapon) in weapons.iter().enumerate() {
                    // Show category header when type changes
                    if weapon.weapon_type != current_type {
                        current_type = &weapon.weapon_type;
                        ui.dummy([0.0, 10.0]);
                        let _type_color = ui.push_style_color(imgui::StyleColor::Text, [0.60, 0.27, 1.0, 1.0]);
                        ui.text(format!("▼ {}", current_type.to_uppercase()));
                        drop(_type_color);
                        ui.separator();
                        ui.dummy([0.0, 5.0]);
                    }

                    let is_selected = menu_state.selected_weapon == Some(i);

                    // Weapon card
                    let bg_color = if is_selected {
                        [0.25, 0.18, 0.35, 1.0]
                    } else {
                        [0.12, 0.12, 0.15, 1.0]
                    };

                    let _card_bg = ui.push_style_color(imgui::StyleColor::ChildBg, bg_color);

                    ui.child_window(format!("weapon_{}", i))
                        .size([0.0, 80.0])
                        .border(true)
                        .build(|| {
                            ui.dummy([0.0, 5.0]);

                            // Weapon name
                            ui.set_window_font_scale(1.1);
                            ui.text(&weapon.name);
                            ui.set_window_font_scale(1.0);

                            ui.dummy([0.0, 5.0]);

                            // Price
                            let _price_color = ui.push_style_color(imgui::StyleColor::Text, [0.08, 0.95, 0.58, 1.0]);
                            ui.text(format!("${}", weapon.price));
                            drop(_price_color);

                            ui.same_line();
                            ui.dummy([150.0, 0.0]);
                            ui.same_line();

                            // Select button
                            if ui.button_with_size(format!("VIEW##{}", i), [80.0, 25.0]) {
                                menu_state.selected_weapon = Some(i);
                            }
                        });

                    drop(_card_bg);
                    ui.dummy([0.0, 5.0]);
                }
            });

        // Right column - weapon details
        ui.next_column();

        ui.child_window("weapon_details")
            .size([0.0, 0.0])
            .border(true)
            .build(|| {
                if let Some(selected_idx) = menu_state.selected_weapon {
                    if let Some(weapon) = weapons.get(selected_idx) {
                        ui.dummy([0.0, 20.0]);

                        // Weapon name
                        let _name_color = ui.push_style_color(imgui::StyleColor::Text, [0.95, 0.95, 0.98, 1.0]);
                        ui.set_window_font_scale(1.8);
                        ui.text(&weapon.name);
                        ui.set_window_font_scale(1.0);
                        drop(_name_color);

                        ui.dummy([0.0, 5.0]);

                        // Type
                        let _type_color = ui.push_style_color(imgui::StyleColor::Text, [0.60, 0.27, 1.0, 1.0]);
                        ui.text(&weapon.weapon_type);
                        drop(_type_color);

                        ui.dummy([0.0, 20.0]);
                        ui.separator();
                        ui.dummy([0.0, 20.0]);

                        // Stats
                        ui.text("STATISTICS");
                        ui.dummy([0.0, 10.0]);

                        // Damage
                        ui.text_colored([0.7, 0.7, 0.7, 1.0], "Damage");
                        ui.same_line();
                        ui.dummy([150.0, 0.0]);
                        ui.same_line();
                        ui.text(format!("{}", weapon.damage));

                        ui.dummy([0.0, 5.0]);

                        // Fire Rate
                        ui.text_colored([0.7, 0.7, 0.7, 1.0], "Fire Rate");
                        ui.same_line();
                        ui.dummy([150.0, 0.0]);
                        ui.same_line();
                        ui.text(format!("{} rounds/sec", weapon.fire_rate));

                        ui.dummy([0.0, 5.0]);

                        // Magazine Size
                        ui.text_colored([0.7, 0.7, 0.7, 1.0], "Magazine Size");
                        ui.same_line();
                        ui.dummy([150.0, 0.0]);
                        ui.same_line();
                        ui.text(format!("{} rounds", weapon.magazine_size));

                        ui.dummy([0.0, 20.0]);
                        ui.separator();
                        ui.dummy([0.0, 20.0]);

                        // Price
                        ui.text("COST");
                        ui.dummy([0.0, 5.0]);
                        let _price_color = ui.push_style_color(imgui::StyleColor::Text, [0.08, 0.95, 0.58, 1.0]);
                        ui.set_window_font_scale(1.5);
                        ui.text(format!("${}", weapon.price));
                        ui.set_window_font_scale(1.0);
                        drop(_price_color);

                        ui.dummy([0.0, 30.0]);

                        // Equip button
                        let _equip_btn = ui.push_style_color(imgui::StyleColor::Button, [0.38, 0.17, 0.60, 1.0]);
                        let _equip_hover = ui.push_style_color(imgui::StyleColor::ButtonHovered, [0.48, 0.25, 0.75, 1.0]);
                        if ui.button_with_size("EQUIP", [150.0, 40.0]) {
                            // TODO: Equip weapon logic
                        }
                        drop(_equip_btn);
                        drop(_equip_hover);
                    }
                } else {
                    ui.dummy([0.0, 200.0]);
                    let _hint_color = ui.push_style_color(imgui::StyleColor::Text, [0.5, 0.5, 0.5, 1.0]);
                    ui.text("Select a weapon to view details");
                    drop(_hint_color);
                }
            });

        ui.columns(1, "", false);
    }
}
