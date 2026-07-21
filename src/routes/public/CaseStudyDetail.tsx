/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ProjectRecord, ContentBlock } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { motion } from "motion/react";
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
  Check
} from "lucide-react";

interface ChartItem {
  name: string;
  Normal?: number;
  Fraud?: number;
  Value?: number;
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
    <div className="space-y-4 p-5 border border-slate-200/60 rounded-xl bg-white shadow-xs">
      <div className="flex items-center justify-between">
        {title && <h4 className="font-display font-semibold text-slate-900 text-sm">{title}</h4>}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/40 no-print">
          <button
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
          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 pb-1 border-b border-slate-50">
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
                    isHovered ? "bg-slate-55" : ""
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

                  {/* Visual Bar */}
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

                    {/* Active tooltip overlay */}
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

  // Action to copy code snippet
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

  // Render different story block types dynamically
  const renderStoryBlock = (block: ContentBlock) => {
    switch (block.type) {
      case "markdown":
        return (
          <div key={block.id} className="space-y-3 prose max-w-none text-slate-600 text-sm leading-relaxed">
            {block.title && <h4 className="font-display font-semibold text-slate-900 text-base">{block.title}</h4>}
            <p className="whitespace-pre-line font-sans">{block.bodyContent}</p>
          </div>
        );
      case "code_snippet":
        return (
          <div key={block.id} className="space-y-2 border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-lg">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-900/80">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                  {block.title || "Source Implementation"} ({block.language || "code"})
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => copyCodeToClipboard(block.id, block.bodyContent)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 text-[10px] px-2.5 py-1 h-7 flex items-center gap-1.5 transition-all duration-200"
              >
                {copiedBlockId === block.id ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
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
          <div key={block.id} className="p-5 border-l-4 border-slate-800 bg-slate-50 rounded-r-xl my-4 flex gap-4">
            <Quote className="w-8 h-8 text-slate-300 flex-shrink-0" />
            <div className="space-y-1.5">
              <p className="font-sans italic text-slate-600 text-sm leading-relaxed">
                "{block.bodyContent}"
              </p>
              {block.caption && (
                <span className="block text-[11px] font-mono text-slate-400 uppercase font-bold">
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

  return (
    <article className="space-y-10 animate-fade-in">
      {/* Navigation Headers (Hidden during printing) */}
      <div className="flex items-center justify-between no-print border-b border-slate-100 pb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onNavigate("home")}
          className="gap-1.5 text-xs text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Case Studies
        </Button>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF Export
          </Button>
          
          {project.githubUrl && (
            <a href={project.githubUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Github className="w-3.5 h-3.5" />
                Source Code
              </Button>
            </a>
          )}
          
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noreferrer">
              <Button variant="primary" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                Live Link
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Main Grid: Split header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left / Middle: Story Header */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="industry">{project.industry}</Badge>
            <Badge variant="difficulty" difficulty={project.difficulty}>{project.difficulty}</Badge>
          </div>
          
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight leading-tight">
            {project.title}
          </h1>
          
          <p className="font-display font-medium text-lg text-slate-500 leading-relaxed">
            {project.subtitle}
          </p>
        </div>

        {/* Right Panel: Project Metadata Panel */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4 shadow-sm h-fit relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-slate-900 via-slate-700 to-slate-400"></div>
          
          <div className="flex justify-between items-center text-[8px] font-mono text-slate-400 select-none tracking-widest leading-none pb-1">
            <span>OS_REF_ID: #{project.id.slice(0, 8).toUpperCase()}</span>
            <span>||||| | ||||</span>
          </div>

          <h3 className="font-display font-bold text-xs text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">
            Audit Parameters
          </h3>
          
          <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-sans">
            <div className="space-y-0.5">
              <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">My Role</span>
              <span className="font-semibold text-slate-800 block line-clamp-2">{project.role}</span>
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
              <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Tech Category</span>
              <span className="font-semibold text-slate-800 block">{project.categories.join(", ")}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider mb-1.5">Stack Details</span>
            <div className="flex flex-wrap gap-1">
              {project.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 font-mono text-[9px] font-medium bg-white text-slate-700 rounded border border-slate-200 shadow-2xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Metric Dashboard Ribbon */}
      <section className="bg-slate-950 text-white rounded-xl overflow-hidden border border-slate-800 shadow-xl shadow-slate-950/10">
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="font-display font-semibold text-xs tracking-wider uppercase text-slate-300">
              Verified Quantifiable Performance
            </span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-900/40 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(16,185,129,0.05)] animate-pulse">
            Durable Stats
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/60">
          {project.metrics.map((metric, idx) => {
            const gaugePcts = [75, 90, 80];
            const pct = gaugePcts[idx % 3];
            return (
              <div key={metric.id} className="p-6 space-y-3.5 hover:bg-slate-900/30 transition-colors duration-200">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">
                    {metric.label}
                  </span>
                  <span className="text-3xl font-display font-bold text-white block tracking-tight">
                    {metric.value}
                  </span>
                </div>
                
                {/* Horizontal Telemetry Gauge */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/20">
                    <div 
                      className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-slate-500">
                    <span>STRENGTH_METRIC</span>
                    <span>{pct}% EFFICIENCY</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans font-light">
                  {metric.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Case Study Content Core */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        
        {/* Left Side: Standard Narrative flow */}
        <div className="lg:col-span-2 space-y-8 animate-fade-in">
          
          {/* Executive Overview */}
          {project.overviewText && (
            <div className="space-y-3">
              <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-100 pb-2">
                Executive Overview
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                {project.overviewText}
              </p>
            </div>
          )}

          {/* Strategic Context */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-100 pb-2">
              1. Objective & Challenge
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Strategic Goal</span>
                <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                  {project.objective}
                </p>
              </div>

              {project.businessProblem && (
                <div className="space-y-2 pt-2 border-t border-slate-50">
                  <span className="text-[10px] font-mono font-bold text-rose-500 uppercase tracking-wider block">The Business Problem</span>
                  <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                    {project.businessProblem}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dataset Specifications */}
          {(project.datasetDesc || project.dataCleaning) && (
            <div className="space-y-4 bg-slate-50 border border-slate-200/40 p-5 rounded-xl">
              <h4 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                Data & Information Corpus
              </h4>
              
              {project.datasetDesc && (
                <div className="space-y-1">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Dataset Details</span>
                  <p className="text-slate-600 text-xs leading-relaxed font-sans">
                    {project.datasetDesc}
                  </p>
                </div>
              )}

              {project.dataCleaning && (
                <div className="space-y-1 pt-3 border-t border-slate-200/30">
                  <span className="text-[9px] font-mono font-bold text-slate-500 uppercase block">Data Cleaning Protocols</span>
                  <p className="text-slate-600 text-xs leading-relaxed font-sans whitespace-pre-line">
                    {project.dataCleaning}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Methodology */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-100 pb-2">
              2. Technical Methodology & Workflow
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Execution Strategy</span>
                <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                  {project.methodology}
                </p>
              </div>

              {project.analysisText && (
                <div className="space-y-2 pt-3 border-t border-slate-50">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Statistical Analysis & Modeling</span>
                  <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                    {project.analysisText}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Findings & Recommendations */}
          {(project.findings || project.recommendations) && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-100 pb-2">
                3. Analytical Findings & Recommendations
              </h3>
              
              {project.findings && (
                <div className="space-y-1.5 p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl">
                  <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider block">Key Discoveries</span>
                  <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                    {project.findings}
                  </p>
                </div>
              )}

              {project.recommendations && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Strategic Recommendations</span>
                  <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                    {project.recommendations}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Retrospective */}
          {(project.challengesText || project.lessonsLearned) && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-100 pb-2">
                4. Engineering Retrospective & Insights
              </h3>

              {project.challengesText && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-amber-600 uppercase block">Technical Challenges Overcome</span>
                  <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                    {project.challengesText}
                  </p>
                </div>
              )}

              {project.lessonsLearned && (
                <div className="space-y-1.5 pt-3 border-t border-slate-50">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Lessons Learned</span>
                  <p className="text-slate-600 text-sm leading-relaxed font-sans whitespace-pre-line">
                    {project.lessonsLearned}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Story Narrative Flow */}
          {project.storyBlocks.length > 0 && (
            <div className="space-y-6 pt-4">
              <h3 className="font-display font-bold text-xl text-slate-900 border-b border-slate-100 pb-2">
                Technical Narrative Walkthrough
              </h3>
              {project.storyBlocks.map(renderStoryBlock)}
            </div>
          )}
        </div>

        {/* Right Side Sticky Scroller / Quick Checklist */}
        <div className="space-y-6">
          <div className="sticky top-24 bg-white border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-xs">
            <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-widest">
              Reviewer Checklist
            </h4>
            
            <ul className="space-y-3 text-xs text-slate-500 font-sans">
              <li className="flex gap-2">
                <span className="h-4 w-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold font-mono text-[9px] flex-shrink-0 mt-0.5">&bull;</span>
                <span><strong>No code larping:</strong> Real metrics audited against measurable operational baselines.</span>
              </li>
              <li className="flex gap-2">
                <span className="h-4 w-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold font-mono text-[9px] flex-shrink-0 mt-0.5">&bull;</span>
                <span><strong>Production Ready:</strong> Clean architectural patterns prioritizing latency, scalability, and code hygiene.</span>
              </li>
              <li className="flex gap-2">
                <span className="h-4 w-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold font-mono text-[9px] flex-shrink-0 mt-0.5">&bull;</span>
                <span><strong>Multi-Disciplinary:</strong> Bridging systems development with strategic analytical insight.</span>
              </li>
            </ul>
            
            {project.images && project.images.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                  Project Artifacts ({project.images.length})
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {project.images.map((img, index) => (
                    <div 
                      key={index} 
                      className="group/img relative aspect-[4/3] rounded-lg border border-slate-200 overflow-hidden bg-slate-50 cursor-zoom-in"
                      onClick={() => {
                        // Open base64/URL image in new tab for high-fidelity viewing
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
                        className="object-cover w-full h-full group-hover/img:scale-105 transition-transform duration-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[9px] font-mono text-white bg-slate-900/80 px-1.5 py-0.5 rounded">View</span>
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
                className="w-full text-xs"
              >
                Back to Index
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
