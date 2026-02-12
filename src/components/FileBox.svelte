<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { createEventDispatcher } from "svelte";
  import type { FileBox, FileBoxData, FileBoxItem } from "../types";
  import { open } from "@tauri-apps/plugin-dialog";

  export let fileBox: FileBox;
  export let index: number | undefined = undefined;
  export let fileBoxData: FileBoxData;

  const dispatch = createEventDispatcher();

  let isDragging = false;
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;
  let pathSegmentsInput: HTMLInputElement;
  let isEditingPathSegments = false;
  let titleInput: HTMLInputElement;
  let isEditingTitle = false;

  $: height = fileBoxData.height;
  $: pathSegments = fileBoxData.path_segments;
  $: files = fileBoxData.files || [];
  $: title = fileBoxData.title || "";

  // 获取显示的标题
  function getDisplayTitle(): string {
    if (title && title.trim()) {
      return title.trim();
    }
    return "Untitled";
  }

  // 用于 dnd-zone 的文件列表
  $: fileItems = files.map((file, idx) => ({
    id: file.id,
    file,
    index: idx,
  }));

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  function handleDragStart(e: DragEvent) {
    isDragging = true;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
    dispatch("dragstart");
  }

  function handleDragEnd(e: DragEvent) {
    isDragging = false;
    dispatch("dragend");
  }

  function handleResizeStart(e: MouseEvent) {
    if (e.button !== 0) return;
    isResizing = true;
    startY = e.clientY;
    startHeight = height;
    e.preventDefault();
    e.stopPropagation();
  }

  function handleResizeMove(e: MouseEvent) {
    if (!isResizing) return;
    const diff = e.clientY - startY;
    const newHeight = Math.max(150, startHeight + diff);
    height = newHeight;
  }

  function handleResizeEnd() {
    if (isResizing) {
      isResizing = false;
      dispatch("heightchange", { id: fileBox.id, height });
    }
  }

  function handleModeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    fileBox.mode = select.value as "normal" | "disabled" | "shadow";
    dispatch("change", { fileBox });
  }

  function handleDelete() {
    dispatch("delete", { id: fileBox.id });
  }

  // 获取显示的路径（根据 path_segments 截断）
  function getDisplayPath(fullPath: string): string {
    if (!fullPath) return "";
    if (pathSegments < 1) return fullPath;

    // 统一使用正斜杠处理路径
    const normalizedPath = fullPath.replace(/\\/g, "/");
    const parts = normalizedPath.split("/").filter((p) => p.length > 0);

    if (parts.length <= pathSegments) return fullPath;

    // 保留最后 pathSegments 个分段
    const displayParts = parts.slice(-pathSegments);
    return displayParts.join("/");
  }

  // 获取文件扩展名用于代码块语言标识
  function getFileExtension(filePath: string): string {
    if (!filePath) return "";
    const parts = filePath.split(".");
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }
    return "";
  }

  function handleToggleCheck(fileId: string) {
    const newFiles = files.map((f) =>
      f.id === fileId ? { ...f, checked: !f.checked } : f
    );
    dispatch("datachange", {
      id: fileBox.id,
      fileBoxData: { ...fileBoxData, files: newFiles },
    });
  }

  function handleDeleteFile(fileId: string) {
    const newFiles = files.filter((f) => f.id !== fileId);
    dispatch("datachange", {
      id: fileBox.id,
      fileBoxData: { ...fileBoxData, files: newFiles },
    });
  }

  async function handleSelectFile(fileId?: string) {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "选择文件",
      });

      if (selected && typeof selected === "string") {
        if (fileId) {
          // 更新现有文件路径
          const newFiles = files.map((f) =>
            f.id === fileId ? { ...f, path: selected } : f
          );
          dispatch("datachange", {
            id: fileBox.id,
            fileBoxData: { ...fileBoxData, files: newFiles },
          });
        }
      }
    } catch (error) {
      console.error("Failed to select file:", error);
    }
  }

  async function handleAddFiles() {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        title: "选择文件",
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        const newFiles: FileBoxItem[] = selected.map((path) => ({
          id: generateId(),
          path,
          checked: true,
        }));

        dispatch("datachange", {
          id: fileBox.id,
          fileBoxData: { ...fileBoxData, files: [...files, ...newFiles] },
        });
      }
    } catch (error) {
      console.error("Failed to add files:", error);
    }
  }

  // dnd-zone 的文件排序处理
  function handleFileDndConsider(e: CustomEvent) {
    fileItems = e.detail.items;
  }

  function handleFileDndFinalize(e: CustomEvent) {
    fileItems = e.detail.items;
    const newFiles = fileItems.map((item) => item.file);
    dispatch("datachange", {
      id: fileBox.id,
      fileBoxData: { ...fileBoxData, files: newFiles },
    });
  }

  function handlePathSegmentsClick() {
    isEditingPathSegments = true;
    setTimeout(() => {
      if (pathSegmentsInput) {
        pathSegmentsInput.focus();
        pathSegmentsInput.select();
      }
    }, 0);
  }

  function handlePathSegmentsBlur() {
    isEditingPathSegments = false;
  }

  function handlePathSegmentsKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (pathSegmentsInput) {
        pathSegmentsInput.blur();
      }
    }
  }

  function handlePathSegmentsInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let value = parseInt(input.value, 10);
    if (isNaN(value)) value = 2;
    dispatch("datachange", {
      id: fileBox.id,
      fileBoxData: { ...fileBoxData, path_segments: value },
    });
  }

  // 标题编辑相关函数
  function handleTitleClick() {
    isEditingTitle = true;
    setTimeout(() => {
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 0);
  }

  function handleTitleBlur() {
    isEditingTitle = false;
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (titleInput) {
        titleInput.blur();
      }
    }
  }

  function handleTitleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    dispatch("datachange", {
      id: fileBox.id,
      fileBoxData: { ...fileBoxData, title: input.value },
    });
  }

  // 处理点击选择文件 - 使用 Tauri 对话框获取完整路径
  async function handleClickSelectFiles() {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        title: "选择文件",
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        const newFiles: FileBoxItem[] = selected.map((path) => ({
          id: generateId(),
          path,
          checked: true,
        }));

        dispatch("datachange", {
          id: fileBox.id,
          fileBoxData: { ...fileBoxData, files: [...files, ...newFiles] },
        });
      }
    } catch (error) {
      console.error("Failed to select files:", error);
    }
  }

  $: modeColor =
    fileBox.mode === "normal"
      ? "bg-gray-700"
      : fileBox.mode === "disabled"
        ? "bg-gray-800"
        : "bg-purple-800";

