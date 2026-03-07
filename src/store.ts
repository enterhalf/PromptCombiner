import { writable, get } from "svelte/store";
import type { AppState, PromptFile, VariantData, Tab } from "./types";
import { savePromptFile, loadPromptFile } from "./tauri-api";
import { basename } from "@tauri-apps/api/path";

// 清理变体数据：如果标题以 "！" 或 "!" 开头，则将内容设为空字符串（不保存到本地）
function cleanVariantDataForSave(promptFile: PromptFile): PromptFile {
  const cleanedVariants: Record<string, VariantData> = {};

  for (const [id, variantData] of Object.entries(promptFile.variants)) {
    cleanedVariants[id] = {
      ...variantData,
      variants: variantData.variants.map((variant) => {
        const title = variant.title || "";
        // 如果标题以 "！" 或 "!" 开头，则清空内容（不保存超长文本到配置文件）
        if (title.startsWith("！") || title.startsWith("!")) {
          return { ...variant, content: "" };
        }
        return variant;
      }),
    };
  }

  return {
    ...promptFile,
    variants: cleanedVariants,
  };
}

const RECENT_FILES_KEY = "prompt-combiner-recent-files";
const MAX_RECENT_FILES = 10;
const MAX_HISTORY_STEPS = 64;

function getStoredRecentFiles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentFiles(files: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(files));
  } catch (error) {
    console.error("Failed to save recent files:", error);
  }
}

function generateTabId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function createEmptyPromptFile(): PromptFile {
  return {
    order: [],
    variants: {},
    text_boxes: {},
    file_boxes: {},
    file_box_data: {},
    separators: [],
  };
}

const defaultState: AppState = {
  tabs: [],
  activeTabId: null,
  currentFile: null,
  currentFileName: "",
  currentFilePath: "",
  activeTab: "files",
  generatedText: "",
  showGeneratedModal: false,
  recentFiles: getStoredRecentFiles(),
  toasts: [],
};

let autoSaveTimeout: number | null = null;

// 历史记录管理
interface HistoryState {
  past: PromptFile[];
  present: PromptFile | null;
  future: PromptFile[];
}

function createHistoryManager() {
  const { subscribe, set, update } = writable<HistoryState>({
    past: [],
    present: null,
    future: [],
  });

  return {
    subscribe,
    push: (newPresent: PromptFile) => {
      update((state) => {
        // 如果新状态和当前状态相同，不添加历史记录
        if (JSON.stringify(state.present) === JSON.stringify(newPresent)) {
          return state;
        }
        const newPast = state.present
          ? [...state.past, state.present].slice(-MAX_HISTORY_STEPS)
          : state.past;
        return {
          past: newPast,
          present: newPresent,
          future: [],
        };
      });
    },
    undo: (): PromptFile | null => {
      let result: PromptFile | null = null;
      update((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, -1);
        result = previous;
        return {
          past: newPast,
          present: previous,
          future: state.present
            ? [state.present, ...state.future]
            : state.future,
        };
      });
      return result;
    },
    redo: (): PromptFile | null => {
      let result: PromptFile | null = null;
      update((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        result = next;
        return {
          past: state.present ? [...state.past, state.present] : state.past,
          present: next,
          future: newFuture,
        };
      });
      return result;
    },
    canUndo: () => {
      const state = get({ subscribe });
      return state.past.length > 0;
    },
    canRedo: () => {
      const state = get({ subscribe });
      return state.future.length > 0;
    },
    reset: () => {
      set({ past: [], present: null, future: [] });
    },
    setPresent: (present: PromptFile | null) => {
      // 设置当前状态并清空历史记录（用于初始化新文件状态）
      set({ past: [], present, future: [] });
    },
  };
}

export const historyManager = createHistoryManager();

