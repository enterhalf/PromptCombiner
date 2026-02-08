<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { TextBox } from "../types";

  export let textBox: TextBox;
  export let index: number;
  export let height: number = 150;

  const dispatch = createEventDispatcher();

  let isDragging = false;
  let startY = 0;
  let startHeight = 0;
  let isResizing = false;

  function handleDragStart(e: MouseEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    e.preventDefault();
  }

  function handleDragEnd() {
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

  function handleModeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    textBox.mode = select.value as "normal" | "disabled" | "shadow";
    dispatch("change", { textBox });
  }

  function handleContentChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    textBox.content = textarea.value;
    updateTitle();
    dispatch("change", { textBox });
  }

  function handleInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    textBox.content = textarea.value;
    updateTitle();
  }

  function updateTitle() {
    const trimmed = textBox.content.trim();
    if (trimmed.length > 0) {
      textBox.title = trimmed.substring(0, Math.min(20, trimmed.length));
    } else {
      textBox.title = "Untitled";
    }
  }

  function handleDelete() {
    dispatch("delete", { id: textBox.id });
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
  class="flex flex-col bg-gray-800 rounded-lg mb-2 overflow-hidden"
  style="height: {height}px;"
  draggable={isDragging}
  on:dragstart={handleDragStart}
  on:dragend={handleDragEnd}
>
  <div class="flex items-center px-3 py-2 {modeColor} border-b border-gray-600">
    <span class="flex-1 font-medium text-white truncate mr-2">
      {textBox.title}
    </span>

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
      on:click={handleDelete}
      class="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30"
      title="Delete"
    >
      ×
    </button>
  </div>

  <div class="flex-1 relative">
    <textarea
      value={textBox.content}
      on:input={handleInput}
      on:blur={handleContentChange}
      class="w-full h-full bg-gray-900 text-white p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Enter your text here..."
    ></textarea>
  </div>

  <div
    class="h-2 bg-gray-700 hover:bg-gray-600 cursor-ns-resize flex items-center justify-center"
    on:mousedown={handleResizeStart}
  >
    <div class="w-8 h-1 bg-gray-500 rounded"></div>
  </div>
</div>
