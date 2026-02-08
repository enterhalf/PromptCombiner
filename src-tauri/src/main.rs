use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TextBox {
    pub id: String,
    pub title: String,
    pub content: String,
    pub mode: String,
    #[serde(default)]
    pub current_variant_index: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Separator {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VariantData {
    pub height: u32,
    pub current_variant_index: usize,
    #[serde(default)]
    pub variant_data: Vec<String>,
    #[serde(default)]
    pub titles: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PromptFile {
    pub name: String,
    pub order: Vec<String>,
    pub text_boxes: std::collections::HashMap<String, TextBox>,
    pub variants: std::collections::HashMap<String, VariantData>,
    pub separators: Vec<Separator>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceItem {
    pub name: String,
    pub path: String,
    pub is_file: bool,
}

#[command]
fn get_workspace_items(workspace_path: String) -> Result<Vec<WorkspaceItem>, String> {
    let path = Path::new(&workspace_path);

    if !path.exists() {
        if let Err(e) = fs::create_dir_all(path) {
            return Err(format!("Failed to create workspace: {}", e));
        }
    }

    let mut items = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Some(name) = entry.file_name().to_str() {
                    let file_path = entry.path();
                    let is_file = file_path.is_file();

                    if is_file && name.ends_with(".prompt") || !is_file {
                        items.push(WorkspaceItem {
                            name: name.to_string(),
                            path: file_path.to_string_lossy().to_string(),
                            is_file,
                        });
                    }
                }
            }
        }
    }

    items.sort_by(|a, b| {
        if a.is_file == b.is_file {
            a.name.cmp(&b.name)
        } else if !a.is_file {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(items)
}

#[command]
fn create_prompt_file(workspace_path: String, name: String) -> Result<String, String> {
    let file_name = if name.ends_with(".prompt") {
        name
    } else {
        format!("{}.prompt", name)
    };

    let file_path = Path::new(&workspace_path).join(&file_name);

    let prompt_file = PromptFile {
        name: file_name.clone(),
        order: vec![],
        text_boxes: std::collections::HashMap::new(),
        variants: std::collections::HashMap::new(),
        separators: vec![],
    };

    let content = serde_json::to_string_pretty(&prompt_file)
        .map_err(|e| format!("Failed to serialize: {}", e))?;

    fs::write(&file_path, content).map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[command]
fn load_prompt_file(file_path: String) -> Result<PromptFile, String> {
    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let prompt_file: PromptFile =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse file: {}", e))?;

    Ok(prompt_file)
}

#[command]
fn save_prompt_file(file_path: String, prompt_file: PromptFile) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&prompt_file)
        .map_err(|e| format!("Failed to serialize: {}", e))?;

    fs::write(&file_path, content).map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(())
}

#[command]
fn rename_prompt_file(old_path: String, new_name: String) -> Result<String, String> {
    let old_file_path = Path::new(&old_path);
    let parent = old_file_path.parent().ok_or("Invalid file path")?;

    let file_name = if new_name.ends_with(".prompt") {
        new_name
    } else {
        format!("{}.prompt", new_name)
    };

    let new_file_path = parent.join(&file_name);

    fs::rename(&old_file_path, &new_file_path)
        .map_err(|e| format!("Failed to rename file: {}", e))?;

    Ok(new_file_path.to_string_lossy().to_string())
}

#[command]
fn delete_prompt_file(file_path: String) -> Result<(), String> {
    fs::remove_file(&file_path).map_err(|e| format!("Failed to delete file: {}", e))?;

    Ok(())
}

#[command]
fn copy_prompt_file(file_path: String, new_name: String) -> Result<String, String> {
    let old_file_path = Path::new(&file_path);
    let parent = old_file_path.parent().ok_or("Invalid file path")?;

    let file_name = if new_name.ends_with(".prompt") {
        new_name
    } else {
        format!("{}.prompt", new_name)
    };

    let new_file_path = parent.join(&file_name);

    fs::copy(&old_file_path, &new_file_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(new_file_path.to_string_lossy().to_string())
}

#[command]
fn generate_context(prompt_file: PromptFile) -> Result<String, String> {
    let mut result = String::new();
    let mut separator_map = std::collections::HashMap::new();

    for sep in &prompt_file.separators {
        separator_map.insert(&sep.id, sep.content.clone());
    }

    let mut shadow_vars = std::collections::HashMap::new();

    for text_box in prompt_file.text_boxes.values() {
        if text_box.mode == "shadow" {
            let var_name = text_box.title.trim().to_lowercase().replace(' ', "_");
            shadow_vars.insert(var_name, text_box.content.clone());
        }
    }

    let mut last_separator = "\n\n".to_string();

    for (index, text_box_id) in prompt_file.order.iter().enumerate() {
        if let Some(text_box) = prompt_file.text_boxes.get(text_box_id) {
            if text_box.mode == "disabled" {
                continue;
            }

            if index > 0 {
                if let Some(sep) = separator_map.get(&format!("sep_{}", index - 1)) {
                    last_separator = sep.clone();
                }
                result.push_str(&last_separator);
            }

            let mut content = text_box.content.clone();

            for (key, value) in &shadow_vars {
                let placeholder = format!("{{{{{}}}}}", key);
                content = content.replace(&placeholder, value);
            }

            result.push_str(&content);
        }
    }

    Ok(result)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_workspace_items,
            create_prompt_file,
            load_prompt_file,
            save_prompt_file,
            rename_prompt_file,
            delete_prompt_file,
            copy_prompt_file,
            generate_context
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
