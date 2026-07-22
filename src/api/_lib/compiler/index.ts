/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PARSER_REGISTRY, unpackZipFile } from "../parsers/registry";
import {
  ExtractedProject,
  ConflictRecord,
  UniversalCompilerOutput,
  ParserEvidenceNode,
  PipelineError
} from "../types/index";
import { validateFileSignature, computeSha256, executeWithTimeout } from "../utils/security";
import { mergeToEvidenceGraph, detectEvidenceConflicts } from "../evidence/graph";
import { compilePortfolioWithGemini, formatDebugAiContext } from "../ai/portfolioCompiler";
import {
  evaluateEvidenceCompleteness,
  generateMissingInformationRequests,
  mergeUserAnswersWithEvidence,
  classifyProjectArchetype,
  runRecruiterAuditEngine
} from "../ai/evidenceEvaluator";
import { getCachedOrSynthesizeUnderstanding } from "../ai/projectUnderstandingEngine";
import { ProjectUnderstanding } from "../types/index";
import crypto from "crypto";

// Helper to normalize strings for metric matching
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Stage 4: Validation Engine - Deterministic Conflict Detection
 */
export function validateAndDetectConflicts(projects: ExtractedProject[]): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

  if (projects.length <= 1) return conflicts;

  // Compare KPIs & Metrics (by similarity of labels across evidence sources)
  const metricGroups = new Map<string, Array<{ label: string; value: string; sourceFile: string; location?: string }>>();

  projects.forEach(p => {
    p.metrics.forEach(m => {
      const normLabel = normalizeLabel(m.label);
      if (normLabel) {
        if (!metricGroups.has(normLabel)) {
          metricGroups.set(normLabel, []);
        }
        metricGroups.get(normLabel)!.push({
          label: m.label,
          value: m.value,
          sourceFile: m.sourceFile,
          location: m.sourceLocation
        });
      }
    });
  });

  metricGroups.forEach((group, normLabel) => {
    if (group.length > 1) {
      const valuesMap = new Map<string, typeof group>();
      group.forEach(item => {
        const normVal = item.value.toLowerCase().trim();
        if (!valuesMap.has(normVal)) {
          valuesMap.set(normVal, []);
        }
        valuesMap.get(normVal)!.push(item);
      });

      if (valuesMap.size > 1) {
        const valuesList: ConflictRecord["values"] = [];
        valuesMap.forEach(vGroup => {
          const rep = vGroup[0];
          valuesList.push({
            value: rep.value,
            sourceFile: rep.sourceFile,
            location: rep.location
          });
        });

        conflicts.push({
          field: `Metric Discrepancy (${group[0].label})`,
          values: valuesList
        });
      }
    }
  });

  return conflicts;
}

/**
 * Stage 3: Normalization & Merge - Consolidation of multiple parsed outputs
 */
export function mergeExtractedProjects(projects: ExtractedProject[]): ExtractedProject {
  if (projects.length === 0) {
    return {
      title: "Consolidated Project Report",
      subtitle: "Multi-file structured analysis",
      summary: "",
      industry: "Uncategorized",
      role: "Analyst",
      duration: "Ongoing",
      date: new Date().toISOString().split("T")[0],
      tags: [],
      categories: [],
      objective: "",
      businessProblem: "",
      methodology: "",
      datasetDesc: "",
      dataCleaning: "",
      findings: "",
      recommendations: "",
      challengesText: "",
      lessonsLearned: "",
      metrics: [],
      storyBlocks: [],
      sourceFiles: []
    };
  }

  const base = projects[0];
  const merged: ExtractedProject = {
    ...base,
    tags: Array.from(new Set(projects.flatMap(p => p.tags))),
    categories: Array.from(new Set(projects.flatMap(p => p.categories))),
    metrics: projects.flatMap(p => p.metrics),
    storyBlocks: projects.flatMap(p => p.storyBlocks),
    sourceFiles: Array.from(new Set(projects.flatMap(p => p.sourceFiles)))
  };

  projects.slice(1).forEach(p => {
    if (p.objective && p.objective !== base.objective) merged.objective += "\n" + p.objective;
    if (p.businessProblem && p.businessProblem !== base.businessProblem) merged.businessProblem += "\n" + p.businessProblem;
    if (p.methodology && p.methodology !== base.methodology) merged.methodology += "\n" + p.methodology;
    if (p.datasetDesc && p.datasetDesc !== base.datasetDesc) merged.datasetDesc += "\n" + p.datasetDesc;
    if (p.dataCleaning && p.dataCleaning !== base.dataCleaning) merged.dataCleaning += "\n" + p.dataCleaning;
    if (p.findings && p.findings !== base.findings) merged.findings += "\n" + p.findings;
    if (p.recommendations && p.recommendations !== base.recommendations) merged.recommendations += "\n" + p.recommendations;
    if (p.challengesText && p.challengesText !== base.challengesText) merged.challengesText += "\n" + p.challengesText;
    if (p.lessonsLearned && p.lessonsLearned !== base.lessonsLearned) merged.lessonsLearned += "\n" + p.lessonsLearned;
  });

  return merged;
}

