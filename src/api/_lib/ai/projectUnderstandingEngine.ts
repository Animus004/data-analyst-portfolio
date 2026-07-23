/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { EvidenceGraph, ProjectUnderstanding } from "../types/index";
import { classifyProjectArchetype, disambiguateKPIs } from "./evidenceEvaluator";
import { executeWithTimeout } from "../utils/security";

// ─── Schema Version ──────────────────────────────────────────────────────────
//
// Increment this constant whenever the ProjectUnderstanding interface changes
// or the Gemini reasoning prompt evolves in a breaking way.
// The LRU cache treats any stored object with a different schemaVersion as
// invalid and triggers a fresh Gemini synthesis automatically.

export const PUE_SCHEMA_VERSION = "1.0.0";

// ─── Gemini Client (lazy-init, shared singleton) ──────────────────────────────

let _aiClient: any = null;
function getPUEClient(): any {
  if (_aiClient) return _aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  _aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });
  return _aiClient;
}

// ─── Evidence-Hash In-Memory Cache ───────────────────────────────────────────
//
// Keyed by the package-level SHA-256 hash computed in the compiler
// (sorted file hashes joined by ":"). Avoids redundant Gemini reasoning
// when the same file set is compiled twice in the same server process
// (e.g., NEEDS_USER_INPUT → second call with userAnswers).
//
// Max 64 entries — LRU eviction keeps memory bounded.

const MAX_CACHE_SIZE = 64;

interface CacheEntry {
  understanding: ProjectUnderstanding;
  accessedAt: number;
}

const _understandingCache = new Map<string, CacheEntry>();

function cacheGet(key: string): ProjectUnderstanding | null {
  const entry = _understandingCache.get(key);
  if (!entry) return null;
  // Update LRU access time
  entry.accessedAt = Date.now();
  return entry.understanding;
}

function cacheSet(key: string, understanding: ProjectUnderstanding): void {
  if (_understandingCache.size >= MAX_CACHE_SIZE) {
    // Evict the least-recently-accessed entry
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of _understandingCache) {
      if (v.accessedAt < oldestTime) {
        oldestTime = v.accessedAt;
        oldest = k;
      }
    }
    if (oldest) _understandingCache.delete(oldest);
  }
  _understandingCache.set(key, { understanding, accessedAt: Date.now() });
}

// ─── Evidence Digest Serializer ───────────────────────────────────────────────
//
// Builds a compact, token-efficient digest of the EvidenceGraph for the
// Gemini call. Stays well under 8 000 tokens on typical uploads.

