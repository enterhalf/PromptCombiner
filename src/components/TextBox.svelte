<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { createEventDispatcher } from "svelte";
  import { get } from "svelte/store";
  import { appStore } from "../store";
  import type { TextBox, VariantData, Variant } from "../types";
  import {
    beginVariantBatchDrag,
    clearVariantBatchDrag,
    getVariantBatchDrag,
  } from "../variant-batch-drag";

  export let textBox: TextBox;
  export let index: number | undefined = undefined;
  export let variantData: VariantData;

  const dispatch = createEventDispatcher();

  // dnd-zone 中变体条目的形状（isDndShadowItem 为拖动过程中的占位标记）
  interface DndVariantItem {
    id: number | string;
    index: number;
    variant: Variant;
    isDndShadowItem?: boolean;
  }

  // 多选时用到的修饰键（鼠标点击 / 回车共用）
  type SelectModifiers = Pick<MouseEvent, "shiftKey" | "ctrlKey" | "metaKey">;

  let isDragging = false;
  let startY = 0;
  let startHeight = 0;
  let isResizing = false;
  let titleInput: HTMLInputElement;
  let isTitleFocused = false;
  let isEditingTitle = false;

  // ------------------------------------------------------------------
  // 变体多选
  //
  // 选中项用「变体对象的引用」记录，而不是数组下标：变体没有稳定 id，
  // 但对象引用在重排、跨框移动时都不会变（只有编辑内容/标题时才会被替换成
  // 新对象，那种情况在 updateVariant* 里就地换掉即可）。
  // 好处是重排后选中状态自动跟随、无需重算下标；撤销/重做等外部改动导致
  // 引用失效时，也会被下面的派生列表自动过滤掉。
  // ------------------------------------------------------------------
  let selectionSet: Set<Variant> = new Set();
  let selectionAnchor: Variant | null = null;

  // 变体拖动过程中的两个小状态（浏览器会在拖动结束后补发一次 click，
  // 需要短暂屏蔽掉，否则整组选中会被那一下 click 清空）
  let variantDragGesture = false;
  let suppressClickAfterDrag = false;

  $: height = variantData.height;
  $: currentVariantIndex = variantData.current_variant_index;
  $: variantList = variantData.variants || [];
  $: totalVariants = variantList.length;
  $: currentVariant = variantList[currentVariantIndex] || {
    content: "",
    title: "",
  };
  $: currentContent = currentVariant.content;
  $: currentTitle = currentVariant.title;

  // 以下这些都是从 selectionSet 派生的只读视图
  let selection: Variant[] = [];
  let selectedIndices: number[] = [];
  let hasSelection = false;
  let multiSelected = false;
  let canMoveLeft = false;
  let canMoveRight = false;

  // 选中项（按列表顺序）；已经不在列表中的引用会被自然剔除
  $: selection = variantList.filter((v) => selectionSet.has(v));
  $: selectedIndices = selection
    .map((v) => variantList.indexOf(v))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  $: hasSelection = selection.length > 0;
  $: multiSelected = selection.length > 1;
  $: canMoveLeft = selectedIndices.length > 0 && selectedIndices[0] > 0;
  $: canMoveRight =
    selectedIndices.length > 0 &&
    selectedIndices[selectedIndices.length - 1] < totalVariants - 1;

  // 用于 dnd-zone 的变体列表
  // 注意：item.id 必须唯一，且不能直接使用"数组下标"——svelte-dnd-action 跨
  // zone 拖动时会把影子条目的 id 改写为被拖条目的 id，并据此过滤其他 zone 里
  // 同 id 的条目；若用纯下标，目标框里同下标的变体会被误删。因此加上框 id 前缀。
  $: variantItems = toVariantItems(variantList);

  function toVariantItems(variants: Variant[]): DndVariantItem[] {
    return variants.map((variant, idx) => ({
      id: `${textBox.id}-v${idx}`,
      variant,
      index: idx,
    }));
  }

  // 获取显示的标题（如果没有保存的标题，则从内容生成预览）
  function getDisplayTitle(variant: Variant): string {
    if (variant.title && variant.title.trim()) {
      return variant.title.trim();
    }
    // 从内容生成预览标题
    const trimmed = variant.content.trim();
    if (trimmed.length > 0) {
      return trimmed.substring(0, Math.min(12, trimmed.length));
    }
    return "Untitled";
  }

  // ------------------------------------------------------------------
  // 选中状态操作
  // ------------------------------------------------------------------

  function setSelection(variants: Variant[], anchor?: Variant | null) {
    selectionSet = new Set(variants);
    if (anchor !== undefined) selectionAnchor = anchor;
  }

  function clearSelection() {
    selectionSet = new Set();
    selectionAnchor = null;
  }

  function selectAllVariants() {
    setSelection([...variantList]);
  }

  // 内容/标题被改写时，变体对象会被替换成新对象，选中集合也要跟着换
  function replaceInSelection(oldVariant: Variant, newVariant: Variant) {
    if (selectionSet.has(oldVariant)) {
      const next = new Set(selectionSet);
      next.delete(oldVariant);
      next.add(newVariant);
      selectionSet = next;
    }
    if (selectionAnchor === oldVariant) {
      selectionAnchor = newVariant;
    }
  }

  /** 切换当前展示的变体 */
  function switchCurrentVariant(vIndex: number) {
    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        current_variant_index: vIndex,
      },
    });
  }

  /**
   * 变体条目的点击：
   *  - 普通点击：收敛为单选，并切换到该变体；
   *  - Shift + 点击：从锚点到点击位置连续多选（锚点不变，方便反复调整区间）；
   *  - Ctrl / Cmd + 点击：把该变体加入 / 移出选中集合，不改当前展示的变体。
   */
  function handleVariantClick(vIndex: number, mods: SelectModifiers) {
    // 拖动刚结束时浏览器可能补发一次 click，忽略掉，免得整组选中被清掉
    if (consumeDragClickSuppression()) return;

    const variant = variantList[vIndex];
    if (!variant) return;

    if (mods.shiftKey) {
      // 锚点优先用上次落点；锚点已经不在列表里（撤销/重做等）就退回最近的选中项
      const anchorInList = selectionAnchor
        ? variantList.indexOf(selectionAnchor)
        : -1;
      const anchorIndex =
        anchorInList >= 0
          ? anchorInList
          : selectedIndices.length > 0
            ? selectedIndices[selectedIndices.length - 1]
            : vIndex;
      const from = Math.min(anchorIndex, vIndex);
      const to = Math.max(anchorIndex, vIndex);
      setSelection(
        variantList.slice(from, to + 1),
        variantList[anchorIndex] || variant,
      );
      switchCurrentVariant(vIndex);
      return;
    }

    if (mods.ctrlKey || mods.metaKey) {
      const next = new Set(selectionSet);
      if (next.has(variant)) {
        next.delete(variant);
      } else {
        next.add(variant);
      }
      selectionSet = next;
      selectionAnchor = variant;
      return;
    }

    setSelection([variant], variant);
    switchCurrentVariant(vIndex);
  }

  function handleVariantChipKeyDown(vIndex: number, e: KeyboardEvent) {
    if (e.key === "Enter") {
      handleVariantClick(vIndex, e);
    }
  }

  /** 变体区自身的快捷键（条目获得焦点时事件会冒泡到这里） */
  function handleVariantZoneKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (hasSelection) {
        e.preventDefault();
        clearSelection();
      }
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (hasSelection) {
        e.preventDefault();
        e.stopPropagation();
        deleteVariants(selectedIndices);
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      e.stopPropagation();
      selectAllVariants();
    }
  }

  /** 点击变体区空白处 = 取消选择 */
  function handleVariantZoneClick(e: MouseEvent) {
    if (consumeDragClickSuppression()) return;
    if (!hasSelection) return;
    if (e.target === e.currentTarget) clearSelection();
  }

  // ------------------------------------------------------------------
  // 批量移动：左移 / 右移一格（与拖拽整组移动等价，便于精确微调）
  // ------------------------------------------------------------------
  function handleMoveSelection(delta: number) {
    const indices = selectionIndices();
    if (indices.length === 0) return;
    // 已经贴到边界：整组不动（与按钮的 disabled 状态一致，这里再兜一次底）
    if (delta < 0 && Math.min(...indices) === 0) return;
    if (delta > 0 && Math.max(...indices) === variantList.length - 1) return;

    const next = [...variantList];
    // 向左移：从最左的选中项开始依次与左邻交换；向右移则反向处理
    const order = delta < 0 ? indices : [...indices].reverse();
    for (const i of order) {
      const j = i + delta;
      if (j < 0 || j >= next.length) continue;
      const tmp = next[j];
      next[j] = next[i];
      next[i] = tmp;
    }
    // 选中项是对象引用，位置变化后 selection / selectedIndices 会自动重算
    commitVariantOrder(next);
  }

  function selectionIndices(): number[] {
    return selection
      .map((v) => variantList.indexOf(v))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
  }

  // ------------------------------------------------------------------
  // 批量删除
  // ------------------------------------------------------------------

  /** 顶部 🗑 按钮：有选中项时删选中项，否则删当前变体 */
  function handleDeleteVariant() {
    deleteVariants(hasSelection ? selectedIndices : [currentVariantIndex]);
  }

  function deleteVariants(indices: number[]) {
    const unique = [...new Set(indices)]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < variantList.length)
      .sort((a, b) => a - b);
    if (unique.length === 0) return;

    if (unique.length >= variantList.length) {
      appStore.showToast("Cannot delete the last variant", "error");
      return;
    }

    const removeSet = new Set(unique);
    const newVariants = variantList.filter((_, i) => !removeSet.has(i));
    // 删除后当前变体要么落到它原来的位置（前面的元素被删掉了），
    // 要么落到"顶上来"的那一条上
    const removedBefore = unique.filter((i) => i < currentVariantIndex).length;
    let newIndex = Math.max(0, currentVariantIndex - removedBefore);
    newIndex = Math.min(newIndex, newVariants.length - 1);

    clearSelection();
    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        variants: newVariants,
        current_variant_index: newIndex,
      },
    });
  }

  // ------------------------------------------------------------------
  // 尺寸调整
  // ------------------------------------------------------------------
  function handleDragStart(e: DragEvent) {
    isDragging = true;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
    dispatch("dragstart");
  }

  function handleDragEnd(e: DragEvent) {
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
    // 拖拽过程中不派发事件，避免占用撤销/重做历史
  }

  function handleResizeEnd() {
    if (isResizing) {
      isResizing = false;
      // 拖拽结束时才派发事件，记录最终高度
      dispatch("heightchange", { id: textBox.id, height });
    }
    // 变体拖动松手后浏览器可能补发 click，短暂屏蔽，避免误清空多选
    if (variantDragGesture) {
      variantDragGesture = false;
      suppressClickAfterDrag = true;
      setTimeout(() => {
        suppressClickAfterDrag = false;
      }, 300);
    }
  }

  function consumeDragClickSuppression(): boolean {
    if (!suppressClickAfterDrag) return false;
    suppressClickAfterDrag = false;
    return true;
  }

  // ------------------------------------------------------------------
  // 标题 / 内容编辑
  // ------------------------------------------------------------------
  function handleTitleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    updateVariantTitle(currentVariantIndex, input.value);
  }

  function handleTitleFocus() {
    isTitleFocused = true;
  }

  function handleTitleBlur(e: Event) {
    isTitleFocused = false;
    isEditingTitle = false;
  }

  function handleTitleClick() {
    if (!isEditingTitle) {
      isEditingTitle = true;
      setTimeout(() => {
        if (titleInput) {
          titleInput.focus();
          titleInput.select();
        }
      }, 0);
    }
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (titleInput) {
        titleInput.blur();
      }
    }
  }

  function handleModeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    textBox.mode = select.value as "normal" | "disabled" | "shadow";
    dispatch("change", { textBox });
  }

  function handleVariantInput(vIndex: number) {
    return (e: Event) => {
      const textarea = e.target as HTMLTextAreaElement;
      updateVariantContent(vIndex, textarea.value);
    };
  }

  function updateVariantContent(variantIndex: number, content: string) {
    const previous = variantList[variantIndex];
    const newVariants = [...(variantData.variants || [])];
    const updated: Variant = { ...newVariants[variantIndex], content };
    newVariants[variantIndex] = updated;
    if (previous) replaceInSelection(previous, updated);
    dispatch("variantschange", {
      id: textBox.id,
      variantData: { ...variantData, variants: newVariants },
    });
  }

  function updateVariantTitle(variantIndex: number, title: string) {
    const previous = variantList[variantIndex];
    const newVariants = [...(variantData.variants || [])];
    const updated: Variant = { ...newVariants[variantIndex], title };
    newVariants[variantIndex] = updated;
    if (previous) replaceInSelection(previous, updated);
    dispatch("variantschange", {
      id: textBox.id,
      variantData: { ...variantData, variants: newVariants },
    });
  }

  function handleDelete() {
    dispatch("delete", { id: textBox.id });
  }

  function handleAddVariant() {
    // 生成新变体标题
    let newTitle = "";
    if (currentTitle && currentTitle.trim()) {
      // 匹配末尾的数字
      const match = currentTitle.match(/^(.*?)(\d+)$/);
      if (match) {
        // 末尾是数字，数字+1
        const prefix = match[1];
        const num = parseInt(match[2], 10) + 1;
        newTitle = prefix + num;
      } else {
        // 末尾没有数字，添加2
        newTitle = currentTitle + "2";
      }
    }

    // 插件选项：开启"新增变体默认空白"后，不再复制当前内容
    const blankDefault =
      get(appStore).plugins.find((p) => p.id === "variant-blank-default")
        ?.enabled ?? false;

    const newVariant: Variant = {
      content: blankDefault ? "" : currentContent,
      title: newTitle,
    };
    // 在当前变体右侧插入新变体
    const newVariants = [...(variantData.variants || [])];
    const insertIndex = currentVariantIndex + 1;
    newVariants.splice(insertIndex, 0, newVariant);
    // 新变体成为当前变体，同时也是唯一选中项
    setSelection([newVariant], newVariant);
    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        variants: newVariants,
        current_variant_index: insertIndex,
      },
    });
  }

  // ------------------------------------------------------------------
  // dnd-zone：变体排序 / 跨框移动
  // ------------------------------------------------------------------

  /** 统一提交一份新的变体顺序，并保持"当前变体"跟随原来的对象 */
  function commitVariantOrder(newVariants: Variant[]) {
    const prevCurrent = variantList[currentVariantIndex];
    let newCurrentIndex = newVariants.indexOf(prevCurrent);
    if (newCurrentIndex === -1) {
      // 找不到（当前变体被移走/移除）：列表已空则回到 0，否则保持在范围内
      newCurrentIndex =
        newVariants.length === 0
          ? 0
          : Math.min(currentVariantIndex, newVariants.length - 1);
    }

    dispatch("variantschange", {
      id: textBox.id,
      variantData: {
        ...variantData,
        variants: newVariants,
        current_variant_index: newCurrentIndex,
      },
    });
  }

  /**
   * 拖动刚开始时收敛选中状态：
   *  - 拖的是没被选中的变体（或当前没有选中项）→ 走单条拖动；
   *  - 拖的是多选中的一员 → 记录整组，松手时整组一起落位（同框 / 跨框都一样）。
   */
  function prepareDragSelection(
    items: DndVariantItem[],
    draggedId?: string | number,
    source?: string,
  ) {
    clearVariantBatchDrag();

    const shadowIdx = items.findIndex((it) => it && it.isDndShadowItem);
    let draggedIndex = shadowIdx >= 0 ? Number(items[shadowIdx].index) : -1;
    if (!Number.isInteger(draggedIndex) || draggedIndex < 0) {
      // 键盘拖动不会插入影子条目，退化成从 id 反解下标
      const raw = String(draggedId ?? "");
      const prefix = `${textBox.id}-v`;
      draggedIndex = raw.startsWith(prefix)
        ? Number(raw.slice(prefix.length))
        : -1;
    }

    const dragged = Number.isInteger(draggedIndex)
      ? variantList[draggedIndex]
      : undefined;
    if (!dragged) return;

    if (source !== "keyboard") {
      variantDragGesture = true;
    }

    const current = variantList.filter((v) => selectionSet.has(v));
    if (current.length > 0 && !selectionSet.has(dragged)) {
      // 拖动了没被选中的变体：多选就地收敛成这一条
      setSelection([dragged], dragged);
      return;
    }

    // 键盘拖动（Enter 起拖 + 方向键）每次按键都会单独派发 finalize，
    // 整组移动拿不到连贯的手势，这里只对指针拖动生效
    if (source !== "keyboard" && current.length > 1 && selectionSet.has(dragged)) {
      beginVariantBatchDrag(textBox.id, current);
    }
  }

  // dnd-zone 的变体排序处理
  function handleVariantDndConsider(e: CustomEvent) {
    const items = (e.detail.items || []) as DndVariantItem[];
    const info = (e.detail.info || {}) as {
      trigger?: string;
      id?: string | number;
      source?: string;
    };

    if (info.trigger === "dragStarted") {
      prepareDragSelection(items, info.id, info.source);
    }

    variantItems = items;
  }

  function handleVariantDndFinalize(e: CustomEvent) {
    // 去掉拖动过程中库可能留下的影子占位条目（isDndShadowItem），只保留真实变体
    const rawItems = (e.detail.items || []) as DndVariantItem[];
    const info = (e.detail.info || {}) as {
      trigger?: string;
      id?: string | number;
    };
    const trigger = info.trigger || "";
    const finalItems = rawItems.filter((it) => it && !it.isDndShadowItem);

    const batch = getVariantBatchDrag();
    const batchSet = batch ? new Set(batch.variants) : null;

    // 1) 落在所有变体区之外：顺序保持不变，只是结束本次拖动
    if (trigger === "droppedOutsideOfAny") {
      const ordered = finalItems.map((it) => it.variant);
      variantItems = toVariantItems(ordered);
      commitVariantOrder(ordered);
      return;
    }

    // 2) 来源框：被按住的那一条离开了本框，把整组剩下的成员也一并移走
    if (
      trigger === "droppedIntoAnother" &&
      batch &&
      batchSet &&
      batch.boxId === textBox.id
    ) {
      const remaining = finalItems
        .filter((it) => !batchSet.has(it.variant))
        .map((it) => it.variant);
      clearSelection();
      clearVariantBatchDrag();
      variantItems = toVariantItems(remaining);
      commitVariantOrder(remaining);
      return;
    }

    // 3) 接收框：以"被拖条目的落点"为锚点，把整组作为连续块插进去。
    //    同框重排时其余成员本来就在列表里，会先被摘掉再随块落位；
    //    跨框移动时其余成员还在源框，由源框的 finalize 负责移除。
    if (batch && batchSet) {
      // 必须按 id 定位"被按住的那一条"：同框拖动时其余成员还在列表里，
      // 直接取第一个命中项会错把队友当成落点。
      let dropIndex = finalItems.findIndex((it) => String(it.id) === String(info.id));
      if (dropIndex < 0) {
        dropIndex = finalItems.findIndex((it) => batchSet.has(it.variant));
      }

      if (dropIndex >= 0) {
        const blockItemsBefore = finalItems
          .slice(0, dropIndex)
          .filter((it) => batchSet.has(it.variant)).length;
        const insertAt = Math.max(0, dropIndex - blockItemsBefore);
        const block = batch.variants.filter(Boolean);

        // 同框时判断锚点是否真的动过：如果只是原地松手，就保持原顺序，
        // 免得把原本分散的选中项强行聚成一堆
        const draggedVariant = finalItems[dropIndex]?.variant;
        const draggedOrigIndex = draggedVariant
          ? variantList.indexOf(draggedVariant)
          : -1;
        if (draggedOrigIndex >= 0) {
          const origBefore = variantList
            .slice(0, draggedOrigIndex)
            .filter((v) => batchSet.has(v)).length;
          if (insertAt === draggedOrigIndex - origBefore) {
            variantItems = toVariantItems(variantList);
            return;
          }
        }

        const rest = finalItems
          .filter((it) => !batchSet.has(it.variant))
          .map((it) => it.variant);
        const ordered = [
          ...rest.slice(0, insertAt),
          ...block,
          ...rest.slice(insertAt),
        ];

        if (batch.boxId === textBox.id) {
          // 同框重排：选中集合里的引用没变，位置会自动跟随，无需重设
          clearVariantBatchDrag();
        } else {
          // 跨框移入：整组成为本框的选中项
          setSelection(block, block[0] ?? null);
        }
        variantItems = toVariantItems(ordered);
        commitVariantOrder(ordered);
        return;
      }
    }

    // 4) 普通单条拖动
    const ordered = finalItems.map((it) => it.variant);
    variantItems = toVariantItems(ordered);
    commitVariantOrder(ordered);
  }

  const BATCH_GHOST_ATTR = "data-variant-batch-ghost";

  /**
   * 整组拖动时给拖影加一个 ×N 角标，让"这次带走的是多条"一眼可见。
   * 由 svelte-dnd-action 的 transformDraggedElement 回调触发。
   */
  function decorateDraggedElement(draggedEl?: HTMLElement) {
    if (!draggedEl || !draggedEl.appendChild) return;
    const batch = getVariantBatchDrag();
    const existing = draggedEl.querySelector(
      `[${BATCH_GHOST_ATTR}]`,
    ) as HTMLElement | null;

    if (!batch || batch.variants.length < 2) {
      if (existing) existing.remove();
      return;
    }

    if (existing) {
      existing.textContent = `×${batch.variants.length}`;
      return;
    }

    const badge = document.createElement("span");
    badge.setAttribute(BATCH_GHOST_ATTR, "true");
    badge.textContent = `×${batch.variants.length}`;
    badge.style.cssText =
      "position:absolute;top:-7px;right:-7px;z-index:1;pointer-events:none;" +
      "background:#2563eb;color:#fff;border-radius:9999px;font-size:10px;" +
      "line-height:1;padding:2px 5px;font-weight:600;box-shadow:0 0 0 1px #1d4ed8;";
    draggedEl.style.overflow = "visible";
    draggedEl.appendChild(badge);
  }

  $: modeColor =
    textBox.mode === "normal"
      ? "bg-gray-700"
      : textBox.mode === "disabled"
        ? "bg-gray-800"
        : "bg-purple-800";
