/**
 * IndexedDB persistence for uploaded gallery images and app prefs.
 * One durable copy per concern — survives refresh/reload.
 * Prefer IndexedDB over localStorage for image blobs and non-secret prefs.
 */

import type {
  AspectRatioPreset,
  ExportPrefs,
  ImageSlide,
  ShaderSettings,
  TimelineSettings
} from '../types';

const DB_NAME = 'gl-web';
const DB_VERSION = 4;
const SLIDES_STORE = 'slides';
const PREFS_STORE = 'prefs';
const PRESETS_STORE = 'presets';

/** Singleton key for the prefs record (one durable copy). */
export const APP_PREFS_KEY = 'app';

export type SidebarTab = 'transitions' | 'effects' | 'slides';

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
  aspectRatio?: AspectRatioPreset;
  sidebarTab?: SidebarTab;
  shaderSettings?: ShaderSettings;
  timelineSettings?: TimelineSettings;
  exportPrefs?: ExportPrefs;
  /** Preview stage CSS zoom (1 = 100%). */
  previewZoom?: number;
}

export const DEFAULT_SIDEBAR_WIDTH = 440;

export const DEFAULT_PREVIEW_ZOOM = 1;
export const PREVIEW_ZOOM_MIN = 0.5;
export const PREVIEW_ZOOM_MAX = 2;
export const PREVIEW_ZOOM_STEP = 0.1;

export function clampPreviewZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_PREVIEW_ZOOM;
  const clamped = Math.max(PREVIEW_ZOOM_MIN, Math.min(PREVIEW_ZOOM_MAX, zoom));
  // Snap to 1 decimal to keep prefs compact and UI stable
  return Math.round(clamped * 10) / 10;
}

export const DEFAULT_EXPORT_PREFS: ExportPrefs = {
  format: 'mp4-wasm',
  resolution: '1080p',
  fps: 30
};

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
      if (!db.objectStoreNames.contains(PRESETS_STORE)) {
        db.createObjectStore(PRESETS_STORE, { keyPath: 'id' });
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
export function clampSidebarWidth(
  width: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
): number {
  const minWidth = 340;
  const maxWidth = Math.max(minWidth, Math.floor(viewportWidth * 0.7));
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.max(minWidth, Math.min(Math.round(width), maxWidth));
}

function sanitizeExportPrefs(raw: unknown): ExportPrefs | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const format =
    r.format === 'mp4-wasm' || r.format === 'png-zip' || r.format === 'webm-video'
      ? r.format
      : DEFAULT_EXPORT_PREFS.format;
  const resolution = r.resolution === '720p' || r.resolution === '1080p' ? r.resolution : '1080p';
  const fps = r.fps === 60 || r.fps === 30 ? r.fps : 30;
  return { format, resolution, fps };
}

function sanitizeShaderSettings(raw: unknown): ShaderSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    breathIntensity: num(r.breathIntensity, 0.35),
    chromaticAberration: num(r.chromaticAberration, 0.15),
    fluidDistortion: num(r.fluidDistortion, 0.12),
    filmGrain: num(r.filmGrain, 0.22),
    vignette: num(r.vignette, 0.35),
    bloomGlow: num(r.bloomGlow, 0.25),
    scanReveal: num(r.scanReveal, 0.3),
    glitch: num(r.glitch, 0),
    edgeBlur: num(r.edgeBlur, 0.18),
    colorTone: ([0, 1, 2, 3, 4].includes(r.colorTone as number)
      ? r.colorTone
      : 0) as ShaderSettings['colorTone'],
    transitionId: typeof r.transitionId === 'string' ? r.transitionId : 'crossfade',
    customGlsl: typeof r.customGlsl === 'string' ? r.customGlsl : undefined
  };
}

function sanitizeTimelineSettings(raw: unknown): TimelineSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  return {
    slideDuration:
      typeof r.slideDuration === 'number' && Number.isFinite(r.slideDuration)
        ? r.slideDuration
        : 4,
    transitionDuration:
      typeof r.transitionDuration === 'number' && Number.isFinite(r.transitionDuration)
        ? r.transitionDuration
        : 1.2,
    loop: typeof r.loop === 'boolean' ? r.loop : true
  };
}

