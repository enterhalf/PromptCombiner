import { writable, get } from "svelte/store";
import type { AppState, PromptFile, WorkspaceItem } from "./types";
import { savePromptFile } from "./tauri-api";

const RECENT_WORKSPACES_KEY = "prompt-combiner-recent-workspaces";
const MAX_RECENT_WORKSPACES = 10;

function getStoredRecentWorkspaces(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_WORKSPACES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentWorkspaces(workspaces: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(workspaces));
  } catch (error) {
    console.error("Failed to save recent workspaces:", error);
  }
}

const defaultState: AppState = {
  workspacePath: "",
  currentFile: null,
  currentFileName: "",
  workspaceItems: [],
  activeTab: "files",
  generatedText: "",
  showGeneratedModal: false,
  recentWorkspaces: getStoredRecentWorkspaces(),
};

let autoSaveTimeout: number | null = null;

function createAppStore() {
  const { subscribe, set, update } = writable<AppState>(defaultState);

  async function autoSave() {
    const state = get(appStore);
    if (state.currentFile && state.workspacePath && state.currentFileName) {
      try {
        const filePath = `${state.workspacePath}/${state.currentFileName}`;
        await savePromptFile(filePath, state.currentFile);
      } catch (error) {
        console.error("Auto-save failed:", error);
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
    if (state.currentFile && state.workspacePath && state.currentFileName) {
      try {
        const filePath = `${state.workspacePath}/${state.currentFileName}`;
        await savePromptFile(filePath, state.currentFile);
        return true;
      } catch (error) {
        console.error("Save failed:", error);
        return false;
      }
    }
    return false;
  }

  return {
    subscribe,
    setWorkspacePath: (path: string) => {
      update((s) => {
        let newRecentWorkspaces = s.recentWorkspaces;
        if (path) {
          newRecentWorkspaces = [
            path,
            ...s.recentWorkspaces.filter((w) => w !== path),
          ].slice(0, MAX_RECENT_WORKSPACES);
          saveRecentWorkspaces(newRecentWorkspaces);
        }
        return {
          ...s,
          workspacePath: path,
          recentWorkspaces: newRecentWorkspaces,
        };
      });
    },
    setCurrentFile: (file: PromptFile | null, fileName?: string) => {
      update((s) => ({
        ...s,
        currentFile: file,
        currentFileName: fileName !== undefined ? fileName : s.currentFileName,
      }));
      triggerAutoSave();
    },
    setCurrentFileName: (fileName: string) =>
      update((s) => ({ ...s, currentFileName: fileName })),
    setWorkspaceItems: (items: WorkspaceItem[]) =>
      update((s) => ({ ...s, workspaceItems: items })),
    setActiveTab: (tab: "files" | "workbench") =>
      update((s) => ({ ...s, activeTab: tab })),
    setGeneratedText: (text: string) =>
      update((s) => ({ ...s, generatedText: text })),
    setShowGeneratedModal: (show: boolean) =>
      update((s) => ({ ...s, showGeneratedModal: show })),
    removeRecentWorkspace: (path: string) => {
      update((s) => {
        const newRecentWorkspaces = s.recentWorkspaces.filter(
          (w) => w !== path
        );
        saveRecentWorkspaces(newRecentWorkspaces);
        return { ...s, recentWorkspaces: newRecentWorkspaces };
      });
    },
    reset: () => set(defaultState),
    saveCurrentFile,
  };
}

export const appStore = createAppStore();
