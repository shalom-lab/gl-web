import React, { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export type AppDialogMode = 'prompt' | 'confirm';

export interface AppDialogProps {
  isOpen: boolean;
  mode: AppDialogMode;
  title: string;
  description?: string;
  /** Initial value for prompt mode */
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm styling (delete) */
  danger?: boolean;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}

/**
 * In-app modal matching ExportModal chrome — replaces window.prompt / confirm.
 */
export const AppDialog: React.FC<AppDialogProps> = ({
  isOpen,
  mode,
  title,
  description,
  defaultValue = '',
  placeholder,
  confirmLabel,
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValue(defaultValue);
    // Focus input after paint
    const t = window.setTimeout(() => {
      if (mode === 'prompt') {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }, 30);
    return () => window.clearTimeout(t);
  }, [isOpen, defaultValue, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && mode === 'prompt') {
        e.preventDefault();
        onConfirm(value.trim());
      } else if (e.key === 'Enter' && mode === 'confirm' && !danger) {
        // Allow Enter to confirm non-destructive; for delete prefer explicit click
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, mode, value, onCancel, onConfirm, danger]);

  if (!isOpen) return null;

  const primaryLabel =
    confirmLabel ?? (mode === 'prompt' ? '确定' : danger ? '删除' : '确定');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-sm overflow-hidden flex flex-col"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100 gap-3">
          <div className="min-w-0 flex items-start gap-2.5">
            {danger && (
              <div className="mt-0.5 w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            )}
            <div className="min-w-0">
              <h2
                id="app-dialog-title"
                className="text-sm font-semibold text-zinc-900 truncate"
              >
                {title}
              </h2>
              {description && (
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0 cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {mode === 'prompt' && (
            <input
              ref={inputRef}
              type="text"
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
            />
          )}
          {mode === 'confirm' && !description && (
            <p className="text-xs text-zinc-600 leading-relaxed">请确认此操作。</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-end gap-2 bg-zinc-50/50">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(mode === 'prompt' ? value.trim() : undefined)}
            disabled={mode === 'prompt' && !value.trim()}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-xs ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
