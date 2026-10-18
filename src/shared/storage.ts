import { STORAGE_KEY } from './constants';
import { DEFAULT_SETTINGS } from './constants';
import { sanitizeSettings } from './settings';
import { logger } from './logger';
import type { MailBriefSettings } from './types';

const memoryFallback = new Map<string, unknown>();

interface StorageLike {
  get(keys: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string): Promise<void>;
}

function storageArea(): StorageLike | null {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return chrome.storage.local as unknown as StorageLike;
    }
  } catch {
    /* non-extension context */
  }
  return null;
}

export async function loadSettings(): Promise<MailBriefSettings> {
  const area = storageArea();
  let raw: Record<string, unknown> | null = null;
  if (area) {
    try {
      const all = await area.get(null);
      raw = (all?.[STORAGE_KEY] as Record<string, unknown> | undefined) ?? null;
    } catch (err) {
      logger.warn('storage read failed, using defaults', { reason: String(err) });
      raw = null;
    }
  } else {
    const cached = memoryFallback.get(STORAGE_KEY);
    raw = (cached as Record<string, unknown> | undefined) ?? null;
  }
  const { settings } = sanitizeSettings(raw ?? {});
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings: MailBriefSettings): Promise<void> {
  const { ok, errors } = sanitizeSettings(settings);
  if (!ok) throw new Error(`Refusing to save invalid settings: ${errors.join(' ')}`);
  const area = storageArea();
  const value = { ...settings };
  if (area) {
    await area.set({ [STORAGE_KEY]: value });
  } else {
    memoryFallback.set(STORAGE_KEY, value);
  }
}

export async function clearSettings(): Promise<void> {
  const area = storageArea();
  if (area) {
    await area.remove(STORAGE_KEY);
  } else {
    memoryFallback.delete(STORAGE_KEY);
  }
}

export async function getRawStoredSettings(): Promise<unknown> {
  const area = storageArea();
  if (!area) return memoryFallback.get(STORAGE_KEY) ?? null;
  const all = await area.get(STORAGE_KEY);
  return all?.[STORAGE_KEY] ?? null;
}
