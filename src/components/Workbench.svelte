<script lang="ts">
  import { appStore } from "../store";
  import type { PromptFile } from "../types";

  export let currentFile: PromptFile;

  let draggingIndex: number | null = null;
  let dropTargetIndex: number | null = null;
  let containerElement: HTMLElement;

  // 直接从 currentFile.order 获取大纲项，避免状态不同步
  $: outlineItems = currentFile.order.map((textBoxId, index) => {
    const tb = currentFile.text_boxes[textBoxId];
    const variantData = currentFile.variants[textBoxId];
    const currentVariantIndex = variantData?.current_variant_index || 0;
    const currentVariant = variantData?.variants?.[currentVariantIndex];
    const title =
      currentVariant?.title ||
      currentVariant?.content?.substring(0, 20) ||
      `Text Box ${index + 1}`;
    return {
      id: tb?.id || textBoxId,
      title: title,
      type: "textbox" as const,
    };
  });

  function handleGenerate() {
    if (!currentFile) return;

    const generated = generatePreview();
    appStore.setGeneratedText(generated);
    appStore.setShowGeneratedModal(true);
  }

  async function handleGenerateAndCopy() {
    handleGenerate();

    if ($appStore.generatedText) {
      try {
        await navigator.clipboard.writeText($appStore.generatedText);
        alert("Copied to clipboard!");
      } catch (error) {
        console.error("Failed to copy:", error);
        alert("Failed to copy to clipboard");
      }
    }
  }

  function handleDragStart(e: DragEvent, index: number) {
    e.stopPropagation();
    draggingIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
  }

  function handleContainerDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }

    if (!containerElement || draggingIndex === null) return;

    // 计算拖放目标位置
    const rect = containerElement.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    // 获取所有子元素的位置
    const children = Array.from(containerElement.children);
    let newDropIndex = outlineItems.length;

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
    e.stopPropagation();

    if (draggingIndex === null) {
      dropTargetIndex = null;
      return;
    }

    // 如果没有有效的放置目标，默认放在最后
    let targetIndex =
      dropTargetIndex !== null ? dropTargetIndex : outlineItems.length;

    // 如果拖放到自己后面，需要调整索引
    if (draggingIndex < targetIndex) {
      targetIndex = targetIndex - 1;
    }

    if (draggingIndex !== targetIndex) {
      // 直接更新 order 数组
      const newOrder = [...currentFile.order];
      const [movedItem] = newOrder.splice(draggingIndex, 1);
      newOrder.splice(targetIndex, 0, movedItem);

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

  function handleDragEnd(e: DragEvent) {
    e.stopPropagation();
    draggingIndex = null;
    dropTargetIndex = null;
  }

  function handleOutlineClick(id: string) {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
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

<div class="flex-1 flex flex-col h-full bg-gray-900 p-4">
  <div class="flex gap-2 mb-4">
    <button
      on:click={handleGenerate}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
    >
      Generate
    </button>
    <button
      on:click={handleGenerateAndCopy}
      class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
    >
      Generate & Copy
    </button>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex-1 overflow-y-auto pr-2"
    role="list"
    on:dragover={handleContainerDragOver}
    on:dragleave={handleContainerDragLeave}
    on:drop={handleContainerDrop}
  >
    <h3 class="text-white font-bold mb-2">Outline</h3>
    <div class="space-y-1" bind:this={containerElement}>
      {#each outlineItems as item, index (item.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          draggable="true"
          role="listitem"
          on:dragstart={(e) => handleDragStart(e, index)}
          on:dragend={handleDragEnd}
          class="flex items-center p-2 rounded bg-gray-800 hover:bg-gray-700 cursor-move select-none {draggingIndex ===
          index
            ? 'opacity-50'
            : ''} {dropTargetIndex === index
            ? 'border-t-2 border-blue-500'
            : ''}"
        >
          <span class="mr-2 text-gray-400 cursor-grab active:cursor-grabbing"
            >☰</span
          >
          <span class="mr-2">📝</span>
          <span
            class="text-gray-300 text-sm truncate flex-1 cursor-pointer"
            role="button"
            tabindex="0"
            on:click={() => handleOutlineClick(item.id)}
            on:keydown={(e) => e.key === "Enter" && handleOutlineClick(item.id)}
          >
            {item.title}
          </span>
        </div>
      {/each}

      <!-- 拖放到最后的位置指示器 -->
      {#if dropTargetIndex === outlineItems.length && draggingIndex !== null}
        <div class="border-t-2 border-blue-500 mt-2"></div>
      {/if}
    </div>
  </div>
</div>

{#if $appStore.showGeneratedModal}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    on:click={() => appStore.setShowGeneratedModal(false)}
  >
    <div
      class="bg-gray-800 rounded-lg p-6 w-[800px] h-[90vh] flex flex-col"
      on:click|stopPropagation
    >
      <h2 class="text-white text-lg font-bold mb-4">Generated Text</h2>
      <div class="flex-1 mb-4">
        <textarea
          readonly
          value={$appStore.generatedText}
          class="w-full h-full bg-gray-900 text-white p-3 rounded resize-none"
        ></textarea>
      </div>
      <div class="flex justify-end gap-2">
        <button
          on:click={() => appStore.setShowGeneratedModal(false)}
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          Close
        </button>
        <button
          on:click={async () => {
            await navigator.clipboard.writeText($appStore.generatedText);
            alert("Copied to clipboard!");
          }}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Copy
        </button>
      </div>
    </div>
  </div>
{/if}
