import { writable, get } from "svelte/store";
import type { AppState, PromptFile, VariantData, Tab, Plugin, PrivacyMapping } from "./types";
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

const PLUGINS_KEY = "prompt-combiner-plugins";
const PRIVACY_MAPPINGS_KEY = "prompt-combiner-privacy-mappings";

// 插件选项默认开关状态
const DEFAULT_PLUGINS: Plugin[] = [
  {
    id: "privacy-replace",
    name: "隐私信息替换",
    enabled: false,
    description: "生成提示词时自动替换敏感信息",
  },
  {
    // 开启后：新增变体不复制当前内容，而是创建空白变体（默认关闭 = 复制）
    id: "variant-blank-default",
    name: "新增变体默认空白",
    enabled: false,
    description:
      "开启后，新增变体不再复制当前变体内容，而是创建空白变体（默认关闭 = 复制内容）",
  },
];

function getStoredPlugins(): Plugin[] {
  const defaults = DEFAULT_PLUGINS.map((p) => ({ ...p }));
  if (typeof window === "undefined") return defaults;
  try {
    const stored = localStorage.getItem(PLUGINS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Plugin[];
      // 合并：保留老用户已保存的开关状态，同时补上后续版本新增的插件项
      const merged = DEFAULT_PLUGINS.map((def) => {
        const saved = parsed.find((p) => p.id === def.id);
        return saved ? { ...def, enabled: !!saved.enabled } : { ...def };
      });
      const extras = parsed.filter(
        (p) => p && !DEFAULT_PLUGINS.some((d) => d.id === p.id),
      );
      return [...merged, ...extras];
    }
  } catch {
    // 忽略错误
  }
  return defaults;
}

function savePlugins(plugins: Plugin[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PLUGINS_KEY, JSON.stringify(plugins));
  } catch (error) {
    console.error("Failed to save plugins:", error);
  }
}

function getStoredPrivacyMappings(): PrivacyMapping[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PRIVACY_MAPPINGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePrivacyMappings(mappings: PrivacyMapping[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRIVACY_MAPPINGS_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.error("Failed to save privacy mappings:", error);
  }
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
  plugins: getStoredPlugins(),
  privacyMappings: getStoredPrivacyMappings(),
  showPluginPanel: false,
  showPrivacyManager: false,
  showPrivacyRestore: false,
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

  // 保存所有"已落到磁盘"的标签页（关闭程序前调用，避免后台标签页的改动丢失）。
  // 未落盘的临时标签页（无 filePath）没有保存目标，直接跳过。
  async function saveAllTabs(): Promise<{ saved: string[]; failed: string[] }> {
    const state = get(appStore);
    const saved: string[] = [];
    const failed: string[] = [];

    for (const tab of state.tabs) {
      if (!tab.filePath) continue;
      // 当前激活标签页以 store 里的 currentFile 为准（撤销/重做等操作只会更新它）
      const file =
        tab.id === state.activeTabId ? state.currentFile : tab.file;
      if (!file) continue;
      try {
        const cleanedFile = cleanVariantDataForSave(file);
        await savePromptFile(tab.filePath, cleanedFile);
        saved.push(tab.filePath);
      } catch (error) {
        console.error("Failed to save tab:", tab.filePath, error);
        failed.push(tab.filePath);
      }
    }

    if (saved.length > 0) {
      const savedSet = new Set(saved);
      update((s) => ({
        ...s,
        tabs: s.tabs.map((t) =>
          t.filePath && savedSet.has(t.filePath) ? { ...t, isUnsaved: false } : t,
        ),
      }));
    }

    return { saved, failed };
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
    updateTabDisplayName: (tabId: string, displayName: string) => {
      update((s) => {
        const newTabs = s.tabs.map(tab => {
          if (tab.id === tabId) {
            return { ...tab, displayName };
          }
          return tab;
        });
        return { ...s, tabs: newTabs };
      });
    },
    reorderTabs: (tabIds: string[]) => {
      update((s) => {
        const newTabs = tabIds.map(id => s.tabs.find(tab => tab.id === id)).filter(Boolean) as Tab[];
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
    saveAllTabs,
    togglePlugin: (pluginId: string) => {
      update((s) => {
        const newPlugins = s.plugins.map((p) =>
          p.id === pluginId ? { ...p, enabled: !p.enabled } : p
        );
        savePlugins(newPlugins);
        return { ...s, plugins: newPlugins };
      });
    },
    setShowPluginPanel: (show: boolean) =>
      update((s) => ({ ...s, showPluginPanel: show })),
    setShowPrivacyManager: (show: boolean) =>
      update((s) => ({ ...s, showPrivacyManager: show })),
    setShowPrivacyRestore: (show: boolean) =>
      update((s) => ({ ...s, showPrivacyRestore: show })),
    addPrivacyMapping: (original: string, replacement: string) => {
      update((s) => {
        const newMapping: PrivacyMapping = {
          id: Math.random().toString(36).substr(2, 9),
          original,
          replacement: replacement || "***",
        };
        const newMappings = [...s.privacyMappings, newMapping];
        savePrivacyMappings(newMappings);
        return { ...s, privacyMappings: newMappings };
      });
    },
    updatePrivacyMapping: (id: string, original: string, replacement: string) => {
      update((s) => {
        const newMappings = s.privacyMappings.map((m) =>
          m.id === id ? { ...m, original, replacement: replacement || "***" } : m
        );
        savePrivacyMappings(newMappings);
        return { ...s, privacyMappings: newMappings };
      });
    },
    removePrivacyMapping: (id: string) => {
      update((s) => {
        const newMappings = s.privacyMappings.filter((m) => m.id !== id);
        savePrivacyMappings(newMappings);
        return { ...s, privacyMappings: newMappings };
      });
    },
  };
}

export const appStore = createAppStore();
