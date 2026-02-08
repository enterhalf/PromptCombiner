<script lang="ts">
  import { appStore } from "./store";
  import { savePromptFile } from "./tauri-api";
  import Sidebar from "./components/Sidebar.svelte";
  import TextBox from "./components/TextBox.svelte";
  import Workbench from "./components/Workbench.svelte";
  import type { TextBox as TextBoxType } from "./types";

  let draggingIndex: number | null = null;

  $: currentFile = $appStore.currentFile;
  $: activeTab = $appStore.activeTab;

  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  function addTextBox() {
    if (!currentFile) return;

    const newId = generateId();
    const newTextBox: TextBoxType = {
      id: newId,
      title: "Untitled",
      content: "",
      mode: "normal",
    };

    appStore.setCurrentFile({
      name: currentFile.name,
      order: [...currentFile.order, newId],
      heights: { ...currentFile.heights, [newId]: 150 },
      text_boxes: { ...currentFile.text_boxes, [newId]: newTextBox },
      separators: currentFile.separators,
    });
  }

  function handleTextBoxChange(e: CustomEvent) {
    if (!currentFile) return;

    const { textBox } = e.detail;
    appStore.setCurrentFile({
      name: currentFile.name,
      order: currentFile.order,
      heights: currentFile.heights,
      text_boxes: { ...currentFile.text_boxes, [textBox.id]: textBox },
      separators: currentFile.separators,
    });
  }

  function handleHeightChange(e: CustomEvent) {
    if (!currentFile) return;

    const { id, height } = e.detail;
    appStore.setCurrentFile({
      name: currentFile.name,
      order: currentFile.order,
      heights: { ...currentFile.heights, [id]: height },
      text_boxes: currentFile.text_boxes,
      separators: currentFile.separators,
    });
  }

  function handleTextBoxDelete(e: CustomEvent) {
    if (!currentFile) return;

    const { id } = e.detail;
    const newOrder = currentFile.order.filter((boxId) => boxId !== id);
    const newTextBoxes = { ...currentFile.text_boxes };
    delete newTextBoxes[id];
    const newHeights = { ...currentFile.heights };
    delete newHeights[id];

    appStore.setCurrentFile({
      name: currentFile.name,
      order: newOrder,
      heights: newHeights,
      text_boxes: newTextBoxes,
      separators: currentFile.separators,
    });
  }

  function handleTextBoxDragEnd() {
    if (!currentFile) return;
    appStore.setCurrentFile({
      name: currentFile.name,
      order: currentFile.order,
      heights: currentFile.heights,
      text_boxes: currentFile.text_boxes,
      separators: currentFile.separators,
    });
  }

  function handleDragStart(index: number) {
    draggingIndex = index;
  }

  function handleDragOver(e: any) {
    e.preventDefault();
  }

  function handleDrop(e: any, index: number) {
    e.preventDefault();
    if (!currentFile) return;
    if (draggingIndex !== null && draggingIndex !== index) {
      const newOrder = [...currentFile.order];
      const item = newOrder[draggingIndex];
      newOrder.splice(draggingIndex, 1);
      newOrder.splice(index, 0, item);
      appStore.setCurrentFile({
        name: currentFile.name,
        order: newOrder,
        heights: currentFile.heights,
        text_boxes: currentFile.text_boxes,
        separators: currentFile.separators,
      });
    }
    draggingIndex = null;
  }

  async function handleSave() {
    if (!currentFile || !$appStore.workspacePath) return;

    try {
      const filePath = `${$appStore.workspacePath}/${currentFile.name}`;
      await savePromptFile(filePath, currentFile);
      alert("File saved successfully!");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to save:", error);

      if (errorMessage.includes("Tauri") || errorMessage.includes("invoke")) {
        alert(
          'This feature is only available in the Tauri desktop app. Please run the app using "npm run tauri dev" instead of "npm run dev".'
        );
      } else {
        alert(`Failed to save file: ${errorMessage}`);
      }
    }
  }

  function generatePreview() {
    if (!currentFile) return "";

    let result = "";
    let shadowVars = new Map();

    Object.values(currentFile.text_boxes).forEach((tb) => {
      if (tb.mode === "shadow") {
        const varName = tb.title.trim().toLowerCase().replace(" ", "_");
        shadowVars.set(varName, tb.content);
      }
    });

    let lastSeparator = "\n\n";

    currentFile.order.forEach((textBoxId, index) => {
      const tb = currentFile.text_boxes[textBoxId];
      if (!tb || tb.mode === "disabled") return;

      if (index > 0) {
        result += lastSeparator;
      }

      let content = tb.content;

      shadowVars.forEach((value, key) => {
        const placeholder = `{{${key}}}`;
        content = content.replace(new RegExp(placeholder, "g"), value);
      });

      result += content;
    });

    return result;
  }
</script>

<div class="flex h-screen bg-gray-900">
  <Sidebar>
    {#if activeTab === "workbench" && currentFile}
      <slot name="workbench">
        <Workbench {currentFile} />
      </slot>
    {/if}
  </Sidebar>

  <div class="flex-1 flex flex-col h-full overflow-hidden">
    {#if currentFile}
      <div
        class="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between"
      >
        <h2 class="text-white font-bold">{currentFile.name}</h2>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div class="max-w-4xl mx-auto">
          {#each currentFile.order as textBoxId, index (textBoxId)}
            {@const textBox = currentFile.text_boxes[textBoxId]}
            {#if textBox}
              <div id={textBox.id}>
                <TextBox
                  {textBox}
                  {index}
                  height={currentFile.heights[textBoxId] || 150}
                  on:change={handleTextBoxChange}
                  on:heightchange={handleHeightChange}
                  on:delete={handleTextBoxDelete}
                  on:dragend={handleTextBoxDragEnd}
                  on:dragstart={() => handleDragStart(index)}
                  on:dragover={handleDragOver}
                  on:drop={(e) => handleDrop(e, index)}
                />
              </div>
            {/if}
          {/each}

          <div class="flex gap-2 mt-4">
            <button
              on:click={addTextBox}
              class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            >
              + Text Box
            </button>
          </div>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <p class="text-gray-400 text-lg mb-4">No file selected</p>
          <p class="text-gray-500 text-sm">
            Select a workspace and open a file from the sidebar
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if $appStore.showGeneratedModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div
      class="bg-gray-800 rounded-lg p-6 w-[800px] max-h-[80vh] flex flex-col"
    >
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
