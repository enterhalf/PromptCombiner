<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { createEventDispatcher } from "svelte";
  import { appStore } from "../store";
  import type { TextBox, VariantData, Variant } from "../types";

  export let textBox: TextBox;
  export let index: number | undefined = undefined;
  export let variantData: VariantData;

  const dispatch = createEventDispatcher();

  // dnd-zone 中变体条目的形状（isDndShadowItem 为拖动过程中的占位标记）
  interface DndVariantItem {
    id: number | string;
    index: number;
    variant: Variant;
    isDndShadowItem?: boolean;
  }

  let isDragging = false;
  let startY = 0;
  let startHeight = 0;
  let isResizing = false;
  let titleInput: HTMLInputElement;
  let isTitleFocused = false;
  let isEditingTitle = false;

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

  // 用于 dnd-zone 的变体列表
  // 注意：item.id 必须唯一，且不能直接使用"数组下标"——svelte-dnd-action 跨
  // zone 拖动时会把影子条目的 id 改写为被拖条目的 id，并据此过滤其他 zone 里
  // 同 id 的条目；若用纯下标，目标框里同下标的变体会被误删。因此加上框 id 前缀。
  $: variantItems = variantList.map((variant, idx) => ({
    id: `${textBox.id}-v${idx}`,
    variant,
    index: idx,
  }));

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
    const newHeight = Math.max(100, startHeight + diff);
    height = newHeight;
    // 拖拽过程中不派发事件，避免占用撤销/重做历史
  }

  function handleResizeEnd() {
    if (isResizing) {
      isResizing = false;
      // 拖拽结束时才派发事件，记录最终高度
      dispatch("heightchange", { id: textBox.id, height });
    }
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
      appStore.showToast("Cannot delete the last variant", "error");
      return;
    }

    const newVariants = [...(variantData.variants || [])];
    newVariants.splice(currentVariantIndex, 1);
    const newTotalVariants = totalVariants - 1;
    // 删除后回到上一个索引位置，如果当前是第一个则保持在第一个
    let newIndex = Math.max(0, currentVariantIndex - 1);
    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        variants: newVariants,
        current_variant_index: newIndex,
      },
    });
  }

  function handleAddVariant() {
    // 生成新变体标题
    let newTitle = "";
    if (currentTitle && currentTitle.trim()) {
      // 匹配末尾的数字
      const match = currentTitle.match(/^(.*?)(\d+)$/);
      if (match) {
        // 末尾是数字，数字+1
        const prefix = match[1];
        const num = parseInt(match[2], 10) + 1;
        newTitle = prefix + num;
      } else {
        // 末尾没有数字，添加2
        newTitle = currentTitle + "2";
      }
    }

    const newVariant: Variant = {
      content: currentContent,
      title: newTitle,
    };
    // 在当前变体右侧插入新变体
    const newVariants = [...(variantData.variants || [])];
    const insertIndex = currentVariantIndex + 1;
    newVariants.splice(insertIndex, 0, newVariant);
    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        variants: newVariants,
        current_variant_index: insertIndex,
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

  // dnd-zone 的变体排序处理
  function handleVariantDndConsider(e: CustomEvent) {
    variantItems = e.detail.items;
  }

  function handleVariantDndFinalize(e: CustomEvent) {
    // 去掉拖动过程中库可能留下的影子占位条目（isDndShadowItem），只保留真实变体
    const rawItems = (e.detail.items || []) as DndVariantItem[];
    const finalItems = rawItems.filter((item) => !item.isDndShadowItem);
    variantItems = finalItems.map((item) => ({
      id: String(item.id),
      variant: item.variant,
      index: item.index,
    }));

    // 重新排序变体（跨 Text Box 落点时，items 已包含被拖入的变体）
    const newVariants = finalItems.map((item) => item.variant);

    // 找到当前选中的变体在新列表中的位置
    const currentVariantId = variantList[currentVariantIndex];
    let newCurrentIndex = newVariants.findIndex((v) => v === currentVariantId);
    if (newCurrentIndex === -1) {
      // 找不到（当前变体被移走/移除）：列表已空则回到 0，否则保持在范围内
      newCurrentIndex =
        newVariants.length === 0
          ? 0
          : Math.min(currentVariantIndex, newVariants.length - 1);
    }

    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        variants: newVariants,
        current_variant_index: newCurrentIndex,
      },
    });
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
        use:dndzone={{
          items: variantItems,
          flipDurationMs: 200,
          type: "variant",
        }}
        on:consider={handleVariantDndConsider}
        on:finalize={handleVariantDndFinalize}
        class="flex flex-wrap gap-1 justify-center"
        role="list"
      >
        {#each variantItems as item (item.id)}
          {@const vIndex = item.index}
          {@const variant = item.variant}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            role="button"
            tabindex="0"
            on:click={() => handleSwitchVariant(vIndex)}
            on:keydown={(e) => e.key === "Enter" && handleSwitchVariant(vIndex)}
            class="px-2 py-1 text-xs rounded border transition-all duration-150 cursor-grab active:cursor-grabbing select-none max-w-[80px] truncate
              {vIndex === currentVariantIndex
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500'}"
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
        on:click={handleAddVariant}
        class="text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-900/30 text-xs"
        title="Add Variant"
      >
        ➕
      </button>
      <button
        on:click={handleDeleteVariant}
        class="text-orange-400 hover:text-orange-300 px-2 py-1 rounded hover:bg-orange-900/30 text-xs"
        title="Delete Variant"
      >
        🗑
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
            class="w-full h-full bg-gray-900 text-white p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your text here..."
          ></textarea>
        </div>
      {/each}
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
