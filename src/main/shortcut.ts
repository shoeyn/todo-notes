import { globalShortcut } from 'electron';
import Store from 'electron-store';

export const DEFAULT_SHORTCUT = 'Alt+Space';

interface StoreSchema {
  globalShortcut: string;
}

const store = new Store<StoreSchema>({
  name: 'todonotes-config',
  defaults: {
    globalShortcut: DEFAULT_SHORTCUT,
  },
});

let currentShortcut: string = DEFAULT_SHORTCUT;
let activeCallback: (() => void) | null = null;

/**
 * Normalizes user-facing accelerator strings (e.g. Option+Space -> Alt+Space).
 */
export function normalizeAccelerator(shortcut: string): string {
  return shortcut
    .replace(/Option/i, 'Alt')
    .replace(/Cmd/i, 'Command')
    .trim();
}

/**
 * Initializes the global shortcut manager and registers the configured accelerator.
 */
export function initShortcutManager(onToggleSpotlight: () => void): void {
  activeCallback = onToggleSpotlight;
  const configured = store.get('globalShortcut', DEFAULT_SHORTCUT);
  currentShortcut = configured || DEFAULT_SHORTCUT;

  registerCurrentShortcut();
}

/**
 * Registers the active shortcut with Electron's globalShortcut system.
 */
function registerCurrentShortcut(): boolean {
  if (!activeCallback) return false;

  const accelerator = normalizeAccelerator(currentShortcut);

  try {
    globalShortcut.unregister(accelerator);
  } catch {}

  const success = globalShortcut.register(accelerator, () => {
    if (activeCallback) {
      activeCallback();
    }
  });

  if (!success) {
    console.warn(`Failed to register global shortcut: ${currentShortcut} (normalized: ${accelerator})`);
  }

  return success;
}

/**
 * Returns the currently active global shortcut.
 */
export function getGlobalShortcut(): string {
  return currentShortcut;
}

/**
 * Updates the global shortcut, persists it in config, and re-registers the listener.
 */
export function setGlobalShortcut(newShortcut: string): { success: boolean; error?: string } {
  if (!newShortcut || typeof newShortcut !== 'string') {
    return { success: false, error: 'Invalid shortcut specified.' };
  }

  const normalized = normalizeAccelerator(newShortcut);

  try {
    // Test registration first
    const registered = globalShortcut.register(normalized, () => {
      if (activeCallback) activeCallback();
    });

    if (!registered) {
      return { success: false, error: `Could not register accelerator "${newShortcut}". It may be reserved by the OS.` };
    }

    // Unregister old shortcut if different
    if (normalizeAccelerator(currentShortcut) !== normalized) {
      globalShortcut.unregister(normalizeAccelerator(currentShortcut));
    }

    currentShortcut = newShortcut;
    store.set('globalShortcut', newShortcut);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Unregisters all registered shortcuts (invoked before app termination).
 */
export function unregisterShortcuts(): void {
  try {
    globalShortcut.unregisterAll();
  } catch {}
}
