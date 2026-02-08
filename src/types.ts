export interface TextBox {
  id: string;
  title: string;
  content: string;
  mode: "normal" | "disabled" | "shadow";
  variants?: string[];
  currentVariantIndex?: number;
}

export interface PromptFile {
  name: string;
  order: string[];
  heights: Record<string, number>;
  text_boxes: Record<string, TextBox>;
  variants: Record<string, Record<string, string>>;
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
