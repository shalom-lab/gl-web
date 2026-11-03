/**
 * IndexedDB persistence for uploaded gallery images and app prefs.
 * One durable copy per concern — survives refresh/reload.
 * Prefer IndexedDB over localStorage for image blobs and non-secret prefs.
 */

import type { ImageSlide } from '../types';

const DB_NAME = 'gl-web';
const DB_VERSION = 2;
const SLIDES_STORE = 'slides';
const PREFS_STORE = 'prefs';

/** Singleton key for the prefs record (one durable copy). */
export const APP_PREFS_KEY = 'app';

export interface StoredSlide {
  id: string;
  title: string;
  aspectRatio: number;
  /** Image bytes — the single durable copy */
  blob: Blob;
  /** Display order in the gallery */
  order: number;
}

/** App layout / UI preferences stored alongside slides in the same IDB. */
export interface AppPrefs {
  key: typeof APP_PREFS_KEY;
  /** Right sidebar width from the vertical splitter handle (px). */
  sidebarWidth: number;
}

export const DEFAULT_SIDEBAR_WIDTH = 440;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SLIDES_STORE)) {
        db.createObjectStore(SLIDES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PREFS_STORE)) {
        db.createObjectStore(PREFS_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'));
  });
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}

/** Persist the current gallery (replaces previous durable copy). */
export async function saveUploadedSlides(slides: ImageSlide[]): Promise<void> {
  const records: StoredSlide[] = await Promise.all(
    slides.map(async (slide, order) => ({
      id: slide.id,
      title: slide.title,
      aspectRatio: slide.aspectRatio,
      blob: await dataUrlToBlob(slide.dataUrl),
      order
    }))
  );

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SLIDES_STORE, 'readwrite');
    const store = tx.objectStore(SLIDES_STORE);
    store.clear();
    for (const record of records) {
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('保存图片失败'));
    tx.onabort = () => reject(tx.error ?? new Error('保存图片已中止'));
  });
  db.close();
}

/** Load persisted gallery; returns null if empty / unavailable. */
export async function loadUploadedSlides(): Promise<ImageSlide[] | null> {
  try {
    const db = await openDb();
    const records = await new Promise<StoredSlide[]>((resolve, reject) => {
      const tx = db.transaction(SLIDES_STORE, 'readonly');
      const store = tx.objectStore(SLIDES_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as StoredSlide[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('读取图片失败'));
    });
    db.close();

    if (!records.length) return null;

    records.sort((a, b) => a.order - b.order);

    const slides: ImageSlide[] = await Promise.all(
      records.map(async (record) => ({
        id: record.id,
        title: record.title,
        aspectRatio: record.aspectRatio,
        dataUrl: await blobToDataUrl(record.blob)
      }))
    );
    return slides;
  } catch (err) {
    console.warn('[imageStore] 无法从 IndexedDB 恢复图片:', err);
    return null;
  }
}

/** Clear the durable gallery (e.g. after 恢复默认). */
export async function clearUploadedSlides(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SLIDES_STORE, 'readwrite');
      tx.objectStore(SLIDES_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('清除图片失败'));
    });
    db.close();
  } catch (err) {
    console.warn('[imageStore] 清除 IndexedDB 失败:', err);
  }
}

/** Clamp sidebar width to the same bounds used by the splitter drag handler. */
export function clampSidebarWidth(width: number, viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280): number {
  const minWidth = 340;
  const maxWidth = Math.max(minWidth, Math.floor(viewportWidth * 0.7));
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.max(minWidth, Math.min(Math.round(width), maxWidth));
}

/** Load app prefs (sidebar layout proportion, etc.); null if missing / unavailable. */
export async function loadAppPrefs(): Promise<AppPrefs | null> {
  try {
    const db = await openDb();
    const record = await new Promise<AppPrefs | undefined>((resolve, reject) => {
      const tx = db.transaction(PREFS_STORE, 'readonly');
      const req = tx.objectStore(PREFS_STORE).get(APP_PREFS_KEY);
      req.onsuccess = () => resolve(req.result as AppPrefs | undefined);
      req.onerror = () => reject(req.error ?? new Error('读取偏好失败'));
    });
    db.close();
    if (!record || typeof record.sidebarWidth !== 'number') return null;
    return {
      key: APP_PREFS_KEY,
      sidebarWidth: record.sidebarWidth
    };
  } catch (err) {
    console.warn('[imageStore] 无法从 IndexedDB 恢复偏好:', err);
    return null;
  }
}

/** Persist app prefs (one durable copy under key `app`). */
export async function saveAppPrefs(prefs: Pick<AppPrefs, 'sidebarWidth'>): Promise<void> {
  try {
    const db = await openDb();
    const record: AppPrefs = {
      key: APP_PREFS_KEY,
      sidebarWidth: clampSidebarWidth(prefs.sidebarWidth)
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PREFS_STORE, 'readwrite');
      tx.objectStore(PREFS_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('保存偏好失败'));
    });
    db.close();
  } catch (err) {
    console.warn('[imageStore] 保存偏好失败:', err);
  }
}
