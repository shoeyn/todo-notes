import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { getMasterKey, encryptText, decryptText, setMasterKey } from '../src/main/keychain.js';

describe('macOS Keychain & AES-256-GCM Encryption', () => {
  let testKey: string;

  beforeAll(async () => {
    testKey = crypto.randomBytes(32).toString('hex');
    await setMasterKey(testKey);
  });

  it('retrieves or derives a valid 256-bit (64 hex char) master key', async () => {
    const key = await getMasterKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBe(64);
  });

  it('encrypts plaintext into ciphertext, 12-byte IV, and 16-byte authTag', async () => {
    const secretMessage = 'Antigravity secret note #42';
    const payload = await encryptText(secretMessage, testKey);

    expect(payload.ciphertext).toBeDefined();
    expect(payload.iv).toBeDefined();
    expect(payload.authTag).toBeDefined();

    // Verify IV length (12 bytes = 16 base64 chars)
    const ivBuf = Buffer.from(payload.iv, 'base64');
    expect(ivBuf.length).toBe(12);

    // Verify Tag length (16 bytes = 24 base64 chars)
    const tagBuf = Buffer.from(payload.authTag, 'base64');
    expect(tagBuf.length).toBe(16);
  });

  it('decrypts encrypted payload cleanly to original string', async () => {
    const original = '# Super Secret Meeting\n\n- Discuss project architecture\n- Review code';
    const encrypted = await encryptText(original, testKey);
    const decrypted = await decryptText(encrypted, testKey);

    expect(decrypted).toBe(original);
  });

  it('fails decryption with authentication error if ciphertext is tampered', async () => {
    const original = 'Confidential data';
    const encrypted = await encryptText(original, testKey);

    // Tamper with ciphertext
    const tamperedCipher = Buffer.from(encrypted.ciphertext, 'base64');
    tamperedCipher[0] = tamperedCipher[0] ^ 0xff;

    await expect(
      decryptText(
        {
          ...encrypted,
          ciphertext: tamperedCipher.toString('base64'),
        },
        testKey
      )
    ).rejects.toThrow();
  });
});
