import React, { useEffect, useState } from 'react';
import { AspectRatioPreset, ExportFormat, ExportPrefs, ExportSettings } from '../types';
import { X, Download, Video, Layers, Film } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  /** True while a background export job is already running */
  isBusy: boolean;
  totalDuration: number;
  aspectRatio: AspectRatioPreset;
  initialPrefs: ExportPrefs;
  onClose: () => void;
  onStartExport: (settings: ExportSettings) => void;
  onPrefsChange?: (prefs: ExportPrefs) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  isBusy,
  totalDuration,
  aspectRatio,
  initialPrefs,
  onClose,
  onStartExport,
  onPrefsChange
}) => {
  const [format, setFormat] = useState<ExportFormat>(initialPrefs.format);
  const [resolution, setResolution] = useState<'1080p' | '720p'>(initialPrefs.resolution);
  const [fps, setFps] = useState<30 | 60>(initialPrefs.fps);

  useEffect(() => {
    if (!isOpen) return;
    setFormat(initialPrefs.format);
    setResolution(initialPrefs.resolution);
    setFps(initialPrefs.fps);
  }, [isOpen, initialPrefs]);

  useEffect(() => {
    onPrefsChange?.({ format, resolution, fps });
  }, [format, resolution, fps, onPrefsChange]);

  if (!isOpen) return null;

  const totalFrames = Math.round(totalDuration * fps);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Video className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">导出视频 / 逐帧序列</h2>
              <p className="text-[11px] text-zinc-400">
                后台导出：开始后可继续编辑，参数会按启动时快照冻结
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isBusy && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
              已有导出任务在后台运行。请等待完成或在右下角进度条中取消后再开始新的导出。
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-2">导出方案选择</label>
            <div className="grid grid-cols-1 gap-3">
              <div
                onClick={() => setFormat('mp4-wasm')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  format === 'mp4-wasm'
                    ? 'border-zinc-900 bg-zinc-50/70 ring-1 ring-zinc-900'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Film className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold text-zinc-900">高画质 MP4（推荐）</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                    ffmpeg.wasm
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  PNG 逐帧 + 页内 ffmpeg.wasm 封装 H.264。开始后在右下角查看进度。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setFormat('png-zip')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    format === 'png-zip'
                      ? 'border-zinc-900 bg-zinc-50/70 ring-1 ring-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs font-semibold text-zinc-900">PNG 序列 ZIP</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">仅导出逐帧 PNG。</p>
                </div>

                <div
                  onClick={() => setFormat('webm-video')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    format === 'webm-video'
                      ? 'border-zinc-900 bg-zinc-50/70 ring-1 ring-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Video className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-semibold text-zinc-900">快速 WebM</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">浏览器 MediaRecorder。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                画面分辨率 ({aspectRatio === 'original' ? '原图' : aspectRatio === 'custom' ? '自定义' : aspectRatio})
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as '1080p' | '720p')}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
              >
                {aspectRatio === '3:4' && (
                  <>
                    <option value="1080p">1080P (1080 × 1440)</option>
                    <option value="720p">720P (810 × 1080)</option>
                  </>
                )}
                {aspectRatio === '9:16' && (
                  <>
                    <option value="1080p">1080P (1080 × 1920)</option>
                    <option value="720p">720P (720 × 1280)</option>
                  </>
                )}
                {aspectRatio === '16:9' && (
                  <>
                    <option value="1080p">1080P (1920 × 1080)</option>
                    <option value="720p">720P (1280 × 720)</option>
                  </>
                )}
                {aspectRatio === '4:3' && (
                  <>
                    <option value="1080p">1080P (1440 × 1080)</option>
                    <option value="720p">720P (960 × 720)</option>
                  </>
                )}
                {(aspectRatio === 'original' || aspectRatio === 'custom') && (
                  <>
                    <option value="1080p">1080P（短边 1080，按当前画幅推算）</option>
                    <option value="720p">720P（短边 720，按当前画幅推算）</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">输出帧率</label>
              <select
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value, 10) as 30 | 60)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
              >
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-600 flex items-center justify-between">
            <span>预计输出总帧数:</span>
            <span className="font-mono font-semibold text-zinc-900">
              {totalFrames} 帧 ({totalDuration.toFixed(1)} 秒)
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg font-medium transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              disabled={isBusy}
              onClick={() =>
                onStartExport({
                  format,
                  resolution,
                  fps,
                  aspectRatio
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>开始后台导出</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
