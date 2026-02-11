<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { TextBox, VariantData, Variant } from "../types";

  export let textBox: TextBox;
  export let index: number | undefined = undefined;
  export let variantData: VariantData;

  const dispatch = createEventDispatcher();

  let isDragging = false;
  let startY = 0;
  let startHeight = 0;
  let isResizing = false;
  let titleInput: HTMLInputElement;
  let isTitleFocused = false;
  let isEditingTitle = false;

  // 变体拖动排序相关
  let draggedVariantIndex: number | null = null;
  let dragOverVariantIndex: number | null = null;
  let variantContainerElement: HTMLElement;

  $: height = variantData.height;
  $: currentVariantIndex = variantData.current_variant_index;
  $: variantList = variantData.variants || [];
  $: totalVariants = variantList.length;
  $: currentVariant = variantList[currentVariantIndex] || {
    content: "",
    title: "",
  };
  $: currentContent = currentVariant.content;
  $: currentTitle = currentVariant.title;

  // 获取显示的标题（如果没有保存的标题，则从内容生成预览）
  function getDisplayTitle(variant: Variant): string {
    if (variant.title && variant.title.trim()) {
      return variant.title.trim();
    }
    // 从内容生成预览标题
    const trimmed = variant.content.trim();
    if (trimmed.length > 0) {
      return trimmed.substring(0, Math.min(12, trimmed.length));
    }
    return "Untitled";
  }

  function handleDragStart(e: DragEvent) {
    e.stopPropagation();
    isDragging = true;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
    dispatch("dragstart");
  }

  function handleDragEnd(e: DragEvent) {
    e.stopPropagation();
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
    const newHeight = Math.max(100, startHeight + diff);
    height = newHeight;
    dispatch("heightchange", { id: textBox.id, height: newHeight });
  }

  function handleResizeEnd() {
    isResizing = false;
  }

  function handleTitleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    updateVariantTitle(currentVariantIndex, input.value);
  }

  function handleTitleFocus() {
    isTitleFocused = true;
  }

  function handleTitleBlur(e: Event) {
    isTitleFocused = false;
    isEditingTitle = false;
  }

  function handleTitleClick() {
    if (!isEditingTitle) {
      isEditingTitle = true;
      setTimeout(() => {
        if (titleInput) {
          titleInput.focus();
          titleInput.select();
        }
      }, 0);
    }
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (titleInput) {
        titleInput.blur();
      }
    }
  }

  function handleModeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    textBox.mode = select.value as "normal" | "disabled" | "shadow";
    dispatch("change", { textBox });
  }

  function handleContentChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    updateVariantContent(currentVariantIndex, textarea.value);
  }

  function handleInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    updateVariantContent(currentVariantIndex, textarea.value);
  }

  function handleVariantInput(vIndex: number) {
    return (e: Event) => {
      const textarea = e.target as HTMLTextAreaElement;
      updateVariantContent(vIndex, textarea.value);
    };
  }

  function updateVariantContent(variantIndex: number, content: string) {
    const newVariants = [...(variantData.variants || [])];
    newVariants[variantIndex] = { ...newVariants[variantIndex], content };
    dispatch("variantschange", {
      id: textBox.id,
      variantData: { ...variantData, variants: newVariants },
    });
  }

  function updateVariantTitle(variantIndex: number, title: string) {
    const newVariants = [...(variantData.variants || [])];
    newVariants[variantIndex] = { ...newVariants[variantIndex], title };
    dispatch("variantschange", {
      id: textBox.id,
      variantData: { ...variantData, variants: newVariants },
    });
  }

  function handleDelete() {
    dispatch("delete", { id: textBox.id });
  }

  function handleDeleteVariant() {
    if (totalVariants <= 1) {
      alert("Cannot delete the last variant");
      return;
    }

    if (confirm("Delete this variant?")) {
      const newVariants = [...(variantData.variants || [])];
      newVariants.splice(currentVariantIndex, 1);
      const newTotalVariants = totalVariants - 1;
      let newIndex = currentVariantIndex;
      if (currentVariantIndex >= newTotalVariants) {
        newIndex = newTotalVariants - 1;
      }
      dispatch("variantschange", {
        id: textBox.id,
        variantData: {
          ...variantData,
          variants: newVariants,
          current_variant_index: newIndex,
        },
      });
    }
  }

  function handleAddVariant() {
    // 复制当前变体的内容和标题
    const newVariant: Variant = {
      content: currentContent,
      title: currentTitle || "", // 复制当前标题（可能是空的）
    };
    const newVariants = [...(variantData.variants || []), newVariant];
    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        variants: newVariants,
        current_variant_index: newVariants.length - 1,
      },
    });
  }

  // 切换到指定变体
  function handleSwitchVariant(index: number) {
    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        current_variant_index: index,
      },
    });
  }

  // 变体拖动排序 - 开始拖动
  function handleVariantDragStart(e: DragEvent, index: number) {
    e.stopPropagation();
    draggedVariantIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
  }

  // 变体拖动排序 - 拖动经过
  function handleVariantDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    dragOverVariantIndex = index;
  }

  // 变体拖动排序 - 放置
  function handleVariantDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedVariantIndex === null || draggedVariantIndex === dropIndex) {
      draggedVariantIndex = null;
      dragOverVariantIndex = null;
      return;
    }

    // 重新排序变体
    const newVariants = [...(variantData.variants || [])];
    const [movedVariant] = newVariants.splice(draggedVariantIndex, 1);
    newVariants.splice(dropIndex, 0, movedVariant);

    // 更新当前选中的变体索引
    let newCurrentIndex = currentVariantIndex;
    if (draggedVariantIndex === currentVariantIndex) {
      // 如果移动的是当前选中的变体
      newCurrentIndex = dropIndex;
    } else if (
      draggedVariantIndex < currentVariantIndex &&
      dropIndex >= currentVariantIndex
    ) {
      // 如果从前方向后移动，且经过当前选中的变体
      newCurrentIndex = currentVariantIndex - 1;
    } else if (
      draggedVariantIndex > currentVariantIndex &&
      dropIndex <= currentVariantIndex
    ) {
      // 如果从后方向前移动，且经过当前选中的变体
      newCurrentIndex = currentVariantIndex + 1;
    }

    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        variants: newVariants,
        current_variant_index: newCurrentIndex,
      },
    });

    draggedVariantIndex = null;
    dragOverVariantIndex = null;
  }

  // 变体拖动排序 - 拖动结束
  function handleVariantDragEnd(e: DragEvent) {
    e.stopPropagation();
    draggedVariantIndex = null;
    dragOverVariantIndex = null;
  }

  $: modeColor =
    textBox.mode === "normal"
      ? "bg-gray-700"
      : textBox.mode === "disabled"
        ? "bg-gray-800"
        : "bg-purple-800";
