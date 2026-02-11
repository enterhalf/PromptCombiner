<script lang="ts">
  import { appStore } from "./store";
  import { savePromptFile } from "./tauri-api";
  import Sidebar from "./components/Sidebar.svelte";
  import TextBox from "./components/TextBox.svelte";
  import Workbench from "./components/Workbench.svelte";
  import type { TextBox as TextBoxType, Variant } from "./types";

  let draggingIndex: number | null = null;
  let dropTargetIndex: number | null = null;
  let containerElement: HTMLElement;

  $: currentFile = $appStore.currentFile;
  $: activeTab = $appStore.activeTab;

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  function addTextBox() {
    if (!currentFile) return;

    const newId = generateId();
    const newTextBox: TextBoxType = {
      id: newId,
      mode: "normal",
    };

    const defaultVariant: Variant = {
      content: "",
      title: "Untitled",
    };

    appStore.setCurrentFile({
      name: currentFile.name,
      order: [...currentFile.order, newId],
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

  function handleTextBoxChange(e: CustomEvent) {
    if (!currentFile) return;

    const { textBox } = e.detail;
    appStore.setCurrentFile({
      name: currentFile.name,
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
      name: currentFile.name,
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
        name: currentFile.name,
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
      name: currentFile.name,
      order: newOrder,
      text_boxes: newTextBoxes,
      variants: newVariants,
      separators: currentFile.separators,
    });
  }

  function handleDragStart(index: number) {
    draggingIndex = index;
  }

  function handleDragEnd() {
    draggingIndex = null;
    dropTargetIndex = null;
  }

  function handleContainerDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }

    if (!containerElement || draggingIndex === null || !currentFile) return;

    // 计算拖放目标位置
    const rect = containerElement.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    // 获取所有子元素的位置
    const children = Array.from(containerElement.children);
    let newDropIndex = currentFile.order.length;

    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      const childRect = child.getBoundingClientRect();
      const childMiddle = childRect.top + childRect.height / 2 - rect.top;

      if (mouseY < childMiddle) {
        newDropIndex = i;
        break;
      }
    }

    dropTargetIndex = newDropIndex;
  }

  function handleContainerDragLeave(e: DragEvent) {
    // 只有当真正离开容器时才重置
    if (!containerElement?.contains(e.relatedTarget as Node)) {
      dropTargetIndex = null;
    }
  }

  function handleContainerDrop(e: DragEvent) {
    e.preventDefault();
    if (!currentFile || draggingIndex === null) return;

    // 如果没有有效的放置目标，默认放在最后
    let targetIndex =
      dropTargetIndex !== null ? dropTargetIndex : currentFile.order.length;

    // 如果拖放到自己后面，需要调整索引
    if (draggingIndex < targetIndex) {
      targetIndex = targetIndex - 1;
    }

    if (draggingIndex !== targetIndex) {
      const newOrder = [...currentFile.order];
      const [item] = newOrder.splice(draggingIndex, 1);
      newOrder.splice(targetIndex, 0, item);
      appStore.setCurrentFile({
        name: currentFile.name,
        order: newOrder,
        text_boxes: currentFile.text_boxes,
        variants: currentFile.variants,
        separators: currentFile.separators,
      });
    }

    draggingIndex = null;
    dropTargetIndex = null;
  }

  async function handleSave() {
    if (!currentFile || !$appStore.workspacePath) return;

    try {
      const filePath = `${$appStore.workspacePath}/${currentFile.name}`;
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
        const currentVariantIndex = variantData?.current_variant_index || 0;
        const currentVariant = variantData?.variants?.[currentVariantIndex];
        const varName =
          currentVariant?.title.trim().toLowerCase().replace(" ", "_") || "";
        const content = currentVariant?.content || "";
        if (varName) {
          shadowVars.set(varName, content);
        }
      }
    });

    let lastSeparator = "\n\n";

    currentFile.order.forEach((textBoxId, index) => {
      const tb = currentFile.text_boxes[textBoxId];
      if (!tb || tb.mode === "disabled") return;

      if (index > 0) {
        result += lastSeparator;
      }

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
</script>

<div class="flex h-screen bg-gray-900">
  <Sidebar>
    <svelte:fragment slot="workbench">
      {#if activeTab === "workbench" && currentFile}
        <Workbench {currentFile} />
      {/if}
    </svelte:fragment>
  </Sidebar>

  <div class="flex-1 flex flex-col h-full overflow-hidden">
    {#if currentFile}
      <div
        class="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between"
      >
        <h2 class="text-white font-bold">{currentFile.name}</h2>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="flex-1 overflow-y-auto p-4"
        role="list"
        on:dragover={handleContainerDragOver}
        on:dragleave={handleContainerDragLeave}
        on:drop={handleContainerDrop}
      >
        <div class="max-w-4xl mx-auto" bind:this={containerElement}>
          {#each currentFile.order as textBoxId, index (textBoxId)}
            {@const textBox = currentFile.text_boxes[textBoxId]}
            {@const variantData = currentFile.variants[textBoxId]}
            {#if textBox && variantData}
              <div
                id={textBox.id}
                role="listitem"
                class="{draggingIndex === index
                  ? 'opacity-50'
                  : ''} {dropTargetIndex === index
                  ? 'border-t-2 border-blue-500'
                  : ''}"
              >
                <TextBox
                  {textBox}
                  {index}
                  {variantData}
                  on:change={handleTextBoxChange}
                  on:heightchange={handleHeightChange}
                  on:delete={handleTextBoxDelete}
                  on:dragstart={() => handleDragStart(index)}
                  on:dragend={handleDragEnd}
                  on:variantschange={handleVariantsChange}
                />
              </div>
            {/if}
          {/each}

          <!-- 拖放到最后的位置指示器 -->
          {#if dropTargetIndex === currentFile.order.length && draggingIndex !== null}
            <div class="border-t-2 border-blue-500 mt-2"></div>
          {/if}

          <div class="flex gap-2 mt-4">
            <button
              on:click={addTextBox}
              class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            >
              + Text Box
            </button>
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
