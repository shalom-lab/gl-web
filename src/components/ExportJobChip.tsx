import React from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  X,
  XCircle
} from 'lucide-react';
import type { ExportFormat } from '../types';
import type { ProgressInfo } from '../core/rendererEngine';

export type ExportJobStatus = 'running' | 'done' | 'error' | 'cancelled';

export interface ExportJobState {
  status: ExportJobStatus;
  progress: ProgressInfo | null;
  resultBlob: Blob | null;
  resultType: ExportFormat | null;
  errorMessage?: string;
  minimized: boolean;
}

interface ExportJobChipProps {
  job: ExportJobState;
  onCancel: () => void;
  onToggleMinimize: () => void;
  onDismiss: () => void;
  onDownload: () => void;
}

function downloadLabel(type: ExportFormat | null): string {
  if (type === 'mp4-wasm') return '下载 MP4';
  if (type === 'png-zip') return '下载 ZIP';
  if (type === 'webm-video') return '下载 WebM';
  return '下载文件';
}

export const ExportJobChip: React.FC<ExportJobChipProps> = ({
  job,
  onCancel,
  onToggleMinimize,
  onDismiss,
  onDownload
}) => {
  const { status, progress, minimized, resultType, errorMessage } = job;
  const percent = progress?.percent ?? 0;

  if (minimized && status === 'running') {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          type="button"
          onClick={onToggleMinimize}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-900 text-white text-xs font-medium shadow-lg border border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer"
          title="展开导出进度"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          <span>导出中 {percent}%</span>
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[min(100%-2rem,22rem)]">
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2 min-w-0">
            {status === 'running' && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
            )}
            {status === 'done' && (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            {(status === 'error' || status === 'cancelled') && (
              <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            )}
            <span className="text-xs font-semibold text-zinc-900 truncate">
              {status === 'running'
                ? '后台导出进行中'
                : status === 'done'
                  ? '导出完成'
                  : status === 'cancelled'
                    ? '已取消导出'
                    : '导出失败'}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {status === 'running' && (
              <button
                type="button"
                onClick={onToggleMinimize}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                title="最小化"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
            {status !== 'running' && (
              <button
                type="button"
                onClick={onDismiss}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                title="关闭"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-3 py-2.5 space-y-2">
          {status === 'running' && (
            <>
              <div className="flex items-center justify-between text-[11px] gap-2">
                <span className="text-zinc-600 truncate">
                  {progress?.statusText || '准备中…'}
                </span>
                <span className="font-mono font-semibold text-zinc-900 shrink-0">
                  {percent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                <div
                  className="h-full bg-zinc-900 transition-all duration-150"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {progress && (
                <div className="text-[10px] text-zinc-400 font-mono">
                  {progress.currentFrame} / {progress.totalFrames} 帧
                </div>
              )}
              {progress?.previewUrl && (
                <div className="h-20 rounded-md overflow-hidden bg-zinc-900 border border-zinc-200">
                  <img
                    src={progress.previewUrl}
                    alt="export preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-2.5 py-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md cursor-pointer"
                >
                  取消导出
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                已冻结开始时的图片与参数快照，可继续编辑预览，不影响本次导出。
              </p>
            </>
          )}

          {status === 'done' && (
            <div className="space-y-2">
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                文件已就绪。若浏览器未自动下载，请点击下方按钮。
              </p>
              <button
                type="button"
                onClick={onDownload}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                {downloadLabel(resultType)}
              </button>
            </div>
          )}

          {status === 'error' && (
            <p className="text-[11px] text-red-600 leading-relaxed">
              {errorMessage || '未知错误'}
            </p>
          )}

          {status === 'cancelled' && (
            <p className="text-[11px] text-zinc-500">导出已取消，可重新打开导出面板再试。</p>
          )}
        </div>
      </div>
    </div>
  );
};
