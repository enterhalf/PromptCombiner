<script lang="ts">
  import { appStore } from "../store";
  import { onMount } from "svelte";

  let restoredText = "";
  let originalText = "";
  let hasAutoCopied = false;

  async function loadFromClipboard() {
    try {
      originalText = await navigator.clipboard.readText();
      restoreText();
    } catch (error) {
      console.error("Failed to read clipboard:", error);
      appStore.showToast("无法读取剪贴板内容", "error");
    }
  }

  function restoreText() {
    if (!originalText) {
      restoredText = "";
      return;
    }

    let result = originalText;

    // 倒序替换，防止替换后的内容又被替换
    const mappings = [...$appStore.privacyMappings].reverse();

    for (const mapping of mappings) {
      if (mapping.replacement) {
        result = result.split(mapping.replacement).join(mapping.original);
      }
    }

    restoredText = result;
  }

  async function copyRestoredText() {
    try {
      await navigator.clipboard.writeText(restoredText);
      appStore.showToast("已复制到剪贴板！", "success");
      hasAutoCopied = true;
    } catch (error) {
      console.error("Failed to copy:", error);
      appStore.showToast("复制失败", "error");
    }
  }

  onMount(async () => {
    await loadFromClipboard();
    if (restoredText) {
      await copyRestoredText();
    }
  });
</script>

<div
  class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
  on:click={() => appStore.setShowPrivacyRestore(false)}
>
  <div
    class="bg-gray-800 rounded-lg p-6 w-[800px] h-[90vh] flex flex-col"
    on:click|stopPropagation
  >
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-white text-lg font-bold">还原隐私信息</h2>
      <button
        on:click={() => appStore.setShowPrivacyRestore(false)}
        class="text-gray-400 hover:text-white"
      >
        ×
      </button>
    </div>

    {#if hasAutoCopied}
      <div class="mb-4 px-4 py-2 bg-green-900/50 border border-green-700 text-green-200 text-sm rounded">
        ✅ 已自动从剪贴板读取并还原，结果已复制到剪贴板
      </div>
    {/if}

    <div class="flex gap-2 mb-4">
      <button
        on:click={loadFromClipboard}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
      >
        从剪贴板读取
      </button>
    </div>

    <div class="flex-1 flex flex-col gap-3 overflow-hidden">
      <div class="flex-1 flex flex-col">
        <label class="text-gray-300 text-sm mb-1">原始内容 (含替换内容)</label>
        <textarea
          bind:value={originalText}
          on:input={restoreText}
          class="flex-1 bg-gray-900 text-white p-3 rounded border border-gray-600 resize-none"
          placeholder="粘贴需要还原的内容..."
        />
      </div>

      <div class="flex-1 flex flex-col">
        <div class="flex items-center justify-between mb-1">
          <label class="text-gray-300 text-sm">还原后的内容</label>
          <button
            on:click={copyRestoredText}
            class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            disabled={!restoredText}
          >
            复制
          </button>
        </div>
        <textarea
          readonly
          value={restoredText}
          class="flex-1 bg-gray-900 text-white p-3 rounded border border-gray-600 resize-none"
          placeholder="还原后的内容将显示在这里..."
        />
      </div>
    </div>

    <div class="flex justify-end mt-4">
      <button
        on:click={() => appStore.setShowPrivacyRestore(false)}
        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
      >
        关闭
      </button>
    </div>
  </div>
</div>