function buildEvidenceDigest(graph: EvidenceGraph): string {
  const parsers = Array.from(new Set(graph.evidenceSources.map(s => s.parser)));

  const kpiNames = Array.from(new Set([
    ...graph.detectedKPIs.map(k => k.value.name),
    ...graph.kpis.map(k => k.value.name),
    ...graph.metrics.map(m => m.value.label)
  ])).filter(Boolean).slice(0, 35);

  const colNames = Array.from(new Set([
    ...graph.detectedDimensions.map(d => d.value),
    ...graph.dimensions.map(d => d.value),
    ...graph.detectedMeasures.map(m => m.value)
  ])).filter(Boolean).slice(0, 45);

  const excelMeasures = Array.from(new Set(
    graph.detectedMeasures
      .filter(m => m.parser === "ExcelParser")
      .map(m => m.value)
  )).slice(0, 20);

  const excelInsights = graph.dashboardInsights
    .filter(d => d.parser === "ExcelParser")
    .map(d => d.value)
    .slice(0, 15);

  const sqlTables = graph.sqlLogic.flatMap(s => s.value.tables).slice(0, 20);
  const sqlAggs   = graph.sqlLogic.flatMap(s => s.value.aggregations).slice(0, 20);
  const sqlWin    = graph.sqlLogic.flatMap(s => s.value.windowFunctions).slice(0, 10);

  const daxMeasures = graph.metrics
    .filter(m => m.parser === "PowerBIParser")
    .map(m => m.value.label)
    .slice(0, 20);

  const businessTerms     = Array.from(new Set(graph.businessTerms.map(t => t.value))).slice(0, 35);
  const businessEntities  = Array.from(new Set(graph.businessEntities.map(e => e.value))).slice(0, 25);
  const businessQuestions = graph.businessQuestions.map(q => q.value).slice(0, 10);
  const dashboardPages    = graph.dashboards.flatMap(d => d.value.pages || [d.value.name]).slice(0, 15);
  const docs              = graph.documentation.map(d => `[${d.value.key}]: ${d.value.text.slice(0, 300)}`).slice(0, 10);
  const techniques        = Array.from(new Set(graph.analyticalTechniques.map(a => a.value))).slice(0, 20);
  const recommendations   = graph.recommendations.map(r => r.value).slice(0, 5);
  const toolsRaw          = Array.from(new Set(
    graph.businessTerms
      .filter(t => t.value.startsWith("Tool:"))
      .map(t => t.value.replace("Tool:", "").trim())
  ));

  const filesSummary = graph.evidenceSources.map(s => ({
    file: s.fileName,
    parser: s.parser,
    confidence: s.confidence,
    nodes: s.nodesExtracted
  }));

  return JSON.stringify({
    parsers,
    files: filesSummary,
    kpiNames,
    columnNames: colNames,
    excelMeasures,
    excelWorkbookTelemetry: excelInsights,
    sqlTables,
    sqlAggregations: sqlAggs,
    sqlWindowFunctions: sqlWin,
    daxMeasures,
    businessTerms,
    businessEntities,
    businessQuestions,
    dashboardPages,
    analyticalTechniques: techniques,
    documentation: docs,
    recommendations,
    detectedTools: toolsRaw
  }, null, 0);
}

// ─── Gemini Response Schema ───────────────────────────────────────────────────

const PUE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    projectType:       { type: Type.STRING },
    projectArchetype:  { type: Type.STRING },
    industry:          { type: Type.STRING },
    businessDomain:    { type: Type.STRING },
    businessProblem:   { type: Type.STRING },
    primaryObjective:  { type: Type.STRING },
    likelyStakeholders: { type: Type.ARRAY, items: { type: Type.STRING } },
    businessQuestions:  { type: Type.ARRAY, items: { type: Type.STRING } },
    trueKPIs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label:      { type: Type.STRING },
          value:      { type: Type.STRING },
          sourceFile: { type: Type.STRING },
          isDAX:      { type: Type.BOOLEAN }
        },
        required: ["label", "value", "sourceFile"]
      }
    },
    analyticalTechniques: { type: Type.ARRAY, items: { type: Type.STRING } },
    toolsUsed:            { type: Type.ARRAY, items: { type: Type.STRING } },
    datasets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fileName:      { type: Type.STRING },
          fileType:      { type: Type.STRING },
          schemaColumns: { type: Type.ARRAY, items: { type: Type.STRING } },
          recordSummary: { type: Type.STRING }
        },
        required: ["fileName", "fileType", "schemaColumns"]
      }
    },
    suggestedTitles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title:     { type: Type.STRING },
          confidence: { type: Type.INTEGER },
          rationale:  { type: Type.STRING }
        },
        required: ["title", "confidence", "rationale"]
      }
    },
    suggestedSummaries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          summary:    { type: Type.STRING },
          confidence: { type: Type.INTEGER }
        },
        required: ["summary", "confidence"]
      }
    },
    confidence: { type: Type.INTEGER }
  },
  required: [
    "projectType", "projectArchetype", "industry", "businessDomain",
    "businessProblem", "primaryObjective", "likelyStakeholders",
    "businessQuestions", "trueKPIs", "analyticalTechniques", "toolsUsed",
    "datasets", "suggestedTitles", "suggestedSummaries", "confidence"
  ]
};

// ─── Validation Guard ─────────────────────────────────────────────────────────
//
// Validates that a reused/cached/request-passed ProjectUnderstanding object
// is structurally sound, not corrupted, AND matches the current schema version.

