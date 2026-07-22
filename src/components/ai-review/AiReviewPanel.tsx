/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AiReviewPanel — AI Portfolio Reviewer UX
 * Orchestrates all AI review sub-panels. No raw form fields here.
 * Business logic hooks and state live in this component;
 * children are pure presentation components.
 */

import React, { useState, useCallback } from "react";
import {
  Sparkles, Brain, CheckCircle2, Edit3, AlertTriangle,
  ChevronDown, ChevronUp, TrendingUp, Database, Shield,
  Clock, Users, Target, Cpu, BarChart3, Zap, FileText,
  Lock, RefreshCw, BookOpen, Wrench
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProjectUnderstanding {
  projectType: string;
  projectArchetype: string;
  industry: string;
  businessDomain: string;
  businessProblem: string;
  primaryObjective: string;
  likelyStakeholders: string[];
  businessQuestions: string[];
  trueKPIs: Array<{ label: string; value: string; sourceFile: string; isDAX?: boolean }>;
  analyticalTechniques: string[];
  toolsUsed: string[];
  datasets: Array<{ fileName: string; fileType: string; schemaColumns: string[]; recordSummary?: string }>;
  suggestedTitles: Array<{ title: string; confidence: number; rationale: string }>;
  suggestedSummaries: Array<{ summary: string; confidence: number }>;
  confidence: number;
  schemaVersion?: string;
}

interface MissingInfoItem {
  field: string;
  reason: string;
  question: string;
  type: "text" | "textarea";
  estimatedQualityBoost?: number;
  recruiterImpactPriority?: "Critical" | "High" | "Medium";
}

interface RecruiterAudit {
  overallQualityScore?: number;
  evidenceConfidenceScore?: number;
  hallucinationRiskLevel?: string;
  recruiterReadinessScore?: number;
}

interface FileCoverageItem {
  fileName: string;
  status: "Used" | "Failed" | "Ignored";
  reason: string;
  size?: number;
}

interface AiReviewPanelProps {
  portfolioProject: any;
  projectUnderstanding?: ProjectUnderstanding;
  missingInformation?: MissingInfoItem[];
  recruiterAudit?: RecruiterAudit;
  fileCoverage?: FileCoverageItem[];
  confidenceScores?: Record<string, number>;
  sourceAttributions?: Record<string, string[]>;
  conflicts?: any[];
  resolvedConflictFields?: Record<string, boolean>;
  uploadedFileMetas?: Array<{ storagePath?: string; name: string }>;
  // Advanced editor props (passed through to accordion)
  safetyScore?: number | null;
  classifications?: Record<string, string>;
  activityLog?: string[];
  originalTexts?: Record<string, string>;
  recommendationValidation?: any[];
  datasetTraceability?: any[];
  completenessReport?: any[];
  crossDocAnalysis?: any;
  activeDiffField?: string | null;
  reviewTab?: "overview" | "fields" | "traceability" | "history";
  importVersions?: Record<string, any[]>;
  showLearningOffer?: boolean;
  pendingCorrection?: { field: string; original: string; corrected: string } | null;
  unresolvedConflictsCount?: number;
  // Callbacks
  onApprove: () => void;
  onCancel: () => void;
  onFieldEdit: (field: string, value: string) => void;
  onAnswersSubmit: (answers: Record<string, string>) => void;
  onSetReviewTab?: (tab: "overview" | "fields" | "traceability" | "history") => void;
  onSetActiveDiffField?: (field: string | null) => void;
  onSetAiParsedResult?: (v: any) => void;
  onConflictResolve?: (field: string, value: string, isKpi?: boolean) => void;
  onLearningApprove?: () => void;
  onLearningDismiss?: () => void;
  renderDiff?: (original: string, current: string) => React.ReactNode;
  // Slot: the existing Advanced Review JSX (tabs + fields + traceability + history)
  advancedReviewSlot?: React.ReactNode;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function confidenceColor(score: number) {
  if (score >= 85) return { bar: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-800/60" };
  if (score >= 65) return { bar: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-950/30 border-amber-800/60" };
  return { bar: "bg-rose-500", text: "text-rose-400", bg: "bg-rose-950/30 border-rose-800/60" };
}

function ConfidenceBar({ score, label }: { score: number; label?: string }) {
  const col = confidenceColor(score);
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[10px] text-slate-400 font-mono w-32 shrink-0 truncate">{label}</span>}
      <div className="flex-1 bg-slate-950 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full ${col.bar} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono font-bold ${col.text} w-9 text-right shrink-0`}>{score}%</span>
    </div>
  );
}

function SectionLabel({ icon: Icon, label, badge }: { icon: any; label: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">{label}</span>
      {badge && (
        <span className="text-[8px] font-mono font-bold bg-indigo-950/60 border border-indigo-900 text-indigo-300 px-1.5 py-0.5 rounded ml-auto">
          {badge}
        </span>
      )}
    </div>
  );
}

function ToolChip({ tool }: { tool: string }) {
  const lower = tool.toLowerCase();
  let cls = "bg-slate-800/60 border-slate-700 text-slate-300";
  if (lower.includes("sql") || lower.includes("postgres") || lower.includes("mysql")) cls = "bg-blue-950/40 border-blue-800/60 text-blue-300";
  else if (lower.includes("excel") || lower.includes("vba") || lower.includes("spreadsheet")) cls = "bg-emerald-950/40 border-emerald-800/60 text-emerald-300";
  else if (lower.includes("power bi") || lower.includes("dax") || lower.includes("pbix")) cls = "bg-yellow-950/40 border-yellow-800/60 text-yellow-300";
  else if (lower.includes("python") || lower.includes("pandas") || lower.includes("scikit")) cls = "bg-indigo-950/40 border-indigo-800/60 text-indigo-300";
  else if (lower.includes("tableau")) cls = "bg-orange-950/40 border-orange-800/60 text-orange-300";
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-semibold border px-1.5 py-0.5 rounded ${cls}`}>
      <span className="text-[8px]">✓</span> {tool}
    </span>
  );
}

function Accordion({ title, icon: Icon, defaultOpen = false, children }: {
  title: string; icon: any; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-800/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900/50 hover:bg-slate-900/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-[10px] font-mono font-bold text-slate-200 uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      {open && <div className="p-3 border-t border-slate-800/50 bg-slate-950/20">{children}</div>}
    </div>
  );
}

// ─── Section 1: Portfolio Health Card ─────────────────────────────────────────

function PortfolioHealthCard({
  understanding,
  recruiterAudit,
  missingCount,
  onComplete
}: {
  understanding?: ProjectUnderstanding;
  recruiterAudit?: RecruiterAudit;
  missingCount: number;
  onComplete: () => void;
}) {
  const overallScore = recruiterAudit?.overallQualityScore ?? understanding?.confidence ?? 75;
  const evidenceScore = recruiterAudit?.evidenceConfidenceScore ?? understanding?.confidence ?? 70;
  const readinessScore = recruiterAudit?.recruiterReadinessScore ?? Math.round(overallScore * 0.9);
  const hallucRisk = recruiterAudit?.hallucinationRiskLevel ?? (evidenceScore >= 85 ? "Low" : evidenceScore >= 65 ? "Medium" : "High");
  const estSeconds = missingCount * 20;
  const riskColor = hallucRisk === "Low" ? "text-emerald-400 bg-emerald-950/30 border-emerald-800" :
    hallucRisk === "Medium" ? "text-amber-400 bg-amber-950/30 border-amber-800" :
      "text-rose-400 bg-rose-950/30 border-rose-800";

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-indigo-900/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-700/50 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Portfolio Health</div>
            <div className="text-[9px] text-slate-400 font-mono">Evidence-grounded analysis complete</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onComplete}
          disabled={missingCount === 0}
          className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
            missingCount > 0
              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
              : "bg-emerald-600/30 border border-emerald-700 text-emerald-400 cursor-default"
          }`}
        >
          {missingCount > 0 ? (
            <><Zap className="w-3 h-3" /> Complete Portfolio</>
          ) : (
            <><CheckCircle2 className="w-3 h-3" /> Portfolio Ready</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="space-y-1">
          <ConfidenceBar score={overallScore} label="Overall Completion" />
          <ConfidenceBar score={evidenceScore} label="Evidence Confidence" />
          <ConfidenceBar score={readinessScore} label="Recruiter Readiness" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className={`rounded-lg p-2 border text-center ${riskColor}`}>
            <div className="text-[8px] font-mono uppercase opacity-70">Hallucination Risk</div>
            <div className="font-bold mt-0.5">{hallucRisk}</div>
          </div>
          <div className="rounded-lg p-2 border border-slate-800 bg-slate-900/40 text-center">
            <div className="text-[8px] font-mono uppercase text-slate-500">Questions Left</div>
            <div className="font-bold text-white mt-0.5">{missingCount}</div>
          </div>
          {missingCount > 0 && (
            <div className="col-span-2 rounded-lg p-2 border border-slate-800 bg-slate-900/40 flex items-center gap-2">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <div>
                <div className="text-[8px] font-mono uppercase text-slate-500">Estimated Time</div>
                <div className="font-bold text-white text-[9px]">~{estSeconds < 60 ? `${estSeconds} sec` : `${Math.ceil(estSeconds / 60)} min`}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section 2: AI Project Understanding Panel ─────────────────────────────────

function AiUnderstandingPanel({ understanding }: { understanding: ProjectUnderstanding }) {
  const confCol = confidenceColor(understanding.confidence);
  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-4">
      <SectionLabel icon={Brain} label="AI Project Understanding" badge={`${understanding.confidence}% Evidence Confidence`} />

      {/* Archetype badge */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[9px] font-mono font-bold bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 px-2 py-0.5 rounded-full">
          {understanding.projectArchetype}
        </span>
      </div>

      {/* Two-column grid for domain facts */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {[
          { label: "Industry", value: understanding.industry },
          { label: "Business Domain", value: understanding.businessDomain },
          { label: "Project Type", value: understanding.projectType },
          { label: "Stakeholders", value: understanding.likelyStakeholders.slice(0, 2).join(", ") || "Not detected" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-950/40 rounded-lg p-2 border border-slate-800/40">
            <div className="text-[8px] font-mono uppercase text-slate-500 mb-0.5">{label}</div>
            <div className="text-slate-200 font-medium leading-snug">{value}</div>
          </div>
        ))}
      </div>

      {/* Business Problem */}
      {understanding.businessProblem && (
        <div className="space-y-1">
          <div className="text-[8px] font-mono uppercase text-slate-500">Business Problem</div>
          <p className="text-slate-300 text-[11px] leading-relaxed border-l-2 border-indigo-700 pl-2.5">
            {understanding.businessProblem}
          </p>
        </div>
      )}

      {/* Primary Objective */}
      {understanding.primaryObjective && (
        <div className="space-y-1">
          <div className="text-[8px] font-mono uppercase text-slate-500">Primary Objective</div>
          <p className="text-slate-300 text-[11px] leading-relaxed border-l-2 border-emerald-700 pl-2.5">
            {understanding.primaryObjective}
          </p>
        </div>
      )}

      {/* Tools Used */}
      {understanding.toolsUsed.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[8px] font-mono uppercase text-slate-500">Detected Tools</div>
          <div className="flex flex-wrap gap-1">
            {understanding.toolsUsed.map(t => <ToolChip key={t} tool={t} />)}
          </div>
        </div>
      )}

      {/* Analytical Techniques */}
      {understanding.analyticalTechniques.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[8px] font-mono uppercase text-slate-500">Detected Techniques</div>
          <div className="flex flex-wrap gap-1">
            {understanding.analyticalTechniques.slice(0, 6).map(t => (
              <span key={t} className="text-[9px] font-mono bg-slate-800/60 border border-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded">
                ✓ {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Business Questions */}
      {understanding.businessQuestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[8px] font-mono uppercase text-slate-500">Business Questions This Answers</div>
          <ul className="space-y-1">
            {understanding.businessQuestions.slice(0, 4).map((q, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-300">
                <span className="text-indigo-400 font-mono shrink-0 mt-0.5">{i + 1}.</span>
                <span className="leading-relaxed">{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPIs table */}
      {understanding.trueKPIs.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[8px] font-mono uppercase text-slate-500">Detected Business KPIs</div>
          <div className="space-y-1">
            {understanding.trueKPIs.slice(0, 5).map((k, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-950/40 border border-slate-800/40 rounded px-2 py-1 text-[10px]">
                <span className="text-slate-300 font-medium">{k.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {k.value && <span className="text-emerald-400 font-mono font-bold">{k.value}</span>}
                  {k.isDAX && <span className="text-yellow-500 text-[8px] font-mono border border-yellow-800 bg-yellow-950/30 px-1 rounded">DAX</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Confidence bar */}
      <div className="pt-1 border-t border-slate-800/40">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-mono uppercase text-slate-500">Overall Evidence Confidence</span>
          <span className={`text-[10px] font-mono font-bold ${confCol.text}`}>{understanding.confidence}%</span>
        </div>
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full ${confCol.bar} transition-all duration-1000`}
            style={{ width: `${understanding.confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Section 3: AI Generated Portfolio (grouped, edit-only, accepted by default) ─

// Helper functions to safely extract string values from either primitives or FieldWithEvidence objects
function extractString(val: any): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && typeof val.value === "string") return val.value;
  return "";
}

function extractStringArray(val: any): string[] {
  if (Array.isArray(val)) return val.map(extractString).filter(Boolean);
  if (val && typeof val === "object" && Array.isArray(val.value)) return val.value.map(extractString).filter(Boolean);
  return [];
}

interface EditState {
  [field: string]: { editing: boolean; draft: string };
}

function AiGeneratedPortfolioSection({
  project,
  understanding,
  confidenceScores,
  sourceAttributions,
  classifications,
  onFieldEdit,
}: {
  project: any;
  understanding?: ProjectUnderstanding;
  confidenceScores?: Record<string, number>;
  sourceAttributions?: Record<string, string[]>;
  classifications?: Record<string, string>;
  onFieldEdit: (field: string, value: string) => void;
}) {
  const [editState, setEditState] = useState<EditState>({});

  const startEdit = useCallback((field: string, current: string) => {
    setEditState(s => ({ ...s, [field]: { editing: true, draft: current } }));
  }, []);

  const saveEdit = useCallback((field: string) => {
    const draft = editState[field]?.draft ?? "";
    onFieldEdit(field, draft);
    setEditState(s => ({ ...s, [field]: { editing: false, draft: "" } }));
  }, [editState, onFieldEdit]);

  const cancelEdit = useCallback((field: string) => {
    setEditState(s => ({ ...s, [field]: { editing: false, draft: "" } }));
  }, []);

  const getConf = (key: string) => confidenceScores?.[key] ?? 80;
  const getSources = (key: string) => sourceAttributions?.[key]?.join(", ") ?? "";
  const getClass = (key: string) => classifications?.[key] ?? "";

  const FieldRow = ({
    field,
    label,
    value,
    confKey,
    multiline = false,
    sourceKey,
  }: {
    field: string;
    label: string;
    value: any;
    confKey: string;
    multiline?: boolean;
    sourceKey?: string;
  }) => {
    const strVal = extractString(value);
    const conf = getConf(confKey);
    const src = getSources(sourceKey ?? confKey);
    const cls = getClass(field);
    const col = confidenceColor(conf);
    const isEditing = editState[field]?.editing;
    const isLowConf = conf < 75;
    const isEmpty = !strVal || strVal.trim().length === 0;

    if (isEmpty) return null;

    return (
      <div className={`rounded-lg border p-2.5 space-y-1.5 ${
        isLowConf
          ? "border-amber-800/40 bg-amber-950/10"
          : "border-slate-800/40 bg-slate-950/20"
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] font-mono uppercase font-bold text-slate-400 truncate">{label}</span>
            {isLowConf && (
              <span className="text-[7px] font-mono font-bold text-amber-400 border border-amber-800 bg-amber-950/40 px-1 rounded shrink-0">
                Needs Confirmation
              </span>
            )}
            {cls === "USER EDITED" && (
              <span className="text-[7px] font-mono font-bold text-indigo-400 border border-indigo-800 bg-indigo-950/40 px-1 rounded shrink-0">
                Edited
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[9px] font-mono font-bold ${col.text}`}>{conf}%</span>
            {!isEditing && (
              <button
                type="button"
                onClick={() => startEdit(field, strVal)}
                className="flex items-center gap-0.5 text-[8px] font-mono text-slate-400 hover:text-indigo-400 border border-slate-700 hover:border-indigo-700 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
              >
                <Edit3 className="w-2.5 h-2.5" /> Edit
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-1.5">
            {multiline ? (
              <textarea
                value={editState[field]?.draft ?? strVal}
                onChange={e => setEditState(s => ({ ...s, [field]: { ...s[field], draft: e.target.value } }))}
                rows={4}
                className="w-full bg-slate-950 border border-indigo-700 rounded p-2 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 font-sans resize-none"
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={editState[field]?.draft ?? strVal}
                onChange={e => setEditState(s => ({ ...s, [field]: { ...s[field], draft: e.target.value } }))}
                className="w-full bg-slate-950 border border-indigo-700 rounded p-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
                autoFocus
              />
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => saveEdit(field)}
                className="text-[9px] font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded cursor-pointer transition-colors"
              >
                ✓ Save
              </button>
              <button
                type="button"
                onClick={() => cancelEdit(field)}
                className="text-[9px] font-mono text-slate-400 hover:text-slate-200 px-2 py-1 rounded cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-slate-200 text-[11px] leading-relaxed font-sans">{strVal}</p>
          </div>
        )}

        <div className="w-full bg-slate-950 h-0.5 rounded-full overflow-hidden">
          <div className={`h-full ${col.bar}`} style={{ width: `${conf}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-4">
      <SectionLabel icon={Sparkles} label="AI Generated Portfolio" />

      {/* Title */}
      <FieldRow
        field="title"
        label="Case Study Title"
        value={extractString(project.title)}
        confKey="title"
        sourceKey="title"
      />

      {/* Executive Summary */}
      <FieldRow
        field="summary"
        label="Executive Summary"
        value={extractString(project.summary || project.executiveSummary)}
        confKey="summary"
        multiline
        sourceKey="summary"
      />

      {/* Business Objective */}
      <FieldRow
        field="objective"
        label="Business Objective"
        value={extractString(project.objective || project.businessObjective)}
        confKey="businessContext"
        multiline
        sourceKey="businessContext"
      />

      {/* Business Problem */}
      <FieldRow
        field="businessProblem"
        label="Business Problem"
        value={extractString(project.businessProblem)}
        confKey="businessProblem"
        multiline
        sourceKey="businessProblem"
      />

      {/* Methodology */}
      <FieldRow
        field="methodology"
        label="Methodology"
        value={extractString(project.methodology)}
        confKey="methodology"
        multiline
        sourceKey="methodology"
      />

      {/* Findings */}
      <FieldRow
        field="findings"
        label="Key Findings"
        value={extractString(project.findings)}
        confKey="findings"
        multiline
        sourceKey="findings"
      />

      {/* Recommendations */}
      <FieldRow
        field="recommendations"
        label="Strategic Recommendations"
        value={extractString(project.recommendations)}
        confKey="recommendations"
        multiline
        sourceKey="recommendations"
      />

      {/* Business Impact */}
      <FieldRow
        field="businessImpact"
        label="Business Impact"
        value={extractString(project.businessImpact)}
        confKey="businessImpact"
        multiline
        sourceKey="businessImpact"
      />

      {/* Metrics summary row */}
      {Array.isArray(project.metrics) && project.metrics.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">Detected KPI Metrics</span>
            <span className="text-[9px] font-mono text-slate-500">{project.metrics.length} detected</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {project.metrics.slice(0, 6).map((m: any, i: number) => (
              <div key={i} className="bg-slate-950/40 border border-slate-800/40 rounded p-2">
                <div className="text-emerald-400 font-mono font-bold text-[11px]">{extractString(m.value)}</div>
                <div className="text-slate-300 text-[9px] font-medium mt-0.5 truncate">{extractString(m.label)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {extractStringArray(project.tags).length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">Tech Tags</span>
          <div className="flex flex-wrap gap-1">
            {extractStringArray(project.tags).map((tag: string, i: number) => (
              <span key={i} className="text-[9px] font-mono bg-indigo-950/40 border border-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section 4: Needs Your Help (missing info prompts) ────────────────────────

function NeedsYourHelpSection({
  items,
  answers,
  onAnswerChange,
  onAnswersSubmit,
  isSubmitting,
}: {
  items: MissingInfoItem[];
  answers: Record<string, string>;
  onAnswerChange: (field: string, value: string) => void;
  onAnswersSubmit: () => void;
  isSubmitting: boolean;
}) {
  const [expandedField, setExpandedField] = useState<string | null>(items[0]?.field ?? null);
  const filledCount = Object.values(answers).filter(v => v.trim().length > 0).length;
  const priorityColor = (p?: string) =>
    p === "Critical" ? "text-rose-400 border-rose-800 bg-rose-950/30" :
    p === "High" ? "text-amber-400 border-amber-800 bg-amber-950/30" :
    "text-slate-400 border-slate-700 bg-slate-900/30";

  if (items.length === 0) return null;

  return (
    <div className="bg-amber-950/10 border border-amber-800/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel icon={AlertTriangle} label="Needs Your Help" badge={`${items.length} questions`} />
        {filledCount > 0 && (
          <button
            type="button"
            onClick={onAnswersSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 text-[9px] font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 shrink-0"
          >
            {isSubmitting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Submit {filledCount} Answer{filledCount !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const isExpanded = expandedField === item.field;
          const hasAnswer = (answers[item.field] ?? "").trim().length > 0;
          return (
            <div
              key={item.field}
              className={`rounded-lg border transition-all ${
                hasAnswer ? "border-emerald-800/40 bg-emerald-950/10" : "border-amber-800/30 bg-amber-950/5"
              }`}
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => setExpandedField(isExpanded ? null : item.field)}
                className="w-full flex items-center justify-between p-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[7px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${priorityColor(item.recruiterImpactPriority)}`}>
                    {item.recruiterImpactPriority ?? "Medium"}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-200 truncate">{item.field}</span>
                  {hasAnswer && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.estimatedQualityBoost && (
                    <span className="text-[8px] font-mono text-emerald-400">+{item.estimatedQualityBoost} quality</span>
                  )}
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                </div>
              </button>

              {/* Expanded body */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-slate-800/30">
                  <p className="text-[10px] text-slate-400 italic leading-relaxed pt-2">
                    {item.reason}
                  </p>
                  <div className="bg-slate-900/60 border border-indigo-900/30 rounded-lg p-2.5">
                    <div className="text-[8px] font-mono uppercase text-indigo-400 font-bold mb-1.5">AI Question</div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">"{item.question}"</p>
                  </div>
                  {item.type === "textarea" ? (
                    <textarea
                      value={answers[item.field] ?? ""}
                      onChange={e => onAnswerChange(item.field, e.target.value)}
                      rows={3}
                      placeholder="Your answer..."
                      className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-600 rounded-lg p-2 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none font-sans resize-none transition-colors"
                    />
                  ) : (
                    <input
                      type="text"
                      value={answers[item.field] ?? ""}
                      onChange={e => onAnswerChange(item.field, e.target.value)}
                      placeholder="Your answer..."
                      className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-600 rounded-lg p-2 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none font-sans transition-colors"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main AiReviewPanel Export ─────────────────────────────────────────────────

export const AiReviewPanel: React.FC<AiReviewPanelProps> = ({
  portfolioProject,
  projectUnderstanding,
  missingInformation = [],
  recruiterAudit,
  fileCoverage = [],
  confidenceScores,
  sourceAttributions,
  conflicts = [],
  resolvedConflictFields = {},
  advancedReviewSlot,
  unresolvedConflictsCount = 0,
  onApprove,
  onCancel,
  onFieldEdit,
  onAnswersSubmit,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [helpFocused, setHelpFocused] = useState(false);

  const handleAnswerChange = useCallback((field: string, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmitAnswers = useCallback(async () => {
    const filled = Object.fromEntries(
      Object.entries(answers).filter(([, v]) => v.trim().length > 0)
    );
    if (Object.keys(filled).length === 0) return;
    setIsSubmitting(true);
    try {
      await onAnswersSubmit(filled);
    } finally {
      setIsSubmitting(false);
      setAnswers({});
    }
  }, [answers, onAnswersSubmit]);

  const fileCoverageUsed = fileCoverage.filter(f => f.status === "Used");

  return (
    <div className="space-y-4 flex flex-col">
      {/* Portfolio Health Card */}
      <PortfolioHealthCard
        understanding={projectUnderstanding}
        recruiterAudit={recruiterAudit}
        missingCount={missingInformation.length}
        onComplete={() => setHelpFocused(true)}
      />

      {/* File Coverage Chips */}
      {fileCoverageUsed.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {fileCoverageUsed.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[8px] font-mono border border-emerald-800/50 bg-emerald-950/20 text-emerald-400 px-1.5 py-0.5 rounded"
            >
              <CheckCircle2 className="w-2.5 h-2.5" />
              {f.fileName}
            </span>
          ))}
        </div>
      )}

      {/* Conflict Resolution Panel (if any) */}
      {conflicts.length > 0 && (
        <div className="bg-slate-950 border border-amber-900/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
              Evidence Conflicts Detected — {unresolvedConflictsCount} unresolved
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            The Evidence Intelligence Engine found conflicting values across uploaded files. Select the correct value for each before saving.
          </p>
          {conflicts.map((c, i) => {
            const isResolved = resolvedConflictFields[c.field];
            return (
              <div key={i} className={`rounded border p-2 text-[10px] space-y-1.5 ${isResolved ? "border-emerald-900/40" : "border-slate-800"}`}>
                <div className="flex justify-between">
                  <span className="font-mono text-indigo-400 font-bold">{c.field}</span>
                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${isResolved ? "text-emerald-400 bg-emerald-950/40 border border-emerald-900" : "text-amber-400 bg-amber-950/40 border border-amber-900 animate-pulse"}`}>
                    {isResolved ? "✓ Resolved" : "⚠ Action Required"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section 1: AI Project Understanding */}
      {projectUnderstanding && (
        <AiUnderstandingPanel understanding={projectUnderstanding} />
      )}

      {/* Section 2: AI Generated Portfolio */}
      <AiGeneratedPortfolioSection
        project={portfolioProject}
        understanding={projectUnderstanding}
        confidenceScores={confidenceScores}
        sourceAttributions={
          sourceAttributions
            ? Object.fromEntries(Object.entries(sourceAttributions).map(([k, v]) => [k, Array.isArray(v) ? v : [String(v)]]))
            : undefined
        }
        onFieldEdit={onFieldEdit}
      />

      {/* Section 3: Needs Your Help */}
      {(helpFocused || missingInformation.length > 0) && (
        <NeedsYourHelpSection
          items={missingInformation}
          answers={answers}
          onAnswerChange={handleAnswerChange}
          onAnswersSubmit={handleSubmitAnswers}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Advanced Review Accordion (existing tabs preserved) */}
      {advancedReviewSlot && (
        <Accordion title="Advanced Review" icon={Wrench} defaultOpen={false}>
          {advancedReviewSlot}
        </Accordion>
      )}

      {/* Save & Cancel Controls */}
      <div className="flex gap-2 pt-1 border-t border-slate-800/60 sticky bottom-0 bg-slate-950/80 backdrop-blur pb-1">
        <button
          type="button"
          onClick={onApprove}
          disabled={unresolvedConflictsCount > 0}
          className={`flex-1 font-semibold text-xs py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
            unresolvedConflictsCount > 0
              ? "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {unresolvedConflictsCount > 0 ? (
            <><Lock className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Resolve {unresolvedConflictsCount} Conflicts to Save</>
          ) : (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Save Case Study to Portfolio</>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs border border-slate-800 text-slate-400 hover:bg-slate-800 px-4 py-2 rounded-lg cursor-pointer transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AiReviewPanel;
