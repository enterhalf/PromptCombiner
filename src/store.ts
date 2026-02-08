import { writable, get } from 'svelte/store';
import type { AppState, PromptFile, WorkspaceItem } from './types';
import { savePromptFile } from './tauri-api';

const defaultState: AppState = {
  workspacePath: '',
  currentFile: null,
  workspaceItems: [],
  activeTab: 'files',
  generatedText: '',
  showGeneratedModal: false
};

let autoSaveTimeout: number | null = null;

function createAppStore() {
  const { subscribe, set, update } = writable<AppState>(defaultState);

  async function autoSave() {
    const state = get(appStore);
    if (state.currentFile && state.workspacePath) {
      try {
        const filePath = `${state.workspacePath}/${state.currentFile.name}`;
        await savePromptFile(filePath, state.currentFile);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }
  }

  function triggerAutoSave() {
    if (autoSaveTimeout !== null) {
      clearTimeout(autoSaveTimeout);
    }
    autoSaveTimeout = setTimeout(() => {
      autoSave();
    }, 2000) as unknown as number;
  }

  async function saveCurrentFile() {
    const state = get(appStore);
    if (state.currentFile && state.workspacePath) {
      try {
        const filePath = `${state.workspacePath}/${state.currentFile.name}`;
        await savePromptFile(filePath, state.currentFile);
        return true;
      } catch (error) {
        console.error('Save failed:', error);
        return false;
      }
    }
    return false;
  }

  return {
    subscribe,
    setWorkspacePath: (path: string) => update(s => ({ ...s, workspacePath: path })),
    setCurrentFile: (file: PromptFile | null) => {
      update(s => ({ ...s, currentFile: file }));
      triggerAutoSave();
    },
    setWorkspaceItems: (items: WorkspaceItem[]) => update(s => ({ ...s, workspaceItems: items })),
    setActiveTab: (tab: 'files' | 'workbench') => update(s => ({ ...s, activeTab: tab })),
    setGeneratedText: (text: string) => update(s => ({ ...s, generatedText: text })),
    setShowGeneratedModal: (show: boolean) => update(s => ({ ...s, showGeneratedModal: show })),
    reset: () => set(defaultState),
    saveCurrentFile
  };
}

export const appStore = createAppStore();
