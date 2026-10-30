import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  initDatabase,
  createFolder,
  listFolders,
  deleteFolder,
  createNote,
  readNote,
  updateNote,
  listNotes,
  deleteNote,
  addTodo,
  listTodos,
  reorderTodo,
  toggleTodo,
  deleteTodo,
} from '../src/main/db.js';

describe('Database Operations (better-sqlite3)', () => {
  let tmpDbDir: string;
  let tmpDbPath: string;
  const testKey = crypto.randomBytes(32).toString('hex');

  beforeEach(() => {
    tmpDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todonotes-db-test-'));
    tmpDbPath = path.join(tmpDbDir, 'test.db');
    initDatabase(tmpDbPath);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDbDir)) {
      fs.rmSync(tmpDbDir, { recursive: true, force: true });
    }
  });

  describe('Folders', () => {
    it('creates root folders and subfolders, preserving hierarchy', () => {
      const parent = createFolder('Projects');
      expect(parent.id).toBeDefined();
      expect(parent.name).toBe('Projects');
      expect(parent.parent_id).toBeNull();

      const sub = createFolder('CustomAgent', parent.id);
      expect(sub.parent_id).toBe(parent.id);

      const allFolders = listFolders();
      expect(allFolders.length).toBe(2);

      const subfolders = listFolders(parent.id);
      expect(subfolders.length).toBe(1);
      expect(subfolders[0].name).toBe('CustomAgent');
    });

    it('deletes folder and cascades', () => {
      const folder = createFolder('Temp');
      expect(deleteFolder(folder.id)).toBe(true);
      expect(listFolders().length).toBe(0);
    });
  });

  describe('Notes (AES-256-GCM Encrypted)', () => {
    it('creates and decrypts notes at rest', async () => {
      const folder = createFolder('Work');
      const note = await createNote(
        'Sprint Roadmap',
        '# Goals\n1. Zero regressions\n2. High velocity',
        folder.id,
        testKey
      );

      expect(note.id).toBeDefined();
      expect(note.title).toBe('Sprint Roadmap');
      expect(note.folder_id).toBe(folder.id);

      // Verify read and decrypt
      const read = await readNote(note.id, testKey);
      expect(read).not.toBeNull();
      expect(read?.title).toBe('Sprint Roadmap');
      expect(read?.content).toContain('# Goals');
      expect(read?.content).toContain('Zero regressions');
    });

    it('updates note content and re-encrypts', async () => {
      const note = await createNote('Draft', 'Initial draft', null, testKey);
      const updated = await updateNote(
        note.id,
        { title: 'Finalized', content: 'Updated confidential content' },
        testKey
      );

      expect(updated?.title).toBe('Finalized');
      expect(updated?.content).toBe('Updated confidential content');

      const reRead = await readNote(note.id, testKey);
      expect(reRead?.content).toBe('Updated confidential content');
    });

    it('lists note metadata without exposing plaintext content', async () => {
      await createNote('Note 1', 'Secret 1', null, testKey);
      await createNote('Note 2', 'Secret 2', null, testKey);

      const notes = listNotes();
      expect(notes.length).toBe(2);
      expect(notes[0].title).toBeDefined();
      expect((notes[0] as any).content).toBeUndefined();
    });

    it('deletes notes cleanly', async () => {
      const note = await createNote('Trash me', 'Gone', null, testKey);
      expect(deleteNote(note.id)).toBe(true);
      const read = await readNote(note.id, testKey);
      expect(read).toBeNull();
    });
  });

  describe('Todos', () => {
    it('creates todos auto-ordered oldest first (ASC) and sequence ranks', () => {
      const t1 = addTodo('First task');
      const t2 = addTodo('Second task');
      const t3 = addTodo('Third task');

      expect(t1.sort_order).toBe(1);
      expect(t2.sort_order).toBe(2);
      expect(t3.sort_order).toBe(3);

      const todos = listTodos();
      expect(todos.length).toBe(3);
      expect(todos[0].text).toBe('First task');
      expect(todos[1].text).toBe('Second task');
      expect(todos[2].text).toBe('Third task');
    });

    it('reorders todos by updating sort_order', () => {
      const t1 = addTodo('Task A');
      const t2 = addTodo('Task B');

      // Move Task B ahead of Task A
      const reordered = reorderTodo(t2.id, 0.5);
      expect(reordered?.sort_order).toBe(0.5);

      const todos = listTodos();
      expect(todos[0].text).toBe('Task B');
      expect(todos[1].text).toBe('Task A');
    });

    it('toggles completion status', () => {
      const t = addTodo('Deploy app');
      expect(t.completed).toBe(false);

      const toggled = toggleTodo(t.id, true);
      expect(toggled?.completed).toBe(true);

      const toggledBack = toggleTodo(t.id);
      expect(toggledBack?.completed).toBe(false);
    });

    it('links todo to an encrypted note', async () => {
      const note = await createNote('Project Brief', 'Details...', null, testKey);
      const todo = addTodo('Read the brief', note.id);

      expect(todo.note_id).toBe(note.id);
      expect(todo.note_title).toBe('Project Brief');

      const todos = listTodos();
      expect(todos[0].note_title).toBe('Project Brief');
    });

    it('deletes todo', () => {
      const todo = addTodo('Delete me');
      expect(deleteTodo(todo.id)).toBe(true);
      expect(listTodos().length).toBe(0);
    });
  });
});
