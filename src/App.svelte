<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { appStore, historyManager } from "./store";
  import { savePromptFile } from "./tauri-api";
  import Sidebar from "./components/Sidebar.svelte";
  import TextBox from "./components/TextBox.svelte";
  import type { TextBox as TextBoxType, Variant, BoxType } from "./types";

  $: currentFile = $appStore.currentFile;
  $: canUndo = $historyManager.past.length > 0;
  $: canRedo = $historyManager.future.length > 0;

  // 用于 dnd-zone 的列表
  $: textBoxList = currentFile
    ? currentFile.order.map((id) => ({
        id,
        textBox: currentFile.text_boxes[id],
        variantData: currentFile.variants[id],
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

  // 在文本框之前插入
  function insertBefore(index: number) {
    insertTextBoxAt(index);
  }

  // 在文本框之后插入
  function insertAfter(index: number) {
    insertTextBoxAt(index + 1);
  }

  function handleTextBoxChange(e: CustomEvent) {
    if (!currentFile) return;

    const { textBox } = e.detail;
    appStore.setCurrentFile({
      order: currentFile.order,
      text_boxes: { ...currentFile.text_boxes, [textBox.id]: textBox },
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
      variants: newVariants,
      separators: currentFile.separators,
    });
  }

  // dnd-zone 的排序处理
  function handleDndConsider(e: CustomEvent) {
    // 拖动过程中的临时更新
    textBoxList = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent) {
    // 拖动完成后的最终更新
    textBoxList = e.detail.items;
    if (!currentFile) return;

    const newOrder = textBoxList.map((item) => item.id);
    appStore.setCurrentFile({
      order: newOrder,
      text_boxes: currentFile.text_boxes,
      variants: currentFile.variants,
      separators: currentFile.separators,
    });
  }

  async function handleSave() {
    if (!currentFile || !$appStore.workspacePath || !$appStore.currentFileName)
      return;

    try {
      const filePath = `${$appStore.workspacePath}/${$appStore.currentFileName}`;
      await savePromptFile(filePath, currentFile);
      alert("File saved successfully!");
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
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Ctrl+Z 撤销
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      appStore.undo();
    }

    // Ctrl+Y 或 Ctrl+Shift+Z 重做
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      appStore.redo();
    }
  }
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
          <!-- 第一个插入按钮（在第一个文本框之前） -->
          <div class="flex justify-center py-1">
            <button
              on:click={() => insertBefore(0)}
              class="px-2 py-0.5 bg-green-600/80 hover:bg-green-700 text-white rounded text-xs opacity-0 hover:opacity-100 transition-opacity"
              title="Insert Text Box here"
            >
              + Text Box
            </button>
          </div>

          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            use:dndzone={{
              items: textBoxList,
              flipDurationMs: 200,
              type: "textbox",
            }}
            on:consider={handleDndConsider}
            on:finalize={handleDndFinalize}
            class="space-y-1"
          >
            {#each textBoxList as item, index (item.id)}
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
                  <!-- 在每个文本框之后的插入按钮 -->
                  <div class="flex justify-center py-1">
                    <button
                      on:click={() => insertAfter(index)}
                      class="px-2 py-0.5 bg-green-600/80 hover:bg-green-700 text-white rounded text-xs opacity-0 hover:opacity-100 transition-opacity"
                      title="Insert Text Box here"
                    >
                      + Text Box
                    </button>
                  </div>
                </div>
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
