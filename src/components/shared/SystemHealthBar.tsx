/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Sparkles, Database, Zap, ShieldCheck, ChevronDown, ChevronUp, ExternalLink, HelpCircle } from "lucide-react";

interface HealthData {
  status: string;
  gemini?: {
    configured: boolean;
    keyPrefix: string | null;
    hasQuotesWarning: boolean;
    hasBearerWarning: boolean;
    activeModel: string;
    fallbackModels: string[];
  };
  supabase?: {
    configured: boolean;
    bucket: string;
  };
  features?: {
    evidenceGraphCaching: string;
    payloadDietBase64Stripping: string;
    vercelMaxDuration: string;
    compilerVersion: string;
  };
  geminiTest?: {
    success: boolean;
    response?: string;
    latencyMs?: number;
    error?: string;
    details?: string;
    recommendation?: string;
  };
}

export const SystemHealthBar: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [testing, setTesting] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  const fetchHealth = async (testAi = false) => {
    try {
      if (testAi) setTesting(true);
      const url = testAi ? "/api/health?testAi=true" : "/api/health";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setHealth(data);
        setLastCheck(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn("Health check unreachable:", err);
    } finally {
      if (testAi) setTesting(false);
    }
  };

  useEffect(() => {
    fetchHealth(false);
  }, []);

  const hasQuotesWarning = health?.gemini?.hasQuotesWarning;
  const aiTestFailed = health?.geminiTest && !health.geminiTest.success;

  return (
    <div className="w-full rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-slate-800 shadow-lg backdrop-blur-md transition-all duration-300 overflow-hidden">
      {/* Top Banner Row */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: System Status summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                aiTestFailed || hasQuotesWarning ? "bg-amber-400" : "bg-emerald-400"
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                aiTestFailed || hasQuotesWarning ? "bg-amber-500" : "bg-emerald-500"
              }`} />
            </span>
            <span className="font-mono font-semibold uppercase tracking-wider text-slate-200 text-[11px] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Engine Diagnostics
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-3">
            {/* AI Model Badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-950/50 border border-indigo-800/60 text-indigo-300 font-mono text-[10px]">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{health?.gemini?.activeModel || "gemini-2.0-flash"}</span>
            </div>

            {/* Evidence Cache P1 Badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 font-mono text-[10px]">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>P1 Fast Cache Active</span>
            </div>

            {/* Payload Diet Badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-950/50 border border-blue-800/60 text-blue-300 font-mono text-[10px]">
              <ShieldCheck className="w-3 h-3 text-blue-400" />
              <span>Payload Diet &lt;50KB</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {lastCheck && (
            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
              Checked {lastCheck}
            </span>
          )}

          <button
            type="button"
            onClick={() => fetchHealth(true)}
            disabled={testing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition-all cursor-pointer disabled:opacity-50"
            title="Test connection to Gemini AI and Supabase"
          >
            <RefreshCw className={`w-3 h-3 ${testing ? "animate-spin text-indigo-400" : ""}`} />
            <span>{testing ? "Testing..." : "Test AI Connection"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 text-[11px] transition-colors cursor-pointer"
          >
            <span>{isExpanded ? "Hide Details" : "Details"}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Warning Bar if Quotes or Bearer detected */}
      {(hasQuotesWarning || (health?.geminiTest && !health.geminiTest.success)) && (
        <div className="px-4 py-2.5 bg-amber-950/60 border-t border-amber-900/80 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start sm:items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300">
                {hasQuotesWarning ? "API Key Warning: Surrounding Quotes Detected" : (health?.geminiTest?.details === "CAPACITY_HIGH_DEMAND" || (health?.geminiTest?.error && health?.geminiTest?.error.includes("503")) ? "Gemini Capacity Spike (503 High Demand)" : "AI Authentication Issue")}
              </span>
              <p className="text-[11px] text-amber-200/90">
                {hasQuotesWarning
                  ? "Your Vercel GEMINI_API_KEY appears to have literal quotes (\"...\"). Remove quotes in Vercel Settings > Environment Variables."
                  : health?.geminiTest?.recommendation || "Ensure your GEMINI_API_KEY is valid and deployed on Vercel."}
              </p>
            </div>
          </div>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-100 font-mono text-[10px] self-start sm:self-center shrink-0"
          >
            Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}

      {/* AI Ping Result Pill */}
      {health?.geminiTest && (
        <div className={`px-4 py-2 text-xs border-t font-mono flex items-center justify-between ${
          health.geminiTest.success
            ? "bg-emerald-950/40 border-emerald-900/60 text-emerald-300"
            : "bg-rose-950/40 border-rose-900/60 text-rose-300"
        }`}>
          <div className="flex items-center gap-2">
            {health.geminiTest.success ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>
              {health.geminiTest.success
                ? `Gemini Online (Latency: ${health.geminiTest.latencyMs}ms | Engine Reply: "${health.geminiTest.response}")`
                : `AI Ping Failed: ${health.geminiTest.error}`}
            </span>
          </div>
          {health.geminiTest.latencyMs !== undefined && (
            <span className="text-[10px] opacity-75">{health.geminiTest.latencyMs}ms roundtrip</span>
          )}
        </div>
      )}

      {/* Collapsible Details Drawer */}
      {isExpanded && (
        <div className="px-4 py-3 bg-slate-950/70 border-t border-slate-800/80 text-xs space-y-3 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Gemini Status */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-indigo-300 font-mono font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Google Gemini Engine</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-0.5">
                <div>Model: <span className="text-white font-mono">{health?.gemini?.activeModel || "gemini-2.0-flash"}</span></div>
                <div>Configured: <span className="font-mono text-emerald-400">{health?.gemini?.configured ? "Yes" : "Missing Key"}</span></div>
                <div>Prefix: <span className="font-mono text-slate-400">{health?.gemini?.keyPrefix || "None"}</span></div>
              </div>
            </div>

            {/* Storage Status */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-300 font-mono font-bold text-[11px]">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Supabase Storage</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-0.5">
                <div>Bucket: <span className="text-white font-mono">{health?.supabase?.bucket || "portfolio-uploads"}</span></div>
                <div>Status: <span className="font-mono text-emerald-400">{health?.supabase?.configured ? "Connected" : "Fallback active"}</span></div>
                <div>Mode: <span className="font-mono text-slate-400">Direct Binary Store</span></div>
              </div>
            </div>

            {/* Optimizations */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-300 font-mono font-bold text-[11px]">
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>Pipeline Optimizations</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-0.5">
                <div>Evidence Cache: <span className="font-mono text-emerald-400">Active (P1)</span></div>
                <div>Payload Diet: <span className="font-mono text-emerald-400">Active (&lt;50KB)</span></div>
                <div>Vercel Timeout: <span className="font-mono text-slate-200">60s Hard Limit</span></div>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60 flex items-start gap-2 text-[11px] text-slate-400">
            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-slate-200">Vercel Environment Setup Tip:</strong> In your Vercel project dashboard, go to <span className="text-indigo-300 font-mono">Settings &gt; Environment Variables</span> and ensure <span className="text-indigo-300 font-mono">GEMINI_API_KEY</span> is pasted cleanly without quotes (e.g. <span className="text-emerald-400 font-mono">AIzaSy...</span> not <span className="text-rose-400 font-mono">"AIzaSy..."</span>).
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
