export interface TextBox {
  id: string;
  title: string;
  content: string;
  mode: 'normal' | 'disabled' | 'shadow';
  checked: boolean;
  height: number;
  variants: string[];
  currentVariant: number;
}

export interface Separator {
  id: string;
  content: string;
}

export interface PromptFile {
  name: string;
  text_boxes: TextBox[];
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
  activeTab: 'files' | 'workbench';
  generatedText: string;
  showGeneratedModal: boolean;
}
