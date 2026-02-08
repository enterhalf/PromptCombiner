# Prompt Combiner

A cross-platform prompt management and combination tool built with Tauri, Svelte, and Rust.

## Features

### Main Interface
- **Text Boxes**: Create and manage multiple text boxes with drag-and-drop reordering
- **Resizable**: Drag the bottom edge of text boxes to adjust height
- **Three Modes**:
  - **Normal**: Participates in context generation
  - **Disabled**: Excluded from context generation
  - **Shadow**: Excluded from context but available as variables (e.g., `{{variable_name}}`)
- **Variants**: Create multiple versions of text content with horizontal navigation
- **Separators**: Define custom separators between text boxes (default: `\n\n`)

### Sidebar
- **File Browser**: Browse and manage `.prompt` files in your workspace
- **File Operations**: Create, rename, copy, and delete files
- **Workspace Management**: Select and switch between workspaces

### Workbench
- **Generate**: Combine all text boxes into a single prompt
- **Generate & Copy**: Generate and automatically copy to clipboard
- **Outline View**: Visual overview of all text boxes with drag-and-drop reordering
- **Preview**: Real-time preview of the generated output

## Tech Stack

- **Frontend**: Svelte 4 + TypeScript
- **Backend**: Rust (Tauri)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## Installation

### Prerequisites

- Node.js 18+ and npm
- Rust and Cargo
- Tauri CLI

### Setup

1. Install dependencies:
```bash
npm install
```

2. Install Tauri CLI:
```bash
npm install -g @tauri-apps/cli
```

## Development

Run the development server:
```bash
npm run dev
```

This will start both the Vite dev server and the Tauri application.

## Building

Build for production:
```bash
npm run build
```

Build the Tauri application:
```bash
npm run tauri build
```

## Project Structure

```
prompt-combiner/
├── src/
│   ├── components/
│   │   ├── TextBox.svelte      # Text box component with modes and variants
│   │   ├── Separator.svelte     # Separator component
│   │   ├── Sidebar.svelte       # File browser and navigation
│   │   └── Workbench.svelte     # Generation and outline view
│   ├── App.svelte               # Main application component
│   ├── main.ts                  # Application entry point
│   ├── app.css                  # Global styles
│   ├── store.ts                 # Svelte store for state management
│   ├── types.ts                 # TypeScript type definitions
│   └── tauri-api.ts             # Tauri API wrapper functions
├── src-tauri/
│   ├── src/
│   │   └── main.rs              # Rust backend with file I/O
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json          # Tauri configuration
├── package.json                 # Node.js dependencies
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS configuration
└── tsconfig.json                # TypeScript configuration
```

## Usage

1. **Select Workspace**: Click "Select Workspace" to choose your working directory
2. **Create File**: Click "+ New File" to create a new `.prompt` file
3. **Add Text Boxes**: Click "+ Text Box" to add new text boxes
4. **Configure Modes**: Use the dropdown to set text box mode (Normal/Disabled/Shadow)
5. **Add Variants**: Click the "+" button on the right side of text boxes to create variants
6. **Generate**: Click "Generate" or "Generate & Copy" to create the final prompt

## File Format

`.prompt` files are stored as JSON with the following structure:

```json
{
  "name": "example.prompt",
  "text_boxes": [
    {
      "id": "unique-id",
      "title": "Example Title",
      "content": "Example content",
      "mode": "normal",
      "checked": true,
      "height": 150,
      "variants": ["content"],
      "currentVariant": 0
    }
  ],
  "separators": [
    {
      "id": "sep-id",
      "content": "\\n\\n"
    }
  ]
}
```

## Design Principles

- **Single Responsibility Principle (SRP)**: Each component and module has a single, well-defined purpose
- **Defensive Programming**: All file operations include error handling
- **Performance**: Optimized for both runtime performance and low resource usage when idle
- **Storage**: Data persistence with minimal disk I/O operations
- **UI/UX**: Clean, simple interface with color blocks for easy navigation

## License

MIT
