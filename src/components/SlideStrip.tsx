import React, { useRef } from 'react';
import { ImageSlide } from '../types';
import { Upload, RotateCcw, Image as ImageIcon } from 'lucide-react';

interface SlideStripProps {
  slides: ImageSlide[];
  currentSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onReplaceSlide: (index: number, file: File) => void;
  onBatchUpload: (files: FileList) => void;
  onResetDefault: () => void;
}

export const SlideStrip: React.FC<SlideStripProps> = ({
  slides,
  currentSlideIndex,
  onSelectSlide,
  onReplaceSlide,
  onBatchUpload,
  onResetDefault
}) => {
  const batchInputRef = useRef<HTMLInputElement>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);
  const pendingReplaceIndex = useRef<number>(0);

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

  return (
    <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2.5">
      {/* Top row actions */}
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-1.5 text-zinc-600 font-medium">
          <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
          <span>图片序列 ({slides.length} 张)</span>
          <span className="text-[11px] text-zinc-400 font-normal">点击跳转 · 悬停可单张替换</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => batchInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md hover:bg-zinc-100 hover:text-zinc-900 shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>批量替换图片</span>
          </button>

          <button
            onClick={onResetDefault}
            title="恢复预设的 10 幅高质量艺术图"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 rounded-md transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>恢复默认</span>
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

      {/* Thumbnails strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {slides.map((slide, index) => {
          const isActive = index === currentSlideIndex;
          return (
            <div
              key={slide.id || index}
              onClick={() => onSelectSlide(index)}
              className={`group relative shrink-0 w-24 sm:w-28 h-16 rounded-lg overflow-hidden cursor-pointer border transition-all ${
                isActive
                  ? 'border-zinc-900 ring-2 ring-zinc-900/15 shadow-xs'
                  : 'border-zinc-200 hover:border-zinc-300 opacity-75 hover:opacity-100'
              }`}
            >
              <img
                src={slide.dataUrl}
                alt={slide.title}
                className="w-full h-full object-cover"
              />

              {/* Number Badge */}
              <div
                className={`absolute top-1 left-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium ${
                  isActive ? 'bg-zinc-900 text-white' : 'bg-black/60 text-white'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </div>

              {/* Hover replace button */}
              <button
                onClick={(e) => handleSingleReplaceClick(e, index)}
                title="替换此张图片"
                className="absolute inset-0 bg-black/40 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity backdrop-blur-2xs"
              >
                <Upload className="w-3 h-3" />
                <span>换图</span>
              </button>

              {/* Active Indicator bar */}
              {isActive && (
                <div className="absolute bottom-0 inset-x-0 h-1 bg-amber-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
