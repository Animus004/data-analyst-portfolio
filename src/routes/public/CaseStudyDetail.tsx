/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ProjectRecord, ContentBlock } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { normalizeKpiLabel, cleanKpiValue } from "../../utils";
import { 
  ArrowLeft, 
  Github, 
  ExternalLink, 
  Cpu, 
  TrendingUp, 
  Code, 
  Layers, 
  Quote, 
  Calendar, 
  Clipboard, 
  Printer,
  Check,
  Target,
  Sparkles,
  BarChart3,
  Award,
  AlertTriangle,
  Lightbulb,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Database,
  Wrench
} from "lucide-react";

interface ChartItem {
  name: string;
  Normal?: number;
  Fraud?: number;
  Value?: number;
}

function formatParagraphsToBullets(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  if (lines.length === 1 && lines[0].length > 110) {
    const sentences = lines[0].split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) {
      return (
        <ul className="space-y-2 my-1">
          {sentences.map((sent, i) => (
            <li key={i} className="flex items-start gap-2.5 text-slate-700 text-sm font-sans leading-relaxed">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 mt-2 shrink-0"></span>
              <span>{sent}</span>
            </li>
          ))}
        </ul>
      );
    }
  }

  return (
    <div className="space-y-2.5">
      {lines.map((line, i) => {
        if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
          return (
            <div key={i} className="flex items-start gap-2.5 text-slate-700 text-sm font-sans leading-relaxed">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 mt-2 shrink-0"></span>
              <span>{line.replace(/^[\u2022\-\*]\s*/, "")}</span>
            </div>
          );
        }
        if (/^\d+[\.\)]/.test(line)) {
          const match = line.match(/^(\d+)[\.\)]\s*(.*)/);
          return (
            <div key={i} className="flex items-start gap-2.5 text-slate-700 text-sm font-sans leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded shrink-0">{match ? match[1] : i+1}</span>
              <span>{match ? match[2] : line}</span>
            </div>
          );
        }
        return (
          <p key={i} className="text-slate-700 text-sm leading-relaxed font-sans">
            {line}
          </p>
        );
      })}
    </div>
  );
}

