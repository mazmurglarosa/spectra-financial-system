import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in SPECTRA:', error, errorInfo);
  }

  private handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-2xl text-center">
            <div className="w-14 h-14 bg-rose-950/80 border border-rose-800 rounded-full flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Pembaruan Sistem SPECTRA</h2>
              <p className="text-xs text-slate-400 mt-1">
                Data penyimpanan lokal browser perlu disegarkan untuk memuat versi Accurate terbaru.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 p-3 rounded text-[11px] font-mono text-rose-300 text-left overflow-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-blue-600/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>Bersihkan Cache & Segarkan Aplikasi</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Halaman</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
