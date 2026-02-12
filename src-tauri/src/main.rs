#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TextBox {
    pub id: String,
    pub mode: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub box_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileBox {
    pub id: String,
    pub mode: String,
    #[serde(rename = "type")]
    pub box_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileBoxItem {
    pub id: String,
    pub path: String,
    pub checked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileBoxData {
    pub height: u32,
    pub path_segments: i32,
    pub files: Vec<FileBoxItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Variant {
    pub content: String,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VariantData {
    pub height: u32,
    pub current_variant_index: usize,
    pub variants: Vec<Variant>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Separator {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PromptFile {
    pub order: Vec<String>,
    pub text_boxes: std::collections::HashMap<String, TextBox>,
    pub file_boxes: Option<std::collections::HashMap<String, FileBox>>,
    pub file_box_data: Option<std::collections::HashMap<String, FileBoxData>>,
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
        order: vec![],
        text_boxes: std::collections::HashMap::new(),
        file_boxes: Some(std::collections::HashMap::new()),
        file_box_data: Some(std::collections::HashMap::new()),
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

// 获取显示的路径（根据 path_segments 截断）
fn get_display_path(full_path: &str, path_segments: i32) -> String {
    if path_segments < 1 {
        return full_path.to_string();
    }
    
    // 统一使用正斜杠处理路径
    let normalized_path = full_path.replace('\\', "/");
    let parts: Vec<&str> = normalized_path.split('/').filter(|p| !p.is_empty()).collect();
    
    if parts.len() <= path_segments as usize {
        return full_path.to_string();
    }
    
    // 保留最后 path_segments 个分段
    let start = parts.len() - path_segments as usize;
    let display_parts = &parts[start..];
    display_parts.join("/")
}

// 获取文件扩展名用于代码块语言标识
fn get_file_extension(file_path: &str) -> String {
    let parts: Vec<&str> = file_path.split('.').collect();
    if parts.len() > 1 {
        parts.last().unwrap().to_lowercase()
    } else {
        String::new()
    }
}

// 读取文件内容
fn read_file_content(file_path: &str) -> Result<String, String> {
    fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))
}

// 生成文件框内容
fn generate_file_box_content(
    file_box: &FileBox,
    file_box_data: &FileBoxData,
) -> Result<String, String> {
    if file_box.mode == "disabled" || file_box.mode == "shadow" {
        return Ok(String::new());
    }

    let path_segments = file_box_data.path_segments;
    let checked_files: Vec<&FileBoxItem> = file_box_data
        .files
        .iter()
        .filter(|f| f.checked)
        .collect();

    if checked_files.is_empty() {
        return Ok(String::new());
    }

    let mut result = String::new();

    for file in checked_files {
        if file.path.is_empty() {
            continue;
        }

        match read_file_content(&file.path) {
            Ok(content) => {
                let display_path = get_display_path(&file.path, path_segments);
                let ext = get_file_extension(&file.path);

                result.push_str(&format!("### {}\n", display_path));
                result.push_str(&format!("```{}\n", ext));
                result.push_str(&content);
                result.push_str("\n```\n\n");
            }
            Err(e) => {
                let display_path = get_display_path(&file.path, path_segments);
                result.push_str(&format!("### {}\n", display_path));
                result.push_str("```\n");
                result.push_str(&format!("[Error reading file: {}]", e));
                result.push_str("\n```\n\n");
            }
        }
    }

    Ok(result.trim().to_string())
}

#[command]
fn generate_context(prompt_file: PromptFile) -> Result<String, String> {
    let mut result = String::new();
    let mut separator_map = std::collections::HashMap::new();

    for sep in &prompt_file.separators {
        separator_map.insert(&sep.id, sep.content.clone());
    }

    let mut shadow_vars = std::collections::HashMap::new();

    // 收集 TextBox Shadow 变量
    for (text_box_id, text_box) in &prompt_file.text_boxes {
        if text_box.mode == "shadow" {
            if let Some(variant_data) = prompt_file.variants.get(text_box_id) {
                for variant in &variant_data.variants {
                    let var_name = variant.title.trim().to_lowercase().replace(' ', "_");
                    if !var_name.is_empty() {
                        shadow_vars.insert(var_name, variant.content.clone());
                    }
                }
            }
        }
    }

    let last_separator = "\n\n".to_string();
    let mut is_first_content = true;

    for box_id in prompt_file.order.iter() {
        let mut content = String::new();

        // 处理 TextBox
        if let Some(text_box) = prompt_file.text_boxes.get(box_id) {
            if text_box.mode != "disabled" && text_box.mode != "shadow" {
                if let Some(variant_data) = prompt_file.variants.get(box_id) {
                    let current_index = variant_data.current_variant_index;
                    if let Some(variant) = variant_data.variants.get(current_index) {
                        content = variant.content.clone();
                    }
                }

                // 替换 Shadow 变量
                for (key, value) in &shadow_vars {
                    let placeholder = format!("{{{{{}}}}}" , key);
                    content = content.replace(&placeholder, value);
                }
            }
        }

        // 处理 FileBox
        if let Some(file_boxes) = &prompt_file.file_boxes {
            if let Some(file_box_data_map) = &prompt_file.file_box_data {
                if let Some(file_box) = file_boxes.get(box_id) {
                    if let Some(file_box_data) = file_box_data_map.get(box_id) {
                        match generate_file_box_content(file_box, file_box_data) {
                            Ok(file_content) => {
                                if !file_content.is_empty() {
                                    if !content.is_empty() {
                                        content.push_str("\n\n");
                                    }
                                    content.push_str(&file_content);
                                }
                            }
                            Err(e) => {
                                eprintln!("Error generating file box content: {}", e);
                            }
                        }
                    }
                }
            }
        }

        if content.is_empty() {
            continue;
        }

        if !is_first_content {
            result.push_str(&last_separator);
        }
        is_first_content = false;
        result.push_str(&content);
    }

    Ok(result)
}

#[command]
fn read_file(file_path: String) -> Result<String, String> {
    read_file_content(&file_path)
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
            generate_context,
            read_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
