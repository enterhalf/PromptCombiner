export interface TextBox {
  id: string;
  mode: "normal" | "disabled" | "shadow";
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
  name: string;
  order: string[];
  variants: Record<string, VariantData>;
  text_boxes: Record<string, TextBox>;
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

export interface AppState {
  workspacePath: string;
  currentFile: PromptFile | null;
  workspaceItems: WorkspaceItem[];
  activeTab: "files" | "workbench";
  generatedText: string;
  showGeneratedModal: boolean;
}