function createAppStore() {
  const { subscribe, set, update } = writable<AppState>(defaultState);

  async function autoSave() {
    const state = get(appStore);
    if (state.currentFile && state.currentFilePath) {
      try {
        const cleanedFile = cleanVariantDataForSave(state.currentFile);
        await savePromptFile(state.currentFilePath, cleanedFile);
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
        const cleanedFile = cleanVariantDataForSave(state.currentFile);
        await savePromptFile(filePath, cleanedFile);
        return true;
      } catch (error) {
        console.error("Save failed:", error);
        return false;
      }
    }
    return false;
  }

  async function saveCurrentFile() {
    const state = get(appStore);
    if (state.currentFile && state.currentFilePath) {
      try {
        const cleanedFile = cleanVariantDataForSave(state.currentFile);
        await savePromptFile(state.currentFilePath, cleanedFile);
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
    addRecentFile: (filePath: string) => {
      update((s) => {
        const newRecentFiles = [
          filePath,
          ...s.recentFiles.filter((f) => f !== filePath),
        ].slice(0, MAX_RECENT_FILES);
        saveRecentFiles(newRecentFiles);
        return {
          ...s,
          recentFiles: newRecentFiles,
        };
      });
    },
    createNewTab: (
      file: PromptFile | null = createEmptyPromptFile(),
      fileName: string = "Untitled",
      filePath: string = "",
      isUnsaved: boolean = true
    ) => {
      update((s) => {
        const newTabId = generateTabId();
        const newTab: Tab = {
          id: newTabId,
          file,
          fileName,
          filePath,
          isUnsaved,
        };
        const newTabs = [...s.tabs, newTab];
        return {
          ...s,
          tabs: newTabs,
          activeTabId: newTabId,
          currentFile: file,
          currentFileName: fileName,
          currentFilePath: filePath,
        };
      });
      if (file) {
        historyManager.setPresent(file);
      }
    },
    openFileInTab: async (filePath: string) => {
      try {
        const promptFile = await loadPromptFile(filePath);
        const fileName = await basename(filePath);
        
        update((s) => {
          const existingTab = s.tabs.find(tab => tab.filePath === filePath);
          if (existingTab) {
            return {
              ...s,
              activeTabId: existingTab.id,
              currentFile: existingTab.file,
              currentFileName: existingTab.fileName,
              currentFilePath: existingTab.filePath,
            };
          }
          
          const newTabId = generateTabId();
          const newTab: Tab = {
            id: newTabId,
            file: promptFile,
            fileName,
            filePath,
            isUnsaved: false,
          };
          const newTabs = [...s.tabs, newTab];
          
          return {
            ...s,
            tabs: newTabs,
            activeTabId: newTabId,
            currentFile: promptFile,
            currentFileName: fileName,
            currentFilePath: filePath,
          };
        });
        
        appStore.addRecentFile(filePath);
      } catch (error) {
        console.error("Failed to load file in tab:", error);
        appStore.showToast("Failed to load file", "error");
      }
    },
    switchTab: (tabId: string) => {
      update((s) => {
        const tab = s.tabs.find(t => t.id === tabId);
        if (!tab) return s;
        
        return {
          ...s,
          activeTabId: tabId,
          currentFile: tab.file,
          currentFileName: tab.fileName,
          currentFilePath: tab.filePath,
        };
      });
      
      const state = get(appStore);
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      if (activeTab?.file) {
        historyManager.setPresent(activeTab.file);
      }
    },
    closeTab: (tabId: string) => {
      update((s) => {
        const tabIndex = s.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return s;
        
        const newTabs = s.tabs.filter(t => t.id !== tabId);
        let newActiveTabId = s.activeTabId;
        let newCurrentFile = s.currentFile;
        let newCurrentFileName = s.currentFileName;
        let newCurrentFilePath = s.currentFilePath;
        
        if (s.activeTabId === tabId) {
          if (newTabs.length > 0) {
            const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
            const newActiveTab = newTabs[newActiveIndex];
            newActiveTabId = newActiveTab.id;
            newCurrentFile = newActiveTab.file;
            newCurrentFileName = newActiveTab.fileName;
            newCurrentFilePath = newActiveTab.filePath;
          } else {
            newActiveTabId = null;
            newCurrentFile = null;
            newCurrentFileName = "";
            newCurrentFilePath = "";
          }
        }
        
        return {
          ...s,
          tabs: newTabs,
          activeTabId: newActiveTabId,
          currentFile: newCurrentFile,
          currentFileName: newCurrentFileName,
          currentFilePath: newCurrentFilePath,
        };
      });
      
      const state = get(appStore);
      if (state.activeTabId) {
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (activeTab?.file) {
          historyManager.setPresent(activeTab.file);
        }
      } else {
        historyManager.reset();
      }
    },
    markTabUnsaved: () => {
      update((s) => {
        if (!s.activeTabId) return s;
        const newTabs = s.tabs.map(tab => {
          if (tab.id === s.activeTabId) {
            return { ...tab, file: s.currentFile, isUnsaved: true };
          }
          return tab;
        });
        return { ...s, tabs: newTabs };
      });
    },
    markTabSaved: () => {
      update((s) => {
        if (!s.activeTabId) return s;
        const newTabs = s.tabs.map(tab => {
          if (tab.id === s.activeTabId) {
            return { ...tab, isUnsaved: false };
          }
          return tab;
        });
        return { ...s, tabs: newTabs };
      });
    },
    updateActiveTabInfo: (fileName?: string, filePath?: string) => {
      update((s) => {
        if (!s.activeTabId) return s;
        const newTabs = s.tabs.map(tab => {
          if (tab.id === s.activeTabId) {
            return {
              ...tab,
              fileName: fileName !== undefined ? fileName : tab.fileName,
              filePath: filePath !== undefined ? filePath : tab.filePath,
              file: s.currentFile,
            };
          }
          return tab;
        });
        return { ...s, tabs: newTabs };
      });
    },
    setCurrentFile: (
      file: PromptFile | null,
      fileName?: string,
      filePath?: string,
      skipHistory = false
    ) => {
      update((s) => ({
        ...s,
        currentFile: file,
        currentFileName: fileName !== undefined ? fileName : s.currentFileName,
        currentFilePath: filePath !== undefined ? filePath : s.currentFilePath,
      }));
      
      appStore.markTabUnsaved();
      
      // 记录历史（除非是撤销/重做操作或初始化）
      if (file && !skipHistory) {
        historyManager.push(file);
      } else if (file && skipHistory) {
        // 初始化历史记录状态，但不添加到历史记录中
        historyManager.setPresent(file);
      } else if (file === null) {
        historyManager.reset();
      }
      triggerAutoSave();
    },
    undo: () => {
      const previousState = historyManager.undo();
      if (previousState) {
        update((s) => ({
          ...s,
          currentFile: previousState,
        }));
        triggerAutoSave();
        return true;
      }
      return false;
    },
    redo: () => {
      const nextState = historyManager.redo();
      if (nextState) {
        update((s) => ({
          ...s,
          currentFile: nextState,
        }));
        triggerAutoSave();
        return true;
      }
      return false;
    },
    setCurrentFileName: (fileName: string) =>
      update((s) => ({ ...s, currentFileName: fileName })),
    setCurrentFilePath: (filePath: string) =>
      update((s) => ({ ...s, currentFilePath: filePath })),
    setActiveTab: (tab: "files" | "workbench") =>
      update((s) => ({ ...s, activeTab: tab })),
    setGeneratedText: (text: string) =>
      update((s) => ({ ...s, generatedText: text })),
    setShowGeneratedModal: (show: boolean) =>
      update((s) => ({ ...s, showGeneratedModal: show })),
    showToast: (message: string, type: "success" | "error" | "info" = "info") => {
      const id = Math.random().toString(36).substr(2, 9);
      update((s) => ({
        ...s,
        toasts: [...s.toasts, { id, message, type }],
      }));
      // 3秒后自动移除
      setTimeout(() => {
        update((s) => ({
          ...s,
          toasts: s.toasts.filter((t) => t.id !== id),
        }));
      }, 3000);
    },
    removeRecentFile: (filePath: string) => {
      update((s) => {
        const newRecentFiles = s.recentFiles.filter((f) => f !== filePath);
        saveRecentFiles(newRecentFiles);
        return { ...s, recentFiles: newRecentFiles };
      });
    },
    reset: () => set(defaultState),
    saveCurrentFile,
  };
}

export const appStore = createAppStore();
