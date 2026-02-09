<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { TextBox, VariantData, Variant } from "../types";

  export let textBox: TextBox;
  export let index: number;
  export let variantData: VariantData;

  const dispatch = createEventDispatcher();

  let isDragging = false;
  let isDragHandle = false;
  let startY = 0;
  let startHeight = 0;
  let isResizing = false;
  let slideOffset = 0;
  let isSliding = false;
  let startX = 0;
  let slideContainerWidth = 0;
  let variantWidth = 0;
  let slideContainer: HTMLElement;
  let titleInput: HTMLInputElement;
  let isTitleFocused = false;
  let isEditingTitle = false;

  $: height = variantData.height;
  $: currentVariantIndex = variantData.current_variant_index;
  $: variantList = variantData.variants || [];
  $: totalVariants = variantList.length;
  $: currentVariant = variantList[currentVariantIndex] || { content: "", title: "" };
  $: currentContent = currentVariant.content;
  $: currentTitle = currentVariant.title;
  $: hasCustomTitle = currentTitle.trim().length > 0;

  function handleDragHandleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isDragHandle = true;
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragStart(e: DragEvent) {
    if (!isDragHandle) {
      e.preventDefault();
      return;
    }
    isDragging = true;
  }

  function handleDragEnd() {
    isDragging = false;
    isDragHandle = false;
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
    const input = e.target as HTMLInputElement;
    if (!input.value.trim()) {
      isEditingTitle = false;
      updateVariantTitle(currentVariantIndex, generateAutoTitle(currentContent));
    } else {
      isEditingTitle = false;
    }
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
    if (!isTitleFocused && !hasCustomTitle) {
      updateVariantTitle(currentVariantIndex, generateAutoTitle(textarea.value));
    }
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

  function handlePrevVariantMouseDown(e: MouseEvent) {
    e.stopPropagation();
  }

  function handleNextVariantMouseDown(e: MouseEvent) {
    e.stopPropagation();
  }

  function generateAutoTitle(content: string): string {
    const trimmed = content.trim();
    if (trimmed.length > 0) {
      return trimmed.substring(0, Math.min(20, trimmed.length));
    }
    return "Untitled";
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
    const newVariant: Variant = {
      content: currentContent,
      title: generateAutoTitle(currentContent),
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

  function handlePrevVariant() {
    if (currentVariantIndex > 0) {
      dispatch("variantschange", {
        id: textBox.id,
        variantData: {
          ...variantData,
          current_variant_index: currentVariantIndex - 1,
        },
      });
    }
  }

  function handleNextVariant() {
    if (currentVariantIndex < totalVariants - 1) {
      dispatch("variantschange", {
        id: textBox.id,
        variantData: {
          ...variantData,
          current_variant_index: currentVariantIndex + 1,
        },
      });
    }
  }

  function handleSlideStart(e: MouseEvent) {
    if (e.button !== 0) return;
    isSliding = true;
    startX = e.clientX;
    e.preventDefault();
  }

  function handleSlideMove(e: MouseEvent) {
    if (!isSliding) return;
    const diff = e.clientX - startX;
    const maxOffset = slideContainerWidth - variantWidth;
    slideOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));
  }

  function handleSlideEnd() {
    if (!isSliding) return;
    isSliding = false;
    const threshold = variantWidth / 3;

    if (slideOffset > threshold) {
      handlePrevVariant();
    } else if (slideOffset < -threshold) {
      handleNextVariant();
    }
    slideOffset = 0;
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
  class="flex flex-col bg-gray-800 rounded-lg mb-2 overflow-hidden relative"
  style="height: {height}px;"
  draggable="true"
  on:dragstart={handleDragStart}
  on:dragend={handleDragEnd}
>
  <div class="flex items-center px-3 py-2 {modeColor} border-b border-gray-600">
    <div
      class="mr-2 cursor-move text-gray-400 hover:text-gray-300"
      on:mousedown={handleDragHandleMouseDown}
      title="Drag to reorder"
    >
      ☰
    </div>
    <div class="flex-1 relative mr-2">
      {#if !isEditingTitle}
        <div
          class="font-medium truncate px-1 rounded cursor-pointer hover:bg-gray-700 {hasCustomTitle
            ? 'text-white'
            : 'text-gray-500'}"
          on:click={handleTitleClick}
          title="Click to edit title"
        >
          {currentTitle || "Untitled"}
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
          class="w-full bg-transparent font-medium truncate focus:outline-none focus:bg-gray-700 rounded px-1 text-white"
          placeholder="Untitled"
        />
      {/if}
    </div>

    <select
      value={textBox.mode}
      on:change={handleModeChange}
      class="bg-gray-700 text-white text-sm px-2 py-1 rounded mr-2 border border-gray-600"
    >
      <option value="normal">Normal</option>
      <option value="disabled">Disabled</option>
      <option value="shadow">Shadow</option>
    </select>

    <button
      on:click={handleDeleteVariant}
      class="text-orange-400 hover:text-orange-300 px-2 py-1 rounded hover:bg-orange-900/30 mr-1"
      title="Delete Variant"
    >
      🗑
    </button>
    <button
      on:click={handleAddVariant}
      class="text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-900/30 mr-1"
      title="Add Variant"
    >
      ➕
    </button>
    <button
      on:click={handleDelete}
      class="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30"
      title="Delete"
    >
      ×
    </button>
  </div>

  <div class="flex-1 relative overflow-hidden">
    <div
      class="absolute inset-0 flex"
      style="transform: translateX(-{currentVariantIndex *
        100}%); transition: transform 0.3s ease;"
      bind:this={slideContainer}
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
      <button
        on:click={handlePrevVariant}
        on:mousedown={handlePrevVariantMouseDown}
        class="absolute left-2 top-1/2 -translate-y-1/2 bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 {currentVariantIndex ===
        0
          ? 'opacity-30 cursor-not-allowed'
          : ''}"
        disabled={currentVariantIndex === 0}
      >
        ◀
      </button>
      <button
        on:click={handleNextVariant}
        on:mousedown={handleNextVariantMouseDown}
        class="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 {currentVariantIndex ===
        totalVariants - 1
          ? 'opacity-30 cursor-not-allowed'
          : ''}"
        disabled={currentVariantIndex === totalVariants - 1}
      >
        ▶
      </button>
      <div
        class="absolute bottom-2 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-xs px-2 py-1 rounded"
      >
        {currentVariantIndex + 1} / {totalVariants}
      </div>
    {/if}
  </div>

  <div
    class="h-2 bg-gray-700 hover:bg-gray-600 cursor-ns-resize flex items-center justify-center"
    on:mousedown={handleResizeStart}
  >
    <div class="w-8 h-1 bg-gray-500 rounded"></div>
  </div>
</div>
