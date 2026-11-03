import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat } from 'lucide-react';
import { ImageSlide } from '../types';

interface TimelineControlProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  loop: boolean;
  slides: ImageSlide[];
  slideDuration: number;
  transitionDuration: number;
  currentTransitionName?: string;
  onOpenTransitionsTab?: () => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onToggleLoop: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
}

export const TimelineControl: React.FC<TimelineControlProps> = ({
  currentTime,
  totalDuration,
  isPlaying,
  loop,
  slides,
  slideDuration,
  transitionDuration,
  currentTransitionName,
  onOpenTransitionsTab,
  onTogglePlay,
  onSeek,
  onToggleLoop,
  onPrevSlide,
  onNextSlide
}) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  const period = slideDuration + transitionDuration;
  const currentSlideIndex =
    slides.length > 0 ? Math.floor(currentTime / period) % slides.length : 0;
  const timeInPeriod = currentTime - Math.floor(currentTime / period) * period;
  const isTransitioning = timeInPeriod >= slideDuration;

  const currentSlide = slides[currentSlideIndex];

  // Keep the active thumbnail in view when the playhead advances or user jumps
  useEffect(() => {
    const thumb = activeThumbRef.current;
    const strip = stripRef.current;
    if (!thumb || !strip) return;

    const thumbLeft = thumb.offsetLeft;
    const thumbRight = thumbLeft + thumb.offsetWidth;
    const viewLeft = strip.scrollLeft;
    const viewRight = viewLeft + strip.clientWidth;
    const pad = 8;

    if (thumbLeft < viewLeft + pad) {
      strip.scrollTo({ left: Math.max(0, thumbLeft - pad), behavior: 'smooth' });
    } else if (thumbRight > viewRight - pad) {
      strip.scrollTo({
        left: thumbRight - strip.clientWidth + pad,
        behavior: 'smooth'
      });
    }
  }, [currentSlideIndex, slides.length]);

  return (
    <div className="bg-white border-t border-zinc-200 px-4 py-3 select-none min-w-0 w-full shrink-0">
      {/* Upper row: Playback buttons & slide status */}
      <div className="flex items-center justify-between gap-4 mb-2.5 min-w-0">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onPrevSlide}
            title="上一张图片 ([)"
            aria-label="上一张图片"
            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? '暂停 (空格)' : '播放 (空格)'}
            aria-label={isPlaying ? '暂停' : '播放'}
            className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={onNextSlide}
            title="下一张图片 (])"
            aria-label="下一张图片"
            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            aria-label="循环播放"
            title={loop ? '循环播放已开启' : '单次播放'}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              loop ? 'text-amber-600 bg-amber-50' : 'text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Current status info & transition badge */}
        <div className="flex items-center gap-2 text-xs min-w-0 overflow-hidden">
          <span className="font-semibold text-zinc-900 truncate">
            {currentSlide ? currentSlide.title : '未加载图片'}
          </span>
          <span
            className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
              isTransitioning
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
            }`}
          >
            {isTransitioning ? '转场中' : '呈现中'}
          </span>
          {currentTransitionName && (
            <button
              onClick={onOpenTransitionsTab}
              title="点击在右侧查看/切换 24 款转场效果"
              className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 text-[10px] font-medium transition-colors cursor-pointer border border-zinc-200/60 shrink-0"
            >
              <span>转场:</span>
              <strong className="text-zinc-900 font-semibold">{currentTransitionName}</strong>
            </button>
          )}
        </div>

        {/* Time display */}
        <div className="text-xs font-mono text-zinc-500 tabular-nums shrink-0">
          <span className="text-zinc-900 font-semibold">{formatTime(currentTime)}</span>
          <span className="text-zinc-300 mx-1">/</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Scrubber progress bar */}
      <div className="relative w-full min-w-0 h-4 flex items-center cursor-pointer group mb-3">
        <input
          type="range"
          min={0}
          max={totalDuration || 1}
          step={0.01}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900 focus:outline-hidden"
        />

        {/* Slide boundary markers */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none flex justify-between px-0.5">
          {slides.map((_, i) => {
            const posPercent = totalDuration > 0 ? ((i * period) / totalDuration) * 100 : 0;
            return (
              <div
                key={i}
                className="absolute w-1 h-2 -translate-x-1/2 bg-zinc-400/70 rounded-xs"
                style={{ left: `${posPercent}%` }}
                title={`第 ${i + 1} 张起始`}
              />
            );
          })}
        </div>
      </div>

      {/* Mini Thumbnails Tape — horizontally scrollable when many slides */}
      <div
        ref={stripRef}
        className="flex items-center gap-1.5 min-w-0 w-full overflow-x-auto overflow-y-hidden pb-1 scrollbar-thin-x"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {slides.map((slide, i) => {
          const isActive = i === currentSlideIndex;
          return (
            <button
              key={slide.id || i}
              ref={isActive ? activeThumbRef : undefined}
              onClick={() => onSeek(i * period)}
              title={`跳转至: ${slide.title}`}
              className={`relative shrink-0 h-9 w-14 rounded overflow-hidden border transition-all cursor-pointer ${
                isActive
                  ? 'border-zinc-900 ring-2 ring-zinc-900/15 shadow-2xs opacity-100'
                  : 'border-zinc-200 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={slide.dataUrl} alt={slide.title} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-mono text-center leading-3">
                {String(i + 1).padStart(2, '0')}
              </div>
              {isActive && <div className="absolute top-0 inset-x-0 h-0.5 bg-amber-500" />}
            </button>
          );
        })}
        {/* Trailing spacer so the last thumb isn't flush-clipped at the edge */}
        <div className="shrink-0 w-1 h-9" aria-hidden />
      </div>
    </div>
  );
};
