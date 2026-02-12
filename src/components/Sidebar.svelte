<script lang="ts">
  import { appStore } from "../store";
  import {
    getWorkspaceItems,
    createPromptFile,
    loadPromptFile,
    renamePromptFile,
    deletePromptFile,
    copyPromptFile,
  } from "../tauri-api";
  import { open } from "@tauri-apps/plugin-dialog";
  import type { WorkspaceItem } from "../types";
  import Workbench from "./Workbench.svelte";

  let workspacePath = "";
  let recentWorkspaces: string[] = [];
  let workspaceItems: WorkspaceItem[] = [];
  let showNewFileDialog = false;
  let newFileName = "";
  let showRenameDialog = false;
  let renameItem: WorkspaceItem | null = null;
  let renameName = "";
  let showCopyDialog = false;
  let copyItem: WorkspaceItem | null = null;
  let copyName = "";
  // Tauri v2 检测：检查 window.__TAURI_INTERNALS__ 是否存在
  let isTauriEnv =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  // 高度调整相关
  let filesHeight = 50; // 百分比
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;
  let sidebarHeight = 0;

  // 订阅store
  appStore.subscribe((state) => {
    workspacePath = state.workspacePath;
    recentWorkspaces = state.recentWorkspaces;
    workspaceItems = state.workspaceItems;
  });

  async function loadWorkspace() {
    if (workspacePath) {
      const items = await getWorkspaceItems(workspacePath);
      appStore.setWorkspaceItems(items);
    }
  }

  async function handleSelectWorkspace() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Workspace Folder",
      });

      if (selected && typeof selected === "string") {
        appStore.setWorkspacePath(selected);
        await loadWorkspace();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to select workspace:", error);

      if (
        errorMessage.includes("not allowed") ||
        errorMessage.includes("Tauri")
      ) {
        alert(
          "This feature is only available in the Tauri desktop app. Please run the app using 'npm run tauri dev' instead of 'npm run dev'."
        );
      } else {
        alert(`Failed to select workspace: ${errorMessage}`);
      }
    }
  }

  async function handleSelectRecentWorkspace(path: string) {
    appStore.setWorkspacePath(path);
    await loadWorkspace();
  }

  function handleRemoveRecentWorkspace(e: Event, path: string) {
    e.stopPropagation();
    appStore.removeRecentWorkspace(path);
  }

  function handleClearWorkspace(e: Event) {
    e.stopPropagation();
    appStore.setWorkspacePath("");
    appStore.setWorkspaceItems([]);
    appStore.setCurrentFile(null, "");
  }

  function getFolderName(path: string): string {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  }

  function getShortPath(path: string): string {
    if (path.length <= 35) return path;
    const parts = path.split(/[/\\]/);
    if (parts.length <= 2) return path;
    return ".../" + parts.slice(-2).join("/");
  }

  async function handleOpenFile(item: WorkspaceItem) {
    if (item.is_file) {
      try {
        await appStore.saveCurrentFile();

        const promptFile = await loadPromptFile(item.path);

        // 打开新文件时重置历史记录并设置初始状态
        appStore.setCurrentFile(promptFile, item.name, true);
      } catch (error) {
        console.error("Failed to load file:", error);
        alert("Failed to load file");
      }
    }
  }

  async function handleCreateFile() {
    if (newFileName.trim()) {
      try {
        const filePath = await createPromptFile(
          workspacePath,
          newFileName.trim()
        );
        await loadWorkspace();
        showNewFileDialog = false;
        newFileName = "";

        const updatedItems = await getWorkspaceItems(workspacePath);
        const newItem = updatedItems.find((item) => item.path === filePath);
        if (newItem && newItem.is_file) {
          await handleOpenFile(newItem);
        }
      } catch (error) {
        console.error("Failed to create file:", error);
        alert("Failed to create file");
      }
    }
  }

  function handleRenameClick(item: WorkspaceItem) {
    renameItem = item;
    renameName = item.name.replace(".prompt", "");
    showRenameDialog = true;
  }

  async function handleRename() {
    if (renameItem && renameName.trim()) {
      try {
        await renamePromptFile(renameItem.path, renameName.trim());
        await loadWorkspace();
        showRenameDialog = false;
        renameItem = null;
        renameName = "";
      } catch (error) {
        console.error("Failed to rename file:", error);
        alert("Failed to rename file");
      }
    }
  }

  function handleCopyClick(item: WorkspaceItem) {
    copyItem = item;
    copyName = item.name.replace(".prompt", "") + "_copy";
    showCopyDialog = true;
  }

  async function handleCopy() {
    if (copyItem && copyName.trim()) {
      try {
        await copyPromptFile(copyItem.path, copyName.trim());
        await loadWorkspace();
        showCopyDialog = false;
        copyItem = null;
        copyName = "";
      } catch (error) {
        console.error("Failed to copy file:", error);
        alert("Failed to copy file");
      }
    }
  }

  async function handleDelete(item: WorkspaceItem) {
    if (confirm(`Are you sure you want to delete ${item.name}?`)) {
      try {
        await deletePromptFile(item.path);
        await loadWorkspace();
      } catch (error) {
        console.error("Failed to delete file:", error);
        alert("Failed to delete file");
      }
    }
  }

  function handleResizeStart(e: MouseEvent) {
    if (e.button !== 0) return;
    isResizing = true;
    startY = e.clientY;
    startHeight = filesHeight;
    const sidebar = (e.target as HTMLElement).closest(
      ".sidebar-container"
    ) as HTMLElement;
    if (sidebar) {
      sidebarHeight = sidebar.clientHeight;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  function handleResizeMove(e: MouseEvent) {
    if (!isResizing) return;
    const diff = e.clientY - startY;
    const diffPercent = (diff / sidebarHeight) * 100;
    // 反向调整：向上拖动时增加Files高度（Workbench高度减少）
    let newHeight = startHeight - diffPercent;
    // 限制最小和最大高度
    newHeight = Math.max(20, Math.min(80, newHeight));
    filesHeight = newHeight;
  }

  function handleResizeEnd() {
    isResizing = false;
  }
</script>

<svelte:window on:mousemove={handleResizeMove} on:mouseup={handleResizeEnd} />

<div
  class="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full sidebar-container"
>
  <div class="p-4 border-b border-gray-700">
    <h1 class="text-white text-lg font-bold">Prompt Combiner</h1>
  </div>

  <!-- Workbench 区域 -->
  <div
    class="flex flex-col overflow-hidden"
    style="height: {100 - filesHeight}%"
  >
    <div class="px-3 py-2 bg-gray-800 border-b border-gray-700">
      <h2 class="text-white font-medium text-sm">Workbench</h2>
    </div>
    <div class="flex-1 overflow-hidden">
      {#if $appStore.currentFile}
        <Workbench currentFile={$appStore.currentFile} />
      {:else}
        <div
          class="flex items-center justify-center h-full text-gray-500 text-sm"
        >
          Open a file to see workbench
        </div>
      {/if}
    </div>
  </div>

  <!-- 拖拽调整条 -->
  <div
    class="h-2 bg-gray-700 hover:bg-gray-600 cursor-ns-resize flex items-center justify-center border-y border-gray-600"
    role="separator"
    aria-orientation="horizontal"
    on:mousedown={handleResizeStart}
  >
    <div class="w-8 h-1 bg-gray-500 rounded"></div>
  </div>

  <!-- Files 区域 -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Files 标题栏 + 工作区选择按钮 -->
    <div class="px-3 py-2 bg-gray-800 border-b border-gray-700">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-white font-medium text-sm">Files</h2>
      </div>

      <!-- 工作区选择按钮 - 显示当前路径或提示文字 -->
      <div class="relative">
        <button
          on:click={handleSelectWorkspace}
          class="w-full text-left px-2 py-1.5 rounded text-xs transition-colors border pr-7 {workspacePath
            ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
            : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700'}"
          disabled={!isTauriEnv}
          class:opacity-50={!isTauriEnv}
          class:cursor-not-allowed={!isTauriEnv}
          title={workspacePath || "Select a workspace folder"}
        >
          <div class="flex items-center">
            <span class="mr-1.5">{workspacePath ? "📁" : "📂"}</span>
            <span class="truncate flex-1">
              {workspacePath ? getShortPath(workspacePath) : "选择工作区..."}
            </span>
          </div>
        </button>
        {#if workspacePath}
          <button
            on:click={handleClearWorkspace}
            class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400 px-1 py-0.5 rounded transition-colors"
            title="关闭工作区"
          >
            ✕
          </button>
        {/if}
      </div>

      {#if !isTauriEnv}
        <div
          class="mt-2 bg-yellow-900/50 border border-yellow-700 text-yellow-200 text-xs p-1.5 rounded"
        >
          ⚠️ 浏览器模式，文件功能需使用 Tauri 桌面应用
        </div>
      {/if}
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      {#if workspacePath}
        <!-- 已打开工作区 - 显示文件列表 -->
        <button
          on:click={() => (showNewFileDialog = true)}
          class="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm mb-3"
        >
          + New File
        </button>

        {#each workspaceItems as item}
          <div
            class="flex items-center justify-between p-2 rounded hover:bg-gray-800 cursor-pointer mb-1 group"
            role="button"
            tabindex="0"
            on:click={() => handleOpenFile(item)}
            on:keydown={(e) => e.key === "Enter" && handleOpenFile(item)}
          >
            <div class="flex items-center flex-1 min-w-0">
              <span class="mr-2">
                {item.is_file ? "📄" : "📁"}
              </span>
              <span class="text-gray-300 text-sm truncate">
                {item.name}
              </span>
            </div>
            {#if item.is_file}
              <div class="flex gap-1 opacity-0 group-hover:opacity-100">
                <button
                  on:click|stopPropagation={() => handleRenameClick(item)}
                  class="text-gray-400 hover:text-white px-1"
                  title="Rename"
                >
                  ✎
                </button>
                <button
                  on:click|stopPropagation={() => handleCopyClick(item)}
                  class="text-gray-400 hover:text-white px-1"
                  title="Copy"
                >
                  📋
                </button>
                <button
                  on:click|stopPropagation={() => handleDelete(item)}
                  class="text-gray-400 hover:text-red-400 px-1"
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            {/if}
          </div>
        {/each}
      {:else}
        <!-- 未打开工作区 - 显示最近工作区列表 -->
        {#if recentWorkspaces.length > 0}
          <div class="text-gray-400 text-xs mb-2 px-1">最近打开</div>
          {#each recentWorkspaces as recentPath}
            <div
              class="flex items-center justify-between p-2 rounded hover:bg-gray-800 cursor-pointer mb-1 group"
              role="button"
              tabindex="0"
              on:click={() => handleSelectRecentWorkspace(recentPath)}
              on:keydown={(e) =>
                e.key === "Enter" && handleSelectRecentWorkspace(recentPath)}
              title={recentPath}
            >
              <div class="flex items-center flex-1 min-w-0">
                <span class="mr-2">📁</span>
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="text-gray-300 text-sm truncate">
                    {getFolderName(recentPath)}
                  </span>
                  <span class="text-gray-500 text-xs truncate">
                    {getShortPath(recentPath)}
                  </span>
                </div>
              </div>
              <button
                on:click={(e) => handleRemoveRecentWorkspace(e, recentPath)}
                class="text-gray-500 hover:text-red-400 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove from history"
              >
                ✕
              </button>
            </div>
          {/each}
        {:else}
          <div
            class="flex flex-col items-center justify-center h-32 text-gray-500 text-sm"
          >
            <span class="mb-2">📂</span>
            <span>未选择工作区</span>
            <span class="text-xs mt-1">点击上方按钮选择</span>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

{#if showNewFileDialog}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg p-6 w-96">
      <h2 class="text-white text-lg font-bold mb-4">New File</h2>
      <input
        type="text"
        bind:value={newFileName}
        class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="File name"
      />
      <div class="flex justify-end gap-2">
        <button
          on:click={() => (showNewFileDialog = false)}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          Cancel
        </button>
        <button
          on:click={handleCreateFile}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Create
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showRenameDialog}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg p-6 w-96">
      <h2 class="text-white text-lg font-bold mb-4">Rename File</h2>
      <input
        type="text"
        bind:value={renameName}
        class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="New name"
      />
      <div class="flex justify-end gap-2">
        <button
          on:click={() => (showRenameDialog = false)}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          Cancel
        </button>
        <button
          on:click={handleRename}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Rename
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showCopyDialog}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg p-6 w-96">
      <h2 class="text-white text-lg font-bold mb-4">Copy File</h2>
      <input
        type="text"
        bind:value={copyName}
        class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Copy name"
      />
      <div class="flex justify-end gap-2">
        <button
          on:click={() => (showCopyDialog = false)}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          Cancel
        </button>
        <button
          on:click={handleCopy}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Copy
        </button>
      </div>
    </div>
  </div>
{/if}
