import React, { useRef } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Download,
  Pencil,
  Trash2,
  Upload
} from 'lucide-react';
import type { ShaderPreset } from '../utils/imageStore';
import { GL_TRANSITIONS_CATALOG } from '../shaders/glTransitions';

interface ShaderPresetPanelProps {
  presets: ShaderPreset[];
  activeTransitionId: string;
  /** When true (default), applying a preset also restores its saved frame aspect. */
  applyAspect: boolean;
  onApplyAspectChange: (next: boolean) => void;
  onApply: (preset: ShaderPreset) => void;
  onDuplicate: (preset: ShaderPreset) => void;
  onRename: (preset: ShaderPreset) => void;
  onDelete: (preset: ShaderPreset) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
}

function transitionLabel(transitionId: string): string {
  if (transitionId === 'custom') return '自定义 GLSL';
  return GL_TRANSITIONS_CATALOG.find((t) => t.id === transitionId)?.name ?? transitionId;
}

function timingHint(preset: ShaderPreset): string | null {
  const t = preset.timelineSettings;
  if (!t) return null;
  return `${t.slideDuration.toFixed(1)}s + 转场 ${t.transitionDuration.toFixed(1)}s`;
}

function aspectHint(preset: ShaderPreset): string | null {
  if (!preset.aspectRatio) return null;
  if (preset.aspectRatio === 'original') return '原图';
  if (preset.aspectRatio === 'custom') {
    const a = preset.customAspect;
    return a ? `自定义 ${a.w}:${a.h}` : '自定义';
  }
  return preset.aspectRatio;
}

export const ShaderPresetPanel: React.FC<ShaderPresetPanelProps> = ({
  presets,
  activeTransitionId,
  applyAspect,
  onApplyAspectChange,
  onApply,
  onDuplicate,
  onRename,
  onDelete,
  onExport,
  onImportFile
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 min-w-0">
          <Bookmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="shrink-0">我的预设</span>
          <span className="text-[10px] font-normal text-zinc-400 truncate">
            转场 + 着色器 + 时长 + 画幅
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            title="从 JSON 导入预设"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <Upload className="w-3 h-3 text-amber-500" />
            <span>导入</span>
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={presets.length === 0}
            title="导出全部预设为 JSON"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3 text-amber-500" />
            <span>导出</span>
          </button>
          <span className="text-[10px] text-zinc-400 font-mono pl-0.5">{presets.length}</span>
        </div>
      </div>

      <label className="flex items-center gap-1.5 px-0.5 text-[10px] text-zinc-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={applyAspect}
          onChange={(e) => onApplyAspectChange(e.target.checked)}
          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        <span>覆盖当前画幅</span>
        <span className="text-zinc-400">（应用预设时恢复 16:9 / 9:16 / 原图等）</span>
      </label>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportFile(file);
          e.target.value = '';
        }}
      />

      {presets.length === 0 ? (
        <p className="text-[11px] text-zinc-400 leading-relaxed px-0.5">
          暂无预设。调好转场 / 着色器 / 时长 / 画幅后，点底部「保存预设」；也可点「导入」加载
          JSON。
        </p>
      ) : (
        <ul className="space-y-1 max-h-44 overflow-y-auto pr-0.5">
          {presets.map((preset) => {
            const isActiveLike = preset.shaderSettings.transitionId === activeTransitionId;
            const timing = timingHint(preset);
            const aspect = aspectHint(preset);
            return (
              <li
                key={preset.id}
                className="group flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 hover:border-zinc-300 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onApply(preset)}
                  title="应用此预设"
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-semibold text-zinc-900 truncate">
                      {preset.name}
                    </span>
                    {isActiveLike && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">
                        <Check className="w-2.5 h-2.5" />
                        同转场
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate font-mono">
                    {transitionLabel(preset.shaderSettings.transitionId)}
                    {aspect ? ` · ${aspect}` : ''}
                    {timing ? ` · ${timing}` : ''}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(preset)}
                  title="复制为新预设"
                  className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onRename(preset)}
                  title="重命名"
                  className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(preset)}
                  title="删除预设"
                  className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