</script>

<svelte:window on:mousemove={handleResizeMove} on:mouseup={handleResizeEnd} />

<div
  class="file-box-container flex flex-col bg-gray-800 rounded-lg mb-2 overflow-hidden relative {isDragging
    ? 'opacity-50'
    : ''}"
  style="height: {height}px;"
  role="region"
  aria-label="File box"
  data-filebox-id={fileBox.id}
>
  <!-- 标题栏 -->
  <div
    class="flex items-center px-3 py-2 {modeColor} border-b border-gray-600 gap-2"
  >
    <!-- 左侧：拖动句柄和标题 -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <div
        class="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-300 select-none"
        draggable="true"
        role="button"
        tabindex="0"
        on:dragstart={handleDragStart}
        on:dragend={handleDragEnd}
        on:keydown={(e) => {}}
        title="Drag to reorder"
      >
        ☰
      </div>
      <div class="relative w-24">
        {#if !isEditingTitle}
          <div
            class="font-medium truncate px-1 rounded cursor-pointer hover:bg-gray-700 text-sm {title?.trim()
              ? 'text-white'
              : 'text-gray-400 italic'}"
            role="button"
            tabindex="0"
            on:click={handleTitleClick}
            on:keydown={(e) => e.key === "Enter" && handleTitleClick()}
            title="Click to edit title"
          >
            {getDisplayTitle()}
          </div>
        {:else}
          <input
            type="text"
            bind:this={titleInput}
            value={title}
            on:input={handleTitleInput}
            on:blur={handleTitleBlur}
            on:keydown={handleTitleKeyDown}
            class="w-full bg-transparent font-medium truncate focus:outline-none focus:bg-gray-700 rounded px-1 text-white text-sm"
            placeholder="Enter title..."
          />
        {/if}
      </div>
    </div>

    <!-- 中间：路径分段参数 -->
    <div class="flex-1 min-w-0 flex items-center justify-center gap-2">
      <span class="text-gray-300 text-xs">Path segments:</span>
      {#if isEditingPathSegments}
        <input
          type="number"
          bind:this={pathSegmentsInput}
          value={pathSegments}
          on:input={handlePathSegmentsInput}
          on:blur={handlePathSegmentsBlur}
          on:keydown={handlePathSegmentsKeyDown}
          class="w-16 bg-gray-600 text-white text-xs px-2 py-1 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          min="0"
          title="Number of path segments to display (0 = full path)"
        />
      {:else}
        <button
          on:click={handlePathSegmentsClick}
          class="text-white text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 border border-gray-500"
          title="Click to edit path segments (0 = full path)"
        >
          {pathSegments < 1 ? "Full" : pathSegments}
        </button>
      {/if}
    </div>

    <!-- 右侧：操作按钮 -->
    <div class="flex items-center gap-1 flex-shrink-0">
      <select
        value={fileBox.mode}
        on:change={handleModeChange}
        class="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
      >
        <option value="normal">Normal</option>
        <option value="disabled">Disabled</option>
        <option value="shadow">Shadow</option>
      </select>

      <button
        on:click={handleDelete}
        class="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30 text-xs"
        title="Delete"
      >
        ×
      </button>
    </div>
  </div>

  <!-- 文件列表区域 - 仅用于显示和排序 -->
  <div class="flex-1 overflow-hidden flex flex-col">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      use:dndzone={{
        items: fileItems,
        flipDurationMs: 200,
        type: "filebox-item",
      }}
      on:consider={handleFileDndConsider}
      on:finalize={handleFileDndFinalize}
      class="flex-1 overflow-y-auto p-2 space-y-1"
      role="list"
    >
      {#each fileItems as item (item.id)}
        {@const file = item.file}
        <div
          class="flex items-center gap-2 p-2 bg-gray-700 rounded border border-gray-600 hover:border-gray-500 group"
          role="listitem"
        >
          <!-- 拖动句柄 -->
          <div
            class="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-300 select-none"
            title="Drag to reorder"
          >
            ☰
          </div>

          <!-- 复选框 -->
          <input
            type="checkbox"
            checked={file.checked}
            on:change={() => handleToggleCheck(file.id)}
            class="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-600"
            title="Include in output"
          />

          <!-- 文件路径 -->
          <button
            on:click={() => handleSelectFile(file.id)}
            class="flex-1 text-left text-sm text-gray-200 hover:text-white truncate cursor-pointer bg-transparent border-none p-0"
            title="Click to change file: {file.path}"
          >
            {getDisplayPath(file.path)}
          </button>

          <!-- 文件扩展名标签 -->
          {#if getFileExtension(file.path)}
            <span class="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
              {getFileExtension(file.path)}
            </span>
          {/if}

          <!-- 删除按钮 -->
          <button
            on:click={() => handleDeleteFile(file.id)}
            class="text-red-400 hover:text-red-300 px-1 py-0.5 rounded hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            ×
          </button>
        </div>
      {/each}
    </div>

    <!-- 文件拖放区域 - 点击使用 Tauri 对话框选择文件 -->
    <div
      class="relative border-t border-gray-600 bg-gray-750 transition-colors"
      role="button"
      tabindex="0"
      aria-label="Drop files here"
      on:click={handleClickSelectFiles}
    >
      <div
        class="w-full py-3 px-4 flex items-center justify-center gap-2 text-sm transition-colors cursor-pointer text-gray-400 hover:text-gray-300"
      >
        <svg
          class="w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <span>Click or drag files here</span>
      </div>
    </div>
  </div>

  <div
    class="h-2 bg-gray-700 hover:bg-gray-600 cursor-ns-resize flex items-center justify-center"
    role="separator"
    aria-orientation="horizontal"
    on:mousedown={handleResizeStart}
  >
    <div class="w-8 h-1 bg-gray-500 rounded"></div>
  </div>
</div>
