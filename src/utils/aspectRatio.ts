/**
 * Aspect-ratio helpers for preview stage + export.
 * 「原图」= most common image aspect among current slides (rounded to 0.01);
 * ties → first slide among the tied group. Empty gallery → 16/9.
 */

import type { AspectRatioPreset, ImageSlide } from '../types';

export interface CustomAspect {
  /** Integer width part of a:b (e.g. 16) */
  w: number;
  /** Integer height part of a:b (e.g. 9) */
  h: number;
}

export const DEFAULT_CUSTOM_ASPECT: CustomAspect = { w: 16, h: 9 };

export const ASPECT_PRESET_VALUES: Record<Exclude<AspectRatioPreset, 'original' | 'custom'>, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '3:4': 3 / 4,
  '4:3': 4 / 3
};

export function clampCustomAspect(raw: Partial<CustomAspect> | null | undefined): CustomAspect {
  const w = Math.max(1, Math.min(99, Math.round(Number(raw?.w) || DEFAULT_CUSTOM_ASPECT.w)));
  const h = Math.max(1, Math.min(99, Math.round(Number(raw?.h) || DEFAULT_CUSTOM_ASPECT.h)));
  return { w, h };
}

/**
 * Most-common slide aspect (rounded to 2 decimals).
 * Tie → earliest slide in the winning bucket.
 */
export function computeOriginalAspect(slides: ImageSlide[]): number {
  if (!slides.length) return 16 / 9;
  const buckets = new Map<string, { count: number; first: number; aspect: number }>();
  slides.forEach((s, i) => {
    const a = Number.isFinite(s.aspectRatio) && s.aspectRatio > 0 ? s.aspectRatio : 16 / 9;
    const key = (Math.round(a * 100) / 100).toFixed(2);
    const cur = buckets.get(key);
    if (!cur) buckets.set(key, { count: 1, first: i, aspect: a });
    else cur.count += 1;
  });
  let best: { count: number; first: number; aspect: number } | null = null;
  for (const b of buckets.values()) {
    if (
      !best ||
      b.count > best.count ||
      (b.count === best.count && b.first < best.first)
    ) {
      best = b;
    }
  }
  return best?.aspect ?? 16 / 9;
}

export function resolveAspectValue(
  preset: AspectRatioPreset,
  slides: ImageSlide[],
  custom: CustomAspect
): number {
  if (preset === 'original') return computeOriginalAspect(slides);
  if (preset === 'custom') {
    const c = clampCustomAspect(custom);
    return c.w / c.h;
  }
  return ASPECT_PRESET_VALUES[preset] ?? 16 / 9;
}

/** Even pixel length for video encoders. */
function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

/**
 * Export frame size from numeric aspect.
 * Short edge = 1080 / 720; long edge derived — matches classic 1920×1080 / 1080×1920.
 */
export function getExportDimensionsFromAspect(
  resolution: '1080p' | '720p',
  aspect: number
): [number, number] {
  const short = resolution === '1080p' ? 1080 : 720;
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  if (a >= 1) {
    return [even(short * a), short];
  }
  return [short, even(short / a)];
}

export type StageLayoutStyle = {
  aspectRatio: string;
  width: string;
  height: string;
  maxWidth: string;
  maxHeight?: string;
};

export function getStageLayout(aspect: number): StageLayoutStyle {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  if (a < 1) {
    return {
      aspectRatio: String(a),
      height: 'min(72vh, 100%)',
      width: 'auto',
      maxWidth: '100%'
    };
  }
  return {
    aspectRatio: String(a),
    width: '100%',
    maxWidth: a >= 1.5 ? '64rem' : '42rem',
    maxHeight: '72vh',
    height: 'auto'
  };
}
