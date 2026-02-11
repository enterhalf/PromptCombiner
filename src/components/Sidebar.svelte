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
  import { open } from "@tauri-apps/api/dialog";
  import type { WorkspaceItem } from "../types";

  let workspacePath = "";
  let workspaceItems: WorkspaceItem[] = [];
  let showNewFileDialog = false;
  let newFileName = "";
  let showRenameDialog = false;
  let renameItem: WorkspaceItem | null = null;
  let renameName = "";
  let showCopyDialog = false;
  let copyItem: WorkspaceItem | null = null;
  let copyName = "";
  let isTauriEnv = typeof window !== "undefined" && "__TAURI__" in window;

  $: activeTab = $appStore.activeTab;

  async function loadWorkspace() {
    if (workspacePath) {
      workspaceItems = await getWorkspaceItems(workspacePath);
      appStore.setWorkspaceItems(workspaceItems);
    }
  }

  async function handleLoadWorkspace() {
    await loadWorkspace();
  }

  async function handleSelectWorkspace() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Workspace Folder",
      });

      if (selected && typeof selected === "string") {
        workspacePath = selected;
        appStore.setWorkspacePath(workspacePath);
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

  async function handleOpenFile(item: WorkspaceItem) {
    if (item.is_file) {
      try {
        await appStore.saveCurrentFile();

        const promptFile = await loadPromptFile(item.path);

        appStore.setCurrentFile(promptFile, item.name);
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

  function handleTabClick(tab: "files" | "workbench") {
    appStore.setActiveTab(tab);
  }
</script>

<div class="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
  <div class="p-4 border-b border-gray-700">
    <h1 class="text-white text-lg font-bold mb-3">Prompt Combiner</h1>

    <div class="flex gap-2 mb-3">
      <button
        on:click={handleSelectWorkspace}
        class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
        disabled={!isTauriEnv}
        class:opacity-50={!isTauriEnv}
        class:cursor-not-allowed={!isTauriEnv}
      >
        Select Workspace
      </button>
    </div>

    {#if !isTauriEnv}
      <div
        class="bg-yellow-900/50 border border-yellow-700 text-yellow-200 text-xs p-2 rounded mb-3"
      >
        ⚠️ Running in browser mode. File features require Tauri desktop app. Run <code
          class="bg-gray-800 px-1 rounded">npm run tauri dev</code
        > instead.
      </div>
    {/if}

    {#if workspacePath}
      <div class="text-gray-400 text-xs mb-2 truncate">
        {workspacePath}
      </div>
    {/if}
  </div>

  <div class="flex border-b border-gray-700">
    <button
      on:click={() => handleTabClick("files")}
      class="flex-1 py-2 text-sm font-medium {activeTab === 'files'
        ? 'text-blue-400 border-b-2 border-blue-400'
        : 'text-gray-400 hover:text-gray-300'}"
    >
      Files
    </button>
    <button
      on:click={() => handleTabClick("workbench")}
      class="flex-1 py-2 text-sm font-medium {activeTab === 'workbench'
        ? 'text-blue-400 border-b-2 border-blue-400'
        : 'text-gray-400 hover:text-gray-300'}"
    >
      Workbench
    </button>
  </div>

  {#if activeTab === "files"}
    <div class="flex-1 overflow-y-auto p-2">
      {#if workspacePath}
        <button
          on:click={() => (showNewFileDialog = true)}
          class="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm mb-3"
        >
          + New File
        </button>
      {/if}

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
    </div>
  {:else}
    <slot name="workbench"></slot>
  {/if}
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
