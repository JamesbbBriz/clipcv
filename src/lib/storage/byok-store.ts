// Persistence layer for BYOK settings. Plaintext API key is encrypted with
// AES-GCM via byok-crypto; ciphertext + IV + raw key all live in
// chrome.storage.local. The raw key is generated once on first save and reused
// across subsequent saves so previously-encrypted blobs stay readable.

import {
  decryptString,
  encryptString,
  generateRawKey,
  type Ciphertext,
} from '@/lib/crypto/byok-crypto';

export type Provider = 'openai' | 'openrouter' | 'custom';
export type OutputFormat = 'pdf' | 'docx' | 'both';

export interface ByokSettings {
  provider: Provider;
  baseUrl: string;
  model: string;
  output: OutputFormat;
}

export interface StoredByok {
  provider: Provider;
  baseUrl: string;
  model: string;
  output: OutputFormat;
  apiKey: Ciphertext;
  cryptoKey: string;
}

export interface LoadedByok {
  settings: ByokSettings;
  apiKey: string;
}

export const STORAGE_KEY = 'byok_settings';

export async function loadByok(): Promise<LoadedByok | null> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as StoredByok | undefined;
  if (!stored) return null;
  const apiKey = await decryptString(stored.apiKey, stored.cryptoKey);
  return {
    settings: {
      provider: stored.provider,
      baseUrl: stored.baseUrl,
      model: stored.model,
      output: stored.output,
    },
    apiKey,
  };
}

export async function saveByok(
  settings: ByokSettings,
  apiKey: string,
): Promise<void> {
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  const prior = existing[STORAGE_KEY] as StoredByok | undefined;
  const cryptoKey = prior?.cryptoKey ?? (await generateRawKey());
  const encrypted = await encryptString(apiKey, cryptoKey);
  const next: StoredByok = {
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    model: settings.model,
    output: settings.output,
    apiKey: encrypted,
    cryptoKey,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function clearByok(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
