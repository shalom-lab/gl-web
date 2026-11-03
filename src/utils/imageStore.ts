/**
 * IndexedDB persistence for uploaded gallery images.
 * One durable copy per slide in a single object store — survives refresh/reload.
 * Prefer IndexedDB over localStorage for image blobs.
 */

import type { ImageSlide } from '../types';

const DB_NAME = 'gl-web';
const DB_VERSION = 1;
const STORE_NAME = 'slides';

export interface StoredSlide {
  id: string;
  title: string;
  aspectRatio: number;
  /** Image bytes — the single durable copy */
  blob: Blob;
  /** Display order in the gallery */
  order: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
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
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
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
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('清除图片失败'));
    });
    db.close();
  } catch (err) {
    console.warn('[imageStore] 清除 IndexedDB 失败:', err);
  }
}
