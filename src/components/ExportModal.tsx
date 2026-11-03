import React, { useEffect, useState } from 'react';
import { AspectRatioPreset, ExportFormat, ExportPrefs, ExportSettings } from '../types';
import { ProgressInfo } from '../core/rendererEngine';
import { X, CheckCircle, Copy, Check, Download, Video, Layers, Film } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  isExporting: boolean;
  progressInfo: ProgressInfo | null;
  totalDuration: number;
  aspectRatio: AspectRatioPreset;
  initialPrefs: ExportPrefs;
  onClose: () => void;
  onStartExport: (settings: ExportSettings) => void;
  onCancelExport: () => void;
  onPrefsChange?: (prefs: ExportPrefs) => void;
  resultBlob: Blob | null;
  resultType: ExportFormat | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  isExporting,
  progressInfo,
  totalDuration,
  aspectRatio,
  initialPrefs,
  onClose,
  onStartExport,
  onCancelExport,
  onPrefsChange,
  resultBlob,
  resultType
}) => {
  const [format, setFormat] = useState<ExportFormat>(initialPrefs.format);
  const [resolution, setResolution] = useState<'1080p' | '720p'>(initialPrefs.resolution);
  const [fps, setFps] = useState<30 | 60>(initialPrefs.fps);
  const [copiedFfmpeg, setCopiedFfmpeg] = useState(false);

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
  const ffmpegCommand = `ffmpeg -framerate ${fps} -i frames/frame_%05d.png -c:v libx264 -pix_fmt yuv420p -crf 18 output.mp4`;

  const handleCopyFfmpeg = () => {
    navigator.clipboard.writeText(ffmpegCommand);
    setCopiedFfmpeg(true);
    setTimeout(() => setCopiedFfmpeg(false), 2000);
  };

  const downloadName =
    resultType === 'mp4-wasm'
      ? 'artlens_video.mp4'
      : resultType === 'png-zip'
        ? 'artlens_frames.zip'
        : 'artlens_video.webm';

  const handleManualDownload = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const resultLabel =
    resultType === 'mp4-wasm'
      ? '已生成高画质 H.264 MP4（PNG 逐帧 + 页内 ffmpeg.wasm 封装）。'
      : resultType === 'png-zip'
        ? '已生成无损 PNG 序列 ZIP 压缩包，共计 ' + totalFrames + ' 帧画面。'
        : '已生成浏览器录制视频文件，可直接播放或保存。';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Video className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">导出视频 / 逐帧序列</h2>
              <p className="text-[11px] text-zinc-400">
                推荐：PNG 逐帧 + 页内 ffmpeg.wasm 合成高画质 MP4
              </p>
            </div>
          </div>
          {!isExporting && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Active Exporting State */}
          {isExporting && progressInfo && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700">{progressInfo.statusText}</span>
                <span className="font-mono font-semibold text-zinc-900 text-sm">
                  {progressInfo.percent}%
                </span>
              </div>

              <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                <div
                  className="h-full bg-zinc-900 transition-all duration-150 ease-out"
                  style={{ width: `${progressInfo.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>
                  当前进度: {progressInfo.currentFrame} / {progressInfo.totalFrames} 帧
                </span>
                <span>时长: {totalDuration.toFixed(1)}s</span>
              </div>

              {progressInfo.previewUrl && (
                <div className="relative w-full h-36 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-200 flex items-center justify-center">
                  <img
                    src={progressInfo.previewUrl}
                    alt="Live frame preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                    实时渲染画面
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onCancelExport}
                  className="px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  取消导出
                </button>
              </div>
            </div>
          )}

          {/* Finished State */}
          {!isExporting && resultBlob && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-emerald-900 mb-0.5">导出完成！</div>
                  <p className="text-emerald-700">{resultLabel}</p>
                </div>
              </div>

              {resultType === 'png-zip' && (
                <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-800">FFmpeg 一键合成 MP4 指令:</span>
                    <button
                      onClick={handleCopyFfmpeg}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors"
                    >
                      {copiedFfmpeg ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>复制指令</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2 bg-zinc-900 text-zinc-200 rounded text-[11px] font-mono overflow-x-auto select-all">
                    {ffmpegCommand}
                  </pre>
                  <p className="text-[11px] text-zinc-400">
                    也可改用「高画质 MP4」方案，由页内 ffmpeg.wasm 自动完成同样的封装。
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleManualDownload}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>重新下载文件</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg font-medium transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          )}

          {/* Configuration Form (Initial State) */}
          {!isExporting && !resultBlob && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-2">
                  导出方案选择
                </label>
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
                      <span className="text-xs font-semibold text-zinc-900">
                        高画质 MP4（推荐）
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                        ffmpeg.wasm
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      先离线渲染无损 PNG 序列，再在浏览器内用 ffmpeg.wasm 封装为 H.264 MP4（CRF
                      18）。首次会下载约 30MB 核心，之后由 Service Worker 缓存。
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
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        仅导出逐帧 PNG，适合自行用本地 FFmpeg 再处理。
                      </p>
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
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        MediaRecorder 浏览器录制，速度快但画质不如 MP4 方案。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    画面分辨率 ({aspectRatio})
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as '1080p' | '720p')}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                  >
                    {aspectRatio === '3:4' && (
                      <>
                        <option value="1080p">1080P (1080 × 1440 竖版高清)</option>
                        <option value="720p">720P (810 × 1080 竖版标清)</option>
                      </>
                    )}
                    {aspectRatio === '9:16' && (
                      <>
                        <option value="1080p">1080P (1080 × 1920 手机全屏)</option>
                        <option value="720p">720P (720 × 1280 手机标清)</option>
                      </>
                    )}
                    {aspectRatio === '16:9' && (
                      <>
                        <option value="1080p">1080P (1920 × 1080 宽屏高清)</option>
                        <option value="720p">720P (1280 × 720 宽屏标清)</option>
                      </>
                    )}
                    {aspectRatio === '4:3' && (
                      <>
                        <option value="1080p">1080P (1440 × 1080 经典胶片)</option>
                        <option value="720p">720P (960 × 720 经典胶片)</option>
                      </>
                    )}
                    {aspectRatio === '1:1' && (
                      <>
                        <option value="1080p">1080P (1080 × 1080 方形画幅)</option>
                        <option value="720p">720P (720 × 720 方形画幅)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    输出帧率 (FPS)
                  </label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value, 10) as 30 | 60)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value={30}>30 FPS (电影推荐)</option>
                    <option value={60}>60 FPS (高流程度)</option>
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
                  onClick={() =>
                    onStartExport({
                      format,
                      resolution,
                      fps,
                      aspectRatio
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {format === 'mp4-wasm'
                      ? '导出高画质 MP4'
                      : format === 'png-zip'
                        ? '导出 PNG 序列'
                        : '开始快速录制'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
