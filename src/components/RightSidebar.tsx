import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ColorTone,
  ImageSlide,
  ShaderSettings,
  TimelineSettings
} from '../types';
import {
  Sparkles,
  Images,
  Clock,
  Upload,
  RotateCcw,
  Download,
  Check,
  Code2,
  ExternalLink,
  Search,
  Sliders,
  X,
  Copy,
  BookmarkPlus,
  Trash2
} from 'lucide-react';
import { GL_TRANSITIONS_CATALOG, DEFAULT_CUSTOM_GLSL } from '../shaders/glTransitions';
import { ShaderPresetPanel } from './ShaderPresetPanel';
import { AppDialog } from './AppDialog';
import {
  buildPresetsExportFile,
  buildShaderConfigExport,
  createShaderPreset,
  deleteShaderPreset,
  duplicateShaderPreset,
  importShaderPresetsFromJson,
  listShaderPresets,
  renameShaderPreset,
  type ShaderPreset
} from '../utils/imageStore';

interface RightSidebarProps {
  activeTab: 'transitions' | 'effects' | 'slides';
  onTabChange: (tab: 'transitions' | 'effects' | 'slides') => void;
  slides: ImageSlide[];
  currentSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onReplaceSlide: (index: number, file: File) => void;
  onBatchUpload: (files: FileList) => void;
  onResetDefault: () => void;
  /** Delete slides by id (after AppDialog confirm in sidebar). */
  onDeleteSlides: (ids: string[]) => void;
  shaderSettings: ShaderSettings;
  onUpdateShader: (settings: ShaderSettings) => void;
  timelineSettings: TimelineSettings;
  onUpdateTimeline: (settings: TimelineSettings) => void;
  totalDuration: number;
  width?: number;
  onOpenExport: () => void;
  onPreviewTransition?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  activeTab,
  onTabChange,
  slides,
  currentSlideIndex,
  onSelectSlide,
  onReplaceSlide,
  onBatchUpload,
  onResetDefault,
  onDeleteSlides,
  shaderSettings,
  onUpdateShader,
  timelineSettings,
  onUpdateTimeline,
  totalDuration,
  width,
  onOpenExport,
  onPreviewTransition
}) => {
  const batchInputRef = useRef<HTMLInputElement>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);
  const pendingReplaceIndex = useRef<number>(0);

  const [transitionCategory, setTransitionCategory] = useState<
    'all' | 'cinematic' | 'motion' | 'fluid' | 'art' | 'custom'
  >('all');
  const [transitionSearch, setTransitionSearch] = useState<string>('');
  const [presets, setPresets] = useState<ShaderPreset[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  type PresetDialogState =
    | { kind: 'closed' }
    | { kind: 'save'; defaultName: string }
    | { kind: 'rename'; preset: ShaderPreset }
    | { kind: 'delete'; preset: ShaderPreset };

  const [presetDialog, setPresetDialog] = useState<PresetDialogState>({ kind: 'closed' });
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(() => new Set());
  const [deleteSlidesOpen, setDeleteSlidesOpen] = useState(false);

  // Drop stale selection when gallery changes
  useEffect(() => {
    const valid = new Set(slides.map((s) => s.id));
    setSelectedSlideIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [slides]);

  const allSelected = slides.length > 0 && selectedSlideIds.size === slides.length;
  const someSelected = selectedSlideIds.size > 0;

  const toggleSlideSelected = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedSlideIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllSlides = () => {
    setSelectedSlideIds(new Set(slides.map((s) => s.id)));
  };

  const clearSlideSelection = () => {
    setSelectedSlideIds(new Set());
  };

  const requestDeleteSelectedSlides = () => {
    if (!selectedSlideIds.size) return;
    setDeleteSlidesOpen(true);
  };

  const confirmDeleteSelectedSlides = () => {
    const ids = [...selectedSlideIds];
    setDeleteSlidesOpen(false);
    setSelectedSlideIds(new Set());
    onDeleteSlides(ids);
  };

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refreshPresets = useCallback(async () => {
    const list = await listShaderPresets();
    setPresets(list);
  }, []);

  useEffect(() => {
    void refreshPresets();
    return () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    };
  }, [refreshPresets]);

  const handleCopyConfig = useCallback(async () => {
    const payload = buildShaderConfigExport(shaderSettings, timelineSettings);
    const json = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      showToast('配置已复制到剪贴板');
    } catch (err) {
      console.warn('clipboard write failed', err);
      // Fallback for older browsers / denied permission
      try {
        const ta = document.createElement('textarea');
        ta.value = json;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('配置已复制到剪贴板');
      } catch {
        showToast('复制失败，请检查浏览器权限');
      }
    }
  }, [shaderSettings, timelineSettings, showToast]);

  const handleSavePreset = useCallback(() => {
    const defaultName = (() => {
      const t =
        shaderSettings.transitionId === 'custom'
          ? '自定义 GLSL'
          : GL_TRANSITIONS_CATALOG.find((x) => x.id === shaderSettings.transitionId)?.name;
      return t ? `${t} 预设` : '我的预设';
    })();
    setPresetDialog({ kind: 'save', defaultName });
  }, [shaderSettings.transitionId]);

  const handleApplyPreset = useCallback(
    (preset: ShaderPreset) => {
      onUpdateShader({ ...preset.shaderSettings });
      if (preset.timelineSettings) {
        onUpdateTimeline({ ...preset.timelineSettings });
      }
      if (preset.shaderSettings.transitionId === 'custom') {
        setTransitionCategory('custom');
      } else if (transitionCategory === 'custom') {
        setTransitionCategory('all');
      }
      onPreviewTransition?.();
      showToast(`已应用「${preset.name}」`);
    },
    [onUpdateShader, onUpdateTimeline, onPreviewTransition, showToast, transitionCategory]
  );

  const handleDuplicatePreset = useCallback(
    async (preset: ShaderPreset) => {
      try {
        const dup = await duplicateShaderPreset(preset);
        await refreshPresets();
        // Also put JSON on clipboard for convenience
        try {
          await navigator.clipboard.writeText(JSON.stringify(dup, null, 2));
        } catch {
          /* ignore clipboard */
        }
        showToast(`已复制「${dup.name}」`);
      } catch (err: any) {
        showToast('复制失败: ' + (err?.message || '未知错误'));
      }
    },
    [refreshPresets, showToast]
  );

  const handleExportPresets = useCallback(() => {
    if (!presets.length) {
      showToast('暂无预设可导出');
      return;
    }
    const payload = buildPresetsExportFile(presets);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gl-web-presets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`已导出 ${presets.length} 个预设`);
  }, [presets, showToast]);

  const handleImportPresetsFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const raw = JSON.parse(text) as unknown;
        const count = await importShaderPresetsFromJson(raw);
        await refreshPresets();
        showToast(`已导入 ${count} 个预设`);
      } catch (err: any) {
        showToast('导入失败: ' + (err?.message || '无效 JSON'));
      }
    },
    [refreshPresets, showToast]
  );

  const handleRenamePreset = useCallback((preset: ShaderPreset) => {
    setPresetDialog({ kind: 'rename', preset });
  }, []);

  const handleDeletePreset = useCallback((preset: ShaderPreset) => {
    setPresetDialog({ kind: 'delete', preset });
  }, []);

  const closePresetDialog = useCallback(() => {
    setPresetDialog({ kind: 'closed' });
  }, []);

  const handlePresetDialogConfirm = useCallback(
    async (value?: string) => {
      const dialog = presetDialog;
      if (dialog.kind === 'closed') return;

      if (dialog.kind === 'save') {
        const trimmed = (value ?? '').trim();
        if (!trimmed) {
          showToast('预设名称不能为空');
          return;
        }
        setPresetDialog({ kind: 'closed' });
        try {
          await createShaderPreset(trimmed, shaderSettings, timelineSettings);
          await refreshPresets();
          showToast(`已保存预设「${trimmed}」`);
        } catch (err: any) {
          showToast('保存失败: ' + (err?.message || '未知错误'));
        }
        return;
      }

      if (dialog.kind === 'rename') {
        const trimmed = (value ?? '').trim();
        if (!trimmed) {
          showToast('名称不能为空');
          return;
        }
        const id = dialog.preset.id;
        setPresetDialog({ kind: 'closed' });
        try {
          await renameShaderPreset(id, trimmed);
          await refreshPresets();
          showToast('已重命名');
        } catch (err: any) {
          showToast('重命名失败: ' + (err?.message || '未知错误'));
        }
        return;
      }

      if (dialog.kind === 'delete') {
        const id = dialog.preset.id;
        setPresetDialog({ kind: 'closed' });
        try {
          await deleteShaderPreset(id);
          await refreshPresets();
          showToast('已删除预设');
        } catch (err: any) {
          showToast('删除失败: ' + (err?.message || '未知错误'));
        }
      }
    },
    [presetDialog, shaderSettings, timelineSettings, refreshPresets, showToast]
  );

  const updateShader = <K extends keyof ShaderSettings>(key: K, value: ShaderSettings[K]) => {
    onUpdateShader({
      ...shaderSettings,
      [key]: value
    });
  };

  const updateTiming = <K extends keyof TimelineSettings>(key: K, value: TimelineSettings[K]) => {
    onUpdateTimeline({
      ...timelineSettings,
      [key]: value
    });
  };

  type TransitionCategory = 'all' | 'cinematic' | 'motion' | 'fluid' | 'art' | 'custom';

  /** Leave the custom GLSL editor and return to the catalog (default: 全部). */
  const closeCustomGlslEditor = (nextCategory: TransitionCategory = 'all') => {
    setTransitionCategory(nextCategory);
    // If the active transition was the custom editor, fall back to a catalog preset
    // so the user isn't stuck on an invisible custom shader with no close path.
    if (shaderSettings.transitionId === 'custom') {
      onUpdateShader({
        ...shaderSettings,
        transitionId: 'crossfade'
      });
    }
  };

  const handleTransitionCategoryClick = (cat: TransitionCategory) => {
    if (cat === 'custom') {
      setTransitionCategory('custom');
      onUpdateShader({
        ...shaderSettings,
        transitionId: 'custom',
        customGlsl: shaderSettings.customGlsl || DEFAULT_CUSTOM_GLSL
      });
      return;
    }
    // Switching to any other chip leaves the editor and shows that catalog
    closeCustomGlslEditor(cat);
  };

  const handleSingleReplaceClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    pendingReplaceIndex.current = index;
    singleInputRef.current?.click();
  };

  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onReplaceSlide(pendingReplaceIndex.current, file);
    }
    e.target.value = '';
  };

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onBatchUpload(e.target.files);
    }
    e.target.value = '';
  };

  const filteredTransitions = GL_TRANSITIONS_CATALOG.filter((t) => {
    const matchCat = transitionCategory === 'all' || t.category === transitionCategory;
    const q = transitionSearch.trim().toLowerCase();
    const matchSearch =
      q === '' ||
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <aside
      style={width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
      className="shrink-0 border-l border-zinc-200 bg-white flex flex-col h-full select-none transition-none"
    >
      {/* Top Sidebar Tab Navigation */}
      <div className="h-12 border-b border-zinc-200 px-3 flex items-center justify-between bg-zinc-50/70">
        <div className="flex items-center gap-1 w-full">
          <button
            onClick={() => onTabChange('transitions')}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'transitions'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/80 font-semibold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>转场库 (24款)</span>
          </button>

          <button
            onClick={() => onTabChange('effects')}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'effects'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/80 font-semibold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>着色器特效</span>
          </button>

          <button
            onClick={() => onTabChange('slides')}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'slides'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/80 font-semibold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Images className="w-3.5 h-3.5" />
            <span>图片 ({slides.length})</span>
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={batchInputRef}
        onChange={handleBatchFileChange}
        multiple
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={singleInputRef}
        onChange={handleSingleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* --- TAB 1: 着色器特效 --- */}
        {activeTab === 'effects' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
              <span className="font-semibold text-zinc-800 text-xs">WebGL Shader 参数调节</span>
              <span className="text-[11px] text-zinc-400">实时渲染生效</span>
            </div>

            {/* Slider items — click label text to reset that effect to 0 */}
            <div className="space-y-3">
              {(
                [
                  { key: 'breathIntensity', label: '镜头微动呼吸 (Ken Burns)' },
                  { key: 'filmGrain', label: '颗粒胶片质感 (Film Grain)' },
                  { key: 'chromaticAberration', label: '色差偏移 (RGB 分离)' },
                  { key: 'fluidDistortion', label: '流体轻波扭曲 (Fluid Wave)' },
                  { key: 'vignette', label: '电影暗角 (Vignette)' },
                  { key: 'bloomGlow', label: '镜头光晕 / 辉光 (Bloom)' },
                  { key: 'scanReveal', label: '进场扫描光显 (Scan Reveal)' },
                  { key: 'edgeBlur', label: '景深边缘虚化 (Edge Blur)' },
                  { key: 'glitch', label: '细微故障风 (Glitch)' }
                ] as const
              ).map((item) => {
                const value = shaderSettings[item.key];
                return (
                  <div key={item.key}>
                    <div className="flex justify-between text-zinc-600 mb-1">
                      <span
                        className="font-medium text-zinc-700 cursor-pointer select-none hover:text-zinc-900"
                        title="点击归零"
                        role="button"
                        tabIndex={0}
                        onClick={() => updateShader(item.key, 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            updateShader(item.key, 0);
                          }
                        }}
                      >
                        {item.label}
                      </span>
                      <span className="font-mono text-zinc-400">
                        {Math.round(value * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={value}
                      onChange={(e) => updateShader(item.key, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-200 rounded-lg accent-zinc-900 cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            {/* Color Tone */}
            <div className="pt-2 border-t border-zinc-100">
              <div className="font-medium text-zinc-700 mb-2">色彩基调滤镜</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  { id: 0, label: '自然电影' },
                  { id: 1, label: '暖阳金辉' },
                  { id: 2, label: '冷色银幕' },
                  { id: 3, label: '经典黑白' },
                  { id: 4, label: '鲜润生机' }
                ].map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => updateShader('colorTone', tone.id as ColorTone)}
                    className={`py-1.5 px-2 rounded-md border text-center font-medium transition-colors cursor-pointer ${
                      shaderSettings.colorTone === tone.id
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-2xs'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: 图片序列 --- */}
        {activeTab === 'slides' && (
          <div className="space-y-3 text-xs">
            {/* Header actions */}
            <div className="flex items-center justify-between pb-1 border-b border-zinc-100 gap-2">
              <span className="font-semibold text-zinc-800 shrink-0">
                图片序列 ({slides.length} 张)
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <button
                  onClick={() => batchInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>批量替换</span>
                </button>
                <button
                  onClick={onResetDefault}
                  title="恢复默认 10 张艺术图"
                  className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Multi-select toolbar */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => (allSelected ? clearSlideSelection() : selectAllSlides())}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="text-[11px] text-zinc-600">
                    {someSelected ? `已选 ${selectedSlideIds.size}` : '全选'}
                  </span>
                </label>
                {someSelected && (
                  <button
                    type="button"
                    onClick={clearSlideSelection}
                    className="text-[11px] text-zinc-500 hover:text-zinc-800 cursor-pointer"
                  >
                    清空
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={!someSelected}
                onClick={requestDeleteSelectedSlides}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
              >
                <Trash2 className="w-3 h-3" />
                <span>删除所选</span>
              </button>
            </div>

            {/* List of slides */}
            <div className="space-y-2">
              {slides.map((slide, index) => {
                const isActive = index === currentSlideIndex;
                const isChecked = selectedSlideIds.has(slide.id);
                return (
                  <div
                    key={slide.id || index}
                    onClick={() => onSelectSlide(index)}
                    className={`group p-2 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all ${
                      isActive
                        ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900/10 shadow-2xs'
                        : isChecked
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSlideSelected(slide.id)}
                      className="shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      title="选择以批量删除"
                    />

                    {/* Thumbnail */}
                    <div className="relative w-16 h-10 rounded-md overflow-hidden bg-zinc-900 shrink-0 border border-zinc-200">
                      <img
                        src={slide.dataUrl}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded bg-black/60 text-white text-[9px] font-mono">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                    </div>

                    {/* Title & Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-zinc-900 truncate">
                          {slide.title}
                        </span>
                        {isActive && (
                          <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            正在播放
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        画幅比: {slide.aspectRatio ? slide.aspectRatio.toFixed(2) : '1.78'}
                      </div>
                    </div>

                    {/* Action button */}
                    <button
                      onClick={(e) => handleSingleReplaceClick(e, index)}
                      className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-900 bg-white border border-zinc-200 rounded hover:bg-zinc-100 transition-colors shrink-0 opacity-70 group-hover:opacity-100 cursor-pointer"
                    >
                      换图
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- TAB 1: gl-transitions 转场库 (24款) 与节奏 --- */}
        {activeTab === 'transitions' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-zinc-900">gl-transitions 转场库 (共 {GL_TRANSITIONS_CATALOG.length} 款)</span>
                <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-mono">
                  GLSL 实时编译
                </span>
              </div>
              <span className="text-[11px] text-zinc-400">
                总长: {totalDuration.toFixed(1)}s
              </span>
            </div>

            {/* Slide Duration */}
            <div>
              <div className="flex justify-between text-zinc-600 mb-1">
                <span className="font-medium text-zinc-700">单张图片展示时长</span>
                <span className="font-mono text-zinc-900 font-semibold">
                  {timelineSettings.slideDuration.toFixed(1)} 秒
                </span>
              </div>
              <input
                type="range"
                min={2.0}
                max={10.0}
                step={0.5}
                value={timelineSettings.slideDuration}
                onChange={(e) => updateTiming('slideDuration', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 rounded-lg accent-zinc-900 cursor-pointer"
              />
              <p className="text-[11px] text-zinc-400 mt-1">每张图片单独静候展示的时长</p>
            </div>

            {/* Transition Duration */}
            <div>
              <div className="flex justify-between text-zinc-600 mb-1">
                <span className="font-medium text-zinc-700">图片转场过渡时长</span>
                <span className="font-mono text-zinc-900 font-semibold">
                  {timelineSettings.transitionDuration.toFixed(1)} 秒
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={3.0}
                step={0.1}
                value={timelineSettings.transitionDuration}
                onChange={(e) =>
                  updateTiming('transitionDuration', parseFloat(e.target.value))
                }
                className="w-full h-1.5 bg-zinc-200 rounded-lg accent-zinc-900 cursor-pointer"
              />
              <p className="text-[11px] text-zinc-400 mt-1">两张图之间 gl-transitions 融合时长</p>
            </div>

            {/* User shader/transition presets (above catalog) */}
            <ShaderPresetPanel
              presets={presets}
              activeTransitionId={shaderSettings.transitionId}
              onApply={handleApplyPreset}
              onDuplicate={handleDuplicatePreset}
              onRename={handleRenamePreset}
              onDelete={handleDeletePreset}
              onExport={handleExportPresets}
              onImportFile={handleImportPresetsFile}
            />

            {/* Search and Category Filter Chips */}
            <div className="pt-2 border-t border-zinc-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-800">转场库 ({GL_TRANSITIONS_CATALOG.length} 款)</span>
                <a
                  href="https://gl-transitions.com/gallery"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 font-medium"
                  title="在新标签页查看 gl-transitions.com 官方数百个开源转场"
                >
                  <span>gl-transitions.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜索转场 (如: PaperTear, Roll, Swap, Wind...)"
                  value={transitionSearch}
                  onChange={(e) => setTransitionSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-[11px] bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-hidden focus:bg-white focus:border-zinc-900"
                />
                {transitionSearch && (
                  <button
                    onClick={() => setTransitionSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs px-1"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all' as const, label: '全部' },
                  { id: 'cinematic' as const, label: '电影质感' },
                  { id: 'motion' as const, label: '动感推镜' },
                  { id: 'fluid' as const, label: '流体水波' },
                  { id: 'art' as const, label: '艺术噪波' },
                  { id: 'custom' as const, label: '自定义 GLSL' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleTransitionCategoryClick(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium shrink-0 transition-colors cursor-pointer ${
                      transitionCategory === cat.id
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom GLSL Editor Mode — only while the「自定义 GLSL」category is selected */}
            {transitionCategory === 'custom' ? (
              <div className="p-3 bg-zinc-900 text-zinc-100 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5 text-amber-400 font-mono font-medium min-w-0">
                    <Code2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">自定义 gl-transitions GLSL</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        updateShader('customGlsl', DEFAULT_CUSTOM_GLSL);
                        updateShader('transitionId', 'custom');
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono transition-colors cursor-pointer"
                      title="恢复默认模板代码"
                    >
                      重置模板
                    </button>
                    <button
                      onClick={() => closeCustomGlslEditor('all')}
                      title="关闭编辑器，返回转场列表"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-medium transition-colors cursor-pointer border border-zinc-700"
                    >
                      <X className="w-3 h-3" />
                      <span>关闭</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  可直接粘贴来自 gl-transitions.com 的任何代码。已自动提供标准环境：
                  <code className="text-amber-300 font-mono"> getFromColor(uv)</code>,
                  <code className="text-amber-300 font-mono"> getToColor(uv)</code>,
                  <code className="text-amber-300 font-mono"> progress</code>,
                  <code className="text-amber-300 font-mono"> ratio</code>。
                  点「关闭」或上方分类标签即可返回转场列表。
                </p>

                <textarea
                  rows={9}
                  value={shaderSettings.customGlsl ?? DEFAULT_CUSTOM_GLSL}
                  onChange={(e) => {
                    onUpdateShader({
                      ...shaderSettings,
                      customGlsl: e.target.value,
                      transitionId: 'custom'
                    });
                  }}
                  className="w-full bg-zinc-950 text-emerald-400 font-mono text-[11px] leading-relaxed p-2.5 rounded border border-zinc-800 focus:outline-hidden focus:border-amber-500 resize-y"
                  spellCheck={false}
                />
              </div>
            ) : null}

            {/* Catalog Grid */}
            <div className="space-y-1.5">
              {filteredTransitions.map((t, index) => {
                const isSelected = shaderSettings.transitionId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (transitionCategory === 'custom') {
                        setTransitionCategory('all');
                      }
                      updateShader('transitionId', t.id);
                      onPreviewTransition?.();
                    }}
                    className={`group p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900/10 shadow-2xs'
                        : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 font-mono text-[10px] font-medium group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                          #{String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="font-semibold text-zinc-900 truncate">{t.name}</span>
                        {t.author && (
                          <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline truncate">
                            by {t.author}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-medium">
                            当前生效
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          点击试看
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed pl-7">
                      {t.description}
                    </p>
                  </div>
                );
              })}

              {/* Direct entry to custom */}
              {transitionCategory !== 'custom' && (
                <div
                  onClick={() => {
                    setTransitionCategory('custom');
                    updateShader('transitionId', 'custom');
                    if (!shaderSettings.customGlsl) {
                      updateShader('customGlsl', DEFAULT_CUSTOM_GLSL);
                    }
                  }}
                  className="p-2.5 rounded-lg border border-dashed border-zinc-300 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-zinc-600" />
                    <div>
                      <div className="font-medium text-zinc-900">编写 / 粘贴自定义 GLSL 转场</div>
                      <div className="text-[11px] text-zinc-400">
                        自由从 gl-transitions 网站复制代码测试
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                    打开编辑器
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar: 复制配置 | 导出 | 保存预设 */}
      <div className="relative p-4 border-t border-zinc-200 bg-zinc-50/60">
        {toast && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[11px] font-medium shadow-lg whitespace-nowrap pointer-events-none">
            {toast}
          </div>
        )}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2.5">
          <span>{slides.length} 张图片</span>
          <span>
            总时长: <strong className="text-zinc-800 font-mono">{totalDuration.toFixed(1)}s</strong>
          </span>
        </div>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => void handleCopyConfig()}
            title="复制当前转场 + 着色器配置为 JSON"
            className="shrink-0 px-2.5 py-2.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 font-medium text-[11px] flex flex-col sm:flex-row items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer min-w-[4.5rem]"
          >
            <Copy className="w-3.5 h-3.5 text-amber-500" />
            <span>复制配置</span>
          </button>

          <button
            type="button"
            onClick={onOpenExport}
            className="flex-1 min-w-0 py-2.5 px-3 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 font-medium text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">导出视频 / PNG 逐帧序列</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSavePreset()}
            title="将当前转场 + 着色器保存为预设"
            className="shrink-0 px-2.5 py-2.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 font-medium text-[11px] flex flex-col sm:flex-row items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer min-w-[4.5rem]"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-amber-500" />
            <span>保存预设</span>
          </button>
        </div>
      </div>

      <AppDialog
        isOpen={presetDialog.kind !== 'closed'}
        mode={presetDialog.kind === 'delete' ? 'confirm' : 'prompt'}
        title={
          presetDialog.kind === 'save'
            ? '保存预设'
            : presetDialog.kind === 'rename'
              ? '重命名预设'
              : presetDialog.kind === 'delete'
                ? '删除预设'
                : ''
        }
        description={
          presetDialog.kind === 'save'
            ? '为当前转场、着色器参数与时长设置命名，保存后可在「我的预设」中一键应用。'
            : presetDialog.kind === 'rename'
              ? '修改预设显示名称（不会改变其中的转场 / 着色器 / 时长内容）。'
              : presetDialog.kind === 'delete'
                ? `确定删除预设「${presetDialog.preset.name}」？此操作不可撤销。`
                : undefined
        }
        defaultValue={
          presetDialog.kind === 'save'
            ? presetDialog.defaultName
            : presetDialog.kind === 'rename'
              ? presetDialog.preset.name
              : ''
        }
        placeholder="输入预设名称"
        confirmLabel={
          presetDialog.kind === 'save'
            ? '保存'
            : presetDialog.kind === 'rename'
              ? '保存'
              : presetDialog.kind === 'delete'
                ? '删除'
                : '确定'
        }
        danger={presetDialog.kind === 'delete'}
        onCancel={closePresetDialog}
        onConfirm={(v) => void handlePresetDialogConfirm(v)}
      />

      <AppDialog
        isOpen={deleteSlidesOpen}
        mode="confirm"
        title="删除所选图片"
        description={`确定删除已选的 ${selectedSlideIds.size} 张图片？此操作不可撤销（可稍后「恢复默认」或重新上传）。`}
        confirmLabel="删除"
        danger
        onCancel={() => setDeleteSlidesOpen(false)}
        onConfirm={() => confirmDeleteSelectedSlides()}
      />
    </aside>
  );
};
