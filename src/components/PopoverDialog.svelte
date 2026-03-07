<script lang="ts">
  export let show = false;
  export let title = "";
  export let message = "";
  export let confirmText = "确认";
  export let cancelText = "取消";
  export let onConfirm: (() => void) | null = null;
  export let onCancel: (() => void) | null = null;
  export let position: { x: number; y: number } | null = null;
  export let type: "confirm" | "input" = "confirm";
  export let inputValue = "";
  export let inputPlaceholder = "";
  export let confirmButtonClass = "bg-red-600 hover:bg-red-700";

  function handleConfirm() {
    if (onConfirm) onConfirm();
  }

  function handleCancel() {
    if (onCancel) onCancel();
  }

  function handleOverlayClick() {
    handleCancel();
  }
</script>

{#if show && position}
  <div
    class="fixed inset-0 z-40"
    on:click={handleOverlayClick}
  ></div>
  <div
    class="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
    style="left: {position.x}px; top: {position.y + 30}px; transform: translateX(-50%)"
  >
    <div
      class="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4 w-72"
      on:click|stopPropagation
    >
      <h2 class="text-white text-sm font-bold mb-2">{title}</h2>
      {#if type === "confirm"}
        <p class="text-gray-300 text-xs mb-3">{message}</p>
      {:else if type === "input"}
        <input
          type="text"
          bind:value={inputValue}
          class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
          placeholder={inputPlaceholder}
        />
      {/if}
      <div class="flex justify-end gap-2">
        <button
          on:click={handleCancel}
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
        >
          {cancelText}
        </button>
        <button
          on:click={handleConfirm}
          class="px-3 py-1.5 {confirmButtonClass} text-white rounded text-xs"
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
