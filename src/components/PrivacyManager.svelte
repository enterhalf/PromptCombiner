<script lang="ts">
  import { appStore } from "../store";

  let newOriginal = "";
  let newReplacement = "";

  function addMapping() {
    if (!newOriginal.trim()) return;
    appStore.addPrivacyMapping(newOriginal.trim(), newReplacement.trim());
    newOriginal = "";
    newReplacement = "";
  }

  function handleOriginalChange(e: Event, mappingId: string, currentReplacement: string) {
    const target = e.target as HTMLInputElement;
    appStore.updatePrivacyMapping(mappingId, target.value, currentReplacement);
  }

  function handleReplacementChange(e: Event, mappingId: string, currentOriginal: string) {
    const target = e.target as HTMLInputElement;
    appStore.updatePrivacyMapping(mappingId, currentOriginal, target.value);
  }
</script>

<div
  class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
  on:click={() => appStore.setShowPrivacyManager(false)}
>
  <div
    class="bg-gray-800 rounded-lg p-6 w-[600px] max-h-[80vh] flex flex-col"
    on:click|stopPropagation
  >
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-white text-lg font-bold">隐私信息管理</h2>
      <button
        on:click={() => appStore.setShowPrivacyManager(false)}
        class="text-gray-400 hover:text-white"
      >
        ×
      </button>
    </div>

    <div class="flex gap-2 mb-4">
      <input
        type="text"
        bind:value={newOriginal}
        placeholder="隐私信息"
        class="flex-1 px-3 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
        on:keydown={(e) => e.key === "Enter" && addMapping()}
      />
      <input
        type="text"
        bind:value={newReplacement}
        placeholder="替换为 (默认为***)"
        class="flex-1 px-3 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
        on:keydown={(e) => e.key === "Enter" && addMapping()}
      />
      <button
        on:click={addMapping}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
      >
        添加
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      {#if $appStore.privacyMappings.length === 0}
        <div class="text-center text-gray-500 py-8">
          暂无隐私信息配置
        </div>
      {:else}
        <div class="space-y-2">
          {#each $appStore.privacyMappings as mapping}
            <div class="flex gap-2 items-center">
              <input
                type="text"
                value={mapping.original}
                on:input={(e) => handleOriginalChange(e, mapping.id, mapping.replacement)}
                class="flex-1 px-3 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 outline-none text-sm"
              />
              <span class="text-gray-400">→</span>
              <input
                type="text"
                value={mapping.replacement}
                on:input={(e) => handleReplacementChange(e, mapping.id, mapping.original)}
                class="flex-1 px-3 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-blue-500 outline-none text-sm"
              />
              <button
                on:click={() => appStore.removePrivacyMapping(mapping.id)}
                class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
              >
                删除
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="flex justify-end mt-4">
      <button
        on:click={() => appStore.setShowPrivacyManager(false)}
        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
      >
        关闭
      </button>
    </div>
  </div>
</div>
