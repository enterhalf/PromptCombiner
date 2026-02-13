<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { onMount, onDestroy } from "svelte";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
  import { appStore, historyManager } from "./store";
  import Sidebar from "./components/Sidebar.svelte";
  import TextBox from "./components/TextBox.svelte";
  import FileBox from "./components/FileBox.svelte";
  import type {
    TextBox as TextBoxType,
    FileBox as FileBoxType,
    FileBoxData,
    Variant,
    BoxType,
    FileBoxItem,
  } from "./types";

  $: currentFile = $appStore.currentFile;
  $: canUndo = $historyManager.past.length > 0;
  $: canRedo = $historyManager.future.length > 0;

  // 跟踪哪个 FileBox 正在被拖放文件
  let activeDragOverFileBoxId: string | null = null;
  let unlistenDragDrop: (() => void) | null = null;

  // 用于 dnd-zone 的列表
  $: boxList = currentFile
    ? currentFile.order.map((id) => ({
        id,
        type: currentFile.text_boxes[id] ? "text" : "file",
        textBox: currentFile.text_boxes[id],
        fileBox: currentFile.file_boxes?.[id],
        variantData: currentFile.variants[id],
        fileBoxData: currentFile.file_box_data?.[id],
        isFileDragOver: activeDragOverFileBoxId === id, // 传递拖放状态
      }))
    : [];

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // 在指定位置插入新文本框
  function insertTextBoxAt(index: number) {
    if (!currentFile) return;

    const newId = generateId();
    const newTextBox: TextBoxType = {
      id: newId,
      mode: "normal",
      type: "text",
    };

    const defaultVariant: Variant = {
      content: "",
      title: "",
    };

    // 在指定位置插入新id
    const newOrder = [...currentFile.order];
    newOrder.splice(index, 0, newId);

    appStore.setCurrentFile({
      order: newOrder,
      text_boxes: { ...currentFile.text_boxes, [newId]: newTextBox },
      file_boxes: currentFile.file_boxes || {},
      file_box_data: currentFile.file_box_data || {},
      variants: {
        ...currentFile.variants,
        [newId]: {
          height: 150,
          current_variant_index: 0,
          variants: [defaultVariant],
        },
      },
      separators: currentFile.separators,
    });
  }

  // 在指定位置插入新文件框
  function insertFileBoxAt(index: number) {
    if (!currentFile) return;

    const newId = generateId();
    const newFileBox: FileBoxType = {
      id: newId,
      mode: "normal",
      type: "file",
    };

    const defaultFileBoxData: FileBoxData = {
      height: 200,
      path_segments: 2,
      files: [],
      title: "",
    };

    // 在指定位置插入新id
    const newOrder = [...currentFile.order];
    newOrder.splice(index, 0, newId);

    appStore.setCurrentFile({
      order: newOrder,
      text_boxes: currentFile.text_boxes,
      file_boxes: { ...(currentFile.file_boxes || {}), [newId]: newFileBox },
      file_box_data: {
        ...(currentFile.file_box_data || {}),
        [newId]: defaultFileBoxData,
      },
      variants: currentFile.variants,
      separators: currentFile.separators,
    });
  }

  // 在文本框之前插入
  function insertBefore(index: number) {
    insertTextBoxAt(index);
  }

  // 在文本框之后插入
  function insertAfter(index: number) {
    insertTextBoxAt(index + 1);
  }

  // 在文件框之前插入
  function insertFileBoxBefore(index: number) {
    insertFileBoxAt(index);
  }

  // 在文件框之后插入
  function insertFileBoxAfter(index: number) {
    insertFileBoxAt(index + 1);
  }

  function handleTextBoxChange(e: CustomEvent) {
    if (!currentFile) return;

    const { textBox } = e.detail;
    appStore.setCurrentFile({
      order: currentFile.order,
      text_boxes: { ...currentFile.text_boxes, [textBox.id]: textBox },
      file_boxes: currentFile.file_boxes,
      file_box_data: currentFile.file_box_data,
      variants: currentFile.variants,
      separators: currentFile.separators,
    });
  }

  function handleVariantsChange(e: CustomEvent) {
    if (!currentFile) return;

    const { id, variantData } = e.detail;
    appStore.setCurrentFile({
      order: currentFile.order,
      text_boxes: currentFile.text_boxes,
      file_boxes: currentFile.file_boxes,
      file_box_data: currentFile.file_box_data,
      variants: { ...currentFile.variants, [id]: variantData },
      separators: currentFile.separators,
    });
  }

  function handleHeightChange(e: CustomEvent) {
    if (!currentFile) return;

    const { id, height } = e.detail;
    const variantData = currentFile.variants[id];
    if (variantData) {
      appStore.setCurrentFile({
        order: currentFile.order,
        text_boxes: currentFile.text_boxes,
        file_boxes: currentFile.file_boxes,
        file_box_data: currentFile.file_box_data,
        variants: {
          ...currentFile.variants,
          [id]: { ...variantData, height },
        },
        separators: currentFile.separators,
      });
    }
  }

  function handleTextBoxDelete(e: CustomEvent) {
    if (!currentFile) return;

    const { id } = e.detail;
    const newOrder = currentFile.order.filter((boxId) => boxId !== id);
    const newTextBoxes = { ...currentFile.text_boxes };
    delete newTextBoxes[id];
    const newVariants = { ...currentFile.variants };
    delete newVariants[id];

    appStore.setCurrentFile({
      order: newOrder,
      text_boxes: newTextBoxes,
      file_boxes: currentFile.file_boxes,
      file_box_data: currentFile.file_box_data,
      variants: newVariants,
      separators: currentFile.separators,
    });
  }

  function handleFileBoxChange(e: CustomEvent) {
    if (!currentFile) return;

    const { fileBox } = e.detail;
    appStore.setCurrentFile({
      order: currentFile.order,
      text_boxes: currentFile.text_boxes,
      file_boxes: { ...(currentFile.file_boxes || {}), [fileBox.id]: fileBox },
      file_box_data: currentFile.file_box_data,
      variants: currentFile.variants,
      separators: currentFile.separators,
    });
  }

  function handleFileBoxDataChange(e: CustomEvent) {
    if (!currentFile) return;

    const { id, fileBoxData } = e.detail;
    appStore.setCurrentFile({
      order: currentFile.order,
      text_boxes: currentFile.text_boxes,
      file_boxes: currentFile.file_boxes,
      file_box_data: {
        ...(currentFile.file_box_data || {}),
        [id]: fileBoxData,
      },
      variants: currentFile.variants,
      separators: currentFile.separators,
    });
  }

  function handleFileBoxHeightChange(e: CustomEvent) {
    if (!currentFile) return;

    const { id, height } = e.detail;
    const fileBoxData = currentFile.file_box_data?.[id];
    if (fileBoxData) {
      appStore.setCurrentFile({
        order: currentFile.order,
        text_boxes: currentFile.text_boxes,
        file_boxes: currentFile.file_boxes,
        file_box_data: {
          ...(currentFile.file_box_data || {}),
          [id]: { ...fileBoxData, height },
        },
        variants: currentFile.variants,
        separators: currentFile.separators,
      });
    }
  }

  function handleFileBoxDelete(e: CustomEvent) {
    if (!currentFile) return;

    const { id } = e.detail;
    const newOrder = currentFile.order.filter((boxId) => boxId !== id);
    const newFileBoxes = { ...(currentFile.file_boxes || {}) };
    delete newFileBoxes[id];
    const newFileBoxData = { ...(currentFile.file_box_data || {}) };
    delete newFileBoxData[id];

    appStore.setCurrentFile({
      order: newOrder,
      text_boxes: currentFile.text_boxes,
      file_boxes: newFileBoxes,
      file_box_data: newFileBoxData,
      variants: currentFile.variants,
      separators: currentFile.separators,
    });
  }

  // dnd-zone 的排序处理
  function handleDndConsider(e: CustomEvent) {
    // 拖动过程中的临时更新
    boxList = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent) {
    // 拖动完成后的最终更新
    boxList = e.detail.items;
    if (!currentFile) return;

    const newOrder = boxList.map((item) => item.id);
    appStore.setCurrentFile({
      order: newOrder,
      text_boxes: currentFile.text_boxes,
      file_boxes: currentFile.file_boxes,
      file_box_data: currentFile.file_box_data,
      variants: currentFile.variants,
      separators: currentFile.separators,
    });
  }

  async function handleSave() {
    if (!currentFile || !$appStore.workspacePath || !$appStore.currentFileName)
      return;

    try {
      const filePath = `${$appStore.workspacePath}/${$appStore.currentFileName}`;
      // 使用 store 中的保存方法，它会自动处理标题清理
      const success = await appStore.saveCurrentFile();
      if (success) {
        alert("File saved successfully!");
      } else {
        alert("Failed to save file");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to save:", error);

      if (errorMessage.includes("Tauri") || errorMessage.includes("invoke")) {
        alert(
          'This feature is only available in the Tauri desktop app. Please run the app using "npm run tauri dev" instead of "npm run dev".'
        );
      } else {
        alert(`Failed to save file: ${errorMessage}`);
      }
    }
  }

  function generatePreview() {
    if (!currentFile) return "";

    let result = "";
    let shadowVars = new Map();

    Object.values(currentFile.text_boxes).forEach((tb) => {
      if (tb.mode === "shadow") {
        const variantData = currentFile.variants[tb.id];
        // 收集所有变体的变量，而不仅仅是当前激活的变体
        variantData?.variants?.forEach((variant) => {
          const varName =
            variant.title.trim().toLowerCase().replace(/\s+/g, "_") || "";
          const content = variant.content || "";
          if (varName) {
            shadowVars.set(varName, content);
          }
        });
      }
    });

    let lastSeparator = "\n\n";
    let isFirstContent = true;

    currentFile.order.forEach((textBoxId) => {
      const tb = currentFile.text_boxes[textBoxId];
      if (!tb || tb.mode === "disabled" || tb.mode === "shadow") return;

      if (!isFirstContent) {
        result += lastSeparator;
      }
      isFirstContent = false;

      const variantData = currentFile.variants[textBoxId];
      const currentVariantIndex = variantData?.current_variant_index || 0;
      let content = variantData?.variants?.[currentVariantIndex]?.content || "";

      shadowVars.forEach((value, key) => {
        const placeholder = `{{${key}}}`;
        content = content.replace(new RegExp(placeholder, "g"), value);
      });

      result += content;
    });

    return result;
  }

  // 键盘快捷键处理
  function handleKeyDown(e: KeyboardEvent) {
    // 如果正在输入文本，不处理快捷键
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // Ctrl+Z 撤销
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      appStore.undo();
    }

    // Ctrl+Y 或 Ctrl+Shift+Z 重做
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "y" || (e.key === "z" && e.shiftKey))
    ) {
      e.preventDefault();
      appStore.redo();
    }
  }

  // 设置 Tauri 拖放事件监听
  onMount(async () => {
    try {
      const webview = getCurrentWebviewWindow();
      unlistenDragDrop = await webview.onDragDropEvent((event) => {
        const payload = event.payload as {
          type: string;
          paths?: string[];
          position?: { x: number; y: number };
        };
        const { type, paths, position } = payload;

        // 辅助函数：找到包含指定点的 FileBox
        function findFileBoxAtPoint(x: number, y: number): string | null {
          // 获取所有 FileBox 元素
          const fileBoxes = document.querySelectorAll("[data-filebox-id]");

          for (const box of fileBoxes) {
            const rect = box.getBoundingClientRect();
            if (
              x >= rect.left &&
              x <= rect.right &&
              y >= rect.top &&
              y <= rect.bottom
            ) {
              return box.getAttribute("data-filebox-id");
            }
          }
          return null;
        }

        // 获取滚动容器的滚动偏移
        function getScrollOffset(): number {
          const scrollContainer = document.querySelector(
            ".flex-1.overflow-y-auto"
          );
          if (scrollContainer) {
            return scrollContainer.scrollTop;
          }
          return 0;
        }

        // 获取 DPI 缩放因子
        const scaleFactor = window.devicePixelRatio || 1;

        if (type === "over" && position) {
          // Tauri 返回的 position 是物理像素坐标（相对于 webview 内容区域）
          // 需要转换为 CSS 像素坐标，与 getBoundingClientRect 保持一致
          const scrollOffset = getScrollOffset();

          // 转换坐标：
          // 1. Tauri 的坐标是物理像素，需要除以 scaleFactor 转换为 CSS 像素
          // 2. Tauri 的 y 坐标是相对于 webview 内容顶部的（包含滚动）
          //    需要减去滚动偏移，转换为相对于视口的坐标
          const viewportX = position.x / scaleFactor;
          const viewportY = position.y / scaleFactor - scrollOffset;

          // 使用 getBoundingClientRect 检测 FileBox
          const fileBoxId = findFileBoxAtPoint(viewportX, viewportY);
          activeDragOverFileBoxId = fileBoxId;
        } else if (type === "drop" && paths && paths.length > 0 && position) {
          // 转换坐标（同上）
          const scrollOffset = getScrollOffset();

          const viewportX = position.x / scaleFactor;
          const viewportY = position.y / scaleFactor - scrollOffset;

          // 使用 getBoundingClientRect 检测 FileBox
          const fileBoxId = findFileBoxAtPoint(viewportX, viewportY);

          if (fileBoxId && currentFile) {
            // 找到对应的 FileBox 数据
            const fileBoxData = currentFile.file_box_data?.[fileBoxId];
            if (fileBoxData) {
              // 添加文件到 FileBox
              const newFiles: FileBoxItem[] = paths.map((path) => ({
                id: Math.random().toString(36).substr(2, 9),
                path,
                checked: true,
              }));

              appStore.setCurrentFile({
                order: currentFile.order,
                text_boxes: currentFile.text_boxes,
                file_boxes: currentFile.file_boxes,
                file_box_data: {
                  ...(currentFile.file_box_data || {}),
                  [fileBoxId]: {
                    ...fileBoxData,
                    files: [...fileBoxData.files, ...newFiles],
                  },
                },
                variants: currentFile.variants,
                separators: currentFile.separators,
              });
            }
          }
          // 重置拖放状态
          activeDragOverFileBoxId = null;
        } else if (type === "leave") {
          // 鼠标离开拖放区域
          activeDragOverFileBoxId = null;
        }
      });
    } catch (error) {
      console.error("[App] Failed to setup drag drop listener:", error);
    }
  });

  onDestroy(() => {
    if (unlistenDragDrop) {
      unlistenDragDrop();
    }
  });
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="flex h-screen bg-gray-900">
  <Sidebar />

  <div class="flex-1 flex flex-col h-full overflow-hidden">
    {#if currentFile}
      <div
        class="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <h2 class="text-white font-bold">{$appStore.currentFileName}</h2>
          <div class="flex items-center gap-1">
            <button
              on:click={() => appStore.undo()}
              disabled={!canUndo}
              class="px-2 py-1 rounded text-sm transition-colors {canUndo
                ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'text-gray-600 cursor-not-allowed'}"
              title="Undo (Ctrl+Z)"
            >
              ←
            </button>
            <button
              on:click={() => appStore.redo()}
              disabled={!canRedo}
              class="px-2 py-1 rounded text-sm transition-colors {canRedo
                ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'text-gray-600 cursor-not-allowed'}"
              title="Redo (Ctrl+Y)"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div class="max-w-4xl mx-auto min-h-full">
          <!-- 第一个插入按钮（在第一个框之前） -->
          <div class="flex justify-center py-1 gap-2">
            <button
              on:click={() => insertBefore(0)}
              class="px-2 py-0.5 bg-green-600 text-white rounded text-xs opacity-10 hover:opacity-100 hover:scale-150 transition-all"
              title="Insert Text Box here"
            >
              + Text Box
            </button>
            <button
              on:click={() => insertFileBoxBefore(0)}
              class="px-2 py-0.5 bg-blue-600 text-white rounded text-xs opacity-10 hover:opacity-100 hover:scale-150 transition-all"
              title="Insert File Box here"
            >
              + File Box
            </button>
          </div>

          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            use:dndzone={{
              items: boxList,
              flipDurationMs: 200,
              type: "box",
            }}
            on:consider={handleDndConsider}
            on:finalize={handleDndFinalize}
            class="space-y-1"
          >
            {#each boxList as item, index (item.id)}
              {@const type = item.type}
              {#if type === "text"}
                {@const textBox = item.textBox}
                {@const variantData = item.variantData}
                {#if textBox && variantData}
                  <div id={textBox.id}>
                    <TextBox
                      {textBox}
                      {variantData}
                      on:change={handleTextBoxChange}
                      on:heightchange={handleHeightChange}
                      on:delete={handleTextBoxDelete}
                      on:variantschange={handleVariantsChange}
                    />
                    <!-- 在每个框之后的插入按钮 -->
                    <div class="flex justify-center py-1 gap-2">
                      <button
                        on:click={() => insertAfter(index)}
                        class="px-2 py-0.5 bg-green-600 text-white rounded text-xs opacity-10 hover:opacity-100 hover:scale-150 transition-all"
                        title="Insert Text Box here"
                      >
                        + Text Box
                      </button>
                      <button
                        on:click={() => insertFileBoxAfter(index)}
                        class="px-2 py-0.5 bg-blue-600 text-white rounded text-xs opacity-10 hover:opacity-100 hover:scale-150 transition-all"
                        title="Insert File Box here"
                      >
                        + File Box
                      </button>
                    </div>
                  </div>
                {/if}
              {:else if type === "file"}
                {@const fileBox = item.fileBox}
                {@const fileBoxData = item.fileBoxData}
                {@const isFileDragOver = item.isFileDragOver}
                {#if fileBox && fileBoxData}
                  <div id={fileBox.id}>
                    <FileBox
                      {fileBox}
                      {fileBoxData}
                      {isFileDragOver}
                      on:change={handleFileBoxChange}
                      on:heightchange={handleFileBoxHeightChange}
                      on:delete={handleFileBoxDelete}
                      on:datachange={handleFileBoxDataChange}
                    />
                    <!-- 在每个框之后的插入按钮 -->
                    <div class="flex justify-center py-1 gap-2">
                      <button
                        on:click={() => insertAfter(index)}
                        class="px-2 py-0.5 bg-green-600 text-white rounded text-xs opacity-10 hover:opacity-100 hover:scale-150 transition-all"
                        title="Insert Text Box here"
                      >
                        + Text Box
                      </button>
                      <button
                        on:click={() => insertFileBoxAfter(index)}
                        class="px-2 py-0.5 bg-blue-600 text-white rounded text-xs opacity-10 hover:opacity-100 hover:scale-150 transition-all"
                        title="Insert File Box here"
                      >
                        + File Box
                      </button>
                    </div>
                  </div>
                {/if}
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <p class="text-gray-400 text-lg mb-4">No file selected</p>
          <p class="text-gray-500 text-sm">
            Select a workspace and open a file from the sidebar
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
