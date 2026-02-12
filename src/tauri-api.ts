import { invoke } from '@tauri-apps/api/tauri';
import type { PromptFile, WorkspaceItem } from './types';

export async function getWorkspaceItems(workspacePath: string): Promise<WorkspaceItem[]> {
  try {
    return await invoke('get_workspace_items', { workspacePath });
  } catch (error) {
    console.error('Failed to get workspace items:', error);
    return [];
  }
}

export async function createPromptFile(workspacePath: string, name: string): Promise<string> {
  try {
    return await invoke('create_prompt_file', { workspacePath, name });
  } catch (error) {
    console.error('Failed to create prompt file:', error);
    throw error;
  }
}

export async function loadPromptFile(filePath: string): Promise<PromptFile> {
  try {
    const data = await invoke('load_prompt_file', { filePath }) as PromptFile;
    // 确保新字段存在
    if (!data.file_boxes) {
      data.file_boxes = {};
    }
    if (!data.file_box_data) {
      data.file_box_data = {};
    }
    return data;
  } catch (error) {
    console.error('Failed to load prompt file:', error);
    throw error;
  }
}

export async function savePromptFile(filePath: string, promptFile: PromptFile): Promise<void> {
  try {
    await invoke('save_prompt_file', { filePath, promptFile });
  } catch (error) {
    console.error('Failed to save prompt file:', error);
    throw error;
  }
}

export async function renamePromptFile(oldPath: string, newName: string): Promise<string> {
  try {
    return await invoke('rename_prompt_file', { oldPath, newName });
  } catch (error) {
    console.error('Failed to rename prompt file:', error);
    throw error;
  }
}

export async function deletePromptFile(filePath: string): Promise<void> {
  try {
    await invoke('delete_prompt_file', { filePath });
  } catch (error) {
    console.error('Failed to delete prompt file:', error);
    throw error;
  }
}

export async function copyPromptFile(filePath: string, newName: string): Promise<string> {
  try {
    return await invoke('copy_prompt_file', { filePath, newName });
  } catch (error) {
    console.error('Failed to copy prompt file:', error);
    throw error;
  }
}

export async function generateContext(promptFile: PromptFile): Promise<string> {
  try {
    return await invoke('generate_context', { promptFile });
  } catch (error) {
    console.error('Failed to generate context:', error);
    throw error;
  }
}

export async function readFileContent(filePath: string): Promise<string> {
  try {
    return await invoke('read_file', { filePath });
  } catch (error) {
    console.error('Failed to read file:', error);
    throw error;
  }
}