/**
 * AI Portfolio Compiler Main Entry Point
 * Flow: Raw Files -> Specialized Parsers -> Evidence Extraction -> Evidence Graph -> Gemini Reasoning Engine -> Structured Portfolio Project
 */
export async function compileProjectPackage(
  rawFiles: Array<{ name: string; size: number; type: string; content: string; storagePath?: string }>,
  userAnswers?: Record<string, string>,
  forceCompile?: boolean,
  existingUnderstanding?: ProjectUnderstanding
): Promise<UniversalCompilerOutput> {
  const pipelineStartTime = Date.now();
  let projectType = "Mixed Analytics";

  // Quotas
  const MAX_RAW_FILES = 50;
  if (rawFiles.length > MAX_RAW_FILES) {
    throw new Error(`Package exceeds maximum file limit (${MAX_RAW_FILES} files). Please reduce file count.`);
  }

  // Stage 1: File Detection, SHA-256 Checksums, Signature Validation & ZIP Unpacking
  const stage1Start = Date.now();
  const allFiles: Array<{ name: string; content: string; type: "text" | "binary"; size: number; sha256: string }> = [];
  const fileCoverage: UniversalCompilerOutput["fileCoverage"] = [];

  for (const file of rawFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const fileHash = computeSha256(file.content);

    // Validate binary signature (magic bytes)
    const sigCheck = validateFileSignature(file.name, file.content);
    if (!sigCheck.isValid) {
      fileCoverage.push({
        fileName: file.name,
        status: "Failed",
        reason: sigCheck.error || "Magic byte file signature mismatch.",
        size: file.size,
        sha256: fileHash
      });
      continue;
    }

    if (ext === "zip") {
      projectType = "ZIP Package";
      const unpacked = await unpackZipFile(file.content);
      unpacked.forEach(u => {
        const uHash = computeSha256(u.content);
        allFiles.push({
          name: u.name,
          content: u.content,
          type: u.type,
          size: Buffer.byteLength(u.content, u.type === "binary" ? "base64" : "utf-8"),
          sha256: uHash
        });
      });
      fileCoverage.push({
        fileName: file.name,
        status: "Used",
        reason: `Unpacked ZIP package archive containing ${unpacked.length} analytics files. Signature verified.`,
        size: file.size,
        sha256: fileHash
      });
    } else {
      const isText = ["py", "sql", "dax", "md", "txt", "csv", "json"].includes(ext);
      allFiles.push({
        name: file.name,
        content: file.content,
        type: isText ? "text" : "binary",
        size: file.size,
        sha256: fileHash
      });
    }
  }
  const stage1Duration = Date.now() - stage1Start;

  // Stage 2: Sandboxed Parser Selection & Evidence Extraction
  const stage2Start = Date.now();
  const parsedProjects: ExtractedProject[] = [];
  const evidenceNodes: ParserEvidenceNode[] = [];

  for (const file of allFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const parser = PARSER_REGISTRY[ext];

    if (parser) {
      try {
        const pStart = Date.now();
        // Sandboxed execution with 15 second threshold
        const result = await executeWithTimeout(
          `Parser[${parser.name}] for '${file.name}'`,
          () => parser.parse(file.name, file.content, file.type),
          15000
        );
        parsedProjects.push(result.project);
        evidenceNodes.push(result.evidenceNode);

        fileCoverage.push({
          fileName: file.name,
          status: "Used",
          reason: `Parsed via specialized Vercel-native ${parser.name} in ${Date.now() - pStart}ms. SHA-256 verified.`,
          size: file.size,
          sha256: file.sha256
        });
      } catch (err: any) {
        console.error(`Sandboxed parser failure for '${file.name}':`, err.message);
        fileCoverage.push({
          fileName: file.name,
          status: "Failed",
          reason: `Isolated parser error: ${err.message || "Unknown execution error"}`,
          size: file.size,
          sha256: file.sha256
        });
      }
    } else {
      fileCoverage.push({
        fileName: file.name,
        status: "Ignored",
        reason: `Format extension (.${ext}) skipped automatically by parser router registry.`,
        size: file.size,
        sha256: file.sha256
      });
    }
  }
  const stage2Duration = Date.now() - stage2Start;

  if (parsedProjects.length === 1 && projectType !== "ZIP Package") {
    const ext = rawFiles[0].name.split(".").pop()?.toLowerCase() || "";
    if (ext === "xlsx" || ext === "xls") projectType = "Excel Analytics";
    else if (ext === "sql") projectType = "SQL Analytics";
    else if (ext === "py") projectType = "Python";
    else if (ext === "ipynb") projectType = "Python";
    else if (ext === "pbix" || ext === "dax") projectType = "Power BI";
  }

  // Stage 3: Build Canonical Evidence Graph
  const stage3Start = Date.now();
  let evidenceGraph: any;
  try {
    evidenceGraph = mergeToEvidenceGraph(evidenceNodes);
    evidenceGraph.projectDomain = projectType;
  } catch (err: any) {
    throw new PipelineError("Evidence Graph", `Failed to construct evidence graph: ${err.message}`, err.name || "EvidenceGraphError", err);
  }
  const stage3Duration = Date.now() - stage3Start;

  // Stage 4: Project Understanding Engine
  const stage4Start = Date.now();
  const packageEvidenceHash = crypto.createHash("sha256")
    .update(allFiles.map(f => f.sha256).sort().join(":"))
    .digest("hex");

  const projectUnderstanding = await getCachedOrSynthesizeUnderstanding(
    evidenceGraph,
    packageEvidenceHash,
    existingUnderstanding
  );
  const stage4Duration = Date.now() - stage4Start;

  const projectArchetype = projectUnderstanding.projectArchetype || classifyProjectArchetype(evidenceGraph);

  // Stage 5: Evidence Completeness Evaluator & Conflicts
  const stage5Start = Date.now();
  const coverageReport = evaluateEvidenceCompleteness(evidenceGraph, userAnswers, projectUnderstanding);
  const { mergedAnswersContext, answerConflicts } = mergeUserAnswersWithEvidence(evidenceGraph, userAnswers);

  const conflicts = [
    ...validateAndDetectConflicts(parsedProjects),
    ...detectEvidenceConflicts(evidenceGraph),
    ...answerConflicts
  ];
  const stage5Duration = Date.now() - stage5Start;

  // Stage 6: Decision Logic: Evaluate Completeness Thresholds
  const requiredScores = [
    coverageReport.executiveSummary,
    coverageReport.businessObjective,
    coverageReport.businessProblem,
    coverageReport.stakeholders,
    coverageReport.methodology,
    coverageReport.kpis,
    coverageReport.recommendations,
    coverageReport.businessImpact,
    coverageReport.interviewStory
  ];
  const isFullySufficient = requiredScores.every(score => score >= 80);

  if (!forceCompile && (!userAnswers || Object.keys(userAnswers).length === 0) && !isFullySufficient) {
    const missingInformation = generateMissingInformationRequests(coverageReport, evidenceGraph, projectUnderstanding);
    if (missingInformation.length > 0) {
      const rawProject = mergeExtractedProjects(parsedProjects);
      console.log(`[Timing Profile] Stage 1 (Prep): ${stage1Duration}ms | Stage 2 (Parsers): ${stage2Duration}ms | Stage 3 (Graph): ${stage3Duration}ms | Stage 4 (PUE): ${stage4Duration}ms | Total (NEEDS_INPUT): ${Date.now() - pipelineStartTime}ms`);
      return {
        status: "NEEDS_USER_INPUT",
        projectType,
        projectArchetype,
        projectUnderstanding,
        rawProject: {
          ...rawProject,
          sourceFiles: Array.from(new Set(allFiles.map(f => f.name)))
        },
        coverageReport,
        missingInformation,
        conflicts,
        fileCoverage,
        evidenceGraph
      };
    }
  }

  const rawProject = mergeExtractedProjects(parsedProjects);

  // Stage 8: AI Portfolio Compiler
  const stage8Start = Date.now();
  const synthesized = await compilePortfolioWithGemini(
    evidenceGraph,
    conflicts,
    rawProject,
    mergedAnswersContext,
    projectArchetype,
    projectUnderstanding
  );
  const stage8Duration = Date.now() - stage8Start;

  // Stage 9: Recruiter Audit Engine
  const stage9Start = Date.now();
  const recruiterAudit = runRecruiterAuditEngine(synthesized.structured, evidenceGraph, conflicts, projectUnderstanding);
  const stage9Duration = Date.now() - stage9Start;

  const totalDuration = Date.now() - pipelineStartTime;

  console.log(`\n==========================================================`);
  console.log(`[PIPELINE TIMING PROFILE] Total Duration: ${totalDuration}ms`);
  console.log(`[PIPELINE TIMING PROFILE] Stage 1 (File Prep & Unpack): ${stage1Duration}ms`);
  console.log(`[PIPELINE TIMING PROFILE] Stage 2 (Sandboxed Parsers): ${stage2Duration}ms`);
  console.log(`[PIPELINE TIMING PROFILE] Stage 3 (Evidence Graph): ${stage3Duration}ms`);
  console.log(`[PIPELINE TIMING PROFILE] Stage 4 (Project Understanding): ${stage4Duration}ms`);
  console.log(`[PIPELINE TIMING PROFILE] Stage 5 (Completeness & Conflicts): ${stage5Duration}ms`);
  console.log(`[PIPELINE TIMING PROFILE] Stage 8 (Gemini Synthesis): ${stage8Duration}ms`);
  console.log(`[PIPELINE TIMING PROFILE] Stage 9 (Recruiter Audit Engine): ${stage9Duration}ms`);
  console.log(`==========================================================\n`);

  // packageEvidenceHash already computed at Stage 4 — reused here for auditMetadata.

  // Construct source attributions and confidence map
  const sourceAttributions: Record<string, string[]> = {};
  const confidenceScores: Record<string, number> = {};

  if (synthesized.structured) {
    confidenceScores.title = synthesized.structured.title.confidence;
    confidenceScores.summary = synthesized.structured.executiveSummary.confidence;
    confidenceScores.businessContext = synthesized.structured.businessContext.confidence;
    confidenceScores.businessProblem = synthesized.structured.businessProblem.confidence;
    confidenceScores.businessImpact = synthesized.structured.businessImpact.confidence;
    confidenceScores.methodology = synthesized.structured.methodology.confidence;
    confidenceScores.analyticalTechniques = synthesized.structured.analyticalTechniques.confidence;
    confidenceScores.findings = synthesized.structured.findings.confidence;
    confidenceScores.recommendations = synthesized.structured.recommendations.confidence;

    sourceAttributions.title = synthesized.structured.title.evidence.map(e => e.sourceFile);
    sourceAttributions.summary = synthesized.structured.executiveSummary.evidence.map(e => e.sourceFile);
    sourceAttributions.businessContext = synthesized.structured.businessContext.evidence.map(e => e.sourceFile);
    sourceAttributions.businessProblem = synthesized.structured.businessProblem.evidence.map(e => e.sourceFile);
    sourceAttributions.businessImpact = synthesized.structured.businessImpact.evidence.map(e => e.sourceFile);
    sourceAttributions.methodology = synthesized.structured.methodology.evidence.map(e => e.sourceFile);
    sourceAttributions.analyticalTechniques = synthesized.structured.analyticalTechniques.evidence.map(e => e.sourceFile);
    sourceAttributions.findings = synthesized.structured.findings.evidence.map(e => e.sourceFile);
    sourceAttributions.recommendations = synthesized.structured.recommendations.evidence.map(e => e.sourceFile);
  }

  return {
    status: "COMPLETE",
    projectType,
    projectArchetype,
    projectUnderstanding,
    rawProject: {
      ...synthesized.raw,
      sourceFiles: Array.from(new Set(allFiles.map(f => f.name)))
    },
    coverageReport,
    recruiterAudit,
    evidenceGraph,
    portfolioProject: synthesized.structured,
    conflicts,
    fileCoverage,
    confidenceScores,
    sourceAttributions,
    starStory: synthesized.structured.starStory.value,
    resumeBullets: synthesized.structured.resumeBullets.value,
    linkedInSummary: synthesized.structured.linkedInSummary.value,
    auditMetadata: {
      importTimestamp: new Date().toISOString(),
      parserVersions: "Portfolio OS AI Intelligence Engine v4.1 (PUE-Cached + Evidence Intelligence + Recruiter Audit + Gemini)",
      evidenceHash: packageEvidenceHash,
      projectVersion: "v4.1",
      totalFilesProcessed: allFiles.length,
      debugAiContext: formatDebugAiContext(evidenceGraph, conflicts)
    }
  };
}

export async function parseUploadedPackage(
  fileName: string,
  buffer: Buffer,
  userAnswers?: Record<string, string>,
  forceCompile?: boolean,
  existingUnderstanding?: ProjectUnderstanding
): Promise<UniversalCompilerOutput> {
  return compileProjectPackage(
    [{
      name: fileName,
      size: buffer.length,
      type: "binary",
      content: buffer.toString("base64")
    }],
    userAnswers,
    forceCompile,
    existingUnderstanding
  );
}

export async function compileSourceCodeToProject(
  fileName: string,
  sourceCode: string,
  userAnswers?: Record<string, string>,
  forceCompile?: boolean,
  existingUnderstanding?: ProjectUnderstanding
): Promise<UniversalCompilerOutput> {
  return compileProjectPackage(
    [{
      name: fileName,
      size: Buffer.byteLength(sourceCode),
      type: "text",
      content: sourceCode
    }],
    userAnswers,
    forceCompile,
    existingUnderstanding
  );
}