/** Load app prefs (layout, shaders, timeline, export); null if missing / unavailable. */
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

    const aspectOk = ['16:9', '9:16', '3:4', '4:3', '1:1'].includes(
      record.aspectRatio as string
    );
    const tabOk = ['transitions', 'effects', 'slides'].includes(record.sidebarTab as string);

    return {
      key: APP_PREFS_KEY,
      sidebarWidth: record.sidebarWidth,
      aspectRatio: aspectOk ? (record.aspectRatio as AspectRatioPreset) : undefined,
      sidebarTab: tabOk ? (record.sidebarTab as SidebarTab) : undefined,
      shaderSettings: sanitizeShaderSettings(record.shaderSettings),
      timelineSettings: sanitizeTimelineSettings(record.timelineSettings),
      exportPrefs: sanitizeExportPrefs(record.exportPrefs),
      previewZoom:
        typeof record.previewZoom === 'number'
          ? clampPreviewZoom(record.previewZoom)
          : undefined
    };
  } catch (err) {
    console.warn('[imageStore] 无法从 IndexedDB 恢复偏好:', err);
    return null;
  }
}

export type AppPrefsInput = Omit<AppPrefs, 'key'>;

/** Persist app prefs (one durable copy under key `app`). */
export async function saveAppPrefs(prefs: AppPrefsInput): Promise<void> {
  try {
    const db = await openDb();
    const record: AppPrefs = {
      key: APP_PREFS_KEY,
      sidebarWidth: clampSidebarWidth(prefs.sidebarWidth),
      aspectRatio: prefs.aspectRatio,
      sidebarTab: prefs.sidebarTab,
      shaderSettings: prefs.shaderSettings,
      timelineSettings: prefs.timelineSettings,
      exportPrefs: prefs.exportPrefs ? sanitizeExportPrefs(prefs.exportPrefs) : undefined,
      previewZoom:
        prefs.previewZoom != null ? clampPreviewZoom(prefs.previewZoom) : undefined
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


/** User-saved transition + shader preset (no slides/images). */
export interface ShaderPreset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Full shader/uniform + transitionId (+ optional customGlsl) */
  shaderSettings: ShaderSettings;
}

/** Clipboard / share payload for「复制配置」. */
export interface ShaderConfigExport {
  version: 1;
  kind: 'gl-web-shader-config';
  exportedAt: string;
  shaderSettings: ShaderSettings;
}

export function buildShaderConfigExport(shaderSettings: ShaderSettings): ShaderConfigExport {
  return {
    version: 1,
    kind: 'gl-web-shader-config',
    exportedAt: new Date().toISOString(),
    shaderSettings: { ...shaderSettings }
  };
}

function sanitizePreset(raw: unknown): ShaderPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const shader = sanitizeShaderSettings(r.shaderSettings);
  if (!shader) return null;
  const createdAt = typeof r.createdAt === 'number' ? r.createdAt : Date.now();
  const updatedAt = typeof r.updatedAt === 'number' ? r.updatedAt : createdAt;
  return {
    id: r.id,
    name: r.name.trim() || '未命名预设',
    createdAt,
    updatedAt,
    shaderSettings: shader
  };
}

/** List all shader/transition presets, newest first. */
export async function listShaderPresets(): Promise<ShaderPreset[]> {
  try {
    const db = await openDb();
    const records = await new Promise<ShaderPreset[]>((resolve, reject) => {
      const tx = db.transaction(PRESETS_STORE, 'readonly');
      const req = tx.objectStore(PRESETS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as ShaderPreset[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('读取预设失败'));
    });
    db.close();
    return records
      .map(sanitizePreset)
      .filter((p): p is ShaderPreset => p != null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn('[imageStore] 无法读取预设:', err);
    return [];
  }
}

/** Create or overwrite a preset (put by id). */
export async function putShaderPreset(preset: ShaderPreset): Promise<void> {
  const clean = sanitizePreset(preset);
  if (!clean) throw new Error('无效的预设数据');
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PRESETS_STORE, 'readwrite');
    tx.objectStore(PRESETS_STORE).put(clean);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('保存预设失败'));
  });
  db.close();
}

/** Delete a preset by id. */
export async function deleteShaderPreset(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PRESETS_STORE, 'readwrite');
    tx.objectStore(PRESETS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('删除预设失败'));
  });
  db.close();
}

/** Create a new preset from current shader settings. */
export async function createShaderPreset(
  name: string,
  shaderSettings: ShaderSettings
): Promise<ShaderPreset> {
  const now = Date.now();
  const preset: ShaderPreset = {
    id: `preset_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `预设 ${new Date(now).toLocaleString()}`,
    createdAt: now,
    updatedAt: now,
    shaderSettings: { ...shaderSettings }
  };
  await putShaderPreset(preset);
  return preset;
}

/** Rename an existing preset. */
export async function renameShaderPreset(id: string, name: string): Promise<void> {
  const all = await listShaderPresets();
  const found = all.find((p) => p.id === id);
  if (!found) throw new Error('预设不存在');
  await putShaderPreset({
    ...found,
    name: name.trim() || found.name,
    updatedAt: Date.now()
  });
}
