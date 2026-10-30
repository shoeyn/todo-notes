# TodoNotes

> **Fast, encrypted desktop todo and note-taking app with global quick-capture, macOS Keychain security, and native Model Context Protocol (MCP) server integration.**

TodoNotes is a local-first desktop application designed for high-velocity daily task and note capture. It pairs a lightweight, spotlight-style quick-capture overlay with end-to-end encrypted markdown notes at rest, hierarchical folder organization, and a built-in stdio MCP server that allows autonomous AI agents (such as **CustomAgent**, **Antigravity**, and **Kiro**) to read, organize, and create tasks and notes seamlessly without friction.

---

## Key Features

- ⚡ **Global Quick-Capture Overlay**: Summon a frameless, floating capture box from anywhere across macOS using a configurable global hotkey (`Option+Space` by default). Press `Esc` or `Enter` to dismiss or submit instantly.
- 🔒 **Encrypted at Rest via macOS Keychain**: Note bodies are strongly encrypted with AES-256-GCM. The master cryptographic key is stored securely in the native macOS Keychain (`kSecAccessControlUserPresence`), unlocking seamlessly via Touch ID biometrics or your macOS user password.
- 📋 **Chronological & Ranked Todos**: Tasks record creation timestamps and display oldest-first by default so lingering items are never forgotten. Custom drag-and-drop or manual priority rank overrides are supported when you need to reorder urgent tasks.
- 🔗 **Note-Linked Todos**: Link any task directly to a parent note or project specification, or keep it standalone as a quick reminder.
- 📁 **Hierarchical Folders**: Organize knowledge bases and project scratchpads into deep nested folders and subfolders.
- 🤖 **Native Model Context Protocol (MCP) Server**: Exposes complete CRUD and search capabilities over stdio. AI coding agents can inspect your project todos, file bug reminders, or read architectural notes directly while working.
- 🛡️ **Zero-Friction CustomAgent Integration**: Pre-registered with CustomAgent trust policies so your personal AI assistant can query and update tasks without repeatedly triggering security approval popups.

---

## Tech Stack & Architecture

- **Desktop Shell**: [Electron](https://www.electronjs.org/) (frameless window management, global shortcuts, native OS integration)
- **Frontend & UI**: React 19, TypeScript, Tailwind CSS, Lucide icons
- **Local Persistence**: SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) with Write-Ahead Logging (WAL) enabled
- **Cryptography**: AES-256-GCM via Node.js native `crypto`, protected by native macOS Keychain APIs (`keytar`)
- **Agent Integration**: Standard stdio transport using [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol)

---

## Repository Structure

```
todonotes/
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Application lifecycle & window manager
│   │   ├── shortcut.ts          # Configurable global shortcut (Option+Space)
│   │   ├── keychain.ts          # macOS Keychain key derivation & AES-256-GCM
│   │   ├── db/                  # SQLite schema, migrations & repositories
│   │   │   ├── schema.sql       # folders, notes, todos schema definitions
│   │   │   └── client.ts        # Database connection & prepared statements
│   │   └── ipc/                 # IPC communication handlers for UI
│   ├── renderer/                # React 19 Frontend
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── App.tsx          # Main dashboard & dual-pane layout
│   │   │   ├── QuickCapture.tsx # Frameless spotlight popup component
│   │   │   ├── components/      # FolderTree, NoteEditor, TodoList
│   │   │   └── styles/          # Tailwind CSS styles
│   └── mcp/                     # Standalone Stdio MCP Server
│       ├── index.ts             # MCP server entry point & stdio transport
│       ├── tools/               # Handlers for todos, notes, and folders
│       └── db.ts                # Direct database access layer for agents
└── tests/                       # Unit and integration test suites
```

---

## Getting Started

### Prerequisites

- **macOS** (12.0 Monterey or later recommended for Touch ID Keychain features)
- **Node.js** >= 20.x
- **pnpm** (Package manager managed via `mise` or corepack)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/nathanshoemark/todonotes.git ~/git/todonotes
cd ~/git/todonotes
pnpm install
```

### Running in Development

Start the Vite development server and the Electron desktop application concurrently:

```bash
pnpm dev
```

To run only the standalone stdio MCP server for testing with an AI client:

```bash
pnpm mcp
```

### Running Tests & Typecheck

```bash
# Typecheck TypeScript sources
pnpm typecheck

# Run automated behavioral tests
pnpm test
```

### Building for Production

Compile TypeScript, bundle the React frontend with Vite, and package the native macOS `.app` and `.dmg`:

```bash
pnpm build
```

---

## Configuration

Settings are saved locally in `~/Library/Application Support/TodoNotes/config.json`:

```json
{
  "shortcut": "Alt+Space",
  "theme": "dark",
  "defaultTodoSort": "oldest_first",
  "keychainAccount": "todonotes-encryption-key"
}
```

- **Global Shortcut**: Default is `Alt+Space` (`Option+Space` on macOS). Can be reconfigured to any valid Electron accelerator (e.g., `Cmd+Shift+Space`).
- **Database Location**: SQLite database is stored locally at `~/Library/Application Support/TodoNotes/todonotes.sqlite`.

---

## MCP Server Integration

TodoNotes includes a native Model Context Protocol (MCP) server that runs as a stdio process. This enables agents to manage tasks and notes programmatically.

### Adding to Antigravity / Claude Desktop / Kiro

Add the following configuration to your MCP settings file (e.g., `~/.gemini/antigravity-cli/settings.json`, `~/.kiro/settings/mcp.json`, or Claude Desktop config):

```json
{
  "mcpServers": {
    "todonotes": {
      "command": "node",
      "args": ["/Users/nathanshoemark/git/todonotes/dist/mcp/index.js"]
    }
  }
}
```

### Available MCP Tools

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `list_todos` | `include_completed?: boolean` | Lists todos chronologically (oldest first) with custom sort rank override. |
| `add_todo` | `text: string`, `note_id?: string` | Quickly creates a new todo item, optionally linked to a note. |
| `reorder_todo` | `id: string`, `target_index: number` | Moves a todo to a new position, updating priority rank. |
| `toggle_todo` | `id: string`, `completed?: boolean` | Toggles the completion status of a todo. |
| `delete_todo` | `id: string` | Permanently deletes a todo item. |
| `list_folders` | *none* | Retrieves the nested folder and subfolder hierarchy tree. |
| `create_folder` | `name: string`, `parent_id?: string` | Creates a new folder or subfolder. |
| `list_notes` | `folder_id?: string` | Lists note headers (id, title, timestamps, folder_id) without decrypting bodies. |
| `read_note` | `id: string` | Decrypts and retrieves the full markdown body of a note via Keychain authorization. |
| `create_note` | `title: string`, `content: string`, `folder_id?: string` | Encrypts note payload with AES-256-GCM and persists it. |
| `delete_note` | `id: string` | Permanently removes a note and any linked associations. |

---

## CustomAgent Frictionless Access

CustomAgent automatically recognizes the `todonotes` MCP server. Tool requests routed through CustomAgent's permission manager are automatically granted trusted access for frictionless daily operation without repeated confirmation dialogs.

---

## Keyboard Shortcuts

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| `Option + Space` | Global (system-wide) | Toggle quick-capture spotlight popup |
| `Enter` | Quick-Capture Popup | Save todo / quick note and close popup |
| `Esc` | Quick-Capture Popup | Dismiss popup without saving |
| `Cmd + N` | Main Window | Create a new note |
| `Cmd + Shift + N` | Main Window | Create a new folder |
| `Cmd + T` | Main Window | Focus todo input |
| `Cmd + F` | Main Window | Search notes and todos |
