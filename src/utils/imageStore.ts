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
import {
  clampCustomAspect,
  DEFAULT_CUSTOM_ASPECT,
  type CustomAspect
} from './aspectRatio';

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
  /** Integer a:b when aspectRatio === 'custom'. */
  customAspect?: CustomAspect;
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
/** Fine wheel step on the zoom % label (smaller than +/-). */
export const PREVIEW_ZOOM_FINE_STEP = 0.01;

export function clampPreviewZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_PREVIEW_ZOOM;
  const clamped = Math.max(PREVIEW_ZOOM_MIN, Math.min(PREVIEW_ZOOM_MAX, zoom));
  // Snap to 2 decimals so fine wheel (±0.01) persists cleanly
  return Math.round(clamped * 100) / 100;
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

    const aspectOk = ['16:9', '9:16', '3:4', '4:3', 'original', 'custom'].includes(
      record.aspectRatio as string
    );
    // Migrate removed 1:1 → 16:9
    const migratedAspect =
      (record.aspectRatio as string) === '1:1'
        ? ('16:9' as AspectRatioPreset)
        : aspectOk
          ? (record.aspectRatio as AspectRatioPreset)
          : undefined;
    const tabOk = ['transitions', 'effects', 'slides'].includes(record.sidebarTab as string);

    return {
      key: APP_PREFS_KEY,
      sidebarWidth: record.sidebarWidth,
      aspectRatio: migratedAspect,
      customAspect: record.customAspect
        ? clampCustomAspect(record.customAspect)
        : undefined,
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
      customAspect: prefs.customAspect
        ? clampCustomAspect(prefs.customAspect)
        : undefined,
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


/** User-saved transition + shader + timeline + framing preset (no slides/images). */
export interface ShaderPreset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Full shader/uniform + transitionId (+ optional customGlsl) */
  shaderSettings: ShaderSettings;
  /** 时长 / 节奏设置（单张展示 + 转场时长 + loop）— 转场区上方的「时长设置」 */
  timelineSettings?: TimelineSettings;
  /** Preview/export frame mode (16:9 / 9:16 / … / original / custom). */
  aspectRatio?: AspectRatioPreset;
  /** Integer a:b when aspectRatio === 'custom'. */
  customAspect?: CustomAspect;
}

/** Clipboard / share payload for「复制配置」. */
export interface ShaderConfigExport {
  /** v2 adds optional aspectRatio + customAspect. */
  version: 1 | 2;
  kind: 'gl-web-shader-config';
  exportedAt: string;
  shaderSettings: ShaderSettings;
  timelineSettings?: TimelineSettings;
  aspectRatio?: AspectRatioPreset;
  customAspect?: CustomAspect;
}

/** File payload for 导入 / 导出全部预设. */
export interface ShaderPresetsFile {
  /** v2 adds optional aspectRatio + customAspect per preset. */
  version: 1 | 2;
  kind: 'gl-web-presets';
  exportedAt: string;
  presets: ShaderPreset[];
}

const ASPECT_PRESET_IDS: AspectRatioPreset[] = [
  '16:9',
  '9:16',
  '3:4',
  '4:3',
  'original',
  'custom'
];

export function sanitizeAspectRatioPreset(raw: unknown): AspectRatioPreset | undefined {
  if (typeof raw !== 'string') return undefined;
  // Legacy 1:1 → 16:9
  if (raw === '1:1') return '16:9';
  return (ASPECT_PRESET_IDS as string[]).includes(raw)
    ? (raw as AspectRatioPreset)
    : undefined;
}

function cloneCustomAspect(aspect: CustomAspect): CustomAspect {
  return clampCustomAspect({ w: aspect.w, h: aspect.h });
}

export function buildShaderConfigExport(
  shaderSettings: ShaderSettings,
  timelineSettings?: TimelineSettings,
  aspectRatio?: AspectRatioPreset,
  customAspect?: CustomAspect
): ShaderConfigExport {
  const framingAspect = sanitizeAspectRatioPreset(aspectRatio);
  return {
    version: 2,
    kind: 'gl-web-shader-config',
    exportedAt: new Date().toISOString(),
    shaderSettings: cloneShaderSettings(shaderSettings),
    timelineSettings: timelineSettings ? cloneTimelineSettings(timelineSettings) : undefined,
    aspectRatio: framingAspect,
    customAspect:
      framingAspect === 'custom' && customAspect
        ? cloneCustomAspect(customAspect)
        : framingAspect === 'custom'
          ? cloneCustomAspect(DEFAULT_CUSTOM_ASPECT)
          : undefined
  };
}

