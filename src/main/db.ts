import Database, { type Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type { Folder, Note, NoteRecord, Todo } from '../shared/types.js';
import { encryptText, decryptText } from './keychain.js';

let dbInstance: DatabaseType | null = null;

export function getDatabasePath(): string {
  const customPath = process.env.TODONOTES_DB_PATH;
  if (customPath) return customPath;

  const dir = path.join(os.homedir(), '.todonotes');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'todonotes.db');
}

export function initDatabase(dbPath?: string): DatabaseType {
  const resolvedPath = dbPath || getDatabasePath();
  const db = new Database(resolvedPath);

  // WAL mode for fast concurrent reads and atomic writes
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT NULL REFERENCES folders(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      folder_id TEXT NULL REFERENCES folders(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      sort_order REAL NOT NULL,
      note_id TEXT NULL REFERENCES notes(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_todos_order ON todos (sort_order ASC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes (folder_id);
    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders (parent_id);
  `);

  dbInstance = db;
  return db;
}

export function getDb(): DatabaseType {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

// ---------------------------------------------------------------------------
// FOLDERS
// ---------------------------------------------------------------------------

export function createFolder(name: string, parentId: string | null = null): Folder {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO folders (id, name, parent_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, name.trim(), parentId || null, now, now);

  return {
    id,
    name: name.trim(),
    parent_id: parentId || null,
    created_at: now,
    updated_at: now,
  };
}

export function listFolders(parentId?: string | null): Folder[] {
  const db = getDb();
  if (parentId !== undefined) {
    if (parentId === null) {
      return db.prepare('SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name ASC').all() as Folder[];
    }
    return db.prepare('SELECT * FROM folders WHERE parent_id = ? ORDER BY name ASC').all(parentId) as Folder[];
  }
  return db.prepare('SELECT * FROM folders ORDER BY name ASC').all() as Folder[];
}

export function deleteFolder(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  return res.changes > 0;
}

// ---------------------------------------------------------------------------
// NOTES
// ---------------------------------------------------------------------------

export async function createNote(
  title: string,
  content: string,
  folderId: string | null = null,
  keyHexOverride?: string
): Promise<Note> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const payload = await encryptText(content, keyHexOverride);

  const stmt = db.prepare(`
    INSERT INTO notes (id, folder_id, title, ciphertext, iv, auth_tag, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, folderId || null, title.trim(), payload.ciphertext, payload.iv, payload.authTag, now, now);

  return {
    id,
    folder_id: folderId || null,
    title: title.trim(),
    content,
    created_at: now,
    updated_at: now,
  };
}

export async function readNote(id: string, keyHexOverride?: string): Promise<Note | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRecord | undefined;
  if (!row) return null;

  const content = await decryptText(
    {
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.auth_tag,
    },
    keyHexOverride
  );

  return {
    id: row.id,
    folder_id: row.folder_id,
    title: row.title,
    content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateNote(
  id: string,
  updates: { title?: string; content?: string; folderId?: string | null },
  keyHexOverride?: string
): Promise<Note | null> {
  const db = getDb();
  const existing = await readNote(id, keyHexOverride);
  if (!existing) return null;

  const now = new Date().toISOString();
  const nextTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
  const nextFolderId = updates.folderId !== undefined ? updates.folderId : existing.folder_id;
  const nextContent = updates.content !== undefined ? updates.content : existing.content;

  const payload = await encryptText(nextContent, keyHexOverride);

  db.prepare(`
    UPDATE notes
    SET title = ?, folder_id = ?, ciphertext = ?, iv = ?, auth_tag = ?, updated_at = ?
    WHERE id = ?
  `).run(nextTitle, nextFolderId, payload.ciphertext, payload.iv, payload.authTag, now, id);

  return {
    id,
    folder_id: nextFolderId,
    title: nextTitle,
    content: nextContent,
    created_at: existing.created_at,
    updated_at: now,
  };
}

export function listNotes(folderId?: string | null): Array<Omit<Note, 'content'> & { preview?: string }> {
  const db = getDb();
  let rows: NoteRecord[];
  if (folderId !== undefined) {
    if (folderId === null) {
      rows = db.prepare('SELECT id, folder_id, title, ciphertext, iv, auth_tag, created_at, updated_at FROM notes WHERE folder_id IS NULL ORDER BY updated_at DESC').all() as NoteRecord[];
    } else {
      rows = db.prepare('SELECT id, folder_id, title, ciphertext, iv, auth_tag, created_at, updated_at FROM notes WHERE folder_id = ? ORDER BY updated_at DESC').all(folderId) as NoteRecord[];
    }
  } else {
    rows = db.prepare('SELECT id, folder_id, title, ciphertext, iv, auth_tag, created_at, updated_at FROM notes ORDER BY updated_at DESC').all() as NoteRecord[];
  }

  return rows.map((r) => ({
    id: r.id,
    folder_id: r.folder_id,
    title: r.title,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function deleteNote(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return res.changes > 0;
}

// ---------------------------------------------------------------------------
// TODOS
// ---------------------------------------------------------------------------

export function addTodo(text: string, noteId: string | null = null, sortOrder?: number): Todo {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  let order = sortOrder;
  if (order === undefined) {
    const row = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM todos').get() as { max_order: number };
    order = (row?.max_order ?? 0) + 1;
  }

  db.prepare(`
    INSERT INTO todos (id, text, completed, sort_order, note_id, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?, ?)
  `).run(id, text.trim(), order, noteId || null, now, now);

  let noteTitle: string | null = null;
  if (noteId) {
    const note = db.prepare('SELECT title FROM notes WHERE id = ?').get(noteId) as { title: string } | undefined;
    if (note) noteTitle = note.title;
  }

  return {
    id,
    text: text.trim(),
    completed: false,
    sort_order: order,
    note_id: noteId || null,
    created_at: now,
    updated_at: now,
    note_title: noteTitle,
  };
}

export function listTodos(includeCompleted: boolean = true): Todo[] {
  const db = getDb();
  const sql = `
    SELECT 
      t.id, t.text, t.completed, t.sort_order, t.note_id, t.created_at, t.updated_at,
      n.title AS note_title
    FROM todos t
    LEFT JOIN notes n ON t.note_id = n.id
    ${includeCompleted ? '' : 'WHERE t.completed = 0'}
    ORDER BY t.sort_order ASC, t.created_at ASC
  `;

  const rows = db.prepare(sql).all() as any[];
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    completed: Boolean(r.completed),
    sort_order: r.sort_order,
    note_id: r.note_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    note_title: r.note_title,
  }));
}

export function reorderTodo(id: string, newSortOrder: number): Todo | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ?').run(newSortOrder, now, id);

  const row = db.prepare(`
    SELECT t.*, n.title AS note_title
    FROM todos t
    LEFT JOIN notes n ON t.note_id = n.id
    WHERE t.id = ?
  `).get(id) as any;

  if (!row) return null;
  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    sort_order: row.sort_order,
    note_id: row.note_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    note_title: row.note_title,
  };
}

export function toggleTodo(id: string, completed?: boolean): Todo | null {
  const db = getDb();
  const now = new Date().toISOString();
  if (completed !== undefined) {
    db.prepare('UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?').run(completed ? 1 : 0, now, id);
  } else {
    db.prepare('UPDATE todos SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?').run(now, id);
  }

  const row = db.prepare(`
    SELECT t.*, n.title AS note_title
    FROM todos t
    LEFT JOIN notes n ON t.note_id = n.id
    WHERE t.id = ?
  `).get(id) as any;

  if (!row) return null;
  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    sort_order: row.sort_order,
    note_id: row.note_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    note_title: row.note_title,
  };
}

export function updateTodo(id: string, updates: { text?: string; noteId?: string | null }): Todo | null {
  const db = getDb();
  const now = new Date().toISOString();
  if (updates.text !== undefined && updates.noteId !== undefined) {
    db.prepare('UPDATE todos SET text = ?, note_id = ?, updated_at = ? WHERE id = ?').run(updates.text.trim(), updates.noteId, now, id);
  } else if (updates.text !== undefined) {
    db.prepare('UPDATE todos SET text = ?, updated_at = ? WHERE id = ?').run(updates.text.trim(), now, id);
  } else if (updates.noteId !== undefined) {
    db.prepare('UPDATE todos SET note_id = ?, updated_at = ? WHERE id = ?').run(updates.noteId, now, id);
  }

  const row = db.prepare(`
    SELECT t.*, n.title AS note_title
    FROM todos t
    LEFT JOIN notes n ON t.note_id = n.id
    WHERE t.id = ?
  `).get(id) as any;

  if (!row) return null;
  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    sort_order: row.sort_order,
    note_id: row.note_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    note_title: row.note_title,
  };
}

export function deleteTodo(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  return res.changes > 0;
}
