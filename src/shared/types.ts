export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  children?: Folder[];
}

export interface NoteRecord {
  id: string;
  folder_id: string | null;
  title: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  sort_order: number;
  note_id: string | null;
  created_at: string;
  updated_at: string;
  note_title?: string | null;
}

export interface AppSettings {
  globalShortcut: string;
  theme: 'dark' | 'light' | 'system';
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}
