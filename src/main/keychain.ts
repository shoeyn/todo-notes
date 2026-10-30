import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { EncryptedPayload } from '../shared/types.js';

const execFileAsync = promisify(execFile);

export const KEYCHAIN_SERVICE = 'todonotes';
export const KEYCHAIN_ACCOUNT = 'master-encryption-key';

let cachedMasterKey: string | null = null;

/**
 * Accesses keytar dynamically to support environments where keytar native bindings
 * are available or fallback to macOS security CLI.
 */
async function getKeytar(): Promise<any> {
  try {
    const mod = await import('keytar');
    return mod.default || mod;
  } catch {
    return null;
  }
}

/**
 * Fallback to read from macOS Keychain via built-in `security` binary.
 */
async function getMacSecurityPassword(service: string, account: string): Promise<string | null> {
  if (process.platform !== 'darwin') return null;
  try {
    const { stdout } = await execFileAsync(
      '/usr/bin/security',
      ['find-generic-password', '-s', service, '-a', account, '-w'],
      { timeout: 1500 }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Fallback to write to macOS Keychain via built-in `security` binary.
 */
async function setMacSecurityPassword(service: string, account: string, secret: string): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  try {
    await execFileAsync(
      '/usr/bin/security',
      ['add-generic-password', '-U', '-a', account, '-s', service, '-w', secret, '-A'],
      { timeout: 1500 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * File-based fallback for environments where Keychain is unavailable (e.g. CI or non-macOS test runner).
 */
function getLocalFallbackPath(): string {
  const dir = path.join(os.homedir(), '.todonotes');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return path.join(dir, '.master_key');
}

/**
 * Retrieves or generates the 256-bit AES master key from macOS Keychain (or secure local store fallback).
 */
export async function getMasterKey(): Promise<string> {
  if (process.env.TODONOTES_MASTER_KEY && process.env.TODONOTES_MASTER_KEY.length >= 64) {
    return process.env.TODONOTES_MASTER_KEY;
  }

  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  const keytar = await getKeytar();
  let secret: string | null = null;

  if (keytar && typeof keytar.getPassword === 'function') {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      secret = await Promise.race([
        keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT),
        timeoutPromise,
      ]);
    } catch {}
  }

  if (!secret) {
    secret = await getMacSecurityPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }

  if (!secret) {
    const fallbackFile = getLocalFallbackPath();
    if (fs.existsSync(fallbackFile)) {
      try {
        secret = fs.readFileSync(fallbackFile, 'utf-8').trim();
      } catch {}
    }
  }

  if (secret && secret.length >= 64) {
    cachedMasterKey = secret;
    return secret;
  }

  // Generate a brand new 256-bit (32 byte) cryptographically secure random key
  const newKey = crypto.randomBytes(32).toString('hex');

  let saved = false;
  if (keytar && typeof keytar.setPassword === 'function') {
    try {
      await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, newKey);
      saved = true;
    } catch {}
  }

  if (!saved) {
    saved = await setMacSecurityPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, newKey);
  }

  // Always write fallback file as local redundancy
  try {
    const fallbackFile = getLocalFallbackPath();
    fs.writeFileSync(fallbackFile, newKey, { encoding: 'utf-8', mode: 0o600 });
  } catch {}

  cachedMasterKey = newKey;
  return newKey;
}

/**
 * Sets or overrides the master key (for password resets or migrations).
 */
export async function setMasterKey(newKeyHex: string): Promise<void> {
  if (!newKeyHex || newKeyHex.length < 64) {
    throw new Error('Master key must be a valid 64-character hex string (32 bytes).');
  }

  const keytar = await getKeytar();
  if (keytar && typeof keytar.setPassword === 'function') {
    try {
      await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, newKeyHex);
    } catch {}
  }

  await setMacSecurityPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, newKeyHex);

  try {
    const fallbackFile = getLocalFallbackPath();
    fs.writeFileSync(fallbackFile, newKeyHex, { encoding: 'utf-8', mode: 0o600 });
  } catch {}

  cachedMasterKey = newKeyHex;
}

/**
 * Encrypts arbitrary text using AES-256-GCM with a fresh 12-byte IV.
 */
export async function encryptText(plainText: string, keyHexOverride?: string): Promise<EncryptedPayload> {
  const keyHex = keyHexOverride || (await getMasterKey());
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext payload and validates authentication tag.
 */
export async function decryptText(payload: EncryptedPayload, keyHexOverride?: string): Promise<string> {
  const keyHex = keyHexOverride || (await getMasterKey());
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}
