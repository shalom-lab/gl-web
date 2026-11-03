import React from 'react';
import { Bookmark, Check, Pencil, Trash2 } from 'lucide-react';
import type { ShaderPreset } from '../utils/imageStore';
import { GL_TRANSITIONS_CATALOG } from '../shaders/glTransitions';

interface ShaderPresetPanelProps {
  presets: ShaderPreset[];
  activeTransitionId: string;
  onApply: (preset: ShaderPreset) => void;
  onRename: (preset: ShaderPreset) => void;
  onDelete: (preset: ShaderPreset) => void;
}

function transitionLabel(transitionId: string): string {
  if (transitionId === 'custom') return '自定义 GLSL';
  return GL_TRANSITIONS_CATALOG.find((t) => t.id === transitionId)?.name ?? transitionId;
}

export const ShaderPresetPanel: React.FC<ShaderPresetPanelProps> = ({
  presets,
  activeTransitionId,
  onApply,
  onRename,
  onDelete
}) => {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
          <Bookmark className="w-3.5 h-3.5 text-amber-500" />
          <span>我的预设</span>
          <span className="text-[10px] font-normal text-zinc-400">转场 + 着色器</span>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono">{presets.length}</span>
      </div>

      {presets.length === 0 ? (
        <p className="text-[11px] text-zinc-400 leading-relaxed px-0.5">
          暂无预设。调好转场/着色器后，点底部「保存预设」即可收录到这里。
        </p>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
          {presets.map((preset) => {
            const isActiveLike = preset.shaderSettings.transitionId === activeTransitionId;
            return (
              <li
                key={preset.id}
                className="group flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 hover:border-zinc-300 transition-colors"
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
                  </div>
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
