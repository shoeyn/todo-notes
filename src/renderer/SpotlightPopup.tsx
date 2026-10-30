import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, FileText, ArrowRight, X, ExternalLink, ShieldCheck } from 'lucide-react';
import type { Folder, Note } from '../shared/types.js';

export const SpotlightPopup: React.FC = () => {
  const [mode, setMode] = useState<'todo' | 'note'>('todo');
  const [text, setText] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Array<Omit<Note, 'content'>>>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load available folders and notes for quick linking
    if (window.todonotes) {
      window.todonotes.listFolders().then(setFolders).catch(console.error);
      window.todonotes.listNotes().then(setNotes).catch(console.error);
    }

    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.todonotes?.hideSpotlight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!window.todonotes) return;

    if (mode === 'todo') {
      if (!text.trim()) return;
      await window.todonotes.addTodo(text.trim(), selectedNoteId || null);
      setStatusMessage('✓ Todo added');
    } else {
      if (!noteTitle.trim()) return;
      await window.todonotes.createNote(
        noteTitle.trim(),
        text.trim(),
        selectedFolderId || null
      );
      setStatusMessage('🛡️ Encrypted note created');
    }

    setText('');
    setNoteTitle('');
    setTimeout(() => {
      setStatusMessage(null);
      window.todonotes?.hideSpotlight();
    }, 400);
  };

  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-3 select-none">
      <div className="w-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/60 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-zinc-100">
        {/* Top Header & Tabs */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-1.5 bg-zinc-800/80 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('todo');
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                mode === 'todo'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CheckSquare size={13} />
              Quick Todo
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('note');
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                mode === 'note'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText size={13} />
              Encrypted Note
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
              <ShieldCheck size={12} />
              Keychain AES-256
            </span>
            <button
              type="button"
              onClick={() => window.todonotes?.openMainWindow()}
              className="p-1 hover:text-zinc-100 transition rounded hover:bg-zinc-800"
              title="Open Full App"
            >
              <ExternalLink size={14} />
            </button>
            <button
              type="button"
              onClick={() => window.todonotes?.hideSpotlight()}
              className="p-1 hover:text-zinc-100 transition rounded hover:bg-zinc-800"
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          {mode === 'note' && (
            <input
              type="text"
              ref={inputRef}
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Note Title..."
              className="w-full bg-zinc-950/70 border border-zinc-700/60 rounded-xl px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-indigo-500 placeholder-zinc-500"
            />
          )}

          <div className="relative">
            <input
              type="text"
              ref={mode === 'todo' ? inputRef : undefined}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                mode === 'todo'
                  ? 'What needs to be done? (Press Enter to save)'
                  : 'Note body content (encrypted at rest)...'
              }
              className="w-full bg-zinc-950/70 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-zinc-500 pr-10"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
            >
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Options / Link Row */}
          <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
            <div className="flex items-center gap-2">
              {mode === 'todo' ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Link note:</span>
                  <select
                    value={selectedNoteId}
                    onChange={(e) => setSelectedNoteId(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="">None (Standalone)</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Folder:</span>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="">Root / General</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              {statusMessage ? (
                <span className="text-emerald-400 font-medium animate-pulse">{statusMessage}</span>
              ) : (
                <span>
                  <kbd className="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-[10px]">⏎ Enter</kbd> save{' '}
                  <kbd className="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-[10px] ml-1">Esc</kbd> dismiss
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
