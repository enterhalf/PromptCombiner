export interface TextBox {
  id: string;
  title: string;
  content: string;
  mode: "normal" | "disabled" | "shadow";
}

export interface Separator {
  id: string;
  content: string;
}

export interface PromptFile {
  name: string;
  order: string[];
  heights: Record<string, number>;
  text_boxes: Record<string, TextBox>;
  separators: Separator[];
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