</script>

<svelte:window
  on:mousemove={handleResizeMove}
  on:mouseup={handleResizeEnd}
  on:touchend={handleResizeEnd}
/>

<div
  class="flex flex-col bg-gray-800 rounded-lg mb-2 overflow-hidden relative {isDragging
    ? 'opacity-50'
    : ''}"
  style="height: {height}px;"
>
  <!-- 标题栏 - 三栏布局（顶端对齐：变体换行时右侧按钮保持在顶部，不随高度居中浮动） -->
  <div
    class="flex items-start px-3 py-2 {modeColor} border-b border-gray-600 gap-2"
  >
    <!-- 左侧：拖动句柄和标题 -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <div
        class="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-300 select-none"
        draggable="true"
        role="button"
        tabindex="0"
        on:dragstart={handleDragStart}
        on:dragend={handleDragEnd}
        on:keydown={(e) => {}}
        title="Drag to reorder"
      >
        ☰
      </div>
      <div class="relative w-24">
        {#if !isEditingTitle}
          <div
            class="font-medium truncate px-1 rounded cursor-pointer hover:bg-gray-700 text-sm {currentTitle?.trim()
              ? 'text-white'
              : 'text-gray-400 italic'}"
            role="button"
            tabindex="0"
            on:click={handleTitleClick}
            on:keydown={(e) => e.key === "Enter" && handleTitleClick()}
            title="Click to edit title"
          >
            {getDisplayTitle(currentVariant)}
          </div>
        {:else}
          <input
            type="text"
            bind:this={titleInput}
            value={currentTitle}
            on:input={handleTitleInput}
            on:focus={handleTitleFocus}
            on:blur={handleTitleBlur}
            on:keydown={handleTitleKeyDown}
            class="w-full bg-transparent font-medium truncate focus:outline-none focus:bg-gray-700 rounded px-1 text-white text-sm"
            placeholder="Enter title..."
          />
        {/if}
      </div>
    </div>

    <!-- 中间：变体切换按钮列表 -->
    <div class="flex-1 min-w-0">
      <!-- svelte-ignore a11y_no_static_element_interactions a11y-no-static-element-interactions a11y_no_noninteractive_element_interactions a11y-no-noninteractive-element-interactions -->
      <div
        use:dndzone={{
          items: variantItems,
          flipDurationMs: 200,
          type: "variant",
          transformDraggedElement: decorateDraggedElement,
        }}
        on:consider={handleVariantDndConsider}
        on:finalize={handleVariantDndFinalize}
        on:keydown={handleVariantZoneKeyDown}
        on:click={handleVariantZoneClick}
        class="flex flex-wrap gap-1 justify-center"
        role="list"
      >
        {#each variantItems as item (item.id)}
          {@const vIndex = item.index}
          {@const variant = item.variant}
          {@const isCurrent = vIndex === currentVariantIndex}
          {@const isSelected = selectionSet.has(variant)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            role="button"
            tabindex="0"
            data-variant-chip="true"
            data-selected={isSelected}
            on:click={(e) => handleVariantClick(vIndex, e)}
            on:keydown={(e) => handleVariantChipKeyDown(vIndex, e)}
            class="px-2 py-1 text-xs rounded border transition-all duration-150 cursor-grab active:cursor-grabbing select-none max-w-[80px] truncate
              {isCurrent
              ? 'bg-blue-600 border-blue-500 text-white'
              : isSelected
                ? 'bg-blue-900/60 border-blue-500/70 text-blue-100'
                : 'bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500'}
              {isSelected && multiSelected
              ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-800'
              : ''}"
            title="{getDisplayTitle(
              variant
            )}{isSelected
              ? ' (selected)'
              : ''} - Click to switch, Shift/Ctrl+Click to multi-select, drag to move"
          >
            {getDisplayTitle(variant)}
          </div>
        {/each}
      </div>
    </div>

    <!-- 右侧：操作按钮 -->
    <div class="flex items-center gap-1 flex-shrink-0">
      <select
        value={textBox.mode}
        on:change={handleModeChange}
        class="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
      >
        <option value="normal">Normal</option>
        <option value="disabled">Disabled</option>
        <option value="shadow">Shadow</option>
      </select>

      <button
        on:click={handleAddVariant}
        class="text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-900/30 text-xs"
        title="Add Variant"
      >
        ➕
      </button>
      <button
        on:click={handleDeleteVariant}
        class="text-orange-400 hover:text-orange-300 px-2 py-1 rounded hover:bg-orange-900/30 text-xs"
        title={multiSelected
          ? `Delete ${selection.length} selected variants`
          : "Delete Variant"}
      >
        {multiSelected ? `🗑 ${selection.length}` : "🗑"}
      </button>
      <button
        on:click={handleDelete}
        class="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30 text-xs"
        title="Delete"
      >
        ×
      </button>
    </div>
  </div>

  <!-- 多选操作条：只在真正选中"多条"时出现，避免单选切换变体时抖动布局 -->
  {#if multiSelected}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      data-variant-toolbar="true"
      class="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 bg-gray-900 border-b border-gray-700 text-[11px] text-gray-300 select-none"
    >
      <span class="text-blue-300 font-medium">
        {selection.length} variants selected
      </span>

      <div class="flex items-center gap-1">
        <button
          on:click={() => handleMoveSelection(-1)}
          disabled={!canMoveLeft}
          class="px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move selection one step earlier"
        >
          ◀
        </button>
        <button
          on:click={() => handleMoveSelection(1)}
          disabled={!canMoveRight}
          class="px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move selection one step later"
        >
          ▶
        </button>
      </div>

      <button
        on:click={() => deleteVariants(selectedIndices)}
        class="px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300 hover:bg-orange-900/70"
        title="Delete selected variants"
      >
        🗑 Delete
      </button>

      <button
        on:click={selectAllVariants}
        class="px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600"
        title="Select all variants"
      >
        Select all
      </button>

      <button
        on:click={clearSelection}
        class="px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600"
        title="Clear selection"
      >
        Clear
      </button>

      <span class="text-gray-500">
        Shift-click for a range · Ctrl-click to toggle · drag any selected chip to
        move the group
      </span>
    </div>
  {/if}

  <div class="flex-1 relative overflow-hidden">
    <div
      class="absolute inset-0 flex"
      style="transform: translateX(-{currentVariantIndex *
        100}%); transition: transform 0.3s ease;"
    >
      {#each variantList as variant, vIndex}
        <div class="flex-shrink-0 w-full h-full" style="width: 100%;">
          <textarea
            value={variant.content}
            on:input={handleVariantInput(vIndex)}
            class="w-full h-full bg-gray-900 text-white p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your text here..."
          ></textarea>
        </div>
      {/each}
    </div>
  </div>

  <div
    class="h-2 bg-gray-700 hover:bg-gray-600 cursor-ns-resize flex items-center justify-center"
    role="separator"
    aria-orientation="horizontal"
    on:mousedown={handleResizeStart}
  >
    <div class="w-8 h-1 bg-gray-500 rounded"></div>
  </div>
</div>
