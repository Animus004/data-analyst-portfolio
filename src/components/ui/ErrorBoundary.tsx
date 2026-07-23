/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: ""
  };

  public static getDerivedStateFromError(error: Error): State {
    const randomHex = Math.random().toString(16).substring(2, 10);
    return {
      hasError: true,
      error,
      errorId: randomHex
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Portfolio OS Error Boundary Caught Exception]:", error, errorInfo);
  }

  private handleReturnToCommandCenter = () => {
    (this as any).setState({ hasError: false, error: null, errorId: "" });
    // Soft navigation to root workspace
    if (typeof window !== "undefined") {
      window.location.hash = "";
      window.location.pathname = "/";
    }
  };

  public render() {
    if (this.state.hasError) {
      if ((this as any).props.fallback) {
        return (this as any).props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-rose-900/60 rounded-2xl p-6 space-y-6 shadow-2xl animate-fade-in text-center">
            <div className="inline-flex p-3.5 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white tracking-tight font-display">
                Portfolio OS encountered an unexpected error.
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                An unexpected execution exception occurred. Your project data and database remain untouched.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-left space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Error ID</span>
                <span className="text-indigo-400 font-bold tracking-widest font-mono">
                  {this.state.errorId || "e8f9a0c2"}
                </span>
              </div>
              {this.state.error?.message && (
                <div className="text-rose-300 text-[10px] pt-1.5 border-t border-slate-900 break-words font-mono">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={this.handleReturnToCommandCenter}
                className="flex-1 bg-white hover:bg-slate-200 text-slate-950 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Home className="w-4 h-4" />
                Return to Command Center
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
