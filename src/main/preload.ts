import { contextBridge, ipcRenderer } from 'electron';
import type { Folder, Note, Todo, AppSettings } from '../shared/types.js';

export interface TodonotesAPI {
  // Database / Notes
  createFolder: (name: string, parentId?: string | null) => Promise<Folder>;
  listFolders: (parentId?: string | null) => Promise<Folder[]>;
  deleteFolder: (id: string) => Promise<boolean>;
  
  createNote: (title: string, content: string, folderId?: string | null) => Promise<Note>;
  readNote: (id: string) => Promise<Note | null>;
  updateNote: (id: string, updates: { title?: string; content?: string; folderId?: string | null }) => Promise<Note | null>;
  listNotes: (folderId?: string | null) => Promise<Array<Omit<Note, 'content'>>>;
  deleteNote: (id: string) => Promise<boolean>;

  // Todos
  addTodo: (text: string, noteId?: string | null, sortOrder?: number) => Promise<Todo>;
  listTodos: (includeCompleted?: boolean) => Promise<Todo[]>;
  reorderTodo: (id: string, newSortOrder: number) => Promise<Todo | null>;
  toggleTodo: (id: string, completed?: boolean) => Promise<Todo | null>;
  updateTodo: (id: string, updates: { text?: string; noteId?: string | null }) => Promise<Todo | null>;
  deleteTodo: (id: string) => Promise<boolean>;

  // Settings & Shortcut
  getSettings: () => Promise<AppSettings>;
  setGlobalShortcut: (shortcut: string) => Promise<{ success: boolean; error?: string }>;
  hideSpotlight: () => void;
  openMainWindow: () => void;
  isSpotlightMode: () => Promise<boolean>;
}

const api: TodonotesAPI = {
  createFolder: (name, parentId) => ipcRenderer.invoke('db:createFolder', name, parentId),
  listFolders: (parentId) => ipcRenderer.invoke('db:listFolders', parentId),
  deleteFolder: (id) => ipcRenderer.invoke('db:deleteFolder', id),

  createNote: (title, content, folderId) => ipcRenderer.invoke('db:createNote', title, content, folderId),
  readNote: (id) => ipcRenderer.invoke('db:readNote', id),
  updateNote: (id, updates) => ipcRenderer.invoke('db:updateNote', id, updates),
  listNotes: (folderId) => ipcRenderer.invoke('db:listNotes', folderId),
  deleteNote: (id) => ipcRenderer.invoke('db:deleteNote', id),

  addTodo: (text, noteId, sortOrder) => ipcRenderer.invoke('db:addTodo', text, noteId, sortOrder),
  listTodos: (includeCompleted) => ipcRenderer.invoke('db:listTodos', includeCompleted),
  reorderTodo: (id, newSortOrder) => ipcRenderer.invoke('db:reorderTodo', id, newSortOrder),
  toggleTodo: (id, completed) => ipcRenderer.invoke('db:toggleTodo', id, completed),
  updateTodo: (id, updates) => ipcRenderer.invoke('db:updateTodo', id, updates),
  deleteTodo: (id) => ipcRenderer.invoke('db:deleteTodo', id),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setGlobalShortcut: (shortcut) => ipcRenderer.invoke('settings:setShortcut', shortcut),
  hideSpotlight: () => ipcRenderer.send('window:hideSpotlight'),
  openMainWindow: () => ipcRenderer.send('window:openMain'),
  isSpotlightMode: () => ipcRenderer.invoke('window:isSpotlightMode'),
};

contextBridge.exposeInMainWorld('todonotes', api);
