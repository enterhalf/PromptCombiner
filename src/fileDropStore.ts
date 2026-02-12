import { writable } from "svelte/store";

// 全局文件拖放状态
export interface FileDropState {
  isDragging: boolean;
  hoveredFileBoxId: string | null;
}

const initialState: FileDropState = {
  isDragging: false,
  hoveredFileBoxId: null,
};

export const fileDropStore = writable<FileDropState>(initialState);

export function setDragStart() {
  fileDropStore.update((state) => ({ ...state, isDragging: true }));
}

export function setDragEnd() {
  fileDropStore.update((state) => ({
    ...state,
    isDragging: false,
    hoveredFileBoxId: null,
  }));
}

export function setHoveredFileBox(id: string | null) {
  fileDropStore.update((state) => ({ ...state, hoveredFileBoxId: id }));
}
