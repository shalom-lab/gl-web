/**
 * Single source of truth for「风格预设」chips (header + effects panel).
 * Each preset patches shader effects + colorTone (+ a default transition).
 * Active state is derived by matching current shaderSettings to a preset.
 */

import type { ColorTone, ShaderSettings } from '../types';

export type StylePresetId =
  | 'cinematic'
  | 'warm'
  | 'nordic'
  | 'noir'
  | 'vivid'
  | 'clean';

/** Fields compared when deciding which chip is active. */
type StyleMatchKey =
  | 'breathIntensity'
  | 'chromaticAberration'
  | 'fluidDistortion'
  | 'filmGrain'
  | 'vignette'
  | 'bloomGlow'
  | 'scanReveal'
  | 'glitch'
  | 'edgeBlur'
  | 'colorTone'
  | 'transitionId';

export interface StylePresetDef {
  id: StylePresetId;
  label: string;
  tip: string;
  /** Values written when the chip is clicked (merged onto current settings). */
  patch: Pick<ShaderSettings, StyleMatchKey>;
}

export const STYLE_PRESETS: readonly StylePresetDef[] = [
  {
    id: 'cinematic',
    label: '电影质感',
    tip: '自然电影色调 + 轻微胶片质感',
    patch: {
      breathIntensity: 0.35,
      chromaticAberration: 0.15,
      fluidDistortion: 0.12,
      filmGrain: 0.22,
      vignette: 0.35,
      bloomGlow: 0.25,
      scanReveal: 0.3,
      glitch: 0,
      edgeBlur: 0.18,
      colorTone: 0 as ColorTone,
      transitionId: 'crossfade'
    }
  },
  {
    id: 'warm',
    label: '暖阳胶片',
    tip: '暖阳色调 + 更重颗粒与辉光',
    patch: {
      breathIntensity: 0.4,
      chromaticAberration: 0.1,
      fluidDistortion: 0.08,
      filmGrain: 0.28,
      vignette: 0.42,
      bloomGlow: 0.45,
      scanReveal: 0.2,
      glitch: 0,
      edgeBlur: 0.22,
      colorTone: 1 as ColorTone,
      transitionId: 'burn'
    }
  },
  {
    id: 'nordic',
    label: '北欧清冷',
    tip: '冷色银幕 + 清透扫描感',
    patch: {
      breathIntensity: 0.25,
      chromaticAberration: 0.18,
      fluidDistortion: 0.16,
      filmGrain: 0.15,
      vignette: 0.28,
      bloomGlow: 0.2,
      scanReveal: 0.4,
      glitch: 0,
      edgeBlur: 0.15,
      colorTone: 2 as ColorTone,
      transitionId: 'directionalwarp'
    }
  },
  {
    id: 'noir',
    label: '黑白纪实',
    tip: '经典黑白 + 高颗粒暗角',
    patch: {
      breathIntensity: 0.3,
      chromaticAberration: 0.05,
      fluidDistortion: 0.05,
      filmGrain: 0.45,
      vignette: 0.55,
      bloomGlow: 0.15,
      scanReveal: 0.25,
      glitch: 0,
      edgeBlur: 0.25,
      colorTone: 3 as ColorTone,
      transitionId: 'fade'
    }
  },
  {
    id: 'vivid',
    label: '鲜润生机',
    tip: '高饱和生机色调 + 轻快光感',
    patch: {
      breathIntensity: 0.28,
      chromaticAberration: 0.12,
      fluidDistortion: 0.1,
      filmGrain: 0.12,
      vignette: 0.22,
      bloomGlow: 0.38,
      scanReveal: 0.28,
      glitch: 0,
      edgeBlur: 0.12,
      colorTone: 4 as ColorTone,
      transitionId: 'ripple'
    }
  },
  {
    id: 'clean',
    label: '原图纯净',
    tip: '关闭特效，保留自然色调',
    patch: {
      breathIntensity: 0,
      chromaticAberration: 0,
      fluidDistortion: 0,
      filmGrain: 0,
      vignette: 0,
      bloomGlow: 0,
      scanReveal: 0,
      glitch: 0,
      edgeBlur: 0,
      colorTone: 0 as ColorTone,
      transitionId: 'crossfade'
    }
  }
] as const;

const MATCH_KEYS: StyleMatchKey[] = [
  'breathIntensity',
  'chromaticAberration',
  'fluidDistortion',
  'filmGrain',
  'vignette',
  'bloomGlow',
  'scanReveal',
  'glitch',
  'edgeBlur',
  'colorTone',
  'transitionId'
];

function approxEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function presetMatches(settings: ShaderSettings, preset: StylePresetDef): boolean {
  for (const key of MATCH_KEYS) {
    const expected = preset.patch[key];
    const actual = settings[key];
    if (typeof expected === 'number' && typeof actual === 'number') {
      if (!approxEq(actual, expected)) return false;
    } else if (expected !== actual) {
      return false;
    }
  }
  return true;
}

/** Which style chip is active, or null if the user has customized away from all presets. */
export function matchStylePresetId(settings: ShaderSettings): StylePresetId | null {
  // Prefer the first exact match; cinematic vs clean both use colorTone 0 but differ in effects.
  for (const preset of STYLE_PRESETS) {
    if (presetMatches(settings, preset)) return preset.id;
  }
  return null;
}

/** Apply a style preset onto current settings (preserves customGlsl). */
export function applyStylePreset(
  current: ShaderSettings,
  presetId: StylePresetId
): ShaderSettings {
  const preset = STYLE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return current;
  return {
    ...current,
    ...preset.patch,
    customGlsl: current.customGlsl
  };
}