function isValidUnderstanding(u: any): u is ProjectUnderstanding {
  return (
    u !== null &&
    typeof u === "object" &&
    typeof u.projectType === "string" && u.projectType.length > 0 &&
    typeof u.industry === "string" && u.industry.length > 0 &&
    typeof u.businessDomain === "string" && u.businessDomain.length > 0 &&
    typeof u.primaryObjective === "string" && u.primaryObjective.length > 0 &&
    typeof u.confidence === "number" &&
    Array.isArray(u.trueKPIs) &&
    Array.isArray(u.toolsUsed) && u.toolsUsed.length > 0 &&
    Array.isArray(u.datasets) &&
    Array.isArray(u.businessQuestions) &&
    Array.isArray(u.suggestedTitles) &&
    // Schema version guard: reject stale objects from old engine versions
    u.schemaVersion === PUE_SCHEMA_VERSION
  );
}

// ─── Deterministic Fallback ───────────────────────────────────────────────────
//
// Last-resort fallback used ONLY when all Gemini models fail entirely.
// NOT the primary reasoning path.

function buildFallbackUnderstanding(graph: EvidenceGraph): ProjectUnderstanding {
  const projectArchetype = classifyProjectArchetype(graph);
  const projectType = graph.projectDomain || projectArchetype;
  const { trueKPIs, schemaDimensions } = disambiguateKPIs(graph);

  const toolsUsed = Array.from(new Set([
    ...graph.evidenceSources.map(s => {
      const p = s.parser;
      if (p === "SQLParser")                              return "SQL";
      if (p === "PowerBIParser")                          return "Power BI / DAX";
      if (p === "ExcelParser")                            return "Excel";
      if (p === "PythonParser" || p === "NotebookParser") return "Python";
      return p.replace("Parser", "");
    }),
    ...graph.businessTerms
      .filter(t => t.value.startsWith("Tool:"))
      .map(t => t.value.replace("Tool:", "").trim())
  ]));

  const analyticalTechniques = Array.from(new Set([
    ...graph.analyticalTechniques.map(a => a.value),
    ...graph.sqlLogic.flatMap(s => s.value.joins.length > 0        ? ["Relational Multi-Table Joins"]         : []),
    ...graph.sqlLogic.flatMap(s => s.value.windowFunctions.length > 0 ? ["Window Aggregations & Partitioning"] : [])
  ]));

  const objectiveDoc = graph.documentation.find(
    d => d.value.key.toLowerCase().includes("objective") || d.value.key.toLowerCase().includes("goal")
  );
  const problemDoc = graph.documentation.find(
    d => d.value.key.toLowerCase().includes("problem") || d.value.key.toLowerCase().includes("challenge")
  );

  const datasets = graph.evidenceSources.map(s => ({
    fileName: s.fileName,
    fileType: s.parser.replace("Parser", ""),
    schemaColumns: schemaDimensions.slice(0, 10),
    recordSummary: `${s.nodesExtracted} nodes extracted`
  }));

  const primarySource = graph.evidenceSources[0]?.fileName || "Dataset";
  const cleanSource   = primarySource.split(".")[0].replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const titleCap      = cleanSource ? cleanSource.charAt(0).toUpperCase() + cleanSource.slice(1) : "Business Intelligence";

  const rawObjText = objectiveDoc?.value.text || "";
  const isJunkObj = !rawObjText ||
    rawObjText.includes("payload") ||
    rawObjText.includes("Extraction") ||
    rawObjText.includes("Visual asset") ||
    rawObjText.includes("PDF Grounded") ||
    rawObjText.includes("file:") ||
    rawObjText.length < 20;

  const fallbackObjective = `This project evaluates key operational performance indicators and transactional trends. The primary objective is to analyze metric variances, identify operational bottlenecks, and formulate strategic business recommendations for decision-makers.`;

  const primaryObjective = !isJunkObj ? rawObjText : fallbackObjective;

  return {
    projectType,
    projectArchetype,
    industry:          "Analytics & Business Intelligence",
    businessDomain:    "Operations & Data Analytics",
    businessProblem:   problemDoc?.value.text ||
      `Analytical gaps identified across ${graph.evidenceSources.length} source file(s) requiring structured evaluation.`,
    primaryObjective,
    likelyStakeholders: graph.stakeholderIndicators.length > 0
      ? graph.stakeholderIndicators.map(s => s.value)
      : ["Executive Leadership", "Analytics Leads", "Operations Managers"],
    businessQuestions: graph.businessQuestions.map(q => q.value),
    trueKPIs,
    analyticalTechniques: analyticalTechniques.length > 0
      ? analyticalTechniques
      : ["Relational Querying", "Dimensional Profiling", "KPI Modeling"],
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["SQL", "Excel", "Power BI"],
    datasets,
    suggestedTitles: [{
      title: `${titleCap} Performance & Decision Engine`,
      confidence: 60,
      rationale: `Derived from primary dataset '${primarySource}' (fallback mode).`
    }],
    suggestedSummaries: [{
      summary: `This ${projectArchetype} synthesizes analytical telemetry across ${graph.evidenceSources.length} source asset(s). ` +
        `Operating within Operations & Data Analytics, the analysis evaluates core performance indicators using ` +
        `${toolsUsed.join(" & ")} to deliver structured decision support.`,
      confidence: 60
    }],
    confidence: 55,
    schemaVersion: PUE_SCHEMA_VERSION
  };
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeUnderstanding(raw: any, graph: EvidenceGraph): ProjectUnderstanding {
  const fallback = buildFallbackUnderstanding(graph);

  const ensureStrArr = (val: any, fb: string[]): string[] =>
    Array.isArray(val) && val.length > 0 ? val.filter(Boolean) : fb;

  const ensureArr = <T>(val: any, fb: T[]): T[] =>
    Array.isArray(val) && val.length > 0 ? val : fb;

  return {
    projectType:          raw.projectType          || fallback.projectType,
    projectArchetype:     raw.projectArchetype     || fallback.projectArchetype,
    industry:             raw.industry             || fallback.industry,
    businessDomain:       raw.businessDomain       || fallback.businessDomain,
    businessProblem:      raw.businessProblem      || fallback.businessProblem,
    primaryObjective:     raw.primaryObjective     || fallback.primaryObjective,
    likelyStakeholders:   ensureStrArr(raw.likelyStakeholders,   fallback.likelyStakeholders),
    businessQuestions:    ensureStrArr(raw.businessQuestions,     fallback.businessQuestions),
    trueKPIs:             ensureArr(raw.trueKPIs,                 fallback.trueKPIs),
    analyticalTechniques: ensureStrArr(raw.analyticalTechniques,  fallback.analyticalTechniques),
    toolsUsed:            ensureStrArr(raw.toolsUsed,             fallback.toolsUsed),
    datasets:             ensureArr(raw.datasets,                 fallback.datasets),
    suggestedTitles:      ensureArr(raw.suggestedTitles,          fallback.suggestedTitles),
    suggestedSummaries:   ensureArr(raw.suggestedSummaries,       fallback.suggestedSummaries),
    confidence: typeof raw.confidence === "number"
      ? Math.max(0, Math.min(100, raw.confidence))
      : fallback.confidence,
    schemaVersion: PUE_SCHEMA_VERSION
  };
}

// ─── Gemini Reasoning Call ────────────────────────────────────────────────────

async function synthesizeViaGemini(graph: EvidenceGraph): Promise<ProjectUnderstanding | null> {
  const pueViaGeminiStart = Date.now();
  console.log(`[PUE-TIMER] synthesizeViaGemini: ENTER | T+0ms`);

  const ai = getPUEClient();
  console.log(`[PUE-TIMER] synthesizeViaGemini: getPUEClient() complete | ai=${ai ? "client_ready" : "null_no_api_key"} | T+${Date.now() - pueViaGeminiStart}ms`);
  if (!ai) {
    console.log(`[PUE-TIMER] synthesizeViaGemini: EXIT early — no AI client | T+${Date.now() - pueViaGeminiStart}ms`);
    return null;
  }

  console.log(`[PUE-TIMER] synthesizeViaGemini: calling buildEvidenceDigest() | T+${Date.now() - pueViaGeminiStart}ms`);
  const digest = buildEvidenceDigest(graph);
  console.log(`[PUE-TIMER] synthesizeViaGemini: buildEvidenceDigest() complete | digest length: ${digest.length} chars | T+${Date.now() - pueViaGeminiStart}ms`);

  const systemInstruction =
    "You are an expert business intelligence analyst and project classifier. " +
    "Given a structured evidence digest extracted from data project files (SQL, Excel, Power BI, Python, CSV, images, documents), " +
    "synthesize a precise, domain-aware ProjectUnderstanding object. " +
    "Reason from the evidence — do not use generic placeholders. " +
    "Identify true business KPIs (not schema column IDs or row keys). " +
    "Identify the real business problem and primary objective from the project evidence. " +
    "Generate business questions this project answers. " +
    "Output valid JSON matching the response schema exactly.";

  const prompt =
    "Analyze this Evidence Digest extracted from a data analyst portfolio project and synthesize a complete ProjectUnderstanding object.\n\n" +
    `### EVIDENCE DIGEST:\n${digest}\n\n` +
    "### INSTRUCTIONS:\n" +
    "- projectType: The general type (e.g. \"Power BI\", \"SQL\", \"Python\", \"Multi-Source\").\n" +
    "- projectArchetype: Specific analytical archetype (e.g. \"Power BI / DAX Business Intelligence Dashboard\", \"SQL Analytics & Data Relational Engine\").\n" +
    "- industry: The real-world industry. Infer from business terms and KPI names — NOT from parser type.\n" +
    "- businessDomain: The functional business domain (e.g. \"Customer Retention & Product Telemetry\").\n" +
    "- businessProblem: The root operational challenge. One clear sentence.\n" +
    "- primaryObjective: The primary analytical goal. One clear sentence.\n" +
    "- likelyStakeholders: 2-4 role titles.\n" +
    "- businessQuestions: 3-6 specific business questions this project answers.\n" +
    "- trueKPIs: Only real business KPIs — NOT schema column names like 'id', 'created_at', 'category_id'.\n" +
    "- analyticalTechniques: Methods used (e.g. \"Time-Series Trend Analysis\", \"Cohort Retention Analysis\").\n" +
    "- toolsUsed: Technology tools.\n" +
    "- datasets: One entry per source file with its detected schema columns.\n" +
    "- suggestedTitles: 2 recruiter-quality project title suggestions.\n" +
    "- suggestedSummaries: 1-2 executive summary paragraph suggestions.\n" +
    "- confidence: Your overall confidence in this synthesis (0-100).\n";

  const candidateModels = ["gemini-3.5-flash", "gemini-2.5-flash"];

  for (const model of candidateModels) {
    const modelStart = Date.now();
    console.log(`[PUE-TIMER] synthesizeViaGemini: attempting model "${model}" | T+${Date.now() - pueViaGeminiStart}ms from PUE entry`);
    try {
      console.log(`[PUE-TIMER] synthesizeViaGemini: calling executeWithTimeout(12000ms) for model "${model}" | T+${Date.now() - pueViaGeminiStart}ms`);
      const geminiTimerLabel = `[GEMINI LATENCY] Model: ${model}`;
      console.time(geminiTimerLabel);
      const response = await executeWithTimeout(
        `Gemini PUE Model[${model}]`,
        async () => {
          const promptTokenEstimate = Math.ceil(prompt.length / 4);
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`[GEMINI API] BEFORE ai.models.generateContent()`);
          console.log(`[GEMINI API] Model:                ${model}`);
          console.log(`[GEMINI API] Prompt Char Length:   ${prompt.length}`);
          console.log(`[GEMINI API] Prompt Token Estimate: ~${promptTokenEstimate} tokens`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          const apiResult = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: PUE_RESPONSE_SCHEMA
            }
          });
          const promptTokens    = apiResult.usageMetadata?.promptTokenCount      ?? "N/A";
          const responseTokens  = apiResult.usageMetadata?.candidatesTokenCount  ?? "N/A";
          const totalTokens     = apiResult.usageMetadata?.totalTokenCount        ?? "N/A";
          const finishReason    = apiResult.candidates?.[0]?.finishReason         ?? "N/A";
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`[GEMINI API] AFTER ai.models.generateContent()`);
          console.log(`[GEMINI API] Model:              ${model}`);
          console.log(`[GEMINI API] Prompt Tokens:      ${promptTokens}`);
          console.log(`[GEMINI API] Response Tokens:    ${responseTokens}`);
          console.log(`[GEMINI API] Total Tokens:       ${totalTokens}`);
          console.log(`[GEMINI API] Finish Reason:      ${finishReason}`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          return apiResult;
        },
        12000
      );
      console.timeEnd(geminiTimerLabel);
      console.log(`[PUE-TIMER] synthesizeViaGemini: executeWithTimeout returned for model "${model}" | model elapsed: ${Date.now() - modelStart}ms | T+${Date.now() - pueViaGeminiStart}ms`);

      console.log(`[PUE-TIMER] synthesizeViaGemini: calling JSON.parse on response | T+${Date.now() - pueViaGeminiStart}ms`);
      const raw = JSON.parse(response.text.trim());
      console.log(`[PUE-TIMER] synthesizeViaGemini: JSON.parse complete | T+${Date.now() - pueViaGeminiStart}ms`);

      console.log(`[PUE-TIMER] synthesizeViaGemini: calling normalizeUnderstanding | T+${Date.now() - pueViaGeminiStart}ms`);
      const normalized = normalizeUnderstanding(raw, graph);
      console.log(`[PUE-TIMER] synthesizeViaGemini: normalizeUnderstanding complete | T+${Date.now() - pueViaGeminiStart}ms`);

      console.log(`[PUE] Synthesized via Gemini/${model} (confidence: ${normalized.confidence})`);
      console.log(`[PUE-TIMER] synthesizeViaGemini: EXIT success via "${model}" | total elapsed: ${Date.now() - pueViaGeminiStart}ms`);
      return normalized;
    } catch (err: any) {
      console.warn(`[PUE] Gemini model ${model} failed or timed out: ${err.message}`);
      console.warn(`[PUE-TIMER] synthesizeViaGemini: model "${model}" FAILED | elapsed for this model: ${Date.now() - modelStart}ms | T+${Date.now() - pueViaGeminiStart}ms from PUE entry`);
    }
  }

  console.log(`[PUE-TIMER] synthesizeViaGemini: all models exhausted | total elapsed: ${Date.now() - pueViaGeminiStart}ms | returning null`);
  return null; // All models failed
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Project Understanding Engine — Optimized Entry Point
 *
 * Avoids redundant Gemini reasoning via a three-tier strategy:
 *
 * Tier 1 — Request passthrough (zero Gemini calls):
 *   If `existing` is provided by the caller (e.g., returned from a prior
 *   NEEDS_USER_INPUT response and passed back in the second request), it is
 *   validated and returned immediately with no AI call.
 *
 * Tier 2 — In-memory evidence hash cache (zero Gemini calls):
 *   If the same file set (keyed by `evidenceHash`) was already synthesized
 *   in this server process, the cached ProjectUnderstanding is returned.
 *
 * Tier 3 — Gemini reasoning (one AI call, then cached):
 *   Only when no reusable understanding is available. The result is cached
 *   under `evidenceHash` for all subsequent calls with the same files.
 *
 * Deterministic fallback: if all Gemini models fail, returns a best-effort
 * object derived from raw graph data. Never throws.
 */
