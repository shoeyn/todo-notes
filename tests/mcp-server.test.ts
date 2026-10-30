import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initDatabase } from '../src/main/db.js';
import { createTodonotesMcpServer } from '../src/mcp/server.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

describe('TodoNotes MCP Server', () => {
  let tmpDbDir: string;
  let server: ReturnType<typeof createTodonotesMcpServer>;

  beforeEach(() => {
    process.env.TODONOTES_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    tmpDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todonotes-mcp-test-'));
    const tmpDbPath = path.join(tmpDbDir, 'mcp_test.db');
    initDatabase(tmpDbPath);
    server = createTodonotesMcpServer();
  });

  afterEach(() => {
    delete process.env.TODONOTES_MASTER_KEY;
    if (fs.existsSync(tmpDbDir)) {
      fs.rmSync(tmpDbDir, { recursive: true, force: true });
    }
  });

  it('exposes all required tools in ListTools handler', async () => {
    const listHandler = (server as any)._requestHandlers.get(
      ListToolsRequestSchema.shape.method.value
    );
    expect(listHandler).toBeDefined();

    const response = await listHandler({ method: 'tools/list' }, {});
    const toolNames = response.tools.map((t: any) => t.name);

    expect(toolNames).toContain('list_todos');
    expect(toolNames).toContain('add_todo');
    expect(toolNames).toContain('reorder_todo');
    expect(toolNames).toContain('list_folders');
    expect(toolNames).toContain('read_note');
    expect(toolNames).toContain('create_note');
  });

  it('adds and lists todos via CallTool handler', async () => {
    const callHandler = (server as any)._requestHandlers.get(
      CallToolRequestSchema.shape.method.value
    );

    // 1. Add todo
    const addRes = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'add_todo',
          arguments: { text: 'Ship TodoNotes App' },
        },
      },
      {}
    );
    expect(addRes.isError).toBeUndefined();
    const createdTodo = JSON.parse(addRes.content[0].text);
    expect(createdTodo.text).toBe('Ship TodoNotes App');
    expect(createdTodo.completed).toBe(false);

    // 2. List todos
    const listRes = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'list_todos',
          arguments: { include_completed: true },
        },
      },
      {}
    );
    const todos = JSON.parse(listRes.content[0].text);
    expect(todos.length).toBe(1);
    expect(todos[0].text).toBe('Ship TodoNotes App');
  });

  it('reorders todos via CallTool handler', async () => {
    const callHandler = (server as any)._requestHandlers.get(
      CallToolRequestSchema.shape.method.value
    );

    const t1 = JSON.parse(
      (
        await callHandler(
          {
            method: 'tools/call',
            params: {
              name: 'add_todo',
              arguments: { text: 'First' },
            },
          },
          {}
        )
      ).content[0].text
    );

    const t2 = JSON.parse(
      (
        await callHandler(
          {
            method: 'tools/call',
            params: {
              name: 'add_todo',
              arguments: { text: 'Second' },
            },
          },
          {}
        )
      ).content[0].text
    );

    // Reorder t2 before t1
    const reorderRes = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'reorder_todo',
          arguments: { id: t2.id, new_sort_order: 0.1 },
        },
      },
      {}
    );
    expect(reorderRes.isError).toBeUndefined();

    const listRes = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'list_todos',
          arguments: {},
        },
      },
      {}
    );
    const todos = JSON.parse(listRes.content[0].text);
    expect(todos[0].text).toBe('Second');
    expect(todos[1].text).toBe('First');
  });

  it('creates and reads encrypted notes via CallTool handler', async () => {
    const callHandler = (server as any)._requestHandlers.get(
      CallToolRequestSchema.shape.method.value
    );

    // 1. Create encrypted note
    const createRes = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'create_note',
          arguments: {
            title: 'API Tokens',
            content: 'SECRET_TOKEN_XYZ_123',
          },
        },
      },
      {}
    );
    expect(createRes.isError).toBeUndefined();
    const createdNote = JSON.parse(createRes.content[0].text);
    expect(createdNote.id).toBeDefined();
    expect(createdNote.title).toBe('API Tokens');

    // 2. Read note (decrypts from rest)
    const readRes = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'read_note',
          arguments: { id: createdNote.id },
        },
      },
      {}
    );
    expect(readRes.isError).toBeUndefined();
    const readNote = JSON.parse(readRes.content[0].text);
    expect(readNote.title).toBe('API Tokens');
    expect(readNote.content).toBe('SECRET_TOKEN_XYZ_123');
  });

  it('creates and lists folders via CallTool handler', async () => {
    const callHandler = (server as any)._requestHandlers.get(
      CallToolRequestSchema.shape.method.value
    );

    const folderRes = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'create_folder',
          arguments: { name: 'Work' },
        },
      },
      {}
    );
    expect(folderRes.isError).toBeUndefined();
    const folder = JSON.parse(folderRes.content[0].text);
    expect(folder.name).toBe('Work');

    const listRes = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'list_folders',
          arguments: {},
        },
      },
      {}
    );
    const folders = JSON.parse(listRes.content[0].text);
    expect(folders.length).toBe(1);
    expect(folders[0].name).toBe('Work');
  });
});
