#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  initDatabase,
  listTodos,
  addTodo,
  reorderTodo,
  toggleTodo,
  deleteTodo,
  listFolders,
  createFolder,
  readNote,
  createNote,
  listNotes,
  deleteNote,
} from '../main/db.js';

// Ensure database is initialized
initDatabase();

export function createTodonotesMcpServer(): Server {
  const server = new Server(
    {
      name: 'todonotes',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_todos',
          description:
            'List todo items ordered chronologically (oldest first) and by custom sort rank. Returns id, text, completed status, sort_order, created_at, and optional linked note details.',
          inputSchema: {
            type: 'object',
            properties: {
              include_completed: {
                type: 'boolean',
                description: 'Whether to include completed todos. Defaults to true.',
              },
            },
          },
        },
        {
          name: 'add_todo',
          description:
            'Add a new todo item with automatic creation timestamp. Can be optionally linked to an existing encrypted note.',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The task description or title.',
              },
              note_id: {
                type: 'string',
                description: 'Optional ID of a note to link to this todo.',
              },
              sort_order: {
                type: 'number',
                description: 'Optional sort order number. If omitted, appends to the end of the list.',
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'reorder_todo',
          description:
            'Reorder a todo item by updating its numeric sort order rank.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The unique ID of the todo to reorder.',
              },
              new_sort_order: {
                type: 'number',
                description: 'The new numeric sort order rank.',
              },
            },
            required: ['id', 'new_sort_order'],
          },
        },
        {
          name: 'toggle_todo',
          description: 'Toggle or update the completion status of a todo item.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The unique ID of the todo.',
              },
              completed: {
                type: 'boolean',
                description: 'Optional explicit completed boolean. If omitted, toggles state.',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'delete_todo',
          description: 'Delete a todo item by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The ID of the todo to delete.',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'list_folders',
          description: 'List note folders and subfolders.',
          inputSchema: {
            type: 'object',
            properties: {
              parent_id: {
                type: 'string',
                description: 'Optional parent folder ID to list subfolders for. Omit to list all.',
              },
            },
          },
        },
        {
          name: 'create_folder',
          description: 'Create a new folder or subfolder for organizing notes.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Folder name.',
              },
              parent_id: {
                type: 'string',
                description: 'Optional parent folder ID for nested subfolders.',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'list_notes',
          description: 'List note titles, folders, and timestamps (without decrypting ciphertext payloads).',
          inputSchema: {
            type: 'object',
            properties: {
              folder_id: {
                type: 'string',
                description: 'Optional folder ID to filter notes.',
              },
            },
          },
        },
        {
          name: 'read_note',
          description:
            'Read and decrypt an AES-256-GCM encrypted note from storage using the master key secured in macOS Keychain.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The ID of the note to decrypt and read.',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'create_note',
          description:
            'Create and encrypt a new note with AES-256-GCM encryption secured by macOS Keychain.',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the note.',
              },
              content: {
                type: 'string',
                description: 'Note content (Markdown or plain text).',
              },
              folder_id: {
                type: 'string',
                description: 'Optional folder ID to place the note in.',
              },
            },
            required: ['title', 'content'],
          },
        },
        {
          name: 'delete_note',
          description: 'Delete a note by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The ID of the note to delete.',
              },
            },
            required: ['id'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'list_todos': {
          const includeCompleted = typeof args.include_completed === 'boolean' ? args.include_completed : true;
          const todos = listTodos(includeCompleted);
          return {
            content: [{ type: 'text', text: JSON.stringify(todos, null, 2) }],
          };
        }

        case 'add_todo': {
          const text = String(args.text || '').trim();
          if (!text) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: Parameter "text" is required.' }],
            };
          }
          const noteId = args.note_id ? String(args.note_id) : null;
          const sortOrder = typeof args.sort_order === 'number' ? args.sort_order : undefined;
          const todo = addTodo(text, noteId, sortOrder);
          return {
            content: [{ type: 'text', text: JSON.stringify(todo, null, 2) }],
          };
        }

        case 'reorder_todo': {
          const id = String(args.id || '');
          const newOrder = Number(args.new_sort_order);
          if (!id || isNaN(newOrder)) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: Parameters "id" and "new_sort_order" are required.' }],
            };
          }
          const updated = reorderTodo(id, newOrder);
          if (!updated) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Todo with ID "${id}" not found.` }],
            };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }],
          };
        }

        case 'toggle_todo': {
          const id = String(args.id || '');
          if (!id) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: Parameter "id" is required.' }],
            };
          }
          const completed = typeof args.completed === 'boolean' ? args.completed : undefined;
          const toggled = toggleTodo(id, completed);
          if (!toggled) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Todo with ID "${id}" not found.` }],
            };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(toggled, null, 2) }],
          };
        }

        case 'delete_todo': {
          const id = String(args.id || '');
          const deleted = deleteTodo(id);
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: deleted, id }) }],
          };
        }

        case 'list_folders': {
          const parentId = args.parent_id !== undefined ? String(args.parent_id) : undefined;
          const folders = listFolders(parentId);
          return {
            content: [{ type: 'text', text: JSON.stringify(folders, null, 2) }],
          };
        }

        case 'create_folder': {
          const folderName = String(args.name || '').trim();
          if (!folderName) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: Parameter "name" is required.' }],
            };
          }
          const parentId = args.parent_id ? String(args.parent_id) : null;
          const folder = createFolder(folderName, parentId);
          return {
            content: [{ type: 'text', text: JSON.stringify(folder, null, 2) }],
          };
        }

        case 'list_notes': {
          const folderId = args.folder_id !== undefined ? (args.folder_id ? String(args.folder_id) : null) : undefined;
          const notes = listNotes(folderId);
          return {
            content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }],
          };
        }

        case 'read_note': {
          const id = String(args.id || '');
          if (!id) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: Parameter "id" is required.' }],
            };
          }
          const note = await readNote(id);
          if (!note) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Note with ID "${id}" not found.` }],
            };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(note, null, 2) }],
          };
        }

        case 'create_note': {
          const title = String(args.title || '').trim();
          const content = String(args.content || '');
          if (!title) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: Parameter "title" is required.' }],
            };
          }
          const folderId = args.folder_id ? String(args.folder_id) : null;
          const created = await createNote(title, content, folderId);
          return {
            content: [{ type: 'text', text: JSON.stringify(created, null, 2) }],
          };
        }

        case 'delete_note': {
          const id = String(args.id || '');
          const deleted = deleteNote(id);
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: deleted, id }) }],
          };
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: `Unknown tool "${name}".` }],
          };
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool error: ${err?.message || String(err)}` }],
      };
    }
  });

  return server;
}

// When executed directly, launch the stdio transport
if (process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server.ts'))) {
  const server = createTodonotesMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error('Fatal TodoNotes MCP Server error:', err);
    process.exit(1);
  });
}
