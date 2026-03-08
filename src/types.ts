export interface TextBox {
  id: string;
  mode: "normal" | "disabled" | "shadow";
  type?: "text"; // 默认为 text
}

export interface FileBox {
  id: string;
  mode: "normal" | "disabled" | "shadow";
  type: "file";
}

// 文件框中的一行文件项
export interface FileBoxItem {
  id: string;
  path: string;
  checked: boolean;
}

// 文件框的数据
export interface FileBoxData {
  height: number;
  path_segments: number; // 保留的路径分段数，默认2，小于1表示显示完整路径
  files: FileBoxItem[];
  title: string; // 文件框标题，用于 Shadow 模式
}

export interface Variant {
  content: string;
  title: string;
}

export interface VariantData {
  height: number;
  variants: Variant[];
  current_variant_index: number;
}

export interface PromptFile {
  order: string[];
  variants: Record<string, VariantData>;
  text_boxes: Record<string, TextBox>;
  file_boxes: Record<string, FileBox>; // 文件框数据
  file_box_data: Record<string, FileBoxData>; // 文件框的文件列表数据
  separators: Separator[];
}

export interface Separator {
  id: string;
  content: string;
}

export interface WorkspaceItem {
  name: string;
  path: string;
  is_file: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export interface Tab {
  id: string;
  file: PromptFile | null;
  fileName: string;
  filePath: string;
  isUnsaved: boolean;
}

export interface PrivacyMapping {
  id: string;
  original: string;
  replacement: string;
}

export interface Plugin {
  id: string;
  name: string;
  enabled: boolean;
}

export interface AppState {
  tabs: Tab[];
  activeTabId: string | null;
  currentFile: PromptFile | null;
  currentFileName: string;
  currentFilePath: string;
  activeTab: "files" | "workbench";
  generatedText: string;
  showGeneratedModal: boolean;
  recentFiles: string[];
  toasts: Toast[];
  plugins: Plugin[];
  privacyMappings: PrivacyMapping[];
  showPluginPanel: boolean;
  showPrivacyManager: boolean;
  showPrivacyRestore: boolean;
}

// 框体类型，为未来扩展预留
export type BoxType = "text" | "file" | "image";
