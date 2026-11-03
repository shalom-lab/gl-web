import React, { useState } from 'react';
import { ShaderSettings, TimelineSettings, ColorTone } from '../types';
import { Sliders, Clock, Sparkles, Wand2 } from 'lucide-react';

interface ShaderControlsProps {
  shaderSettings: ShaderSettings;
  timelineSettings: TimelineSettings;
  slideCount: number;
  onUpdateShader: (settings: ShaderSettings) => void;
  onUpdateTimeline: (settings: TimelineSettings) => void;
}

export const ShaderControls: React.FC<ShaderControlsProps> = ({
  shaderSettings,
  timelineSettings,
  slideCount,
  onUpdateShader,
  onUpdateTimeline
}) => {
  const [activeTab, setActiveTab] = useState<'effects' | 'timing'>('effects');

  const updateSetting = <K extends keyof ShaderSettings>(key: K, value: ShaderSettings[K]) => {
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

  const totalCalculatedSeconds =
    slideCount * (timelineSettings.slideDuration + timelineSettings.transitionDuration);

  return (
    <div className="bg-white border-t border-zinc-200">
      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 pt-2">
        <div className="flex items-center gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('effects')}
            className={`pb-2 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'effects'
                ? 'border-zinc-900 text-zinc-900 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>着色器艺术效果</span>
          </button>

          <button
            onClick={() => setActiveTab('timing')}
            className={`pb-2 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'timing'
                ? 'border-zinc-900 text-zinc-900 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>节奏与转场控制</span>
          </button>
        </div>

        <div className="pb-2 text-[11px] text-zinc-400">
          预估视频总长: <span className="text-zinc-700 font-medium font-mono">{totalCalculatedSeconds.toFixed(1)}s</span>
        </div>
      </div>

      {/* Tab 1: Shader Effects */}
      {activeTab === 'effects' && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3.5 text-xs">
          {(
            [
              { key: 'breathIntensity', label: '镜头微动呼吸' },
              { key: 'filmGrain', label: '颗粒胶片质感' },
              { key: 'chromaticAberration', label: '色差偏移 (RGB)' },
              { key: 'fluidDistortion', label: '流体轻波扭曲' },
              { key: 'vignette', label: '电影暗角' },
              { key: 'bloomGlow', label: '镜头光晕 / 辉光' },
              { key: 'scanReveal', label: '进场光扫显现' },
              { key: 'edgeBlur', label: '景深边缘虚化' },
              { key: 'glitch', label: '细微故障风' }
            ] as const
          ).map((item) => {
            const value = shaderSettings[item.key];
            return (
              <div key={item.key}>
                <div className="flex justify-between text-zinc-600 mb-1">
                  <span
                    className="cursor-pointer select-none hover:text-zinc-900"
                    title="点击归零"
                    role="button"
                    tabIndex={0}
                    onClick={() => updateSetting(item.key, 0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        updateSetting(item.key, 0);
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
                  onChange={(e) => updateSetting(item.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 rounded-lg accent-zinc-800 cursor-pointer"
                />
              </div>
            );
          })}

          {/* Color Tone */}
          <div className="sm:col-span-2">
            <div className="text-zinc-600 mb-1">色调基调</div>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 0, label: '自然电影' },
                { id: 1, label: '暖阳金辉' },
                { id: 2, label: '冷色银幕' },
                { id: 3, label: '经典黑白' },
                { id: 4, label: '鲜润生机' }
              ].map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => updateSetting('colorTone', tone.id as ColorTone)}
                  className={`py-1 px-1.5 text-[11px] rounded border font-medium transition-colors ${
                    shaderSettings.colorTone === tone.id
                      ? 'border-zinc-900 bg-zinc-900 text-white'
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

      {/* Tab 2: Timing & Transitions */}
      {activeTab === 'timing' && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
          {/* Slide Duration */}
          <div>
            <div className="flex justify-between text-zinc-600 mb-1">
              <span>单张图片展示时长</span>
              <span className="font-mono text-zinc-800 font-semibold">
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
              className="w-full h-1.5 bg-zinc-200 rounded-lg accent-zinc-800 cursor-pointer"
            />
            <p className="text-[11px] text-zinc-400 mt-1">每张图片单独静候展示的时间</p>
          </div>

          {/* Transition Duration */}
          <div>
            <div className="flex justify-between text-zinc-600 mb-1">
              <span>图片转场过渡时长</span>
              <span className="font-mono text-zinc-800 font-semibold">
                {timelineSettings.transitionDuration.toFixed(1)} 秒
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={timelineSettings.transitionDuration}
              onChange={(e) => updateTiming('transitionDuration', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 rounded-lg accent-zinc-800 cursor-pointer"
            />
            <p className="text-[11px] text-zinc-400 mt-1">两张图之间 Shader 融合过渡的时间</p>
          </div>

          {/* Transition Type */}
          <div>
            <div className="text-zinc-600 mb-1.5">图片转场效果</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'crossfade', label: '柔和电影溶解' },
                { id: 'directionalwarp', label: '方向流光推镜' },
                { id: 'ripple', label: '水波同心涟漪' },
                { id: 'burn', label: '胶片过曝燃烧' },
                { id: 'swirl', label: '漩涡流光吸入' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => updateSetting('transitionId', t.id)}
                  className={`py-1.5 px-2 text-[11px] rounded border text-left font-medium transition-colors ${
                    shaderSettings.transitionId === t.id
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-2xs'
                      : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
