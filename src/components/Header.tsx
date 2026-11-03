import React from 'react';
import { AspectRatioPreset, ShaderSettings } from '../types';
import { Film, Sparkles, SlidersHorizontal, Download, Maximize2 } from 'lucide-react';

interface HeaderProps {
  aspectRatio: AspectRatioPreset;
  onAspectRatioChange: (aspect: AspectRatioPreset) => void;
  onApplyPreset: (name: string) => void;
  onOpenExport: () => void;
  onToggleFullscreen: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  aspectRatio,
  onAspectRatioChange,
  onApplyPreset,
  onOpenExport,
  onToggleFullscreen
}) => {
  return (
    <header className="h-14 border-b border-zinc-200 bg-white/95 px-4 sm:px-6 flex items-center justify-between select-none">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
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
      <div className="flex items-center gap-2">
        {/* Aspect Ratio Switch */}
        <div className="hidden md:flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200/80 text-xs text-zinc-600">
          {[
            { id: '16:9', label: '16:9', tip: '16:9 横屏视频' },
            { id: '9:16', label: '9:16', tip: '9:16 手机短视频' },
            { id: '3:4', label: '3:4', tip: '3:4 艺术画卷/人像' },
            { id: '4:3', label: '4:3', tip: '4:3 复古画幅' },
            { id: '1:1', label: '1:1', tip: '1:1 方形画幅' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onAspectRatioChange(item.id as AspectRatioPreset)}
              title={item.tip}
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

        {/* Style presets */}
        <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-zinc-200">
          <span className="text-[11px] text-zinc-400 font-medium">风格预设:</span>
          {[
            { id: 'cinematic', label: '电影质感' },
            { id: 'warm', label: '暖阳胶片' },
            { id: 'nordic', label: '北欧清冷' },
            { id: 'noir', label: '黑白纪实' },
            { id: 'clean', label: '原图纯净' }
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => onApplyPreset(preset.id)}
              className="px-2 py-1 text-xs rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleFullscreen}
          title="全屏模式"
          className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-medium shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出视频 / PNG序列</span>
        </button>
      </div>
    </header>
  );
};
