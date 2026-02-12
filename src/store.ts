import { writable, get } from "svelte/store";
import type { AppState, PromptFile, WorkspaceItem, VariantData } from "./types";
import { savePromptFile } from "./tauri-api";

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

const RECENT_WORKSPACES_KEY = "prompt-combiner-recent-workspaces";
const MAX_RECENT_WORKSPACES = 10;
const MAX_HISTORY_STEPS = 64;

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
    if (state.currentFile && state.workspacePath && state.currentFileName) {
      try {
        const filePath = `${state.workspacePath}/${state.currentFileName}`;
        const cleanedFile = cleanVariantDataForSave(state.currentFile);
        await savePromptFile(filePath, cleanedFile);
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
    setCurrentFile: (
      file: PromptFile | null,
      fileName?: string,
      skipHistory = false
    ) => {
      update((s) => ({
        ...s,
        currentFile: file,
        currentFileName: fileName !== undefined ? fileName : s.currentFileName,
      }));
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
