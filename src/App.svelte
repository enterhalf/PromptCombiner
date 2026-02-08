<script lang="ts">
  import { appStore } from './store';
  import { savePromptFile } from './tauri-api';
  import Sidebar from './components/Sidebar.svelte';
  import TextBox from './components/TextBox.svelte';
  import Separator from './components/Separator.svelte';
  import type { TextBox as TextBoxType, Separator as SeparatorType } from './types';

  let draggingIndex: number | null = null;

  $: currentFile = $appStore.currentFile;
  $: activeTab = $appStore.activeTab;

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  function addTextBox() {
    if (!currentFile) return;
    
    const newTextBox: TextBoxType = {
      id: generateId(),
      title: 'Untitled',
      content: '',
      mode: 'normal',
      checked: true,
      height: 150,
      variants: [''],
      currentVariant: 0
    };
    
    currentFile.text_boxes.push(newTextBox);
  }

  function addSeparator() {
    if (!currentFile) return;
    
    const newSeparator: SeparatorType = {
      id: generateId(),
      content: '\\n\\n'
    };
    
    currentFile.separators.push(newSeparator);
  }

  function handleTextBoxChange(e: CustomEvent) {
    if (!currentFile) return;
    
    const { textBox } = e.detail;
    const index = currentFile.text_boxes.findIndex(tb => tb.id === textBox.id);
    if (index !== -1) {
      currentFile.text_boxes[index] = textBox;
    }
  }

  function handleTextBoxDelete(e: CustomEvent) {
    if (!currentFile) return;
    
    const { id } = e.detail;
    currentFile.text_boxes = currentFile.text_boxes.filter(tb => tb.id !== id);
  }

  function handleSeparatorChange(e: CustomEvent) {
    if (!currentFile) return;
    
    const { separator } = e.detail;
    const index = currentFile.separators.findIndex(s => s.id === separator.id);
    if (index !== -1) {
      currentFile.separators[index] = separator;
    }
  }

  function handleSeparatorDelete(e: CustomEvent) {
    if (!currentFile) return;
    
    const { id } = e.detail;
    currentFile.separators = currentFile.separators.filter(s => s.id !== id);
  }

  function handleDragStart(index: number) {
    draggingIndex = index;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggingIndex !== null && draggingIndex !== index) {
      const item = currentFile.text_boxes[draggingIndex];
      currentFile.text_boxes.splice(draggingIndex, 1);
      currentFile.text_boxes.splice(index, 0, item);
    }
    draggingIndex = null;
  }

  async function handleSave() {
    if (!currentFile || !$appStore.workspacePath) return;
    
    try {
      const filePath = `${$appStore.workspacePath}/${currentFile.name}`;
      await savePromptFile(filePath, currentFile);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save file');
    }
  }

  function generatePreview() {
    if (!currentFile) return '';
    
    let result = '';
    let separatorMap = new Map();
    
    currentFile.separators.forEach((sep, index) => {
      separatorMap.set(index, sep.content);
    });
    
    let shadowVars = new Map();
    
    currentFile.text_boxes.forEach(tb => {
      if (tb.mode === 'shadow') {
        const varName = tb.title.trim().toLowerCase().replace(' ', '_');
        shadowVars.set(varName, tb.content);
      }
    });
    
    let lastSeparator = '\n\n';
    
    currentFile.text_boxes.forEach((tb, index) => {
      if (tb.mode === 'disabled') return;
      
      if (index > 0) {
        const sepIndex = index - 1;
        if (separatorMap.has(sepIndex)) {
          lastSeparator = separatorMap.get(sepIndex);
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

<div class="flex h-screen bg-gray-900">
  <Sidebar>
    {#if activeTab === 'workbench'}
      <slot name="workbench">
        <div class="flex-1 flex flex-col h-full bg-gray-900 p-4">
          <div class="flex gap-2 mb-4">
            <button
              on:click={handleSave}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Save
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto">
            <h3 class="text-white font-bold mb-2">Preview</h3>
            <div class="bg-gray-800 rounded-lg p-4 min-h-64">
              <pre class="text-gray-300 text-sm whitespace-pre-wrap break-words">{generatePreview()}</pre>
            </div>
          </div>
        </div>
      </slot>
    {/if}
  </Sidebar>

  <div class="flex-1 flex flex-col h-full overflow-hidden">
    {#if currentFile}
      <div class="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <h2 class="text-white font-bold">{currentFile.name}</h2>
        <div class="flex gap-2">
          <button
            on:click={addTextBox}
            class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
          >
            + Text Box
          </button>
          <button
            on:click={addSeparator}
            class="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
          >
            + Separator
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div class="max-w-4xl mx-auto">
          {#each currentFile.text_boxes as textBox, index (textBox.id)}
            <div id={textBox.id}>
              <TextBox
                {textBox}
                {index}
                on:change={handleTextBoxChange}
                on:delete={handleTextBoxDelete}
                draggable="true"
                on:dragstart={() => handleDragStart(index)}
                on:dragover={handleDragOver}
                on:drop={(e) => handleDrop(e, index)}
              />
            </div>
          {/each}

          {#each currentFile.separators as separator (separator.id)}
            <div id={separator.id}>
              <Separator
                {separator}
                on:change={handleSeparatorChange}
                on:delete={handleSeparatorDelete}
              />
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <p class="text-gray-400 text-lg mb-4">No file selected</p>
          <p class="text-gray-500 text-sm">Select a workspace and open a file from the sidebar</p>
        </div>
      </div>
    {/if}
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