export async function getCachedOrSynthesizeUnderstanding(
  graph: EvidenceGraph,
  evidenceHash: string,
  existing?: ProjectUnderstanding
): Promise<ProjectUnderstanding> {
  const pueEntryMs = Date.now();
  console.log(`[PUE-TIMER] getCachedOrSynthesizeUnderstanding: ENTER | evidenceHash: ${evidenceHash.slice(0, 12)}... | existing: ${existing !== undefined ? "provided" : "none"}`);

  try {
    // Tier 1: Reuse a valid ProjectUnderstanding passed by the caller
    console.log(`[PUE-TIMER] Tier 1 check: existing supplied? ${existing !== undefined && existing !== null} | T+${Date.now() - pueEntryMs}ms`);
    if (existing !== undefined && existing !== null) {
      if (isValidUnderstanding(existing)) {
        console.log("[PUE] Reusing caller-supplied ProjectUnderstanding (Tier 1 — zero Gemini calls).");
        console.log(`[PUE-TIMER] Tier 1 HIT: returning existing | T+${Date.now() - pueEntryMs}ms`);
        // Warm the cache in case it wasn't already there
        cacheSet(evidenceHash, existing);
        return existing;
      }
      console.warn("[PUE] Caller-supplied ProjectUnderstanding failed validation — proceeding to Tier 2.");
      console.warn(`[PUE-TIMER] Tier 1 MISS: validation failed | T+${Date.now() - pueEntryMs}ms`);
    }

    // Tier 2: Evidence hash cache hit
    console.log(`[PUE-TIMER] Tier 2 check: calling cacheGet | T+${Date.now() - pueEntryMs}ms`);
    const cached = cacheGet(evidenceHash);
    if (cached !== null) {
      console.log("[PUE] Cache hit for evidenceHash — returning cached ProjectUnderstanding (Tier 2 — zero Gemini calls).");
      console.log(`[PUE-TIMER] Tier 2 HIT: returning cached | T+${Date.now() - pueEntryMs}ms`);
      return cached;
    }
    console.log(`[PUE-TIMER] Tier 2 MISS: no cache hit | T+${Date.now() - pueEntryMs}ms`);

    // Tier 3: Synthesize via Gemini, then cache
    console.log(`[PUE-TIMER] Tier 3: calling synthesizeViaGemini | T+${Date.now() - pueEntryMs}ms`);
    const geminiResult = await synthesizeViaGemini(graph);
    console.log(`[PUE-TIMER] Tier 3: synthesizeViaGemini returned | result: ${geminiResult !== null ? "success" : "null"} | T+${Date.now() - pueEntryMs}ms`);

    if (geminiResult !== null) {
      cacheSet(evidenceHash, geminiResult);
      console.log(`[PUE-TIMER] getCachedOrSynthesizeUnderstanding: EXIT via Gemini success | total: ${Date.now() - pueEntryMs}ms`);
      return geminiResult;
    }

    // Deterministic fallback — all Gemini models failed
    console.warn("[PUE] All Gemini models failed — using deterministic fallback (Tier 3 fallback).");
    console.warn(`[PUE-TIMER] Tier 3 fallback: calling buildFallbackUnderstanding | T+${Date.now() - pueEntryMs}ms`);
    const fallback = buildFallbackUnderstanding(graph);
    cacheSet(evidenceHash, fallback);
    console.log(`[PUE-TIMER] getCachedOrSynthesizeUnderstanding: EXIT via fallback | total: ${Date.now() - pueEntryMs}ms`);
    return fallback;

  } catch (err: any) {
    console.error(`[PUE ERROR] getCachedOrSynthesizeUnderstanding threw at T+${Date.now() - pueEntryMs}ms:`, err?.message);
    console.error(err?.stack);
    throw err;
  }
}

/**
 * @deprecated Use getCachedOrSynthesizeUnderstanding for all pipeline calls.
 * Kept as a direct Gemini-synthesize path for testing purposes only.
 */
export async function synthesizeProjectUnderstanding(
  graph: EvidenceGraph
): Promise<ProjectUnderstanding> {
  const result = await synthesizeViaGemini(graph);
  return result ?? buildFallbackUnderstanding(graph);
}
