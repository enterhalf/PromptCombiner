<script lang="ts">
  import { appStore } from "../store";
  import {
    loadPromptFile,
    renamePromptFile,
    deletePromptFile,
    copyPromptFile,
  } from "../tauri-api";
  import { open } from "@tauri-apps/plugin-dialog";
  import Workbench from "./Workbench.svelte";
  import PopoverDialog from "./PopoverDialog.svelte";
  import { basename, dirname } from "@tauri-apps/api/path";
  import { exportPromptToClipboard, importPromptFromClipboard } from "../clipboard-utils";

  let recentFiles: string[] = [];
  let showNewFileDialog = false;
  let newFileName = "";
  let showRenameDialog = false;
  let renamePath: string | null = null;
  let renameName = "";
  let renamePosition: { x: number; y: number } | null = null;
  let showCopyDialog = false;
  let copyPath: string | null = null;
  let copyName = "";
  let copyPosition: { x: number; y: number } | null = null;
  let showDeleteDialog = false;
  let deletePath: string | null = null;
  let deletePosition: { x: number; y: number } | null = null;
  // Context menu state
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuFilePath: string | null = null;
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
    if (path.length <= 45) return path;
    const parts = path.split(/[/\\]/);
    if (parts.length <= 3) return path;
    return ".../" + parts.slice(-3).join("/");
  }

  async function handleOpenFile(filePath: string) {
    try {
      await appStore.openFileInTab(filePath);
    } catch (error) {
      console.error("Failed to load file:", error);
      appStore.showToast("Failed to load file", "error");
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

  function handleContextMenu(e: MouseEvent, filePath: string) {
    e.preventDefault();
    e.stopPropagation();
    contextMenuFilePath = filePath;
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    contextMenuVisible = true;
  }

  function hideContextMenu() {
    contextMenuVisible = false;
    contextMenuFilePath = null;
  }

  function handleRenameClick() {
    if (!contextMenuFilePath) return;
    renamePath = contextMenuFilePath;
    const fileName = getFileName(renamePath).replace(".prompt", "");
    renameName = fileName;
    renamePosition = { x: contextMenuX, y: contextMenuY };
    showRenameDialog = true;
    hideContextMenu();
  }

  async function handleRename() {
    if (!renamePath || !renameName.trim()) return;
    try {
      const newFilePath = await renamePromptFile(renamePath, renameName.trim());
      appStore.removeRecentFile(renamePath);
      appStore.addRecentFile(newFilePath);
      if ($appStore.currentFilePath === renamePath) {
        const newFileName = getFileName(newFilePath);
        appStore.setCurrentFileName(newFileName);
        appStore.setCurrentFilePath(newFilePath);
      }
      showRenameDialog = false;
      renamePath = null;
      renameName = "";
      renamePosition = null;
    } catch (error) {
      console.error("Failed to rename file:", error);
      appStore.showToast("Failed to rename file", "error");
    }
  }

  function cancelRename() {
    showRenameDialog = false;
    renamePath = null;
    renameName = "";
    renamePosition = null;
  }

  function handleCopyClick() {
    if (!contextMenuFilePath) return;
    copyPath = contextMenuFilePath;
    const fileName = getFileName(copyPath).replace(".prompt", "");
    copyName = fileName + "_copy";
    copyPosition = { x: contextMenuX, y: contextMenuY };
    showCopyDialog = true;
    hideContextMenu();
  }

  async function handleCopy() {
    if (!copyPath || !copyName.trim()) return;
    try {
      const newFilePath = await copyPromptFile(copyPath, copyName.trim());
      appStore.addRecentFile(newFilePath);
      showCopyDialog = false;
      copyPath = null;
      copyName = "";
      copyPosition = null;
    } catch (error) {
      console.error("Failed to copy file:", error);
      appStore.showToast("Failed to copy file", "error");
    }
  }

  function cancelCopy() {
    showCopyDialog = false;
    copyPath = null;
    copyName = "";
    copyPosition = null;
  }

  function handleDeleteClick() {
    if (!contextMenuFilePath) return;
    // 检查要删除的文件是否是当前加载的配置文件
    if (contextMenuFilePath === $appStore.currentFilePath) {
      appStore.showToast(
        "Cannot delete currently loaded files, please switch configuration files before deletion.",
        "error"
      );
      hideContextMenu();
      return;
    }
    deletePath = contextMenuFilePath;
    deletePosition = { x: contextMenuX, y: contextMenuY };
    showDeleteDialog = true;
    hideContextMenu();
  }

  async function confirmDelete() {
    if (!deletePath) return;
    try {
      await deletePromptFile(deletePath);
      appStore.removeRecentFile(deletePath);
      showDeleteDialog = false;
      deletePath = null;
      deletePosition = null;
    } catch (error) {
      console.error("Failed to delete file:", error);
      appStore.showToast("Failed to delete file", "error");
    }
  }

  function cancelDelete() {
    showDeleteDialog = false;
    deletePath = null;
    deletePosition = null;
  }

  function handleRemoveFromHistoryClick() {
    if (!contextMenuFilePath) return;
    appStore.removeRecentFile(contextMenuFilePath);
    hideContextMenu();
  }

  // 剪贴板导出功能
  async function handleExportToClipboard() {
    const currentFile = $appStore.currentFile;
    const state = $appStore;
    
    if (!currentFile) {
      appStore.showToast("没有可导出的内容", "error");
      return;
    }
    
    // 获取当前标签的显示名称或文件名
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    const title = activeTab?.displayName || activeTab?.fileName || "Untitled";
    
    try {
      const exportText = exportPromptToClipboard(currentFile, title.replace(/\.prompt$/, ""));
      await navigator.clipboard.writeText(exportText);
      appStore.showToast("已复制到剪贴板", "success");
    } catch (error) {
      console.error("Failed to export to clipboard:", error);
      appStore.showToast("导出失败", "error");
    }
  }

  // 剪贴板导入功能
  async function handleImportFromClipboard() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const result = importPromptFromClipboard(clipboardText);
      
      if (!result) {
        appStore.showToast("剪贴板内容格式无效", "error");
        return;
      }
      
      const { title, promptFile } = result;
      
      // 创建新标签页，标题使用导入的标题
      appStore.createNewTab(promptFile, title, "", true);
      appStore.showToast(`已导入: ${title}`, "success");
    } catch (error) {
      console.error("Failed to import from clipboard:", error);
      appStore.showToast("导入失败，请检查剪贴板权限", "error");
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

<svelte:window
  on:mousemove={handleResizeMove}
  on:mouseup={handleResizeEnd}
  on:click={hideContextMenu}
/>

<div
  class="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full sidebar-container"
>
  <div class="px-4 py-2 border-b border-gray-700 flex items-center">
    <button
      on:click={() => appStore.setShowPluginPanel(!$appStore.showPluginPanel)}
      class="p-2 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      title="插件"
    >
      ⚡
    </button>
  </div>

  <!-- 插件面板 -->
  {#if $appStore.showPluginPanel}
    <div class="bg-gray-800 border-b border-gray-700 p-3">
      <h3 class="text-white text-sm font-bold mb-2">插件</h3>
      <div class="space-y-2">
        {#each $appStore.plugins as plugin}
          <label class="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={plugin.enabled}
              on:change={() => appStore.togglePlugin(plugin.id)}
              class="accent-blue-500"
            />
            <span>{plugin.name}</span>
          </label>
        {/each}
      </div>
    </div>
  {/if}

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
            on:click={handleExportToClipboard}
            class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="导出到剪贴板"
            disabled={!$appStore.currentFile}
            class:opacity-50={!$appStore.currentFile}
            class:cursor-not-allowed={!$appStore.currentFile}
          >
            📋
          </button>
          <button
            on:click={handleImportFromClipboard}
            class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="从剪贴板导入"
          >
            📥
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
        <div class="text-gray-400 text-xs mb-1 px-1">最近打开</div>
        {#each recentFiles as filePath}
          <div
            class="flex items-center p-1.5 rounded hover:bg-gray-800 cursor-pointer mb-0.5"
            role="button"
            tabindex="0"
            on:click={() => handleOpenFile(filePath)}
            on:keydown={(e) => e.key === "Enter" && handleOpenFile(filePath)}
            on:contextmenu={(e) => handleContextMenu(e, filePath)}
            title={filePath}
          >
            <span class="mr-1.5 text-xs">📄</span>
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-gray-300 text-xs truncate">
                {getFileName(filePath)}
              </span>
              <span class="text-gray-500 text-[10px] truncate">
                {getShortPath(filePath)}
              </span>
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

  <!-- Context Menu -->
  {#if contextMenuVisible}
    <div
      class="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[160px]"
      style="left: {contextMenuX}px; top: {contextMenuY}px;"
      on:click|stopPropagation
    >
      <button
        on:click={handleRenameClick}
        class="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded-t-lg transition-colors"
      >
        重命名
      </button>
      <button
        on:click={handleCopyClick}
        class="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      >
        复制
      </button>
      <button
        on:click={handleDeleteClick}
        class="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
      >
        删除
      </button>
      <div class="border-t border-gray-700 my-0.5"></div>
      <button
        on:click={handleRemoveFromHistoryClick}
        class="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-300 rounded-b-lg transition-colors"
      >
        从历史记录移除
      </button>
    </div>
  {/if}
</div>

{#if showRenameDialog && renamePath}
  <PopoverDialog
    show={showRenameDialog}
    position={renamePosition}
    title="重命名文件"
    type="input"
    inputValue={renameName}
    inputPlaceholder="新名称"
    confirmText="重命名"
    cancelText="取消"
    confirmButtonClass="bg-blue-600 hover:bg-blue-700"
    onConfirm={handleRename}
    onCancel={cancelRename}
  />
{/if}

{#if showCopyDialog && copyPath}
  <PopoverDialog
    show={showCopyDialog}
    position={copyPosition}
    title="复制文件"
    type="input"
    inputValue={copyName}
    inputPlaceholder="副本名称"
    confirmText="复制"
    cancelText="取消"
    confirmButtonClass="bg-blue-600 hover:bg-blue-700"
    onConfirm={handleCopy}
    onCancel={cancelCopy}
  />
{/if}

{#if showDeleteDialog && deletePath}
  <PopoverDialog
    show={showDeleteDialog}
    position={deletePosition}
    title="确认删除"
    message={`确定要删除 ${getFileName(deletePath)} 吗？`}
    confirmText="删除"
    cancelText="取消"
    confirmButtonClass="bg-red-600 hover:bg-red-700"
    onConfirm={confirmDelete}
    onCancel={cancelDelete}
  />
{/if}