</script>

<svelte:window on:mousemove={handleResizeMove} on:mouseup={handleResizeEnd} />

<div
  class="flex flex-col bg-gray-800 rounded-lg mb-2 overflow-hidden relative {isDragging
    ? 'opacity-50'
    : ''}"
  style="height: {height}px;"
>
  <!-- 标题栏 - 三栏布局 -->
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
            class="font-medium truncate px-1 rounded cursor-pointer hover:bg-gray-700 text-sm {currentTitle?.trim()
              ? 'text-white'
              : 'text-gray-400 italic'}"
            role="button"
            tabindex="0"
            on:click={handleTitleClick}
            on:keydown={(e) => e.key === "Enter" && handleTitleClick()}
            title="Click to edit title"
          >
            {getDisplayTitle(currentVariant)}
          </div>
        {:else}
          <input
            type="text"
            bind:this={titleInput}
            value={currentTitle}
            on:input={handleTitleInput}
            on:focus={handleTitleFocus}
            on:blur={handleTitleBlur}
            on:keydown={handleTitleKeyDown}
            class="w-full bg-transparent font-medium truncate focus:outline-none focus:bg-gray-700 rounded px-1 text-white text-sm"
            placeholder="Enter title..."
          />
        {/if}
      </div>
    </div>

    <!-- 中间：变体切换按钮列表 -->
    <div class="flex-1 min-w-0">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="flex flex-wrap gap-1 justify-center"
        role="list"
        bind:this={variantContainerElement}
        on:dragover={(e) => {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }
        }}
        on:drop={(e) => {
          e.preventDefault();
          // 如果 drop 在容器上但没有在具体的变体上，默认放到最后
          if (draggedVariantIndex !== null && dragOverVariantIndex === null) {
            handleVariantDrop(e, variantList.length - 1);
          }
        }}
      >
        {#each variantList as variant, vIndex (vIndex)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            draggable="true"
            role="button"
            tabindex="0"
            on:click={() => handleSwitchVariant(vIndex)}
            on:keydown={(e) => e.key === "Enter" && handleSwitchVariant(vIndex)}
            on:dragstart={(e) => handleVariantDragStart(e, vIndex)}
            on:dragover={(e) => handleVariantDragOver(e, vIndex)}
            on:drop={(e) => handleVariantDrop(e, vIndex)}
            on:dragend={(e) => handleVariantDragEnd(e)}
            class="px-2 py-1 text-xs rounded border transition-all duration-150 cursor-grab active:cursor-grabbing select-none max-w-[80px] truncate
              {vIndex === currentVariantIndex
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500'}
              {dragOverVariantIndex === vIndex && draggedVariantIndex !== vIndex
              ? 'ring-2 ring-yellow-400'
              : ''}
              {draggedVariantIndex === vIndex ? 'opacity-50' : ''}"
            title="{getDisplayTitle(
              variant
            )} - Drag to reorder, click to switch"
          >
            {getDisplayTitle(variant)}
          </div>
        {/each}
      </div>
    </div>

    <!-- 右侧：操作按钮 -->
    <div class="flex items-center gap-1 flex-shrink-0">
      <select
        value={textBox.mode}
        on:change={handleModeChange}
        class="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
      >
        <option value="normal">Normal</option>
        <option value="disabled">Disabled</option>
        <option value="shadow">Shadow</option>
      </select>

      <button
        on:click={handleDeleteVariant}
        class="text-orange-400 hover:text-orange-300 px-2 py-1 rounded hover:bg-orange-900/30 text-xs"
        title="Delete Variant"
      >
        🗑
      </button>
      <button
        on:click={handleAddVariant}
        class="text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-900/30 text-xs"
        title="Add Variant"
      >
        ➕
      </button>
      <button
        on:click={handleDelete}
        class="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30 text-xs"
        title="Delete"
      >
        ×
      </button>
    </div>
  </div>

  <div class="flex-1 relative overflow-hidden">
    <div
      class="absolute inset-0 flex"
      style="transform: translateX(-{currentVariantIndex *
        100}%); transition: transform 0.3s ease;"
    >
      {#each variantList as variant, vIndex}
        <div class="flex-shrink-0 w-full h-full" style="width: 100%;">
          <textarea
            value={variant.content}
            on:input={handleVariantInput(vIndex)}
            on:blur={handleContentChange}
            class="w-full h-full bg-gray-900 text-white p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your text here..."
          ></textarea>
        </div>
      {/each}
    </div>

    {#if totalVariants > 1}
      <div
        class="absolute bottom-2 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-xs px-2 py-1 rounded"
      >
        {currentVariantIndex + 1} / {totalVariants}
      </div>
    {/if}
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
