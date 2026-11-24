import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Unexpected interface failure.',
    };
  }

  override componentDidCatch(error: unknown): void {
    // Keep silent in production UI while logging once for browser console inspection
    if (error instanceof Error) {
      console.error('[Spin Legends ErrorBoundary]', error.message);
    }
  }

  private handleRecoverView = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="w-full h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/40 bg-slate-900/95 p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h1 className="text-lg font-black tracking-tight">Arena Interface Interrupted</h1>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            A rendering error occurred, but your Commander save profile remains intact. Recover the active view or reload the stadium.
          </p>
          {this.state.errorMessage && (
            <div className="rounded-lg bg-slate-950/90 border border-slate-800 px-3 py-2 text-xs text-slate-400 font-mono break-words">
              {this.state.errorMessage}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleRecoverView}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-sky-400 text-slate-950 font-black text-sm hover:bg-sky-300 transition cursor-pointer"
            >
              Recover View
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 font-bold text-sm hover:bg-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
