<script lang="ts">
  import { appStore } from '../store';
  import { generateContext, savePromptFile } from '../tauri-api';
  import type { PromptFile, TextBox, Separator } from '../types';

  export let currentFile: PromptFile;

  let outlineItems: Array<{ id: string; title: string; type: 'textbox' | 'separator' }> = [];
  let draggingItem: number | null = null;

  $: if (currentFile) {
    updateOutline();
  }

  function updateOutline() {
    outlineItems = [];
    currentFile.text_boxes.forEach((tb, index) => {
      outlineItems.push({
        id: tb.id,
        title: tb.title || `Text Box ${index + 1}`,
        type: 'textbox'
      });
    });
    currentFile.separators.forEach((sep, index) => {
      outlineItems.push({
        id: sep.id,
        title: `Separator ${index + 1}`,
        type: 'separator'
      });
    });
  }

  async function handleGenerate() {
    if (!currentFile) return;
    
    try {
      const generated = await generateContext(currentFile);
      appStore.setGeneratedText(generated);
      appStore.setShowGeneratedModal(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to generate context:', error);
      
      if (errorMessage.includes('Tauri') || errorMessage.includes('invoke')) {
        alert('This feature is only available in the Tauri desktop app. Please run the app using "npm run tauri dev" instead of "npm run dev".');
      } else {
        alert(`Failed to generate context: ${errorMessage}`);
      }
    }
  }

  async function handleGenerateAndCopy() {
    await handleGenerate();
    
    if ($appStore.generatedText) {
      try {
        await navigator.clipboard.writeText($appStore.generatedText);
        alert('Copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy:', error);
        alert('Failed to copy to clipboard');
      }
    }
  }

  async function handleSave() {
    if (!currentFile || !$appStore.workspacePath) return;
    
    try {
      const filePath = `${$appStore.workspacePath}/${currentFile.name}`;
      await savePromptFile(filePath, currentFile);
      alert('File saved successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to save:', error);
      
      if (errorMessage.includes('Tauri') || errorMessage.includes('invoke')) {
        alert('This feature is only available in the Tauri desktop app. Please run the app using "npm run tauri dev" instead of "npm run dev".');
      } else {
        alert(`Failed to save file: ${errorMessage}`);
      }
    }
  }

  function handleDragStart(index: number) {
    draggingItem = index;
  }

  function handleDragOver(e: any, index: number) {
    e.preventDefault();
  }

  function handleDrop(e: any, index: number) {
    e.preventDefault();
    if (draggingItem !== null && draggingItem !== index) {
      const item = outlineItems[draggingItem];
      outlineItems.splice(draggingItem, 1);
      outlineItems.splice(index, 0, item);
      
      reorderItems();
    }
    draggingItem = null;
  }

  function reorderItems() {
    const newTextBoxes: TextBox[] = [];
    const newSeparators: Separator[] = [];
    
    outlineItems.forEach(item => {
      const tb = currentFile.text_boxes.find(t => t.id === item.id);
      const sep = currentFile.separators.find(s => s.id === item.id);
      
      if (tb) {
        newTextBoxes.push(tb);
      } else if (sep) {
        newSeparators.push(sep);
      }
    });
    
    appStore.setCurrentFile({
      name: currentFile.name,
      text_boxes: newTextBoxes,
      separators: newSeparators
    });
  }

  function handleOutlineClick(id: string) {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function generatedPreview() {
    if (!currentFile) return '';
    
    let result = '';
    const separatorMap = new Map<string, string>();
    
    currentFile.separators.forEach(sep => {
      separatorMap.set(sep.id, sep.content);
    });
    
    const shadowVars = new Map<string, string>();
    
    currentFile.text_boxes.forEach(tb => {
      if (tb.mode === 'shadow') {
        const varName = tb.title.trim().toLowerCase().replace(/\s+/g, '_');
        shadowVars.set(varName, tb.content);
      }
    });
    
    let lastSeparator = '\n\n';
    
    currentFile.text_boxes.forEach((tb, index) => {
      if (tb.mode === 'disabled') return;
      
      if (index > 0) {
        const sepKey = `sep_${index - 1}`;
        if (separatorMap.has(sepKey)) {
          lastSeparator = separatorMap.get(sepKey)!;
        }
        result += lastSeparator;
      }
      
      let content = tb.content;
      
      shadowVars.forEach((value, key) => {
        const placeholder = `{{${key}}}`;
        content = content.replace(new RegExp(placeholder, 'g'), value);
      });
      
      result += content;
    });
    
    return result;
  }
</script>

<div class="flex-1 flex flex-col h-full bg-gray-900 p-4">
  <div class="flex gap-2 mb-4">
    <button
      on:click={handleSave}
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
    >
      Save
    </button>
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

  <div class="flex-1 flex gap-4 overflow-hidden">
    <div class="flex-1 overflow-y-auto pr-2">
      <h3 class="text-white font-bold mb-2">Outline</h3>
      <div class="space-y-1">
        {#each outlineItems as item, index}
          <div
            draggable="true"
            on:dragstart={() => handleDragStart(index)}
            on:dragover={(e) => handleDragOver(e, index)}
            on:drop={(e) => handleDrop(e, index)}
            class="flex items-center p-2 rounded bg-gray-800 hover:bg-gray-700 cursor-move"
            on:click={() => handleOutlineClick(item.id)}
          >
            <span class="mr-2 text-gray-400">☰</span>
            <span class="mr-2">
              {item.type === 'textbox' ? '📝' : '🔀'}
            </span>
            <span class="text-gray-300 text-sm truncate flex-1">
              {item.title}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <h3 class="text-white font-bold mb-2">Preview</h3>
      <div class="bg-gray-800 rounded-lg p-4 min-h-64">
        <pre class="text-gray-300 text-sm whitespace-pre-wrap break-words">{generatedPreview()}</pre>
      </div>
    </div>
  </div>
</div>

{#if $appStore.showGeneratedModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg p-6 w-[800px] max-h-[80vh] flex flex-col">
      <h2 class="text-white text-lg font-bold mb-4">Generated Text</h2>
      <div class="flex-1 overflow-y-auto mb-4">
        <textarea
          readonly
          value={$appStore.generatedText}
          class="w-full h-64 bg-gray-900 text-white p-3 rounded resize-none"
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
            alert('Copied to clipboard!');
          }}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Copy
        </button>
      </div>
    </div>
  </div>
{/if}