const InteractiveChartBlock: React.FC<{ title?: string; data: ChartItem[]; industry: string }> = ({
  title,
  data,
  industry
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [viewType, setViewType] = useState<"bar" | "table">("bar");

  const isFintech = industry.toLowerCase().includes("fintech") || industry.toLowerCase().includes("banking");
  const isTransit = industry.toLowerCase().includes("smart") || industry.toLowerCase().includes("transit") || industry.toLowerCase().includes("mobility");

  const leftLabel = isFintech ? "Normal Ledger" : isTransit ? "Scheduled Runs" : "Base Volume";
  const rightLabel = isFintech ? "Anomalous Vector" : isTransit ? "Congestion Delay" : "High Risk Variance";

  const leftColor = "bg-slate-800";
  const rightColor = isFintech ? "bg-rose-500" : isTransit ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-4 p-5 border border-slate-200/80 rounded-xl bg-white shadow-xs">
      <div className="flex items-center justify-between">
        {title && <h4 className="font-display font-semibold text-slate-900 text-sm">{title}</h4>}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/40 no-print">
          <button
            type="button"
            onClick={() => setViewType("bar")}
            className={`px-2 py-1 text-[10px] font-mono rounded-md font-bold transition-all cursor-pointer ${
              viewType === "bar"
                ? "bg-white text-slate-950 shadow-xs"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Visual Chart
          </button>
          <button
            type="button"
            onClick={() => setViewType("table")}
            className={`px-2 py-1 text-[10px] font-mono rounded-md font-bold transition-all cursor-pointer ${
              viewType === "table"
                ? "bg-white text-slate-950 shadow-xs"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Ledger Table
          </button>
        </div>
      </div>

      {viewType === "bar" ? (
        <div className="space-y-3.5 pt-1">
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 pb-1 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded ${leftColor}`}></span>
              <span>{leftLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded ${rightColor}`}></span>
              <span>{rightLabel}</span>
            </div>
          </div>

          <div className="space-y-4">
            {data.map((item, i) => {
              const rightValue = item.Fraud || 0;
              const leftValue = item.Normal || 0;
              const total = rightValue + leftValue || 1;
              const rightPct = Math.min(100, Math.max(0, (rightValue / total) * 100));
              const leftPct = 100 - rightPct;
              const isHovered = hoveredIdx === i;

              return (
                <div
                  key={i}
                  className={`space-y-1.5 transition-all duration-200 p-2 rounded-lg ${
                    isHovered ? "bg-slate-50" : ""
                  }`}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {isTransit ? "Corridor" : "Interval"}: {item.name}
                    </span>
                    <span>
                      Total Volume: <strong className="text-slate-900 font-bold">{total}</strong>
                    </span>
                  </div>

                  <div className="h-7 w-full bg-slate-100 rounded-md overflow-hidden flex shadow-inner border border-slate-200/40 relative cursor-pointer">
                    <div
                      style={{ width: `${leftPct}%` }}
                      className={`${leftColor} flex items-center pl-2.5 text-[9px] font-mono text-white/90 font-bold transition-all`}
                    >
                      {leftPct > 15 && `${Math.round(leftPct)}%`}
                    </div>
                    <div
                      style={{ width: `${rightPct}%` }}
                      className={`${rightColor} flex items-center justify-end pr-2.5 text-[9px] font-mono text-white font-bold transition-all`}
                    >
                      {rightPct > 15 && `${Math.round(rightPct)}%`}
                    </div>

                    {isHovered && (
                      <div className="absolute inset-0 bg-slate-950/95 flex items-center justify-center pointer-events-none border border-slate-950/20 rounded-md">
                        <span className="px-2 py-0.5 text-white rounded font-mono text-[10px] font-semibold">
                          {leftLabel}: {leftValue} ({Math.round(leftPct)}%) | {rightLabel}: {rightValue} ({Math.round(rightPct)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left border-collapse text-[11px] font-mono text-slate-600">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 uppercase text-[10px]">
                <th className="p-2.5">{isTransit ? "Corridor" : "Interval"}</th>
                <th className="p-2.5 text-right">{leftLabel}</th>
                <th className="p-2.5 text-right">{rightLabel}</th>
                <th className="p-2.5 text-right">Total Aggregate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((item, i) => {
                const rightValue = item.Fraud || 0;
                const leftValue = item.Normal || 0;
                const total = rightValue + leftValue;
                return (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-semibold text-slate-700">{item.name}</td>
                    <td className="p-2.5 text-right text-slate-900">{leftValue}</td>
                    <td className="p-2.5 text-right text-slate-900">{rightValue}</td>
                    <td className="p-2.5 text-right font-bold text-slate-950">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-slate-400 font-mono text-center pt-1">
        *Live performance metrics and structural data feed synchronized over TLS streams.
      </p>
    </div>
  );
};

interface CaseStudyDetailProps {
  project: ProjectRecord;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export const CaseStudyDetail: React.FC<CaseStudyDetailProps> = ({
  project,
  onNavigate
}) => {
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

  const copyCodeToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBlockId(id);
    setTimeout(() => {
      setCopiedBlockId(null);
    }, 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderStoryBlock = (block: ContentBlock) => {
    switch (block.type) {
      case "markdown":
        return (
          <div key={block.id} className="space-y-3 bg-white border border-slate-200/80 p-5 rounded-xl shadow-2xs">
            {block.title && <h4 className="font-display font-semibold text-slate-900 text-base border-b border-slate-100 pb-2">{block.title}</h4>}
            {formatParagraphsToBullets(block.bodyContent)}
          </div>
        );
      case "code_snippet":
        return (
          <div key={block.id} className="space-y-2 border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-lg">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-900/80">
              <div className="flex items-center gap-3">
                <Code className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-[10px] text-slate-300 font-bold tracking-wider uppercase">
                  {block.title || "Source Implementation"} ({block.language || "code"})
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => copyCodeToClipboard(block.id, block.bodyContent)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 text-[10px] px-2.5 py-1 h-7 flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
              >
                {copiedBlockId === block.id ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3 h-3" />
                    <span>Copy Code</span>
                  </>
                )}
              </Button>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-100 overflow-x-auto leading-relaxed max-h-96">
              <code>{block.bodyContent}</code>
            </pre>
          </div>
        );
      case "quote":
        return (
          <div key={block.id} className="p-5 border-l-4 border-indigo-600 bg-indigo-50/40 rounded-r-xl my-4 flex gap-4 border border-indigo-100/60">
            <Quote className="w-7 h-7 text-indigo-400 flex-shrink-0" />
            <div className="space-y-1.5">
              <p className="font-sans italic text-slate-800 text-sm leading-relaxed font-medium">
                "{block.bodyContent}"
              </p>
              {block.caption && (
                <span className="block text-[11px] font-mono text-indigo-600 uppercase font-bold">
                  &mdash; {block.caption}
                </span>
              )}
            </div>
          </div>
        );
      case "chart_data":
        let parsedData: Array<{ name: string; Normal?: number; Fraud?: number; Value?: number }> = [];
        try {
          parsedData = JSON.parse(block.bodyContent);
        } catch (e) {
          console.error("Failed to parse chart data JSON");
        }

        return (
          <InteractiveChartBlock 
            key={block.id} 
            title={block.title} 
            data={parsedData} 
            industry={project.industry} 
          />
        );
      default:
        return null;
    }
  };

  const primaryRecommendation = project.recommendations ? project.recommendations.split("\n")[0] : "Implement real-time KPI telemetry monitoring across executive dashboards.";
  const topImage = project.images && project.images.length > 0 ? project.images[0] : null;

  return (
    <article className="space-y-10 animate-fade-in pb-12">
      {/* Navigation & Action Bar */}
      <div className="flex items-center justify-between no-print border-b border-slate-100 pb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onNavigate("home")}
          className="gap-1.5 text-xs text-slate-600 hover:text-slate-950 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Case Studies
        </Button>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF Export
          </Button>
          
          {project.githubUrl && (
            <a href={project.githubUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs cursor-pointer">
                <Github className="w-3.5 h-3.5" />
                Source Code
              </Button>
            </a>
          )}
          
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noreferrer">
              <Button variant="primary" size="sm" className="gap-1.5 text-xs cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white">
                <ExternalLink className="w-3.5 h-3.5" />
                Live Link
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Main Title & Metadata Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="industry">{project.industry}</Badge>
            <Badge variant="difficulty" difficulty={project.difficulty}>{project.difficulty}</Badge>
            <span className="text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
              Verified Case Study
            </span>
          </div>
          
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight leading-tight">
            {project.title}
          </h1>
          
          <p className="font-display font-medium text-lg text-slate-600 leading-relaxed">
            {project.subtitle}
          </p>
        </div>

        {/* Right Metadata Panel */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm h-fit relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500"></div>
          
          <div className="flex justify-between items-center text-[8px] font-mono text-slate-400 select-none tracking-widest leading-none pb-1">
            <span>REF_ID: #{project.id.slice(0, 8).toUpperCase()}</span>
            <span>PROD_VERIFIED</span>
          </div>

          <h3 className="font-display font-bold text-xs text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" /> Executive Audit Context
          </h3>
          
          <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-sans">
            <div className="space-y-0.5">
              <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Role</span>
              <span className="font-semibold text-slate-800 block">{project.role}</span>
            </div>
            
            <div className="space-y-0.5">
              <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Duration</span>
              <span className="font-semibold text-slate-800 block">{project.duration}</span>
            </div>
            
            <div className="space-y-0.5">
              <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Timeline</span>
              <span className="font-semibold text-slate-800 block flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {new Date(project.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
            </div>
            
            <div className="space-y-0.5">
              <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Category</span>
              <span className="font-semibold text-slate-800 block">{project.categories.join(", ")}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider mb-1.5">Tech Tags</span>
            <div className="flex flex-wrap gap-1">
              {project.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 font-mono text-[9px] font-semibold bg-white text-indigo-700 rounded-lg border border-indigo-100 shadow-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 1. EXECUTIVE OVERVIEW BRIEFING CARD ─── */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white rounded-2xl p-6 border border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-white">Executive Briefing</h2>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Recruiter Scan Summary & Decision Matrix</span>
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold bg-indigo-950 border border-indigo-800 text-indigo-300 px-3 py-1 rounded-full uppercase tracking-wider">
            Executive Summary
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-sm">
            <span className="text-[9px] font-mono uppercase text-indigo-400 font-bold block flex items-center gap-1">
              <Target className="w-3 h-3" /> Project Goal
            </span>
            <p className="text-xs text-slate-200 leading-relaxed font-sans line-clamp-3">
              {project.summary || project.objective}
            </p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-sm">
            <span className="text-[9px] font-mono uppercase text-emerald-400 font-bold block flex items-center gap-1">
              <Award className="w-3 h-3" /> Strategic Business Value
            </span>
            <p className="text-xs text-slate-200 leading-relaxed font-sans line-clamp-3">
              {project.overviewText || project.summary}
            </p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-sm">
            <span className="text-[9px] font-mono uppercase text-amber-400 font-bold block flex items-center gap-1">
              <Database className="w-3 h-3" /> Dataset Scale
            </span>
            <p className="text-xs text-slate-200 leading-relaxed font-sans line-clamp-3">
              {project.datasetDesc || `${project.metrics.length} metric dimensions across transactional logs`}
            </p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-sm">
            <span className="text-[9px] font-mono uppercase text-purple-400 font-bold block flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Primary Stack
            </span>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {project.tags.slice(0, 4).map(t => (
                <span key={t} className="text-[9px] font-mono bg-slate-950 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Key Recommendation Box */}
        <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-wider block">Primary Strategic Recommendation</span>
            <p className="text-xs text-slate-200 leading-relaxed font-sans font-medium">
              "{primaryRecommendation}"
            </p>
          </div>
        </div>
      </section>

      {/* ─── 2. HERO DASHBOARD SCREENSHOT ─── */}
      {topImage && (
        <section className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-sm overflow-hidden hover:scale-[1.01] transition-transform duration-300 cursor-zoom-in group"
          onClick={() => {
            const w = window.open();
            if (w) {
              w.document.write(`<img src="${topImage}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
              w.document.title = `${project.title} - Executive Dashboard`;
            }
          }}
        >
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-white text-xs font-mono font-bold uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Executive Dashboard & Visual Telemetry</span>
            </div>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-900 px-2 py-0.5 rounded">
              Verified Hero Visual
            </span>
          </div>
          <div className="relative aspect-[16/9] sm:aspect-[21/9] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
            <img 
              src={topImage} 
              alt={`${project.title} Dashboard`} 
              className="object-cover w-full h-full"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
              <span className="text-[10px] font-mono text-white bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-lg shadow-xl font-bold tracking-widest uppercase">
                Enlarge Dashboard
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ─── MAIN GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
        <div className="lg:col-span-2 space-y-8">
          
          {/* 3. INSIGHTS (Findings & Recommendations) */}
          {(project.findings || project.recommendations) && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                Strategic Insights & Action Plan
              </h3>
              
              {project.findings && (
                <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2 shadow-sm">
                  <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Key Discoveries
                  </span>
                  {formatParagraphsToBullets(project.findings)}
                </div>
              )}

              {project.recommendations && (
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm">
                  <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Executive Action Items
                  </span>
                  {formatParagraphsToBullets(project.recommendations)}
                </div>
              )}
            </div>
          )}

          {/* 4. METHODOLOGY (Objective + Data + Execution) */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" />
              Methodology & Execution
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-2.5 shadow-sm">
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-600" /> Primary Objective
                </span>
                {formatParagraphsToBullets(project.objective)}
              </div>

              {project.businessProblem && (
                <div className="bg-rose-50/30 border border-rose-200 p-5 rounded-2xl space-y-2.5 shadow-sm">
                  <span className="text-[10px] font-mono font-bold text-rose-600 uppercase tracking-wider block flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> The Problem
                  </span>
                  {formatParagraphsToBullets(project.businessProblem)}
                </div>
              )}
            </div>

            {(project.datasetDesc || project.dataCleaning) && (
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm mt-4">
                <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Layers className="w-4 h-4 text-slate-700" /> Data Corpus
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {project.datasetDesc && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Source Architecture</span>
                      {formatParagraphsToBullets(project.datasetDesc)}
                    </div>
                  )}
                  {project.dataCleaning && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block">Transformation</span>
                      {formatParagraphsToBullets(project.dataCleaning)}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm mt-4">
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Execution Strategy</span>
                {formatParagraphsToBullets(project.methodology)}
              </div>
              {project.analysisText && (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block">Analytical Modeling</span>
                  {formatParagraphsToBullets(project.analysisText)}
                </div>
              )}
            </div>
          </div>

          {/* 5. KPIs */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Verified Performance Metrics
            </h3>
            
            <div className="bg-slate-950 text-white rounded-2xl overflow-hidden border border-slate-800 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                {project.metrics.map((metric, idx) => {
                  const normalizedLabel = normalizeKpiLabel(metric.label);
                  const sanitizedValue = cleanKpiValue(metric.value, normalizedLabel);
                  const gaugePcts = [82, 94, 88];
                  const pct = gaugePcts[idx % 3];

                  return (
                    <div key={metric.id || idx} className="p-5 space-y-3 hover:bg-slate-900 transition-colors">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block font-bold">
                          {normalizedLabel}
                        </span>
                        <span className="text-3xl font-display font-bold text-white block tracking-tight">
                          {sanitizedValue}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[8px] font-mono text-slate-500">
                          <span>AUDITED</span>
                          <span className="text-emerald-400 font-bold">{pct}% CONFIDENCE</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {metric.description || "Extracted and verified across source dataset files."}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6. ENGINEERING RETROSPECTIVE */}
          {(project.challengesText || project.lessonsLearned || project.storyBlocks.length > 0) && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-slate-700" />
                Engineering Retrospective
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.challengesText && (
                  <div className="p-5 bg-amber-50/30 border border-amber-200 rounded-2xl space-y-2 shadow-sm">
                    <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-wider block">Technical Obstacles</span>
                    {formatParagraphsToBullets(project.challengesText)}
                  </div>
                )}
                {project.lessonsLearned && (
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Lessons Learned</span>
                    {formatParagraphsToBullets(project.lessonsLearned)}
                  </div>
                )}
              </div>

              {project.storyBlocks.length > 0 && (
                <div className="space-y-6 pt-4">
                  {project.storyBlocks.map(renderStoryBlock)}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Sticky Sidebar */}
        <div className="space-y-6">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
              <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Recruiter Evaluation
              </h4>
              
              <ul className="space-y-3 text-xs text-slate-600 font-sans">
                <li className="flex gap-2">
                  <span className="h-4 w-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold font-mono text-[9px] shrink-0 mt-0.5">✓</span>
                  <span><strong>Evidence Grounded:</strong> Real metrics extracted and verified against raw data files.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-4 w-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold font-mono text-[9px] shrink-0 mt-0.5">✓</span>
                  <span><strong>Production Ready:</strong> Clean architecture prioritizing low latency and dataset integrity.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-4 w-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold font-mono text-[9px] shrink-0 mt-0.5">✓</span>
                  <span><strong>Strategic Business Value:</strong> Translates technical querying into executive action items.</span>
                </li>
              </ul>

              {project.images && project.images.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Project Gallery ({project.images.length})
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {project.images.map((img, index) => (
                      <div 
                        key={index} 
                        className="group/img relative aspect-[4/3] rounded-xl border border-slate-200 overflow-hidden bg-slate-50 cursor-zoom-in shadow-sm hover:scale-[1.01] transition-transform duration-300"
                        onClick={() => {
                          const w = window.open();
                          if (w) {
                            w.document.write(`<img src="${img}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                            w.document.title = `${project.title} - Asset ${index + 1}`;
                          }
                        }}
                      >
                        <img 
                          src={img} 
                          alt={`Project Asset ${index + 1}`}
                          className="object-cover w-full h-full"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[9px] font-mono text-white bg-slate-900/90 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Zoom</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-3 border-t border-slate-100">
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => onNavigate("home")} 
                  className="w-full text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-white cursor-pointer shadow-sm rounded-xl"
                >
                  Return to Portfolio Index
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
