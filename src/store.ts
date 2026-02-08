import { writable } from 'svelte/store';
import type { AppState, PromptFile, WorkspaceItem } from './types';

const defaultState: AppState = {
  workspacePath: '',
  currentFile: null,
  workspaceItems: [],
  activeTab: 'files',
  generatedText: '',
  showGeneratedModal: false
};

function createAppStore() {
  const { subscribe, set, update } = writable<AppState>(defaultState);

  return {
    subscribe,
    setWorkspacePath: (path: string) => update(s => ({ ...s, workspacePath: path })),
    setCurrentFile: (file: PromptFile | null) => update(s => ({ ...s, currentFile: file })),
    setWorkspaceItems: (items: WorkspaceItem[]) => update(s => ({ ...s, workspaceItems: items })),
    setActiveTab: (tab: 'files' | 'workbench') => update(s => ({ ...s, activeTab: tab })),
    setGeneratedText: (text: string) => update(s => ({ ...s, generatedText: text })),
    setShowGeneratedModal: (show: boolean) => update(s => ({ ...s, showGeneratedModal: show })),
    reset: () => set(defaultState)
  };
}

export const appStore = createAppStore();