export function buildPresetsExportFile(presets: ShaderPreset[]): ShaderPresetsFile {
  return {
    version: 2,
    kind: 'gl-web-presets',
    exportedAt: new Date().toISOString(),
    presets: presets.map((p) => {
      const clean = sanitizePreset(p);
      if (!clean) {
        // Should not happen for in-memory presets; fall back to shallow-safe copy
        return {
          ...p,
          shaderSettings: cloneShaderSettings(p.shaderSettings),
          timelineSettings: p.timelineSettings
            ? cloneTimelineSettings(p.timelineSettings)
            : undefined,
          aspectRatio: sanitizeAspectRatioPreset(p.aspectRatio),
          customAspect: p.customAspect ? cloneCustomAspect(p.customAspect) : undefined
        };
      }
      return clean;
    })
  };
}

function newPresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizePreset(raw: unknown): ShaderPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const shader = sanitizeShaderSettings(r.shaderSettings);
  if (!shader) return null;
  const createdAt = typeof r.createdAt === 'number' ? r.createdAt : Date.now();
  const updatedAt = typeof r.updatedAt === 'number' ? r.updatedAt : createdAt;
  const aspectRatio = sanitizeAspectRatioPreset(r.aspectRatio);
  const customAspect =
    aspectRatio === 'custom'
      ? clampCustomAspect(
          r.customAspect && typeof r.customAspect === 'object'
            ? (r.customAspect as CustomAspect)
            : DEFAULT_CUSTOM_ASPECT
        )
      : r.customAspect && typeof r.customAspect === 'object'
        ? clampCustomAspect(r.customAspect as CustomAspect)
        : undefined;
  return {
    id: r.id,
    name: r.name.trim() || '未命名预设',
    createdAt,
    updatedAt,
    shaderSettings: shader,
    timelineSettings: sanitizeTimelineSettings(r.timelineSettings),
    aspectRatio,
    customAspect: aspectRatio === 'custom' ? customAspect ?? cloneCustomAspect(DEFAULT_CUSTOM_ASPECT) : customAspect
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


function cloneShaderSettings(settings: ShaderSettings): ShaderSettings {
  return {
    breathIntensity: settings.breathIntensity,
    chromaticAberration: settings.chromaticAberration,
    fluidDistortion: settings.fluidDistortion,
    filmGrain: settings.filmGrain,
    vignette: settings.vignette,
    bloomGlow: settings.bloomGlow,
    scanReveal: settings.scanReveal,
    glitch: settings.glitch,
    edgeBlur: settings.edgeBlur,
    colorTone: settings.colorTone,
    transitionId: settings.transitionId,
    customGlsl: settings.customGlsl != null ? String(settings.customGlsl) : undefined
  };
}

function cloneTimelineSettings(settings: TimelineSettings): TimelineSettings {
  return {
    slideDuration: settings.slideDuration,
    transitionDuration: settings.transitionDuration,
    loop: settings.loop
  };
}

export interface CreateShaderPresetFraming {
  aspectRatio?: AspectRatioPreset;
  customAspect?: CustomAspect;
}

/** Create a new preset from current shader + timeline + framing settings. */
export async function createShaderPreset(
  name: string,
  shaderSettings: ShaderSettings,
  timelineSettings?: TimelineSettings,
  framing?: CreateShaderPresetFraming
): Promise<ShaderPreset> {
  const now = Date.now();
  const aspectRatio = sanitizeAspectRatioPreset(framing?.aspectRatio);
  const preset: ShaderPreset = {
    id: newPresetId(),
    name: name.trim() || `预设 ${new Date(now).toLocaleString()}`,
    createdAt: now,
    updatedAt: now,
    shaderSettings: cloneShaderSettings(shaderSettings),
    timelineSettings: timelineSettings ? cloneTimelineSettings(timelineSettings) : undefined,
    aspectRatio,
    customAspect:
      aspectRatio === 'custom'
        ? cloneCustomAspect(framing?.customAspect ?? DEFAULT_CUSTOM_ASPECT)
        : framing?.customAspect
          ? cloneCustomAspect(framing.customAspect)
          : undefined
  };
  await putShaderPreset(preset);
  return preset;
}

/** Duplicate a preset in IDB with a new id and「副本」name (deep copy — no shared refs). */
export async function duplicateShaderPreset(source: ShaderPreset): Promise<ShaderPreset> {
  const now = Date.now();
  const base = source.name.replace(/\s*副本$/, '').trim() || '未命名预设';
  const aspectRatio = sanitizeAspectRatioPreset(source.aspectRatio);
  const preset: ShaderPreset = {
    id: newPresetId(),
    name: `${base} 副本`,
    createdAt: now,
    updatedAt: now,
    shaderSettings: cloneShaderSettings(source.shaderSettings),
    timelineSettings: source.timelineSettings
      ? cloneTimelineSettings(source.timelineSettings)
      : undefined,
    aspectRatio,
    customAspect:
      aspectRatio === 'custom'
        ? cloneCustomAspect(source.customAspect ?? DEFAULT_CUSTOM_ASPECT)
        : source.customAspect
          ? cloneCustomAspect(source.customAspect)
          : undefined
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

/**
 * Overwrite preset parameters (shader / timeline / framing) while keeping id + name.
 * Used only when the user explicitly enables「同步修改预设」.
 */
export async function updateShaderPresetParams(
  id: string,
  patch: {
    shaderSettings: ShaderSettings;
    timelineSettings?: TimelineSettings;
    aspectRatio?: AspectRatioPreset;
    customAspect?: CustomAspect;
  }
): Promise<ShaderPreset> {
  const all = await listShaderPresets();
  const found = all.find((p) => p.id === id);
  if (!found) throw new Error('预设不存在');
  const aspectRatio = sanitizeAspectRatioPreset(patch.aspectRatio ?? found.aspectRatio);
  const next: ShaderPreset = {
    ...found,
    updatedAt: Date.now(),
    shaderSettings: cloneShaderSettings(patch.shaderSettings),
    timelineSettings: patch.timelineSettings
      ? cloneTimelineSettings(patch.timelineSettings)
      : found.timelineSettings
        ? cloneTimelineSettings(found.timelineSettings)
        : undefined,
    aspectRatio,
    customAspect:
      aspectRatio === 'custom'
        ? cloneCustomAspect(patch.customAspect ?? found.customAspect ?? DEFAULT_CUSTOM_ASPECT)
        : patch.customAspect
          ? cloneCustomAspect(patch.customAspect)
          : found.customAspect
            ? cloneCustomAspect(found.customAspect)
            : undefined
  };
  await putShaderPreset(next);
  return next;
}

/**
 * Import presets from a JSON file payload.
 * Always assigns new ids (additive merge — never overwrites existing by id).
 * Returns how many were imported.
 */
export async function importShaderPresetsFromJson(raw: unknown): Promise<number> {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.presets)) {
      list = obj.presets;
    } else if (obj.shaderSettings) {
      // Single preset / config export
      list = [obj];
    }
  }
  if (!list.length) throw new Error('JSON 中没有可导入的预设');

  let imported = 0;
  const now = Date.now();
  for (const item of list) {
    const parsed = sanitizePreset(
      item && typeof item === 'object'
        ? {
            ...(item as object),
            // Force fresh id even if source had one
            id: newPresetId(),
            name:
              typeof (item as { name?: unknown }).name === 'string'
                ? (item as { name: string }).name
                : '导入的预设',
            createdAt: now,
            updatedAt: now
          }
        : null
    );
    // Also accept bare { shaderSettings, timelineSettings } without id/name
    const fallback =
      parsed ??
      (() => {
        if (!item || typeof item !== 'object') return null;
        const r = item as Record<string, unknown>;
        const shader = sanitizeShaderSettings(r.shaderSettings);
        if (!shader) return null;
        const aspectRatio = sanitizeAspectRatioPreset(r.aspectRatio);
        return {
          id: newPresetId(),
          name: typeof r.name === 'string' ? r.name.trim() || '导入的预设' : '导入的预设',
          createdAt: now,
          updatedAt: now,
          shaderSettings: shader,
          timelineSettings: sanitizeTimelineSettings(r.timelineSettings),
          aspectRatio,
          customAspect:
            aspectRatio === 'custom'
              ? clampCustomAspect(
                  r.customAspect && typeof r.customAspect === 'object'
                    ? (r.customAspect as CustomAspect)
                    : DEFAULT_CUSTOM_ASPECT
                )
              : undefined
        } satisfies ShaderPreset;
      })();
    if (!fallback) continue;
    await putShaderPreset(fallback);
    imported += 1;
  }
  if (imported === 0) throw new Error('未能解析任何有效预设');
  return imported;
}
