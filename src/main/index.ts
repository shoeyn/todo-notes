import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initDatabase,
  listFolders,
  createFolder,
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
  updateTodo,
  deleteTodo,
} from './db.js';
import {
  initShortcutManager,
  getGlobalShortcut,
  setGlobalShortcut,
  unregisterShortcuts,
} from './shortcut.js';
import { getMasterKey } from './keychain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let spotlightWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

function createSpotlightWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  const winWidth = 650;
  const winHeight = 280;
  const x = Math.round((width - winWidth) / 2);
  const y = 160;

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const query = '?mode=spotlight';
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}${query}`);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), { search: query });
  }

  win.on('blur', () => {
    win.hide();
  });

  return win;
}

function toggleSpotlight(): void {
  if (!spotlightWindow) {
    spotlightWindow = createSpotlightWindow();
  }

  if (spotlightWindow.isVisible() && spotlightWindow.isFocused()) {
    spotlightWindow.hide();
  } else {
    spotlightWindow.show();
    spotlightWindow.focus();
    spotlightWindow.webContents.send('spotlight:opened');
  }
}

// Register IPC handlers
function registerIpcHandlers(): void {
  ipcMain.handle('db:createFolder', async (_, name, parentId) => createFolder(name, parentId));
  ipcMain.handle('db:listFolders', async (_, parentId) => listFolders(parentId));
  ipcMain.handle('db:deleteFolder', async (_, id) => deleteFolder(id));

  ipcMain.handle('db:createNote', async (_, title, content, folderId) => createNote(title, content, folderId));
  ipcMain.handle('db:readNote', async (_, id) => readNote(id));
  ipcMain.handle('db:updateNote', async (_, id, updates) => updateNote(id, updates));
  ipcMain.handle('db:listNotes', async (_, folderId) => listNotes(folderId));
  ipcMain.handle('db:deleteNote', async (_, id) => deleteNote(id));

  ipcMain.handle('db:addTodo', async (_, text, noteId, sortOrder) => addTodo(text, noteId, sortOrder));
  ipcMain.handle('db:listTodos', async (_, includeCompleted) => listTodos(includeCompleted));
  ipcMain.handle('db:reorderTodo', async (_, id, newSortOrder) => reorderTodo(id, newSortOrder));
  ipcMain.handle('db:toggleTodo', async (_, id, completed) => toggleTodo(id, completed));
  ipcMain.handle('db:updateTodo', async (_, id, updates) => updateTodo(id, updates));
  ipcMain.handle('db:deleteTodo', async (_, id) => deleteTodo(id));

  ipcMain.handle('settings:get', async () => ({
    globalShortcut: getGlobalShortcut(),
    theme: 'dark' as const,
  }));

  ipcMain.handle('settings:setShortcut', async (_, shortcut) => setGlobalShortcut(shortcut));

  ipcMain.on('window:hideSpotlight', () => {
    if (spotlightWindow && spotlightWindow.isVisible()) {
      spotlightWindow.hide();
    }
  });

  ipcMain.on('window:openMain', () => {
    if (spotlightWindow && spotlightWindow.isVisible()) {
      spotlightWindow.hide();
    }
    if (!mainWindow) {
      mainWindow = createMainWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.handle('window:isSpotlightMode', (event) => {
    return event.sender === spotlightWindow?.webContents;
  });
}

app.whenReady().then(async () => {
  // Initialize database and key
  initDatabase();
  await getMasterKey();

  registerIpcHandlers();

  // Create windows
  mainWindow = createMainWindow();
  spotlightWindow = createSpotlightWindow();

  // Initialize global shortcut (Option+Space / Alt+Space)
  initShortcutManager(() => {
    toggleSpotlight();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('will-quit', () => {
  unregisterShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
