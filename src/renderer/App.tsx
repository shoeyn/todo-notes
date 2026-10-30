import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  FileText,
  FolderPlus,
  Folder as FolderIcon,
  ChevronRight,
  ChevronDown,
  Lock,
  Shield,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Settings,
  Link as LinkIcon,
  Search,
  Key,
} from 'lucide-react';
import type { Folder, Note, Todo, AppSettings } from '../shared/types.js';
import { SpotlightPopup } from './SpotlightPopup.js';

export const App: React.FC = () => {
  const [isSpotlight, setIsSpotlight] = useState(false);
  const [activeTab, setActiveTab] = useState<'todos' | 'notes'>('todos');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Todos state
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoNoteId, setNewTodoNoteId] = useState<string>('');
  const [showCompleted, setShowCompleted] = useState(true);

  // Notes state
  const [notesList, setNotesList] = useState<Array<Omit<Note, 'content'>>>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [noteEditTitle, setNoteEditTitle] = useState('');
  const [noteEditContent, setNoteEditContent] = useState('');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Modals & Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    globalShortcut: 'Alt+Space',
    theme: 'dark',
  });
  const [shortcutInput, setShortcutInput] = useState('');
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);

  // New folder dialog
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string>('');

  useEffect(() => {
    // Check if running in spotlight window mode
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'spotlight') {
      setIsSpotlight(true);
      return;
    }

    if (window.todonotes) {
      window.todonotes.isSpotlightMode().then((isSp) => {
        if (isSp) setIsSpotlight(true);
      });
      loadData();
      window.todonotes.getSettings().then((s) => {
        setSettings(s);
        setShortcutInput(s.globalShortcut);
      });
    }
  }, []);

  const loadData = async () => {
    if (!window.todonotes) return;
    try {
      const [f, t, n] = await Promise.all([
        window.todonotes.listFolders(),
        window.todonotes.listTodos(true),
        window.todonotes.listNotes(),
      ]);
      setFolders(f);
      setTodos(t);
      setNotesList(n);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  // -------------------------------------------------------------------------
  // TODO ACTIONS
  // -------------------------------------------------------------------------
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim() || !window.todonotes) return;
    const created = await window.todonotes.addTodo(
      newTodoText.trim(),
      newTodoNoteId || null
    );
    setTodos((prev) => [...prev, created]);
    setNewTodoText('');
    setNewTodoNoteId('');
  };

  const handleToggleTodo = async (id: string, currentStatus: boolean) => {
    if (!window.todonotes) return;
    const updated = await window.todonotes.toggleTodo(id, !currentStatus);
    if (updated) {
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  };

  const handleDeleteTodo = async (id: string) => {
    if (!window.todonotes) return;
    await window.todonotes.deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    if (!window.todonotes) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= todos.length) return;

    const currentItem = todos[index];
    const neighborItem = todos[targetIndex];

    // Swap their sort orders
    const newCurrentOrder = neighborItem.sort_order;
    const newNeighborOrder = currentItem.sort_order;

    await window.todonotes.reorderTodo(currentItem.id, newCurrentOrder);
    await window.todonotes.reorderTodo(neighborItem.id, newNeighborOrder);

    const reloaded = await window.todonotes.listTodos(true);
    setTodos(reloaded);
  };

  // -------------------------------------------------------------------------
  // NOTE ACTIONS
  // -------------------------------------------------------------------------
  const handleSelectNote = async (id: string) => {
    if (!window.todonotes) return;
    const note = await window.todonotes.readNote(id);
    if (note) {
      setActiveNote(note);
      setNoteEditTitle(note.title);
      setNoteEditContent(note.content);
    }
  };

  const handleCreateNewNote = async () => {
    if (!window.todonotes) return;
    const created = await window.todonotes.createNote(
      'Untitled Note',
      '',
      selectedFolderId
    );
    setActiveNote(created);
    setNoteEditTitle(created.title);
    setNoteEditContent('');
    const freshNotes = await window.todonotes.listNotes();
    setNotesList(freshNotes);
  };

  const handleSaveActiveNote = async () => {
    if (!activeNote || !window.todonotes) return;
    setIsSavingNote(true);
    try {
      const updated = await window.todonotes.updateNote(activeNote.id, {
        title: noteEditTitle,
        content: noteEditContent,
      });
      if (updated) {
        setActiveNote(updated);
        const freshNotes = await window.todonotes.listNotes();
        setNotesList(freshNotes);
      }
    } finally {
      setTimeout(() => setIsSavingNote(false), 300);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!window.todonotes) return;
    await window.todonotes.deleteNote(id);
    if (activeNote?.id === id) {
      setActiveNote(null);
      setNoteEditTitle('');
      setNoteEditContent('');
    }
    const freshNotes = await window.todonotes.listNotes();
    setNotesList(freshNotes);
  };

  // -------------------------------------------------------------------------
  // FOLDER ACTIONS
  // -------------------------------------------------------------------------
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !window.todonotes) return;
    const created = await window.todonotes.createFolder(
      newFolderName.trim(),
      newFolderParentId || null
    );
    setFolders((prev) => [...prev, created]);
    setNewFolderName('');
    setNewFolderParentId('');
    setIsNewFolderOpen(false);
  };

  const handleDeleteFolder = async (id: string) => {
    if (!window.todonotes) return;
    await window.todonotes.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    if (selectedFolderId === id) setSelectedFolderId(null);
  };

  // -------------------------------------------------------------------------
  // SETTINGS & SHORTCUT
  // -------------------------------------------------------------------------
  const handleSaveShortcut = async () => {
    if (!window.todonotes || !shortcutInput.trim()) return;
    const res = await window.todonotes.setGlobalShortcut(shortcutInput.trim());
    if (res.success) {
      setSettings((s) => ({ ...s, globalShortcut: shortcutInput.trim() }));
      setShortcutFeedback('✓ Shortcut updated successfully');
      setTimeout(() => setShortcutFeedback(null), 2500);
    } else {
      setShortcutFeedback(`❌ ${res.error || 'Failed to register shortcut'}`);
    }
  };

  // Filter notes by folder and search query
  const filteredNotes = useMemo(() => {
    return notesList.filter((n) => {
      if (selectedFolderId && n.folder_id !== selectedFolderId) return false;
      if (
        noteSearchQuery &&
        !n.title.toLowerCase().includes(noteSearchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [notesList, selectedFolderId, noteSearchQuery]);

  // If in spotlight popup mode
  if (isSpotlight) {
    return <SpotlightPopup />;
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 font-sans select-none overflow-hidden">
      {/* -------------------------------------------------------------------- */}
      {/* SIDEBAR                                                              */}
      {/* -------------------------------------------------------------------- */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/60 flex flex-col justify-between">
        <div className="flex flex-col">
          {/* Mac window drag region */}
          <div className="h-9 w-full flex items-center px-4 pt-2 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center gap-2 pl-14">
              <span className="font-semibold text-xs tracking-wider text-zinc-300 uppercase">
                TodoNotes
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="p-3 space-y-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('todos');
                setSelectedFolderId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'todos'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare size={16} />
                <span>All Todos</span>
              </div>
              <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 font-mono">
                {todos.filter((t) => !t.completed).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('notes');
                setSelectedFolderId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'notes' && selectedFolderId === null
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText size={16} />
                <span>All Notes</span>
              </div>
              <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 font-mono">
                {notesList.length}
              </span>
            </button>
          </div>

          {/* Folders Section */}
          <div className="px-3 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1">
              <span>Folders</span>
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(true)}
                className="hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition"
                title="New Folder"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="mt-1 space-y-0.5 overflow-y-auto max-h-[300px]">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                    selectedFolderId === folder.id && activeTab === 'notes'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                  onClick={() => {
                    setSelectedFolderId(folder.id);
                    setActiveTab('notes');
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderIcon size={14} className="text-amber-400 shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 transition"
                    title="Delete folder"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {folders.length === 0 && (
                <div className="text-[11px] text-zinc-600 px-3 py-2 italic">
                  No folders yet. Click + to create one.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Status / Settings Bar */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
            <Shield size={13} />
            <span>macOS Keychain</span>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 transition"
          >
            <Settings size={13} />
            <kbd className="text-[10px] bg-zinc-900 px-1 py-0.5 rounded border border-zinc-700">
              {settings.globalShortcut}
            </kbd>
          </button>
        </div>
      </aside>

      {/* -------------------------------------------------------------------- */}
      {/* MAIN VIEW CONTENT                                                    */}
      {/* -------------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
        {/* Top App Header */}
        <header className="h-12 border-b border-zinc-800/80 px-6 flex items-center justify-between shrink-0 bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-sm text-zinc-200">
              {activeTab === 'todos' ? 'Todo Checklist' : 'Encrypted Notes'}
            </h1>
            {activeTab === 'todos' && (
              <span className="text-[11px] text-zinc-500 font-mono">
                Auto-ordered: Oldest first (ASC)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'todos' ? (
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                />
                <span>Show Completed</span>
              </label>
            ) : (
              <button
                type="button"
                onClick={handleCreateNewNote}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition shadow-sm"
              >
                <Plus size={13} />
                New Note
              </button>
            )}
          </div>
        </header>

        {/* Tab 1: TODOS VIEW */}
        {activeTab === 'todos' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* Quick Add Bar */}
            <form onSubmit={handleAddTodo} className="flex gap-2 mb-4 shrink-0">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Add a new task (auto-sequenced oldest first)..."
                className="flex-1 bg-zinc-900/70 border border-zinc-700/60 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 placeholder-zinc-500"
              />

              <select
                value={newTodoNoteId}
                onChange={(e) => setNewTodoNoteId(e.target.value)}
                className="bg-zinc-900/70 border border-zinc-700/60 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="">No linked note</option>
                {notesList.map((n) => (
                  <option key={n.id} value={n.id}>
                    Link: {n.title}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
              >
                <Plus size={14} />
                Add
              </button>
            </form>

            {/* Todos List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {todos
                .filter((t) => showCompleted || !t.completed)
                .map((todo, idx) => (
                  <div
                    key={todo.id}
                    className={`group flex items-center justify-between p-3 rounded-xl border transition ${
                      todo.completed
                        ? 'bg-zinc-950/40 border-zinc-800/40 text-zinc-500'
                        : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => handleToggleTodo(todo.id, todo.completed)}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <span
                        className={`text-sm truncate ${
                          todo.completed ? 'line-through text-zinc-500' : ''
                        }`}
                      >
                        {todo.text}
                      </span>
                      {todo.note_title && (
                        <button
                          type="button"
                          onClick={() => {
                            if (todo.note_id) {
                              setActiveTab('notes');
                              handleSelectNote(todo.note_id);
                            }
                          }}
                          className="flex items-center gap-1 text-[11px] bg-zinc-800 px-2 py-0.5 rounded text-indigo-400 hover:text-indigo-300 transition"
                        >
                          <LinkIcon size={11} />
                          {todo.note_title}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
                      <span className="font-mono text-[10px]">
                        {new Date(todo.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {/* Reorder Buttons */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => handleReorder(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                          title="Move Up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(idx, 'down')}
                          disabled={idx === todos.length - 1}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                          title="Move Down"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTodo(todo.id)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 ml-1"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {todos.length === 0 && (
                <div className="text-center py-12 text-zinc-600 text-sm">
                  No todos yet. Use the input above or press <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-xs">{settings.globalShortcut}</kbd> from anywhere.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: NOTES VIEW */}
        {activeTab === 'notes' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Notes List Sub-panel */}
            <div className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-900/20">
              <div className="p-3 border-b border-zinc-800">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={noteSearchQuery}
                    onChange={(e) => setNoteSearchQuery(e.target.value)}
                    placeholder="Search notes..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 placeholder-zinc-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNote(note.id)}
                    className={`p-3 cursor-pointer transition flex flex-col gap-1 ${
                      activeNote?.id === note.id
                        ? 'bg-indigo-950/30 border-l-2 border-indigo-500 text-zinc-100'
                        : 'hover:bg-zinc-900/50 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate">{note.title || 'Untitled'}</span>
                      <Lock size={11} className="text-emerald-400 shrink-0" />
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}

                {filteredNotes.length === 0 && (
                  <div className="text-center py-8 text-zinc-600 text-xs italic">
                    No notes found.
                  </div>
                )}
              </div>
            </div>

            {/* Note Editor */}
            <div className="flex-1 flex flex-col bg-zinc-950 p-6 overflow-hidden">
              {activeNote ? (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <input
                      type="text"
                      value={noteEditTitle}
                      onChange={(e) => setNoteEditTitle(e.target.value)}
                      placeholder="Note Title"
                      className="text-lg font-bold bg-transparent focus:outline-none text-zinc-100 flex-1"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveActiveNote}
                        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                      >
                        {isSavingNote ? 'Encrypting...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(activeNote.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-400 rounded hover:bg-zinc-800 transition"
                        title="Delete note"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={noteEditContent}
                    onChange={(e) => setNoteEditContent(e.target.value)}
                    placeholder="Write Markdown or encrypted note contents here..."
                    className="flex-1 bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-zinc-200 placeholder-zinc-600"
                  />

                  <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800/80">
                    <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-mono">
                      <Lock size={11} />
                      AES-256-GCM Encrypted at Rest
                    </span>
                    <span>
                      Updated {new Date(activeNote.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-2">
                  <FileText size={32} className="opacity-40" />
                  <span className="text-sm">Select a note from the left or create a new one</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------------- */}
      {/* NEW FOLDER MODAL                                                     */}
      {/* -------------------------------------------------------------------- */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <FolderPlus size={18} className="text-amber-400" />
              <span>Create New Folder</span>
            </div>

            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name..."
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-amber-500"
            />

            {folders.length > 0 && (
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-400">Parent Folder (for nesting):</span>
                <select
                  value={newFolderParentId}
                  onChange={(e) => setNewFolderParentId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-300"
                >
                  <option value="">None (Top Level)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SETTINGS MODAL                                                       */}
      {/* -------------------------------------------------------------------- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 font-semibold text-sm text-zinc-200">
                <Settings size={18} />
                <span>TodoNotes Preferences</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {/* Global Shortcut Configuration */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-300">
                Global Quick-Capture Shortcut (Spotlight Popup)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shortcutInput}
                  onChange={(e) => setShortcutInput(e.target.value)}
                  placeholder="e.g. Option+Space, Alt+Space"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSaveShortcut}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition"
                >
                  Update
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Default: <code className="font-mono text-zinc-400">Option+Space</code> (or <code className="font-mono text-zinc-400">Alt+Space</code>). Toggles spotlight quick todo/note capture from anywhere in macOS.
              </p>
              {shortcutFeedback && (
                <div className="text-xs font-medium text-emerald-400 pt-1">
                  {shortcutFeedback}
                </div>
              )}
            </div>

            {/* Keychain & Encryption Info */}
            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <Key size={14} className="text-amber-400" />
                <span>macOS Keychain Master Key</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Notes are encrypted at rest with AES-256-GCM. The 256-bit encryption key is securely stored in macOS Keychain under service <code className="font-mono text-zinc-300">todonotes</code> with biometric/login authorization.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
