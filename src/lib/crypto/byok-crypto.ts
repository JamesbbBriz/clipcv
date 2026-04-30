// WebCrypto AES-GCM helpers for at-rest encryption of the user's BYOK API key.
// Key invariant (CLAUDE.md §6.2): the raw key is generated locally, lives only
// in chrome.storage.local, and never leaves the browser.

const KEY_ALGORITHM: AesKeyAlgorithm = { name: 'AES-GCM', length: 256 };
const KEY_USAGES: readonly KeyUsage[] = ['encrypt', 'decrypt'];
const IV_BYTES = 12; // 96 bits — recommended for GCM.

export interface Ciphertext {
  ct: string;
  iv: string;
}

export async function generateRawKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(KEY_ALGORITHM, true, [...KEY_USAGES]);
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(new Uint8Array(raw));
}

export async function encryptString(
  plaintext: string,
  rawKeyBase64: string,
): Promise<Ciphertext> {
  const key = await importRawKey(rawKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(data),
  );
  return {
    ct: bufferToBase64(new Uint8Array(buf)),
    iv: bufferToBase64(iv),
  };
}

export async function decryptString(
  payload: Ciphertext,
  rawKeyBase64: string,
): Promise<string> {
  const key = await importRawKey(rawKeyBase64);
  const iv = base64ToBuffer(payload.iv);
  const ct = base64ToBuffer(payload.ct);
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ct),
  );
  return new TextDecoder().decode(buf);
}

async function importRawKey(rawBase64: string): Promise<CryptoKey> {
  const bytes = base64ToBuffer(rawBase64);
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(bytes),
    KEY_ALGORITHM,
    false,
    [...KEY_USAGES],
  );
}

// Allocate a fresh ArrayBuffer-backed copy. Needed because TS 5.7+ types
// `TextEncoder.encode(...)` / `crypto.getRandomValues(...)` as
// `Uint8Array<ArrayBufferLike>`, while WebCrypto's encrypt/decrypt/importKey
// signatures (under lib.dom) require `ArrayBuffer`-backed views. We always
// allocate ArrayBuffer-backed bytes ourselves so the copy is sound.
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

function bufferToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    s += String.fromCharCode(byte);
  }
  return btoa(s);
}

function base64ToBuffer(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    out[i] = s.charCodeAt(i);
  }
  return out;
}
