<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { appStore } from "../store";
  import type { PromptFile } from "../types";

  export let currentFile: PromptFile;

  // 用于 dnd-zone 的列表
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
      id: textBoxId,
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

  // dnd-zone 的排序处理
  function handleDndConsider(e: CustomEvent) {
    outlineItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent) {
    outlineItems = e.detail.items;

    const newOrder = outlineItems.map((item) => item.id);
    appStore.setCurrentFile({
      order: newOrder,
      text_boxes: currentFile.text_boxes,
      variants: currentFile.variants,
      separators: currentFile.separators,
    });
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

  <h3 class="text-white font-bold mb-2">Outline</h3>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    use:dndzone={{
      items: outlineItems,
      flipDurationMs: 200,
      type: "outline",
    }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
    class="flex-1 overflow-y-auto pr-2 space-y-1"
  >
    {#each outlineItems as item (item.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="flex items-center p-2 rounded bg-gray-800 hover:bg-gray-700 cursor-move select-none"
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
