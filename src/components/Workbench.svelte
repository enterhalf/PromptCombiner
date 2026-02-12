<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { appStore } from "../store";
  import type { PromptFile, FileBoxItem } from "../types";
  import { readFileContent } from "../tauri-api";

  export let currentFile: PromptFile;

  // 用于 dnd-zone 的列表
  $: outlineItems = currentFile.order.map((boxId, index) => {
    const textBox = currentFile.text_boxes[boxId];
    const fileBox = currentFile.file_boxes?.[boxId];
    
    if (textBox) {
      const variantData = currentFile.variants[boxId];
      const currentVariantIndex = variantData?.current_variant_index || 0;
      const currentVariant = variantData?.variants?.[currentVariantIndex];
      const title =
        currentVariant?.title ||
        currentVariant?.content?.substring(0, 20) ||
        `Text Box ${index + 1}`;
      return {
        id: boxId,
        title: title,
        type: "text" as const,
      };
    } else if (fileBox) {
      const fileBoxData = currentFile.file_box_data?.[boxId];
      const fileCount = fileBoxData?.files?.length || 0;
      const checkedCount = fileBoxData?.files?.filter((f: FileBoxItem) => f.checked).length || 0;
      return {
        id: boxId,
        title: `File Box (${checkedCount}/${fileCount} files)`,
        type: "file" as const,
      };
    }
    return {
      id: boxId,
      title: `Unknown ${index + 1}`,
      type: "unknown" as const,
    };
  });

  async function handleGenerate() {
    if (!currentFile) return;

    const generated = await generatePreview();
    appStore.setGeneratedText(generated);
    appStore.setShowGeneratedModal(true);
  }

  async function handleGenerateAndCopy() {
    await handleGenerate();

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
      file_boxes: currentFile.file_boxes,
      file_box_data: currentFile.file_box_data,
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

  // 获取显示的路径（根据 path_segments 截断）
  function getDisplayPath(fullPath: string, pathSegments: number): string {
    if (!fullPath) return "";
    if (pathSegments < 1) return fullPath;
    
    // 统一使用正斜杠处理路径
    const normalizedPath = fullPath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(p => p.length > 0);
    
    if (parts.length <= pathSegments) return fullPath;
    
    // 保留最后 pathSegments 个分段
    const displayParts = parts.slice(-pathSegments);
    return displayParts.join('/');
  }

  // 获取文件扩展名用于代码块语言标识
  function getFileExtension(filePath: string): string {
    if (!filePath) return "";
    const parts = filePath.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }
    return "";
  }

  async function generateFileBoxContent(fileBoxId: string): Promise<string> {
    const fileBox = currentFile.file_boxes?.[fileBoxId];
    const fileBoxData = currentFile.file_box_data?.[fileBoxId];
    
    if (!fileBox || !fileBoxData || fileBox.mode === "disabled" || fileBox.mode === "shadow") {
      return "";
    }

    const pathSegments = fileBoxData.path_segments || 2;
    const checkedFiles = fileBoxData.files?.filter((f: FileBoxItem) => f.checked) || [];
    
    if (checkedFiles.length === 0) return "";

    let result = "";
    
    for (const file of checkedFiles) {
      if (!file.path) continue;
      
      try {
        const content = await readFileContent(file.path);
        const displayPath = getDisplayPath(file.path, pathSegments);
        const ext = getFileExtension(file.path);
        
        result += `### ${displayPath}\n`;
        result += "\`\`\`" + ext + "\n";
        result += content;
        result += "\n\`\`\`\n\n";
      } catch (error) {
        console.error(`Failed to read file ${file.path}:`, error);
        const displayPath = getDisplayPath(file.path, pathSegments);
        result += `### ${displayPath}\n`;
        result += "\`\`\`\n";
        result += `[Error reading file: ${error}]`;
        result += "\n\`\`\`\n\n";
      }
    }
    
    return result.trim();
  }

  async function generatePreview(): Promise<string> {
    if (!currentFile) return "";

    let result = "";
    let shadowVars = new Map();

    // 收集 Shadow 模式的变量
    Object.values(currentFile.text_boxes).forEach((tb) => {
      if (tb.mode === "shadow") {
        const variantData = currentFile.variants[tb.id];
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

    for (const boxId of currentFile.order) {
      const textBox = currentFile.text_boxes[boxId];
      const fileBox = currentFile.file_boxes?.[boxId];
      
      let content = "";
      
      if (textBox && textBox.mode !== "disabled" && textBox.mode !== "shadow") {
        const variantData = currentFile.variants[boxId];
        const currentVariantIndex = variantData?.current_variant_index || 0;
        content = variantData?.variants?.[currentVariantIndex]?.content || "";
        
        // 替换 Shadow 变量
        shadowVars.forEach((value, key) => {
          const placeholder = `{{${key}}}`;
          content = content.replace(new RegExp(placeholder, "g"), value);
        });
      } else if (fileBox && fileBox.mode !== "disabled" && fileBox.mode !== "shadow") {
        content = await generateFileBoxContent(boxId);
      }
      
      if (!content) continue;

      if (!isFirstContent) {
        result += lastSeparator;
      }
      isFirstContent = false;
      result += content;
    }

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
        {#if item.type === "text"}
          <span class="mr-2">📝</span>
        {:else if item.type === "file"}
          <span class="mr-2">📁</span>
        {:else}
          <span class="mr-2">❓</span>
        {/if}
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
