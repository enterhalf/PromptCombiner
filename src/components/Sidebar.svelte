<script lang="ts">
  import { appStore } from "../store";
  import {
    createPromptFile,
    loadPromptFile,
    renamePromptFile,
    deletePromptFile,
    copyPromptFile,
  } from "../tauri-api";
  import { open, save } from "@tauri-apps/plugin-dialog";
  import Workbench from "./Workbench.svelte";
  import { basename, dirname } from "@tauri-apps/api/path";

  let recentFiles: string[] = [];
  let showNewFileDialog = false;
  let newFileName = "";
  let showRenameDialog = false;
  let renamePath: string | null = null;
  let renameName = "";
  let showCopyDialog = false;
  let copyPath: string | null = null;
  let copyName = "";
  let showDeleteDialog = false;
  let deletePath: string | null = null;
  // Tauri v2 检测
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
    recentFiles = state.recentFiles;
  });

  function getFileName(path: string): string {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  }

  function getShortPath(path: string): string {
    if (path.length <= 35) return path;
    const parts = path.split(/[/\\]/);
    if (parts.length <= 2) return path;
    return ".../" + parts.slice(-2).join("/");
  }

  async function handleOpenFile(filePath: string) {
    try {
      await appStore.saveCurrentFile();

      const promptFile = await loadPromptFile(filePath);
      const fileName = await basename(filePath);

      // 打开新文件时重置历史记录并设置初始状态
      appStore.setCurrentFile(promptFile, fileName, filePath, true);
      appStore.addRecentFile(filePath);
    } catch (error) {
      console.error("Failed to load file:", error);
      appStore.showToast("Failed to load file", "error");
    }
  }

  async function handleCreateFile() {
    try {
      const selectedPath = await save({
        title: "新建 Prompt 文件",
        defaultPath: "untitled.prompt",
        filters: [{ name: "Prompt Files", extensions: ["prompt"] }],
      });

      if (selectedPath && typeof selectedPath === "string") {
        const dirPath = await dirname(selectedPath);
        const fileNameWithExt = getFileName(selectedPath);
        const fileName = fileNameWithExt.replace(/\.prompt$/, "");

        const filePath = await createPromptFile(dirPath, fileName);
        appStore.addRecentFile(filePath);
        await handleOpenFile(filePath);
      }
    } catch (error) {
      console.error("Failed to create file:", error);
      appStore.showToast("Failed to create file", "error");
    }
  }

  async function handleOpenFileDialog() {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "打开 Prompt 文件",
        filters: [{ name: "Prompt Files", extensions: ["prompt"] }],
      });

      if (selected && typeof selected === "string") {
        await handleOpenFile(selected);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
      appStore.showToast("Failed to open file", "error");
    }
  }

  function handleRenameClick(filePath: string) {
    renamePath = filePath;
    const fileName = getFileName(filePath).replace(".prompt", "");
    renameName = fileName;
    showRenameDialog = true;
  }

  async function handleRename() {
    if (!renamePath || !renameName.trim()) return;
    try {
      const newFilePath = await renamePromptFile(renamePath, renameName.trim());
      // 更新最近文件列表
      appStore.removeRecentFile(renamePath);
      appStore.addRecentFile(newFilePath);
      // 如果重命名的是当前打开的文件，更新当前文件路径
      if ($appStore.currentFilePath === renamePath) {
        const newFileName = getFileName(newFilePath);
        appStore.setCurrentFileName(newFileName);
        appStore.setCurrentFilePath(newFilePath);
      }
      showRenameDialog = false;
      renamePath = null;
      renameName = "";
    } catch (error) {
      console.error("Failed to rename file:", error);
      appStore.showToast("Failed to rename file", "error");
    }
  }

  function handleCopyClick(filePath: string) {
    copyPath = filePath;
    const fileName = getFileName(filePath).replace(".prompt", "");
    copyName = fileName + "_copy";
    showCopyDialog = true;
  }

  async function handleCopy() {
    if (!copyPath || !copyName.trim()) return;
    try {
      const newFilePath = await copyPromptFile(copyPath, copyName.trim());
      appStore.addRecentFile(newFilePath);
      showCopyDialog = false;
      copyPath = null;
      copyName = "";
    } catch (error) {
      console.error("Failed to copy file:", error);
      appStore.showToast("Failed to copy file", "error");
    }
  }

  function handleDeleteClick(e: Event, filePath: string) {
    e.stopPropagation();
    // 检查要删除的文件是否是当前加载的配置文件
    if (filePath === $appStore.currentFilePath) {
      appStore.showToast(
        "Cannot delete currently loaded files, please switch configuration files before deletion.",
        "error"
      );
      return;
    }
    deletePath = filePath;
    showDeleteDialog = true;
  }

  async function confirmDelete() {
    if (!deletePath) return;
    try {
      await deletePromptFile(deletePath);
      appStore.removeRecentFile(deletePath);
      showDeleteDialog = false;
      deletePath = null;
    } catch (error) {
      console.error("Failed to delete file:", error);
      appStore.showToast("Failed to delete file", "error");
    }
  }

  function cancelDelete() {
    showDeleteDialog = false;
    deletePath = null;
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
    <!-- Files 标题栏 + 操作按钮 -->
    <div class="px-3 py-2 bg-gray-800 border-b border-gray-700">
      <div class="flex items-center justify-between">
        <h2 class="text-white font-medium text-sm">Files</h2>
        <div class="flex items-center gap-1">
          <button
            on:click={handleOpenFileDialog}
            class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="打开文件"
            disabled={!isTauriEnv}
            class:opacity-50={!isTauriEnv}
            class:cursor-not-allowed={!isTauriEnv}
          >
            📂
          </button>
          <button
            on:click={handleCreateFile}
            class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="新建文件"
            disabled={!isTauriEnv}
            class:opacity-50={!isTauriEnv}
            class:cursor-not-allowed={!isTauriEnv}
          >
            +
          </button>
        </div>
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
      {#if recentFiles.length > 0}
        <div class="text-gray-400 text-xs mb-2 px-1">最近打开</div>
        {#each recentFiles as filePath}
          <div
            class="flex items-center justify-between p-2 rounded hover:bg-gray-800 cursor-pointer mb-1 group"
            role="button"
            tabindex="0"
            on:click={() => handleOpenFile(filePath)}
            on:keydown={(e) => e.key === "Enter" && handleOpenFile(filePath)}
            title={filePath}
          >
            <div class="flex items-center flex-1 min-w-0">
              <span class="mr-2">📄</span>
              <div class="flex flex-col flex-1 min-w-0">
                <span class="text-gray-300 text-sm truncate">
                  {getFileName(filePath)}
                </span>
                <span class="text-gray-500 text-xs truncate">
                  {getShortPath(filePath)}
                </span>
              </div>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100">
              <button
                on:click|stopPropagation={() => handleRenameClick(filePath)}
                class="text-gray-400 hover:text-white px-1"
                title="重命名"
              >
                ✎
              </button>
              <button
                on:click|stopPropagation={() => handleCopyClick(filePath)}
                class="text-gray-400 hover:text-white px-1"
                title="复制"
              >
                📋
              </button>
              <button
                on:click={(e) => handleDeleteClick(e, filePath)}
                class="text-gray-400 hover:text-red-400 px-1"
                title="删除"
              >
                🗑
              </button>
              <button
                on:click|stopPropagation={() => appStore.removeRecentFile(filePath)}
                class="text-gray-500 hover:text-red-400 px-1.5 py-0.5 rounded transition-opacity"
                title="从历史记录中移除"
              >
                ✕
              </button>
            </div>
          </div>
        {/each}
      {:else}
        <div
          class="flex flex-col items-center justify-center h-32 text-gray-500 text-sm"
        >
          <span class="mb-2">📄</span>
          <span>未打开任何文件</span>
          <span class="text-xs mt-1">点击上方按钮打开或新建</span>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showRenameDialog && renamePath}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg p-6 w-96">
      <h2 class="text-white text-lg font-bold mb-4">重命名文件</h2>
      <input
        type="text"
        bind:value={renameName}
        class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="新名称"
      />
      <div class="flex justify-end gap-2">
        <button
          on:click={() => {
            showRenameDialog = false;
            renamePath = null;
            renameName = "";
          }}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          取消
        </button>
        <button
          on:click={handleRename}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          重命名
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showCopyDialog && copyPath}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg p-6 w-96">
      <h2 class="text-white text-lg font-bold mb-4">复制文件</h2>
      <input
        type="text"
        bind:value={copyName}
        class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="副本名称"
      />
      <div class="flex justify-end gap-2">
        <button
          on:click={() => {
            showCopyDialog = false;
            copyPath = null;
            copyName = "";
          }}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          取消
        </button>
        <button
          on:click={handleCopy}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          复制
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showDeleteDialog && deletePath}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg p-6 w-96">
      <h2 class="text-white text-lg font-bold mb-4">确认删除</h2>
      <p class="text-gray-300 mb-4">
        确定要删除 <span class="text-white font-semibold"
          >{getFileName(deletePath)}</span
        >?
      </p>
      <div class="flex justify-end gap-2">
        <button
          on:click={cancelDelete}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          取消
        </button>
        <button
          on:click={confirmDelete}
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          删除
        </button>
      </div>
    </div>
  </div>
{/if}
