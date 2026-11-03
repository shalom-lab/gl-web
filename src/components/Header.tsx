import React from 'react';
import { AspectRatioPreset } from '../types';
import { Film, Download, Maximize2, Github } from 'lucide-react';
import type { CustomAspect } from '../utils/aspectRatio';
import { STYLE_PRESETS, type StylePresetId } from '../utils/stylePresets';

interface HeaderProps {
  aspectRatio: AspectRatioPreset;
  onAspectRatioChange: (aspect: AspectRatioPreset) => void;
  customAspect: CustomAspect;
  onCustomAspectChange: (next: CustomAspect) => void;
  activeStylePresetId: StylePresetId | null;
  onApplyPreset: (id: string) => void;
  onOpenExport: () => void;
  onToggleFullscreen: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  aspectRatio,
  onAspectRatioChange,
  customAspect,
  onCustomAspectChange,
  activeStylePresetId,
  onApplyPreset,
  onOpenExport,
  onToggleFullscreen
}) => {
  return (
    <header className="h-14 border-b border-zinc-200 bg-white/95 px-4 sm:px-6 flex items-center justify-between select-none">
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shadow-xs">
          <Film className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-zinc-900 text-sm tracking-tight">ArtLens</h1>
            <span className="text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/60 rounded px-1.5 py-0.2">
              Three.js Shader
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 hidden sm:block">图片艺术视频与着色器生成器</p>
        </div>
      </div>

      {/* Middle: Aspect ratio & Style presets */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile: compact aspect select (chip row is md+) */}
        <label className="md:hidden flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="sr-only">画幅比例</span>
          <select
            value={aspectRatio}
            onChange={(e) => onAspectRatioChange(e.target.value as AspectRatioPreset)}
            className="max-w-[7.5rem] px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            aria-label="画幅比例"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="3:4">3:4</option>
            <option value="4:3">4:3</option>
            <option value="original">原图</option>
            <option value="custom">自定义</option>
          </select>
        </label>

        {/* Aspect Ratio Switch */}
        <div
          className="hidden md:flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200/80 text-xs text-zinc-600"
          role="group"
          aria-label="画幅比例"
        >
          {[
            { id: '16:9' as const, label: '16:9', tip: '16:9 横屏视频' },
            { id: '9:16' as const, label: '9:16', tip: '9:16 手机短视频' },
            { id: '3:4' as const, label: '3:4', tip: '3:4 艺术画卷/人像' },
            { id: '4:3' as const, label: '4:3', tip: '4:3 复古画幅' },
            { id: 'original' as const, label: '原图', tip: '按图库中出现最多的图片宽高比（众数）成帧，仍 fit 不拉伸' },
            { id: 'custom' as const, label: '自定义', tip: '自定义整数比例 a:b' }
          ].map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onAspectRatioChange(item.id)}
              title={item.tip}
              aria-pressed={aspectRatio === item.id}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                aspectRatio === item.id
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {aspectRatio === 'custom' && (
          <div className="flex items-center gap-1 text-xs text-zinc-600 pl-1">
            <input
              type="number"
              min={1}
              max={99}
              value={customAspect.w}
              onChange={(e) =>
                onCustomAspectChange({
                  w: Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)),
                  h: customAspect.h
                })
              }
              className="w-10 px-1 py-0.5 rounded border border-zinc-200 bg-white text-center font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
              title="自定义宽度份数"
            />
            <span className="text-zinc-400 font-medium">:</span>
            <input
              type="number"
              min={1}
              max={99}
              value={customAspect.h}
              onChange={(e) =>
                onCustomAspectChange({
                  w: customAspect.w,
                  h: Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1))
                })
              }
              className="w-10 px-1 py-0.5 rounded border border-zinc-200 bg-white text-center font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
              title="自定义高度份数"
            />
          </div>
        )}

        {/* Style presets — shared STYLE_PRESETS catalog */}
        <div
          className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-zinc-200"
          role="group"
          aria-label="风格预设"
        >
          <span className="text-[11px] text-zinc-400 font-medium">风格预设:</span>
          {STYLE_PRESETS.map((preset) => {
            const active = activeStylePresetId === preset.id;
            return (
              <button
                type="button"
                key={preset.id}
                onClick={() => onApplyPreset(preset.id)}
                title={preset.tip}
                aria-pressed={active}
                className={`px-2 py-1 text-xs rounded-md border font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleFullscreen}
          title="全屏模式"
          aria-label="全屏模式"
          className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          title="导出视频 / PNG 序列"
          aria-label="导出"
          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-medium shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出</span>
        </button>

        <a
          href="https://github.com/shalom-lab/gl-web"
          target="_blank"
          rel="noopener noreferrer"
          title="在 GitHub 打开仓库"
          aria-label="GitHub 仓库"
          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <Github className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};
