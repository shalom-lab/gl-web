import React, { useRef, useState } from 'react';
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
  X
} from 'lucide-react';
import { GL_TRANSITIONS_CATALOG, DEFAULT_CUSTOM_GLSL } from '../shaders/glTransitions';

interface RightSidebarProps {
  activeTab: 'transitions' | 'effects' | 'slides';
  onTabChange: (tab: 'transitions' | 'effects' | 'slides') => void;
  slides: ImageSlide[];
  currentSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onReplaceSlide: (index: number, file: File) => void;
  onBatchUpload: (files: FileList) => void;
  onResetDefault: () => void;
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
            <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
              <span className="font-semibold text-zinc-800">
                图片序列 ({slides.length} 张)
              </span>
              <div className="flex items-center gap-1.5">
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

            {/* List of slides */}
            <div className="space-y-2">
              {slides.map((slide, index) => {
                const isActive = index === currentSlideIndex;
                return (
                  <div
                    key={slide.id || index}
                    onClick={() => onSelectSlide(index)}
                    className={`group p-2 rounded-lg border flex items-center gap-3 cursor-pointer transition-all ${
                      isActive
                        ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900/10 shadow-2xs'
                        : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
                    }`}
                  >
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
                      className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-900 bg-white border border-zinc-200 rounded hover:bg-zinc-100 transition-colors shrink-0 opacity-70 group-hover:opacity-100"
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

      {/* Sticky Bottom Export Action Bar */}
      <div className="p-4 border-t border-zinc-200 bg-zinc-50/60">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2.5">
          <span>{slides.length} 张图片</span>
          <span>
            总时长: <strong className="text-zinc-800 font-mono">{totalDuration.toFixed(1)}s</strong>
          </span>
        </div>
        <button
          onClick={onOpenExport}
          className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 font-medium text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>导出视频 / PNG 逐帧序列</span>
        </button>
      </div>
    </aside>
  );
};
