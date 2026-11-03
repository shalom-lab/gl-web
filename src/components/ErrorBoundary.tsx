import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Lightweight crash shield so a render error does not blank the whole app. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleDismiss = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 p-6">
        <div
          role="alert"
          className="max-w-md w-full rounded-xl border border-red-200 bg-white shadow-lg p-5 space-y-3"
        >
          <h1 className="text-sm font-semibold text-zinc-900">界面出错了</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            渲染过程中发生未捕获错误。你可以尝试继续，或刷新页面；本地图片与预设仍保存在 IndexedDB。
          </p>
          <pre className="text-[10px] font-mono text-red-700 bg-red-50 border border-red-100 rounded-lg p-2 max-h-28 overflow-auto whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleDismiss}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg cursor-pointer"
            >
              尝试继续
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
