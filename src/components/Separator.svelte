<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Separator } from '../types';

  export let separator: Separator;

  const dispatch = createEventDispatcher();

  function handleContentChange(e: Event) {
    const input = e.target as HTMLInputElement;
    separator.content = input.value;
    dispatch('change', { separator });
  }

  function handleDelete() {
    dispatch('delete', { id: separator.id });
  }
</script>

<div class="flex items-center bg-gray-700 rounded-lg mb-2 px-3 py-2">
  <span class="text-gray-400 mr-2">Separator:</span>
  <input
    type="text"
    value={separator.content}
    on:input={handleContentChange}
    class="flex-1 bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
    placeholder="\\n\\n"
  />
  <button
    on:click={handleDelete}
    class="ml-2 text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30"
    title="Delete"
  >
    ×
  </button>
</div>
